# Web Build (openhistoria.com)

This is the web build — the **only** edition of Open Historia, served from the trusted central origin (openhistoria.com / the `/play/` site). It runs the **entire game client unchanged** with **zero server process**: a `window.fetch` interceptor answers every same-origin `/api/*` call out of IndexedDB, heavy map tiles stream from the registry Worker's CORS+range proxy (or a hash-verified community content-node swarm), and optional magic-link/Google accounts sync your games as client-side-encrypted blobs. Everything in this page lives under `src/runtime/web/` and is gated behind `import.meta.env.VITE_OH_WEB`. There is no desktop Electron app and no Android APK variant anymore — those were removed in the web-only refactor.

See also: [Web runtime](web-runtime.md) (boot/lifecycle/onboarding), [World state](world-state.md), [Assets & data](assets-and-data.md), [Runtime services](runtime-services.md), [Conventions](conventions.md).

---

## 1. How it boots and how it is gated

The whole web backend is behind one Vite mode flag. `.env.web` sets `VITE_OH_WEB=1`, and that file is loaded **only** by `vite build --mode web` — which is now the **only** build mode. `VITE_OH_WEB` compiles to the literal `1`, so Rollup keeps every `if (import.meta.env.VITE_OH_WEB)` branch and the dynamic imports it guards in the bundle (the old framing was that these branches were tree-shaken away in a non-web desktop/Android build; those branches have been removed in the web-only refactor, so there is nothing left to strip).

| Step | Location | What happens |
|---|---|---|
| Gate | `src/main.jsx:28` | `if (import.meta.env.VITE_OH_WEB)` dynamically `import("./runtime/web/index.js")`, calls `installWebBackend()`, then `mount()`s the React app. Non-web builds just `mount()`. |
| Entry | `src/runtime/web/index.js` | `installWebBackend()` — seed → install interceptor → accounts/sync → home page. |
| Content fetch | `src/runtime/assets.js:855` | For pmtiles, dynamically imports `web/contentTrust.js` and tries `fetchVerifiedBuffer(url)` (node swarm) before the origin. |

`installWebBackend()` (`src/runtime/web/index.js`) runs, in order:

1. `await ensureSeeded()` — write the default scenario into IndexedDB before any `/api` call (`libraryStore.js`).
2. `installWebApiRouter()` — monkey-patch `window.fetch` (`router.js`).
3. If the URL carries `?magic=<token>`, `redeemMagicToken()` then race a `syncNow()` (12 s cap) **before first render** so a signed-in user's games are already present, then strip the token from the URL with `history.replaceState`.
4. `initAccountWidget()` — the corner sign-in/sync chip (`accountWidget.js`).
5. If `shouldShowHome()` (not yet "entered" this tab session) → `showHomePage()`; otherwise `connectBestNode()` in the background.

Build scripts (`package.json`, run via **bun**):

| Script | Command |
|---|---|
| `bun run build:web` | seeds web defaults → `vite build --mode web --outDir dist-web --emptyOutDir` |
| `bun run build:site` | same, but `--base /play/` + `scripts/assemble-site.mjs` → `dist-site/` (landing page at `/`, game at `/play/`). **This is the script Vercel runs** on every merge to `main` (see `vercel.json`: `installCommand: "bun install"`, `buildCommand: "bun run build:site"`). |

`scripts/seed-web-defaults.mjs` regenerates `src/runtime/web/generated/defaultScenario.js` (auto-generated; the default scenario's meta + colors + base64 cover) so the seed is baked into the bundle. Seed generation + the vite build both run under Node via bun; Vercel detects bun from `package.json`'s `"packageManager": "bun@1.3.14"`.

---

## 2. Configuration (`.env.web`)

Every URL points at the **registry Worker** (`open-historia-registry.nichojkrol.workers.dev`), which is the one piece of always-on server infrastructure.

| Var | Value / default | Purpose | Read in |
|---|---|---|---|
| `VITE_OH_WEB` | `1` | Master flag; gates all web-mode code + dynamic imports. | `main.jsx`, `assets.js`, `libraryBar.jsx`, `settings.jsx` |
| `VITE_OH_PMTILES_URL` | Worker `/content` | CORS+range proxy for the 60–100 MB pmtiles (a static-site host like Vercel can't serve files that large). Also the base for `default-regions.geojson`. Falls back to `/assets` (local dev). | `router.js:55`, `libraryStore.js:325` |
| `VITE_OH_DIRECTORY_URL` | Worker `/node-directory.json` | The **signed** live node directory (updates as nodes are accepted/paused/banned). | `contentTrust.js:17` |
| `VITE_OH_HUB_URL` | Worker root | Community-hub GitHub proxy (`/hub/*`), because GitHub attachments send no CORS. | `router.js:109` |
| `VITE_OH_ACCOUNT_URL` | Worker root | Accounts (`/account/*`) + encrypted sync (`/sync/*`). | `account.js:11` |
| `VITE_OH_GOOGLE_CLIENT_ID` | Google OAuth client id | Public client id for "Sign in with Google". Empty ⇒ Google button hidden (accounts effectively disabled). | `account.js:77` |
| `VITE_OH_MANIFEST_URL` | *(unset)* → `/content-manifest.json` | Signed asset→hash manifest; ships with the build, same-origin default. | `contentTrust.js:18` |

---

## 3. The fake backend: the `/api` fetch interceptor (`router.js`)

There is no Express server. `installWebApiRouter()` (`router.js:138`) replaces `window.fetch` once (`installed` guard). The wrapper:

- Resolves the request URL against `location.href`. **Only** same-origin requests whose path starts with `/api/` are intercepted; everything else (AI providers, GitHub API, ESRI tiles, static assets, Google Identity, node URLs) passes straight to the saved `originalFetch`.
- Builds a real `Request`, dispatches to `route(request, url)`, and returns a real `Response` — so all the existing client code (`src/runtime/library.js`, `src/runtime/assets.js`, `documentIO.js`, `basemapLibrary.js`) runs **unchanged**.
- On throw: `SyntaxError` (bad JSON body) → `400`, anything else → `500`.

> **Important boundary:** only `window.fetch` is patched. `<img src>`, `<link>`, XHR, `EventSource`, and PMTiles' own range reads that don't go through `fetch` all **bypass** the interceptor. This is exactly why cover images are embedded as `data:` URLs (see §6) rather than served as `/api/...` paths.

### `route()` dispatch

`route()` (`router.js:38`) splits the path into `["api", domain, ...segments]` and dispatches on `domain`. Each handler returns a `Response` or `null` (fall through).

| `domain` (+ path shape) | Handler | Store file |
|---|---|---|
| `runtime/pmtiles/<key>` | inline (scenario override → else proxy) | `libraryStore.getScenarioPmtilesOverride` |
| `runtime/json/<key>` | `handleRuntimeJson` | `libraryStore.js:1110` |
| `mapeditor/*` | `handleMapEditor` | `editorStore.js` |
| `basemaps/*` | `handleBasemaps` | `basemapStore.js` |
| `flags/*` | `handleFlags` | `flagStore.js` |
| `library` | `handleLibrary` | `libraryStore.js:1036` |
| `scenarios/*` | `handleScenarios` | `libraryStore.js:1042` |
| `games/*` | `handleGames` | `libraryStore.js:1076` |
| `ui-settings/*` | `handleUiSettings` | `settingsStore.js:82` |
| `lang/*` | `handleLang` | `settingsStore.js:44` |
| `hub/*` | inline proxy → Worker / node | (see below) |
| *(anything else)* | `errorResponse("Unknown web-mode endpoint", 404)` | `util.js` |

### Body handling (`readBody`, `router.js:20`)

- `GET`/`HEAD` → no body.
- **Asset uploads** (`isAssetUpload`: `scenarios`|`games` + an `assets` segment + `PUT`) are forced to **raw bytes** regardless of `Content-Type`, because colors/geojson arrive as `application/json` but must be stored **verbatim** (round-tripping them through `JSON.parse`/`JSON.stringify` would re-format and bloat them).
- Otherwise: `application/json` → `JSON.parse`; everything else → raw `Uint8Array`.

### The two branches that are *not* pure IndexedDB

- **`runtime/pmtiles/<key>`** (`router.js:51`): first ask `getScenarioPmtilesOverride(key, range)` (a scenario may carry its own pmtiles in IndexedDB); otherwise proxy `${VITE_OH_PMTILES_URL||/assets}/<key>.pmtiles` with the incoming `Range`/method.
- **`hub/*`** (`router.js:108`): forward to `${VITE_OH_HUB_URL}/hub/<segments>`. For a bundle download (`hub/file?url=…`, GET) it **prefers the connected content node** (`getConnected()` → `node.url/oh/v1/hub`) to offload the central proxy, falling back to the Worker. `POST`s (import counters) attach `Authorization: Bearer <session>` when signed in so imports dedup by **account** instead of by IP.

---

## 4. IndexedDB layer (`idb.js`)

A dependency-free promise wrapper. Database `open-historia-web`, `DB_VERSION = 2`. Adding a store means bumping the version; `onupgradeneeded` creates only what is missing (additive — nobody's data is touched). An `onversionchange` handler closes this connection when another tab opens a newer version, so a second tab's upgrade isn't blocked.

| Store (`STORES`) | keyPath | Contents |
|---|---|---|
| `scenarios` | `id` | one record per scenario (meta + json + assets) |
| `games` | `id` | one record per game |
| `mapeditorDocs` | `id` | map-editor documents |
| `basemapMeta` | `id` | basemap metadata |
| `basemapPayload` | `id` | basemap binary payloads |
| `flags` | `id` | flag records |
| `kv` | `key` | small singletons (manifests, ui-settings, `seeded`, sync versions, account session/DEK) |

Helpers: `idbGet`, `idbGetAll`, `idbPut`, `idbDelete`, `idbUpdate` (read-modify-write one record), and kv-specific `kvGet(key, fallback)`, `kvPut`, `kvUpdate`. `runTx` resolves on transaction **commit** (via `oncomplete`), not merely on request success, so writes are durable before a caller reads back.

---

## 5. The library store (`libraryStore.js`) — the heart of the fake backend

The scenarios/games/runtime store, backed by IndexedDB. Backs `/api/library`, `/api/scenarios*`, `/api/games*`, `/api/runtime/json*`, `/api/runtime/pmtiles*`. (It was originally framed as a browser port of the deleted `server/libraryStore.js`; that Express store is gone, and this is now the only implementation.)

### Record shapes (all live in one IndexedDB record)

```
scenario:  { id, meta, json:{actions,advisor,chat,events,game,prompts,world},
             colors?, flags?, geojson:{regionsGeojson,citiesGeojson,backgroundData},
             pmtiles:{cities,countries,regions}, cover?:{contentType,bytes} }
game:      { id, meta, json:{…7…}, colors?, flags?, snapshots?, cover?:{contentType,bytes} }
```

A web record holds `world`/`game`/`colors`/`geojson` together in one object, so owner migration is **synchronous and in-place** — there are no separate files to keep in step (the deleted Express store used to split a scenario across many files on disk; this design collapses them).

### Manifests (in `kv`)

| kv key | Shape | Meaning |
|---|---|---|
| `scenario-manifest` | `{ order[], selectedScenarioId }` | scenario order + which is selected |
| `game-manifest` | `{ activeGameId, order[] }` | game order + which is active |
| `seeded` | `boolean` | one-time seed flag |

### Catalog composition

- `getLibraryCatalog()` (`:245`) is what `/api/library` returns: `{ activeGame, activeGameId, activeScenarioId, countryNames, games, runtimeScenario, scenarios, selectedScenario, selectedScenarioId, token }`. `token` is a cache key combining the active game's + runtime scenario's `updatedAt`.
- `getScenarioCatalog()` / `getGameCatalog()` compose per-item summaries (spread `readScenarioMeta`/`readGameMeta`, `assetStatus`, `cacheToken = ${id}-${updatedAt}`, `coverImageUrl`, usage counts). Order comes from `resolveOrderedIds` (manifest order, then extras, default id unshifted first).
- A game summary also carries `country`, `currentDate`, `round`, `eventCount`, `pendingActions` (non-`resolved` actions), `scenarioName`, `scenarioAccentColor`, and both `coverImageUrl` (own → falls back to its scenario's) and `ownCoverImageUrl`.

### Runtime JSON read/write (what the running game hits every turn)

`readRuntimeJsonAsset(key)` (`:416`) resolves an asset by precedence: **active game record → active runtime scenario → fallback default**. Special cases:

- `SCENARIO_GEOJSON_ASSET_KEYS` (`regionsGeojson`/`citiesGeojson`/`backgroundData`) come from the scenario; a scenario without its own `regionsGeojson` **borrows Modern Day's** (migrated as *default's* record, since those owners live in default's owner-space).
- The default scenario's `regionsGeojson` (~12 MB) is **not** in the seed — `fetchDefaultRegionsGeojson()` (`:327`) pulls `${VITE_OH_PMTILES_URL}/default-regions.geojson` once per session (never pinning an empty/failed result, so a transient miss retries). Without it the political map renders blank.
- `colors` falls back to the immutable app palette (`generated/fallbackColors.js`), **not** the mutable default-scenario colors.

`writeRuntimeJsonAsset(key, value)` (`:481`) writes onto the active game (auto-creating one from the selected scenario if none exists), canonicalizing country refs on the way in: `world`→`canonicalizeWorldCountryRefs`, `game`→`canonicalizeGameCountry`, `colors`→`canonicalizeColorKeys`. `flags` are **not** canonicalized (a flag key is always the raw code the editor painted).

### Owner-schema migration (`ensureOwnerSchema`, `:357`)

Rewrites a record whose owners are GADM codes into one keyed by country **names**. It *imports* `src/runtime/shared/ownerMigration.js` (pure ESM, so Vite bundles it) rather than re-implementing it — one resolver, no drift. (That module was relocated from the deleted `server/ownerMigration.js`; its test is `src/runtime/shared/ownerMigration.test.js`.) Runs lazily on read, once per `kind:id` (`migratedRecords` set), and discards roll-back `snapshots` (they predate the rename and are blind-written back with no staleness marker).

### Export / import bundles

- `exportScenarioBundle(id, mode)` (`:858`) — `mode:"light"` drops pmtiles overrides; `"full"` embeds them base64. Schema `pax-historia-scenario-bundle/2`.
- `importScenarioBundle` / `updateScenarioFromBundle` accept any schema in `ACCEPTED_BUNDLE_SCHEMAS` (v1 + v2). Note the **JSON-descriptor gotcha** (`:915`): `colors`/`flags`/`tags` descriptors carry the **object itself** in `descriptor.data`, not base64 — passing them through `base64ToBytes` (as geojson/pmtiles do) made `atob` throw and broke import of every flag/tag-carrying preset (e.g. WWII).
- Hub provenance (`hubOrigin = { postId, bundleUrl, syncedAt }`) is stamped **last** and survives only when a write explicitly carries it — any other meta write forks the copy and stops offering hub updates.

### Seeding (`ensureSeeded`, `:1024`)

If the `seeded` kv flag is unset and no `default` scenario exists, write `defaultScenarioSeedRecord()` (built from `generated/defaultScenario.js`: meta, colors, base64 cover) and add it to the manifest. Idempotent.

---

## 6. Cover images — and why the web build embeds them as `data:` URLs

`COVER_IMAGE_ASSET_KEY = "cover"`; a cover is stored on the record as `{ contentType, bytes:Uint8Array }`. The **displayed** cover in a catalog summary is a **base64 `data:` URL** via `coverDataUrl(record.cover)` (`libraryStore.js:60`, used at `:181`, `:222`, `:229`).

**Why:** the library UI renders the cover in an `<img src>`. The `<img>` load does **not** pass through the patched `window.fetch` interceptor (see §3's boundary note), so a `/api/scenarios/:id/assets/cover` `src` would hit the network and 404 to the SPA fallback instead of ever reaching the interceptor. Embedding the bytes as a `data:<contentType>;base64,…` URL makes the image render with **zero network round-trip**, straight from the IndexedDB record. (The interceptor *does* still serve a direct `GET /api/scenarios/:id/assets/cover` — `scenarioAssetResponse`, `:817` — for code paths that go through `fetch`, e.g. export; it's only the `<img>` display path that needs the data URL.)

Cover uploads/removals (`uploadScenarioAsset`/`uploadGameAsset`, `:783`/`:838`) validate the content-type against `SUPPORTED_IMAGE_CONTENT_TYPES` (avif/gif/jpeg/png/webp) and mirror the bytes + `coverImageContentType` meta.

---

## 7. Store models & country resolution (`models.js`)

The constants and pure helpers for the web store (asset-key sets, `resolveOwnerRef`, the meta readers). These were originally a browser mirror of the deleted `server/libraryStore.js`; that Express store is gone, and `models.js` is now the only implementation of these constants.

### Asset-key sets

| Set | Members |
|---|---|
| `STORAGE_JSON_ASSET_KEYS` | `actions, advisor, chat, events` |
| `CORE_JSON_ASSET_KEYS` | `game, prompts, world` |
| `OPTIONAL_JSON_ASSET_KEYS` | `colors, flags, tags` |
| `PMTILES_ASSET_KEYS` | `cities, countries, regions` |
| `SCENARIO_GEOJSON_ASSET_KEYS` | `regionsGeojson, citiesGeojson, backgroundData` |
| `UPLOADABLE_SCENARIO_ASSET_KEYS` | `cover` + optional + pmtiles + geojson |
| `UPLOADABLE_GAME_ASSET_KEYS` | `cover` only |

`SCENARIO_BUNDLE_SCHEMA = "pax-historia-scenario-bundle/2"` — the **only** compatibility gate on a file strangers swap; the schema string moves with the owner rename so an old build can't silently mis-resolve a name-keyed bundle.

### `resolveOwnerRef(value, world)` (`:87`)

Resolves an owner token to its canonical **name**. Precedence:

1. A `polityOverrides[value]` marked `verbatim` (a human-named polity whose text collides with a GADM code like "USA") → honored literally.
2. Any polity whose `name`/`aliases`/key matches (case-insensitive), skipping self-named entries so `{MNG:{name:"MNG"}}` doesn't pin `MNG` forever.
3. `COUNTRY_NAME_REGISTRY[value]` (legacy code or alias → name).
4. Otherwise the raw value.

`canonicalizeWorldCountryRefs` / `canonicalizeGameCountry` / `canonicalizeColorKeys` apply it across `regionOwnershipOverrides`, `ownerCodes`, `polityOverrides` (rekeyed by name, `.code` dropped), `units`, `countryTags`, `internationalReputation`, and color/game country fields. `readScenarioMeta`/`readGameMeta` apply defaults + normalize `coverImageContentType`, `hubOrigin`, `playCount`, `lastPlayedAt`.

---

## 8. Heavy content: PMTiles, the node swarm, and the trust model

Heavy map tiles never touch IndexedDB by default; they stream from the network. Integrity comes from **hashes and signatures, never from trusting a node**.

### The fetch path (`assets.js` → `contentTrust.js`)

`assets.js:855` (web only): for a pmtiles URL, try `fetchVerifiedBuffer(url)` first; on any miss/failure fall through to the origin (via `router.js`'s pmtiles proxy branch → the Worker). A node outage is therefore invisible.

`fetchVerifiedBuffer(url)` (`contentTrust.js:122`):

1. Map the URL to a content-manifest asset id (`countries.pmtiles`, etc.).
2. Load the **signed** content manifest (asset→`{sha256,bytes}`) and the active node list.
3. For each candidate node (connected node first, then a per-asset rotation): `GET <node>/oh/v1/content/<sha256>`, reject on wrong byte length, **recompute SHA-256 and compare** — a tampered node is skipped with a warning.
4. Return the verified `ArrayBuffer`, or `null` so the caller uses the canonical origin.

### Node directory: signed control doc + live addresses

`loadDirectoryNodes()` (`contentTrust.js:88`) combines two sources:
- The **signed** directory (`VITE_OH_DIRECTORY_URL`) — an auto-accept **deny-list / control doc**: nodes marked `banned`/`paused` are excluded and rate-limit/cap overrides applied.
- The **unsigned** live list (`nodes-live.json`, same origin) — actual current URLs (`{id,url,status}`), so a node restarting on a new URL needs no admin re-sign.

Because every byte is hash-verified, an un-vetted node can at worst be useless; a bad actor is removed by an admin ban published to the signed directory.

### Signature verification (`trust.js` + `trust/pinned-key.js`)

`fetchSignedJson(url)` (`trust.js:41`) fetches `url` and `url.sig`, verifies the **detached Ed25519 signature over the exact served bytes** against the pinned root key(s), and enforces `keyid` + `expires`. Returns `{valid, data, reason}`; any of unsigned / bad-signature / expired / keyid-unknown ⇒ `valid:false` and the client simply **doesn't use nodes** and falls back to the origin — a broken trust chain degrades safely.

- `verifyDetached` uses `@noble/ed25519`.
- `PINNED_ROOT_KEYS` (`trust/pinned-key.js`) — currently one key `oh-root-1` — is compiled into both the client and the node software; the private key is offline. Rotation = ship both keys for one release, then drop the old one.

### Connecting to a node (`nodeConnect.js`)

`connectBestNode()` (`:89`) probes every directory node's `/oh/v1/status` (4 s timeout), picks reachable + `active` + not `full` with the **lowest latency**, and makes content fetches prefer it (`setPreferredNode`).

| Endpoint | Method | Purpose |
|---|---|---|
| `/oh/v1/status` | GET | probe: liveness, region, user counts, `full` |
| `/oh/v1/ping` | GET | count toward the node's live user tally; heartbeat health check |
| `/oh/v1/leave` | GET (keepalive, `pagehide`) | drop out of the node's player count immediately |
| `/oh/v1/content/<sha256>` | GET | fetch a hash-addressed content blob |
| `/oh/v1/hub?url=…` | GET | node-served community bundle download |

A 20 s heartbeat re-selects a node if the current one goes draining/full/unreachable. `reportPresence(nodeId)` (`account.js:48`) tells the **registry** (not the node) which node a **signed-in** player is on so the admin panel can show connectivity — a node itself never learns a player's identity; signed-out players report nothing.

---

## 9. Home / connect screen (`homePage.js`)

A full-screen parchment/Roman overlay injected over the already-mounted game on first entry per tab session (`sessionStorage["oh:entered"]`). Pure DOM (no React), scoped under `.oh-home`. It auto-connects the best node and renders live stats.

| Control | Behavior |
|---|---|
| Connection panel | "Finding the nearest node…" → connected node card (**anonymous node id only**, region, latency, `players/max` bar) or "Connected via the origin" fallback. Fed by `connectBestNode()` → `renderConnection`. |
| Account section | Google sign-in button (via Google Identity Services), or "Signed in as …" + Sign out. Hidden if `!accountConfigured()` or no `googleClientId()`. |
| **⚔ Enter Open Historia** | `enter()` — sets the `oh:entered` flag and removes the overlay. |
| Footer links | GitHub, Discord, Host a node. |

---

## 10. Accounts + end-to-end-encrypted sync

Optional, web-only. The registry Worker only ever stores **ciphertext** and the wrapped data key — it never sees plaintext saves.

### `account.js` — identity + client crypto

- **Session** lives in `kv` (`account:session`) so it survives reloads; email in `account:email`; the raw 32-byte **DEK** cached in memory + `kv` (`account:dek`), **never uploaded** in the clear.
- Sign-in: magic link (`requestMagicLink` → email; `redeemMagicToken` from `?magic=`) or Google (`signInWithGoogle` hands the GIS credential to `/account/google`). Both establish a session then `ensureDek(session, hasKey)`.
- `ensureDek`: existing account → pull the DEK from `/account/key`; first sign-in ever → generate `crypto.getRandomValues(32)` and register it. The Worker stores it wrapped under (a) the **offline admin master key** (recovery) and (b) a Worker secret (cross-device delivery).
- **Crypto:** `encryptRecord`/`decryptRecord` are AES-256-GCM to/from `base64(iv‖ciphertext)`. `encodeRecord`/`decodeRecord` preserve binary fields (`Uint8Array`/`ArrayBuffer` → `{__u8:base64}`) so a full record with cover/pmtiles bytes round-trips through JSON.
- **Fingerprint:** `recordFingerprint` hashes a `syncHashView` that **excludes** `lastPlayedAt`/`playCount` (`VOLATILE_META_FIELDS`) — merely *opening* a game bumps those, and hashing them would re-upload heavy blobs for a stat tick nobody edited. The ciphertext still encodes the full record, so stats ride along on the next genuine edit.

### `sync.js` — the reconciliation engine

Full-scan model (compare local SHA-256 vs last-synced version), so no write can be missed. **v1 scope = games + scenarios + their catalog manifests** (map-editor docs and basemaps wait for R2). Each record → one blob (`games:<id>`, `scenarios:<id>`, `kv:<manifest>`).

- `syncNow()` (`:128`) runs `pull` then `push`, persisting `sync:versions` (`{blob_id:{version,sha?,deleted?}}`, device-local, never synced). Emits `oh:sync` events (`syncing`/`ok`/`error`) — but only flashes "Syncing…" once **real** work starts, so an empty 20 s poll doesn't look like a phantom upload.
- `pull`: apply any newer sync blob than the known version (decrypt → `idbPut`/`kvPut`), or tombstone deletions. A single bad blob is caught per-item so it can't red-line the whole sync. (The "server" here is the registry Worker's `/sync/*` endpoints — the only always-on backend, storing ciphertext only.)
- `push`: upload locally-changed records (`sha` differs); on **409 conflict** it's **last-writer-wins = take the Worker's copy**; `413` = too large (waits for R2); then tombstone records gone locally.
- `startSync()` runs `syncNow` immediately, every 20 s, and on tab `visibilitychange`→hidden.

### Transport endpoints (session-authed, `Bearer <session>`)

| Endpoint | Method | Returns |
|---|---|---|
| `/account/request` | POST | send magic link (`{ok, devLink?}`) |
| `/account/verify` | POST | `{email, session, hasKey}` |
| `/account/google` | POST | `{email, session, hasKey}` |
| `/account/key` | GET / POST | fetch / register the DEK |
| `/account/presence` | POST | report `{nodeId}` (admin visibility) |
| `/sync/manifest` | GET | `[{blob_id, version, deleted}]` |
| `/sync/blob?id=` | GET | `{ciphertext, sha256, version, deleted}` |
| `/sync/blob?id=` | PUT | `200 {version}` \| `409 {conflict,current}` \| `413` |
| `/sync/blob?id=` | DELETE | tombstone |

### `accountWidget.js` — the corner chip

A fixed top-right sign-in/sync control (DOM, not React). A colored dot shows sync state (idle/ok=green/syncing=amber/error=red); the panel offers Google sign-in when signed out, or **Sync now** / **Sign out** when signed in. Listens for `oh:sync` (status) and `oh:auth` (start/stop `startSync`) events.

---

## 11. Secondary stores (brief)

The interceptor also answers these through the same `ctx` handler pattern (return `Response` or `null`):

| Domain | Handler | Notes |
|---|---|---|
| `mapeditor/*` | `handleMapEditor` (`editorStore.js`) | map-editor documents in the `mapeditorDocs` store |
| `basemaps/*` | `handleBasemaps` (`basemapStore.js`) | basemap meta + payload (two stores) |
| `flags/*` | `handleFlags` (`flagStore.js`) | flag records |
| `ui-settings/*` | `handleUiSettings` (`settingsStore.js:82`) | UI settings persisted in `kv` |
| `lang/*` | `handleLang` (`settingsStore.js:44`) | language packs: IndexedDB overrides merged over the static `/lang/*.json` Vite copies to the site |

---

## 12. Architecture notes (the web build's shape)

There is no server build to compare against anymore. For reference, the web build's shape is:

| Aspect | Web build |
|---|---|
| Backend | a `window.fetch` interceptor (`router.js`) answers same-origin `/api/*` from IndexedDB; there is no server process |
| Persistence | one IndexedDB record per item (`idb.js`, `open-historia-web` database) |
| Record layout | `world`/`game`/`colors`/`geojson`/`cover` all live in **one** record |
| Owner migration | synchronous and in-place (records are single-object); **imports** `src/runtime/shared/ownerMigration.js` (relocated from the deleted `server/`) |
| Cover image URL | base64 `data:` URL (bypasses the fetch interceptor for `<img>`) — see §6 |
| PMTiles hosting | registry Worker CORS+range proxy + hash-verified content-node swarm; the default `regions.geojson` is fetched from the content origin on demand, not seeded |
| Default scenario | seeded from `generated/defaultScenario.js`; big geometry fetched on demand |
| Accounts / sync | optional magic-link/Google + AES-256-GCM E2E sync through the registry Worker (`account.js`/`sync.js`); the Worker stores ciphertext only |
| Community bundle download | proxied via the Worker `/hub/file` or a connected content node (CORS, since GitHub attachments send no CORS) |
| Gating | the whole `src/runtime/web/**` tree is behind `VITE_OH_WEB`; since `--mode web` is the only build mode, it's always in the bundle |

---

### File index

| File | Role |
|---|---|
| `src/runtime/web/index.js` | boot entry (`installWebBackend`) |
| `src/runtime/web/router.js` | `/api` fetch interceptor + dispatch |
| `src/runtime/web/idb.js` | IndexedDB primitives + `STORES` |
| `src/runtime/web/libraryStore.js` | scenarios/games/runtime store + handlers |
| `src/runtime/web/models.js` | constants, `resolveOwnerRef`, meta readers |
| `src/runtime/web/util.js` | response builders, base64, SHA-256, range serving |
| `src/runtime/web/account.js` | session, DEK, AES-GCM, sync transport |
| `src/runtime/web/sync.js` | pull/push reconciliation engine |
| `src/runtime/web/accountWidget.js` | corner sign-in/sync chip |
| `src/runtime/web/homePage.js` | entry/connect overlay |
| `src/runtime/web/contentTrust.js` | verified node-swarm content fetch |
| `src/runtime/web/trust.js` | Ed25519 signed-manifest verification |
| `src/runtime/web/nodeConnect.js` | node selection + heartbeat + presence |
| `src/runtime/web/settingsStore.js` | ui-settings + language handlers |
| `src/runtime/web/basemapStore.js` / `flagStore.js` / `editorStore.js` | secondary store handlers |
| `src/runtime/web/trust/pinned-key.js` | pinned root public key(s) |
| `.env.web` | web-mode build config |
