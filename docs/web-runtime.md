# Web Runtime (the in-browser backend)

The web build has no server process. Instead, before React mounts, a small runtime under `src/runtime/web/` monkey-patches `window.fetch` so every same-origin `/api/*` call the client makes is answered from IndexedDB. The client code (`library.js`, `assets.js`, editor IO, basemap library) is byte-identical to what the deleted desktop/Android variants ran — it just calls `fetch("/api/…")` and gets a `Response` back.

This page documents that in-browser backend. For the build pipeline, accounts, sync, and the content-node trust chain that ship alongside it, see [web-build.md](web-build.md).

---

## 1. What it replaces

Historically the project shipped an Express server (`server/server.js`) that answered every `/api/*` route — backed by on-disk JSON and binary files under `server/data/`, a CSRF/CORS security layer, an AI relay, and a hub proxy. The web-only refactor deleted that whole `server/` directory (and the desktop Electron app and the Android/Capacitor bundle with it).

The web build now ships a **browser fetch-interceptor** that answers the same `/api/*` contract out of IndexedDB-backed store handlers. Nothing about the contract changed: the request shapes, response envelopes, range semantics, and bundle schemas are byte-faithful to the deleted server so exported data stays compatible. The difference is purely where the answer comes from — a `Response` built in the browser instead of an HTTP reply from `localhost:3000`.

---

## 2. How the interceptor is installed

The whole web backend is gated on the compile-time flag `VITE_OH_WEB` (set by `.env.web`, loaded only for `vite build --mode web`). The one place it is read at boot is the fork in `src/main.jsx`.

| Step | Location | What happens |
|---|---|---|
| Fork | `src/main.jsx` (boot) | `if (import.meta.env.VITE_OH_WEB)` dynamically `import("./runtime/web/index.js")`, calls `installWebBackend()`, and **only then** `mount()`s the React app. Non-web builds just `mount()`. The dynamic import means the desktop branch never even references `src/runtime/web/*`. |
| Entry | `src/runtime/web/index.js:15` | `installWebBackend()`: seed → install interceptor → accounts/sync → home page. |
| Install | `src/runtime/web/router.js:138` | `installWebApiRouter()` replaces `window.fetch` once (an `installed` guard). |

`installWebBackend()` (`src/runtime/web/index.js`) runs, in order:

1. `await ensureSeeded()` — write the default scenario into IndexedDB **before** any `/api` call (`libraryStore.js`).
2. `installWebApiRouter()` — monkey-patch `window.fetch` (`router.js`).
3. If the URL carries `?magic=<token>`, `redeemMagicToken()` then race a `syncNow()` (12 s cap) before first render so a signed-in user's games are already present, then strip the token with `history.replaceState`.
4. `initAccountWidget()` — the corner sign-in/sync chip.
5. `shouldShowHome()` → `showHomePage()` on first entry per tab session; otherwise `connectBestNode()` in the background.

Because the interceptor is installed before `mount()`, no client request can escape uninstalled — the first `/api/library` call from the startup preload already hits the patched `fetch`. See the boot-fork section of [architecture.md](architecture.md).

---

## 3. The router

`installWebApiRouter()` (`router.js:138`) saves the real `window.fetch` as `originalFetch`, then replaces `window.fetch` with a wrapper that:

- Resolves the request URL against `window.location.href`.
- **Only** intercepts requests where `url.origin === window.location.origin && url.pathname.startsWith("/api/")` (`router.js:153`). Everything else — AI providers, GitHub API, ESRI tiles, static assets, Google Identity, content-node URLs — passes straight to `originalFetch`.
- Builds a real `Request`, dispatches to `route(request, url)`, and returns a real `Response`, so all existing client code runs unchanged.
- On throw: `SyntaxError` (bad JSON body) → `400`, anything else → `500` — mirroring the deleted Express server's body-parser behavior (`router.js:160`).

> **Boundary:** only `window.fetch` is patched. `<img src>`, `<link>`, XHR, `EventSource`, and PMTiles' own range reads that don't go through `fetch` all **bypass** the interceptor. This is why cover images are embedded as `data:` URLs rather than served as `/api/.../assets/cover` paths (see [web-build.md](web-build.md) §6).

### `route()` dispatch

`route()` (`router.js:38`) splits the path into `["api", domain, ...segments]` and dispatches on `domain`. Each handler returns a `Response` or `null` (fall through).

| `domain` (+ path shape) | Handler | Store file |
|---|---|---|
| `runtime/pmtiles/<key>` | inline (scenario override → else proxy to `VITE_OH_PMTILES_URL`) | `libraryStore.getScenarioPmtilesOverride` (`libraryStore.js:1062`) |
| `runtime/json/<key>` | `handleRuntimeJson` | `libraryStore.js:1177` |
| `mapeditor/*` | `handleMapEditor` | `editorStore.js` |
| `basemaps/*` | `handleBasemaps` | `basemapStore.js` |
| `flags/*` | `handleFlags` | `flagStore.js` |
| `library` | `handleLibrary` | `libraryStore.js:1103` |
| `scenarios/*` | `handleScenarios` | `libraryStore.js:1109` |
| `games/*` | `handleGames` | `libraryStore.js:1143` |
| `ui-settings/*` | `handleUiSettings` | `settingsStore.js:83` |
| `lang/*` | `handleLang` | `settingsStore.js:45` |
| `hub/*` | inline proxy → registry Worker / connected content node | (see below) |
| *(anything else)* | `errorResponse("Unknown web-mode endpoint", 404)` | `util.js` |

The surface this table covers is the same `/api` contract the architecture page documents — see [architecture.md](architecture.md) for the data-flow view (runtime JSON/PMTiles endpoints, library/scenario/game mutations, write side).

### Body handling (`readBody`, `router.js:20`)

- `GET`/`HEAD` → no body.
- **Asset uploads** (`isAssetUpload`: `scenarios`|`games` + an `assets` segment + `PUT`) are forced to **raw bytes** regardless of `Content-Type`, because colors/geojson arrive as `application/json` but must be stored **verbatim** — the deleted server's `express.raw` did the same.
- Otherwise: `application/json` → `JSON.parse`; everything else → raw `Uint8Array`.

### The two branches that are *not* pure IndexedDB

- **`runtime/pmtiles/<key>`** (`router.js:51`): first ask `getScenarioPmtilesOverride(key, range)` (a scenario may carry its own pmtiles in IndexedDB); otherwise proxy `${VITE_OH_PMTILES_URL||/assets}/<key>.pmtiles` with the incoming `Range`/method. The hosted site points the env var at the registry Worker's CORS+range proxy (Vite/`dist-site/` doesn't host the 60–100 MB pmtiles itself).
- **`hub/*`** (`router.js:108`): forward to `${VITE_OH_HUB_URL}/hub/<segments>`. For a bundle download (`hub/file?url=…`, GET) it **prefers the connected content node** (`getConnected()` → `node.url/oh/v1/hub`) to offload the central proxy, falling back to the Worker. `POST`s (import counters) attach `Authorization: Bearer <session>` when signed in so imports dedup by **account** instead of by IP.

---

## 4. The stores

Every handler reads and writes through a small set of store modules under `src/runtime/web/`, each backed by IndexedDB object stores via `idb.js` (database `open-historia-web`, additive versioned upgrades). Deep-dive on the record shapes, manifests, catalog composition, runtime read/write, owner migration, and export/import bundles lives in [web-build.md](web-build.md) §4–§7; the role of each store is:

| Store | Role |
|---|---|
| `libraryStore.js` | The heart. Backs `/api/library`, `/api/scenarios*`, `/api/games*`, `/api/runtime/json*`, `/api/runtime/pmtiles*`. One IndexedDB record per scenario (meta + 7 JSON assets + colors/flags/geojson/pmtiles/cover) and per game (meta + JSON assets + colors/flags/snapshots/cover). Persists to the `scenarios` and `games` object stores. |
| `mapEditorStore.js` (`editorStore.js` handler) | Map-editor documents — `?editor=1` author maps. Persists to `mapeditorDocs`. |
| `basemapStore.js` | Basemap metadata + binary payloads (two stores: `basemapMeta`, `basemapPayload`) for uploaded custom backgrounds. |
| `flagStore.js` | "My flags" records — user-painted flag images keyed by owner code. Persists to `flags`. |
| `settingsStore.js` | UI settings (`/api/ui-settings`) in `kv` and language packs (`/api/lang/:code`) — ships merged **under** the AI-generated IndexedDB overlay, fetched from `/lang/*.json` that Vite copies to the site. |
| `account.js` / `sync.js` | Optional web-only accounts + E2E-encrypted sync; session/DEK cached in `kv`. (See [web-build.md](web-build.md) §10.) |

### `util.js` — byte-compatible response builders

`util.js` is the browser port of the helpers the deleted Express server had inline. It produces byte-compatible ids, hashes, and response envelopes so exported data and community-dedup hashes stay stable:

- `normalizeId(value, prefix, maxLen)` — slug form for library ids; pass `maxLen=48` for the map editor. Mirrors the server's historical `normalizeId`.
- `sha256Hex(str)` — SHA-256 of a string via `crypto.subtle`, used so `basemapLibrary.sha256Hex` / `flagStore`'s `hashPayload` dedup stays consistent with the deleted server's hashing.
- `binaryResponse(bytes, contentType, rangeHeader)` — serves a `Uint8Array`/`ArrayBuffer` as a `Response` with full HTTP Range support (`Accept-Ranges`, `206`/`Content-Range`, suffix ranges, `416` unsatisfiable) so the PMTiles protocol and any `<img>`/range consumer behaves exactly as it did against the deleted server's `streamBinaryFile` + `parseByteRange`.
- `jsonResponse` / `errorResponse` — JSON response envelopes with `Cache-Control: no-store`.
- `base64ToBytes` / `bytesToBase64` / `parseJsonValue` / `serializeJsonValue` — base64 + JSON helpers for bundle round-trips and for reading colors/geojson that may be stored as raw uploaded text.

Because `util.js` matches the deleted server byte-for-byte, a bundle exported from the web build imports on a self-hosted local install and vice versa.

---

## 5. Shared modules (relocated)

A handful of modules that used to live under `server/` were promoted out of it during the refactor because both the web runtime and the content-node tooling need them. The web build imports only the first; the others are referenced by `tools/content-node/` tooling, not by the browser bundle.

| Module | Now lives at | Used by |
|---|---|---|
| `ownerMigration.js` | `src/runtime/shared/ownerMigration.js` (pure ESM, + test) | web `libraryStore.js` (`ensureOwnerSchema`, `libraryStore.js:416`) and the Editor's document migration. Vite bundles it into the web build — one resolver, no drift. |
| `country-names.json` | `data/country-names.json` | shipped into the `COUNTRY_NAME_REGISTRY` the web runtime resolves owners against. |
| `trust.js`, `node.js` | `tools/content-node/` | content-node server + signing tooling (not bundled into the web build; the web build verifies signatures via `src/runtime/web/trust.js` + `trust/pinned-key.js` instead). |
| scenario seed `default` | `data/scenarios/default` | baked into `src/runtime/web/generated/defaultScenario.js` by `scripts/seed-web-defaults.mjs` at build time. |

`ensureOwnerSchema` rewrites a record whose owners are GADM codes into one keyed by country **names**. Unlike the deleted server (which had to keep multiple on-disk files in step), the web build does this **synchronously and in-place**: a web record holds `world`/`game`/`colors`/`flags`/`tags`/`geojson` together, so there are no sibling files to reconcile. Runs lazily on read, once per `kind:id`. See [web-build.md](web-build.md) §5 for the full record-shape and migration discussion.

---

## 6. AI: no relay on the web build

The deleted Express server exposed `POST /api/ai/relay` so a self-hosted local install could defeat browser CORS when calling a player's own OpenAI-compatible endpoint (Ollama, LM Studio) from `localhost`. **The web build does not run a relay.** There is no `/api/ai/relay` handler in `router.js` — the route is simply absent from the dispatch table in §3.

On `openhistoria.com`, AI calls go **browser → provider direct**: the request leaves the page straight to the configured OpenAI-compatible endpoint (or to Google Gemini / Anthropic directly), passing through the interceptor untouched because it is not same-origin `/api/*`. Most commercial providers send permissive CORS headers; a local backend does not, which is the one operational difference.

If you self-host Open Historia locally and want the relay back, you must run your **own** relay — the `/api/ai/relay` code path still exists in `src/Game/AI/main.jsx` but is gated behind `PAGE_IS_LOCAL = isLocallyServed()` and only fires when the page is served from a local server that itself answers `/api/ai/relay`. On the hosted website `isLocallyServed()` is false and the path is never taken.

For a local Ollama/LM Studio backend used with the hosted site, configure the provider to allow the site's origin (e.g. `OLLAMA_ORIGINS=https://openhistoria.com`) so the browser's direct cross-origin call is accepted. See [ai-overview.md](ai-overview.md) for the transport-internals view and provider configuration.

---

## 7. See also

- [web-build.md](web-build.md) — how the web build boots and is gated, the `.env.web` configuration, the IndexedDB layer (`idb.js`), the library store record shapes / owner migration / export-import, cover-image data-URL behavior, the node swarm + trust chain, and accounts + E2E sync.
- [architecture.md](architecture.md) — tech stack, the boot fork, the `/api` surface from the data-flow side, frontend ↔ backend write path.
- [ai-overview.md](ai-overview.md) — supported AI providers, where the key goes (direct calls vs origin vs the dormant relay path), transport internals per provider.
- [assets-and-data.md](assets-and-data.md) — the asset catalog, PMTiles resolution order, and the `map-data` GitHub Release the pmtiles branch proxies.
- [runtime-services.md](runtime-services.md) — the client-side library / scenario / game / i18n services that issue the `/api/*` calls this runtime answers.
