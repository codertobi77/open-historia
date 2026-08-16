# Map Data & Assets

Open Historia paints the world from a handful of heavy, mostly-static binaries (three PMTiles vector archives, two GeoJSON seed/geometry files) plus small per-scenario JSON documents (colors, flags, tags, world state). This page traces where each asset physically lives (app bundle vs. the `map-data` GitHub Release vs. the signed content-node swarm), how the web build resolves a scenario override on top of the shared default (a `window.fetch` interceptor routes every same-origin `/api/*` call to IndexedDB-backed store handlers, with heavy tiles proxied from the content origin), and how the browser client (`src/runtime/assets.js`) caches, warms, primes, and memoizes everything without OOMing the tab. The single load-bearing rule: the big binaries are **never** in Git — they are downloaded on demand from a GitHub Release named `map-data`, checksum-verified, and streamed to the web client from the content origin.

---

## 1. Asset catalog

Every runtime asset the map depends on, with its physical filename, MIME, and how it reaches the browser.

| Asset | Key | File on disk | Source of truth | Served to client via | Notes |
|---|---|---|---|---|---|
| Regions vector tiles | `regions` | `regions.pmtiles` (~105.8 MB) | `map-data` Release | `GET /api/runtime/pmtiles/regions` | GADM level-1 borders; the z0 tile is the region catalog; paints owners above z6.5 |
| Countries vector tiles | `countries` | `countries.pmtiles` (~62.7 MB) | `map-data` Release | `GET /api/runtime/pmtiles/countries` | z0 tile is the country index + label source; warmed on **every** map |
| Cities vector tiles | `cities` | `cities.pmtiles` (~1.5 MB) | `map-data` Release | `GET /api/runtime/pmtiles/cities` | Modern-day city labels layer |
| Custom regions geometry | `regionsGeojson` | `regions.geojson` (per-scenario) | IndexedDB record (scenario), else `default` scenario | `GET /api/runtime/json/regionsGeojson` | Editor-drawn shapes; `EMPTY_FEATURE_COLLECTION` when absent; **never cached client-side** |
| Custom cities geometry | `citiesGeojson` | `cities.geojson` (per-scenario) | IndexedDB record (scenario) | `GET /api/runtime/json/citiesGeojson` | Era-accurate city points; rendered when `world.customCities`; **never cached client-side** |
| Region seed | — | `regions-seed.geojson` (~55.3 MB) | `map-data` Release | `GET /assets/regions-seed.geojson` (or `VITE_OH_PMTILES_URL`) | Offline-produced seed the **map editor** imports; not a runtime map layer |
| City seed | — | `cities-seed.json` (~7.9 MB) | `map-data` Release | `GET /assets/cities-seed.json` (or `VITE_OH_PMTILES_URL`) | Consumed by the editor (`citiesImport.js`) and AI prompt context (`promptContext.js`) |
| Nation colors | `colors` | `colors.json` (~3.4 KB) | IndexedDB record (scenario), else app palette | `GET /api/runtime/json/colors` | Owner-name → hex; falls back to immutable `public/assets/colors.json` |
| Nation flags | `flags` | `flags.json` (per-scenario) | IndexedDB record (scenario) | `GET /api/runtime/json/flags` | Owner code → PNG data URL; `{}` when absent |
| Nation tags | `tags` | `tags.json` (per-scenario) | IndexedDB record (scenario) | `GET /api/runtime/json/tags` | Owner code → `string[]`; **starting** tags only (merge with `world.countryTags`) |
| Map background | `backgroundData` | `background.json` (per-scenario) | IndexedDB record (scenario) | `GET /api/runtime/json/backgroundData` | Heavy `{dataUrl}`/`{geojson}` payload; loaded only when `world.background` set |
| World state | `world` | `world.json` (per-game/scenario) | IndexedDB record (game), else scenario | `GET /api/runtime/json/world` | The live simulation document — see [World state](world-state.md) |
| Runtime game JSON | `game`, `events`, `chat`, `actions`, `advisor`, `prompts`, `snapshots` | (per-game, in the game record) | IndexedDB record (game) | `GET/PUT /api/runtime/json/<key>` | Per-game session state; polled ~5s |

The client-side URL and PMTiles-archive tables are declared in `src/runtime/assets.js:63` (`JSON_URLS`) and `src/runtime/assets.js:122` (`PMTILES_ARCHIVES` / `PMTILES_PROTOCOL_URLS`). The asset-key sets that govern which keys are JSON vs. PMTiles vs. optional — `STORAGE_JSON_ASSET_KEYS`, `PMTILES_ASSET_KEYS`, `SCENARIO_GEOJSON_ASSET_KEYS`, `OPTIONAL_JSON_ASSET_KEYS`, and the seed/fallback defaults — live in `src/runtime/web/models.js` (the surviving constants moved out of the deleted `server/libraryStore.js`).

**Basemap raster** (satellite/streets/terrain imagery) is *not* one of these files — it streams live from public ESRI/ArcGIS Online and AWS terrain tile servers (§8), so it is not part of the `map-data` Release.

---

## 2. Where assets come from

On the web build there is no `OH_DATA_DIR` and no disk — an asset is resolved from up to four places, all browser-side or content-origin-side. Which one wins depends on whether the active scenario ships an override.

| Source | What lives there | When it wins |
|---|---|---|
| **IndexedDB record** (`open-historia-web` database, `src/runtime/web/idb.js`) | Per-scenario overrides (pmtiles/geojson/colors/flags/tags/cover), per-game state (`world`/`game`/`events`/…), the seeded `default` scenario, UI settings, language overrides | Always, for every same-origin `/api/runtime/json/*` and `/api/scenarios/:id/assets/*` call — the `window.fetch` interceptor (`src/runtime/web/router.js`) answers it directly |
| **`map-data` GitHub Release** | Canonical, checksum-pinned copies of every heavy binary (the three pmtiles + the seed geojson/json + the default scenario's `regions.geojson`) | The source of truth for the heavy map tiles; mirrored to content nodes | 
| **Registry Worker CORS+range proxy + content-node swarm** (`VITE_OH_PMTILES_URL`, `src/runtime/web/contentTrust.js`) | Byte-identical pmtiles + `default-regions.geojson`, served over HTTP range requests, hash-verified against the signed content manifest | When the interceptor handles `/api/runtime/pmtiles/<key>` and there is no per-scenario override — it proxies to the content origin; the client's `warmPmtilesArchive` prefers a connected content node, falling through to the Worker |
| **App bundle** (`public/assets/`, copied into the built site) | Small immutable fallbacks: `colors.json` (the app palette), and the editor seeds (`regions-seed.geojson`, `cities-seed.json`) for the map-editor import flows | Only as a fallback for `colors`, and as the served path for editor seeds |

### PMTiles resolution order (web build)

For `/api/runtime/pmtiles/<key>` the interceptor (`src/runtime/web/router.js`) resolves in this order:

1. **Scenario override** — `getScenarioPmtilesOverride(key, range)` returns bytes uploaded into the scenario's IndexedDB record.
2. **Content origin** — proxy `${VITE_OH_PMTILES_URL || "/assets"}/<key>.pmtiles` to the registry Worker / content-node swarm, with the incoming `Range`/method.

Because step 1 can serve different bytes after a scenario switch, the client rotates its PMTiles caches on token change (§6) — a correctness fix, not just memory hygiene. `warmPmtilesArchive` (`assets.js:855`) additionally tries the hash-verified node swarm first (`contentTrust.js`) before falling through to the origin, so a bad node can at worst force a retry and never delivers tampered bytes.

### JSON resolution order (web build)

`readRuntimeJsonAsset(assetKey)` in `src/runtime/web/libraryStore.js` resolves per asset key:

- **Custom geometry** (`regionsGeojson`/`citiesGeojson`, in `SCENARIO_GEOJSON_ASSET_KEYS`): resolved from the active game's scenario record in IndexedDB. A non-default scenario with no `regions.geojson` of its own **borrows the `default` scenario's** Modern-Day geometry (the default scenario record owns those owner names); missing entirely → `EMPTY_FEATURE_COLLECTION`.
- **Per-game state** (`world`, `events`, `game`, `colors`, `flags`, `tags`, `snapshots`, …): active game record first, then the selected scenario record.
- **Optional JSON fallback**: only `colors` has a built-in fallback — the immutable app palette resolved from `public/assets/colors.json` (`generated/fallbackColors.js` in the bundle). `flags`/`tags` with no field → `{}`.
- Otherwise → the default for the asset key, or `{}`.

The default scenario's ~12 MB `regions.geojson` is **not** in the IndexedDB seed; `fetchDefaultRegionsGeojson()` pulls `${VITE_OH_PMTILES_URL}/default-regions.geojson` once per session, never pinning an empty/failed result, so a transient miss retries. Without it the political map renders blank.

---

## 3. The `map-data` GitHub Release + manifest

The heavy binaries used to live in Git LFS; the org's free LFS *bandwidth* is 1 GB/month shared, and a full checkout pulls ~200 MB, so a few installs exhausted it and every subsequent download 403'd. They now ship as **assets on a GitHub Release** (`Open-Historia/open-historia`, tag `map-data`), whose download bandwidth is free and unmetered. See `scripts/fetch-map-assets.mjs:1` for the full rationale.

### `scripts/map-assets.json`

The manifest that `fetch-map-assets.mjs` reads. Note the **name/namespace split**: `path` is the *stable client location* the game serves from; `asset` is the *versioned release filename* uploaded to GitHub.

| `path` (stable client name) | `asset` (release name) | bytes | Why the names differ |
|---|---|---|---|
| `public/assets/regions.pmtiles` | `regions.pmtiles` | 105 827 424 | same |
| `public/assets/countries.pmtiles` | `countries.pmtiles` | 62 739 546 | same |
| `public/assets/cities.pmtiles` | `cities.pmtiles` | 1 547 924 | same |
| `public/assets/cities-seed.json` | `cities-seed.json` | 7 857 627 | same |
| `public/assets/regions-seed.geojson` | **`regions-seed-z8.geojson`** | 55 350 393 | client name is stable; release name is versioned to a zoom generation (z8) |
| `data/scenarios/default/regions.geojson` | **`default-regions-names.geojson`** | 55 401 660 | the `default` scenario's named custom-region geometry |

Root keys: `owner: "Open-Historia"`, `repo: "open-historia"`, `release: "map-data"`. Download URL is `https://github.com/<owner>/<repo>/releases/download/<release>/<asset>`.

**Namespacing gotcha:** the client always requests the *stable* path (e.g. `regions-seed.geojson`), while the release stores a *versioned* name (`regions-seed-z8.geojson`). The manifest is the only bridge. If a new zoom generation is uploaded under a new release name but the manifest's `sha256`/`bytes` aren't bumped, clients keep the old bytes; conversely a stable client name can silently point at a stale release generation. **When a map file changes: upload the new asset AND update its `sha256` + `bytes` in the manifest.**

### `scripts/fetch-map-assets.mjs`

Makes the local tree match the manifest. It's the maintainer-facing / content-node-fetch helper run **in place of** `git lfs pull` when seeding a local content node or refreshing the on-disk copies a node caches; the hosted web build fetches these over the network at runtime and doesn't need it.

| Mode | Command | Behaviour |
|---|---|---|
| Verify | `node scripts/fetch-map-assets.mjs` | Re-fetch anything whose SHA-256 differs (picks up a re-uploaded map, repairs truncation) |
| Ensure | `node scripts/fetch-map-assets.mjs --ensure` | Faster: trusts size, only fetches missing / wrong-size files |

Downloads to `<dst>.download`, verifies the SHA-256 **before** renaming into place, and is **best-effort**: it never exits non-zero (`process.exit(0)` on every path, `fetch-map-assets.mjs:92`) so a network failure can never block a launch or update. Requires Node 18+ for global `fetch`.

### Content-node variant

A content node operator runs the **same** release + checksums and fetches them into a writable content directory (see `tools/content-node/`) so the node can serve reads: the node fetches the `map-data` Release assets once into its content store, registers them hash-addressed (`/oh/v1/content/<sha256>`), and clients verify every byte against the signed `content-manifest.json`. This is how the heavy binaries reach the web client at runtime — there's no per-player `OH_DATA_DIR` anymore.

---

## 4. Runtime routes (answered by the fetch interceptor)

There is no Express server. The client still issues the same same-origin paths, and they're answered by the `window.fetch` interceptor in `src/runtime/web/router.js` (the `route()` dispatch maps each `domain` to a store handler under `src/runtime/web/`):

| Route | Handler | Purpose |
|---|---|---|
| `GET /api/runtime/json/:assetKey` | `readRuntimeJsonAsset` (`libraryStore.js`) | Read a runtime JSON doc from the active game/scenario IndexedDB record (base64 `data:` URLs excepted for cover — §6 of [Web build](web-build.md)); `Cache-Control: no-store` |
| `PUT /api/runtime/json/:assetKey` | `writeRuntimeJsonAsset` (`libraryStore.js`) | Persist to the active game's IndexedDB record; echoes back the normalized record |
| `GET /api/runtime/pmtiles/:assetKey` | scenario override → content-origin proxy (`router.js`) | Return a scenario's per-scenario pmtiles override from IndexedDB when present, else-proxy to `${VITE_OH_PMTILES_URL}/<key>.pmtiles` (range-capable; forwarded `Range`/method) |
| `HEAD /api/runtime/pmtiles/:assetKey` | content-origin proxy (`router.js`) | `Content-Length` for the client's persisted-cache freshness check; `Accept-Ranges: bytes` |
| `GET/PUT/DELETE /api/scenarios/:id/assets/:assetKey` | `handleScenarios` (`libraryStore.js`) | Upload/serve per-scenario overrides (pmtiles, geojson, flags, tags, cover) |
| `GET/PUT/DELETE /api/games/:id/assets/:assetKey` | `handleGames` (`libraryStore.js`) | Per-game images |

`writeRuntimeJsonAsset` auto-creates a game from the selected scenario if none is active, canonicalizes country refs for `world`/`game`/`colors`, then writes to the game record and returns the re-read record. That echoed record is what the client caches (§5, `writeJson`).

---

## 5. Client asset layer — `src/runtime/assets.js`

The browser's single module for reading, writing, warming, priming, and caching every asset. All URLs carry a `?v=<runtimeAssetToken>` query so a library mutation invalidates by URL identity.

### Endpoint wiring — `setRuntimeAssetEndpoints`

`assets.js:204`. Called on boot and on every scenario/game/library switch with a new `token`. It:

1. **Sweeps the old generation's caches BEFORE rebuilding the URLs** (`:218`) — the old URL strings are the only handles to those entries, so this must run first or the parsed GeoJSON (~190 MB on a 55 MB `regions.geojson`) is stranded forever.
2. Rebuilds every `JSON_URLS.*` = `withRuntimeToken("/api/runtime/json/<key>")` (`:260`).
3. Rebuilds `PMTILES_ARCHIVES.*` = `buildAbsoluteUrl("/api/runtime/pmtiles/<key>")` (`:275`) and the `pmtiles://…` protocol URLs (`:279`).

The token also gates the PMTiles cache rotation (`:239`): dropping `binaryValueCache`, `binaryRequestCache`, `pmtilesArchives`, the `Protocol` tile registry, and the `pmtilesCache` header — both to free the ~162 MB of warmed buffers and because `/api/runtime/pmtiles/:key` can serve *different bytes* after a switch (a stale directory applied to new bytes would decode garbage).

### Reading JSON — `readJson`

`assets.js:544`. Options: `{ cache, defaultValue, force, signal }`.

| Behaviour | Detail |
|---|---|
| Store decision | Snapshotted synchronously at call time via `isNoStoreJsonUrl` (see below) — never re-evaluated post-`await` |
| Value cache | `jsonValueCache` (Map, URL-keyed, no TTL/cap; swept on token change) |
| Request batching | `jsonRequestCache` de-dupes concurrent fetches to the same URL even with `force:true` — the ~5 s Nations/Cities/background/units pollers share one network request |
| Failure fallback | With `defaultValue`, serves a clone but **does not cache** it (transient failure must not pin a default) |
| Parse bookkeeping | `jsonLoadedUrls.add(url)` records a genuine parse *inside* the try — lets `loadRegionCatalog` tell "no custom regions" apart from "fetch failed, retry" |

`isNoStoreJsonUrl(url)` (`assets.js:158`) returns true for `regionsGeojson` and `citiesGeojson`. These FeatureCollections are huge and their only long-lived reader keeps them in React state (`Nations.jsx`/`Cities.jsx`, both `force:true`), so caching a second parsed copy is pure waste. It **must** be evaluated synchronously (the comment at `:154` explains why an after-`await` check resurrects the leak on scenario switch).

### Writing JSON — `writeJson` / `primeJson`

- `writeJson(url, data)` (`assets.js:618`) `PUT`s the payload, then caches **what the store echoed back** (the normalized record), not what was sent — legacy-record rewrites on the way in used to be pinned out of view. It calls `primeJson`, `invalidateDerivedCachesForWrite`, and `persistResponse`.
- `primeJson(url, data)` (`assets.js:602`) seeds the value cache (or deletes it for no-store URLs) and marks `jsonLoadedUrls`. Used to make a write immediately visible without a round-trip.
- `invalidateDerivedCachesForWrite(url)` (`assets.js:177`) drops the memoized `colors`/`flags`/`tags`/`world`-derived promises on a matching write and fires the `oh:colors-updated` DOM event so the live map repaints without a reload.

### Reading/priming binary — PMTiles

| Function | Line | Role |
|---|---|---|
| `getPmtilesArchive(url)` | `818` | Return cached `PMTiles` or register a new one |
| `warmPmtilesArchive(url)` | `829` | Download the full archive into `binaryValueCache`, then prime. **Web build** tries the hash-verified node swarm first (`contentTrust.js`), falls through to the origin |
| `primePmtilesArchive(url, buffer)` | `823` | Store the ArrayBuffer and register a `MemorySource`-backed archive |
| `registerPmtilesArchive(url)` | `390` | `new PMTiles(source, pmtilesCache)` + register on the `Protocol` |

`MemorySource` (`assets.js:364`) wraps an in-memory `Uint8Array` and satisfies `getBytes(offset, length)` locally, so once an archive is warmed the PMTiles library slices it in memory instead of issuing range requests. `createPmtilesArchive` (`:382`) uses a `MemorySource` when the bytes are in `binaryValueCache`, else the URL (range fetches). Directory/header decode caching is the shared `pmtilesCache = new SharedPromiseCache(256)` (`:141`).

### `resolveCountryDisplayName` and the resolver

`assets.js:288`. `resolveCountryDisplayName(name, code)` delegates to a swappable `countryNameResolver` installed via `setCountryNameResolver` (`:284`) — the i18n / localization layer registers a resolver so PMTiles feature names (`Country`/`NAME`/…) render translated. It defaults to identity. Used by both `loadCountryNames` and `loadRegionCatalog` when decoding the z0 tile.

### Cache inventory

| Cache | Keyed by | Contents | Rotated on token? |
|---|---|---|---|
| `jsonValueCache` | full URL | parsed JSON docs | yes |
| `jsonRequestCache` | full URL | in-flight JSON promises | yes |
| `jsonLoadedUrls` (Set) | full URL | "did a genuine parse happen" | yes |
| `binaryValueCache` | full URL | pmtiles `ArrayBuffer`s | yes |
| `binaryRequestCache` | full URL | in-flight pmtiles fetches | yes |
| `pmtilesArchives` | full URL | `PMTiles` instances | yes |
| `pmtilesCache` | source key | header/dir LRU (256) | header entry cleared |
| `runtimeJsonValueCache` / `runtimeJsonRequestCache` | asset **key** | web-build IndexedDB-backed docs | cleared (correctness) |
| `remoteValueCache` / `remoteRequestCache` | URL | warmed raster tile sizes | no |
| memoized promises: `nationColorsPromise`, `nationFlagsPromise`, `nationTagsPromise`, `countryNamesPromise`, `regionCatalogPromise` | scenario token | derived catalogs | re-keyed |

---

## 6. Persistent Cache Storage + freshness

`fetchWithPersistence(url)` (`assets.js:336`) layers a `CacheStorage` cache (`PRELOAD_CACHE_NAME = "open-historia-preload-v2"`, `:11`) over the network so warmed assets survive reloads:

1. Look up the persisted `Response`.
2. If present, issue a **`HEAD`** and compare `Content-Length` against the cached copy's. Equal (or the server can't answer, i.e. offline) → serve cached. Differ → refetch (an update replaced the file on disk).
3. Miss → `fetch(url, {cache:"force-cache"})`, then `persistResponse(url, clone)`.

The `v1` → `v2` cache-name bump (`:9`) exists because `v1` had no freshness check and could serve months-old map data forever; the bump flushes everyone once and the `HEAD` check keeps it fresh thereafter. `jsonHeadersFor` (`:32`) stamps the real UTF-8 byte length on client-written responses so the `HEAD` comparison isn't silently disabled by a missing `Content-Length`.

The **web build** uses a parallel key namespace: `buildRuntimeCacheUrl(key)` (`:333`) → `…/__runtime-cache/<key>.json`, read/written by `readRuntimeJson` / `writeRuntimeJson` (`:666`, `:705`) which are keyed by *asset key* (not URL) and therefore cleared wholesale on a token change (they'd otherwise serve the previous game's state).

---

## 7. The fetch interceptor + node swarm

The web build has no node server. same-origin `/api/*` is answered by the fetch interceptor; heavy pmtiles stream from the content origin over a hash-verified node swarm.

- **Route interception:** `src/runtime/web/router.js` installs a `fetch` interceptor for same-origin `/api/*`. `/api/runtime/pmtiles/:key` checks a scenario override in IndexedDB (`getScenarioPmtilesOverride`), else fetches `${VITE_OH_PMTILES_URL || "/assets"}/<key>.pmtiles`. The hosted site sets `VITE_OH_PMTILES_URL` to the **registry Worker's CORS+range proxy**, because a static-site host (Vercel) can't serve the 60–100 MB archives directly (same-origin would 404 to the SPA fallback).
- **Verified content swarm:** `warmPmtilesArchive` (`assets.js:855`) dynamically imports `src/runtime/web/contentTrust.js` and calls `fetchVerifiedBuffer(url)`. It maps the URL to a manifest asset id (`assetIdFromUrl`, `contentTrust.js:72`), fetches `<node>/oh/v1/content/<sha256>` from the vetted node swarm, and verifies **every byte** against the signed `content-manifest.json` (`:140`). A bad/broken node can at worst force a retry — it can never deliver tampered bytes — and any failure falls through to the canonical origin, so a node outage is invisible. The signed node **directory** (`VITE_OH_DIRECTORY_URL`) is a deny-list/control doc; live addresses come from `nodes-live.json`.

See [Web build](web-build.md) and [Web runtime](web-runtime.md) for the swarm/registry architecture and the trust chain.

---

## 8. Startup preload + the ~162 MB prime

`src/runtime/preload.js` warms the map before React fully mounts, inside a **30 s time budget** (`STARTUP_TIME_BUDGET_MS`, `:16`). Tasks run serially, each with an `AbortController` wired to the remaining budget; the budget expiring aborts the current task and leaves the rest to load lazily in-game.

| # | id | Label | Weight | Warms | Skipped on custom map? |
|---|---|---|---|---|---|
| 1 | `state` | Syncing saves and runtime state | 12 | `game`,`prompts`,`colors`,`actions`,`chat`,`advisor`,`events`,`world` JSON | no |
| 2 | `textures` | Warming world textures | 20 | ESRI basemap + AWS terrain raster tiles (global z0–2 + initial viewport) | **yes** — a custom `world.background` replaces the basemap entirely |
| 3 | `countries` | Caching country geometry | 26 | `countries.pmtiles` (~62.7 MB) | **no** — needed for names + labels on every map |
| 4 | `country-index` | Building country index | 8 | `loadCountryNames()` | no |
| 5 | `country-labels` | Building country labels | 14 | `warmCountryLabelCollections()` | no |
| 6 | `cities` | Caching city layer | 10 | `cities.pmtiles` (~1.5 MB) | no |
| 7 | `regions` | Caching regional borders | 24 | `regions.pmtiles` (~105.8 MB) | **no** — paints owners above z6.5 even on custom maps |

**The ~162 MB prime:** warming tasks 3+6+7 pulls all three archives fully into `binaryValueCache` as in-memory `ArrayBuffer`s — the code cites regions ≈101 MB + countries ≈60 MB + cities ≈1.5 MB ≈ **162 MB** resident (`assets.js:231`; on-disk manifest sizes total ~170 MB). This is a deliberate memory-for-latency trade: a fully-warmed `MemorySource` archive answers tile requests without further network I/O. The cost is that this ~162 MB must be **freed on scenario switch** — which is exactly what the PMTiles cache rotation in `setRuntimeAssetEndpoints` (§5) does. (The geojson double-store and pinned-PMTiles memory backlog are tracked separately.)

Task results feed a weighted progress bar: `normalizeTaskResult` (`preload.js:165`) sums the `.size` of each warmed asset into `loadedBytes`, and `progress = completedWeight / TOTAL_WEIGHT`.

---

## 9. Derived catalogs (memoized accessors)

These read the z0 PMTiles tile (or a JSON doc) once per scenario and cache the derived result on the scenario token. They power AI prompts, pickers, and labels.

| Accessor | Line | Reads | Produces | Cache key |
|---|---|---|---|---|
| `getNationColors()` | `900` | `colors.json` | owner-name → hex map | `JSON_URLS.colors` |
| `getNationFlags()` | `949` | `flags.json` | owner-code → PNG data URL (`{}` default) | `JSON_URLS.flags` |
| `getNationTags()` | `933` | `tags.json` | owner-code → `string[]` **starting** tags (merge with `world.countryTags`) | `JSON_URLS.tags` |
| `loadCountryNames()` | `965` | `countries.pmtiles` z0 tile + `world.polityOverrides` | sorted `{code,name}[]` country index | `PMTILES_ARCHIVES.countries` |
| `loadRegionCatalog()` | `1036` | `regions.pmtiles` z0 tile + `regions.geojson` custom names | sorted `{id,name,country,countryCode}[]` | `PMTILES_ARCHIVES.regions` + `JSON_URLS.regionsGeojson` |

Common invariants: each drops its promise on failure so the next call **retries** instead of pinning an empty catalog for the session; each is invalidated by `invalidateDerivedCachesForWrite` when its underlying asset is written.

- **`loadCountryNames`** decodes the `countries` vector-tile layer, dedupes by resolved display name (`resolveCountryDisplayName`), then merges `world.polityOverrides` — a nameless override never degrades a real name to a bare code (`:1008`).
- **`loadRegionCatalog`** decodes the stock `regions` layer, then **overlays the scenario's own `regions.geojson`**: the world's own name for a region wins (a world that renamed "Warmińsko-Mazurskie" to "South Konisburg" talks about South Konisburg everywhere, `:1109`), and editor-drawn `reg_*` shapes the stock tiles don't know get named from the custom geometry. It uses `jsonLoadedUrls.has(regionsGeojson)` (`:1101`) — not a truthiness test on the payload — to distinguish "no custom regions" (stock names correct) from "fetch failed" (retry), because the server answers a geometry-less scenario with a 200 empty FeatureCollection.

`decodeVectorTile(data)` (`assets.js:885`) lazily imports `@mapbox/vector-tile` + `pbf` and is the shared decoder for both catalogs.

---

## 10. Basemap raster + terrain (asset-adjacent)

Not part of the `map-data` Release, but resolved through this module. `ESRI_BASEMAPS` (`assets.js:82`) lists ten public, token-free ArcGIS Online services with per-layer `maxZoom`; `DEFAULT_BASEMAP_ID = "ocean"` (`:94`). The selected id is read from `localStorage["map_basemap_style"]` (`selectedBasemapId`, `:112`).

| Concern | Mechanism |
|---|---|
| Low-zoom source | Direct ESRI XYZ template `esriTileTemplate(id)` (`:104`) |
| High-zoom source | `ohbase://<id>/{z}/{y}/{x}` protocol (`basemapProtocolTemplate`, `:109`), registered by `ensureBasemapProtocol` (`:537`) |
| Placeholder swap | ESRI serves an identical "Map Data Not Yet Available" JPEG (HTTP 200) past a layer's coverage; `basemapTileLoader` (`:513`) byte-detects it (learned from two ocean tiles, `loadPlaceholderRef` `:454`) and synthesizes an upscaled crop of the nearest real ancestor (`synthesizeFromAncestor`, `:471`) |
| Terrain | `TERRAIN_TILE_TEMPLATE` → AWS `elevation-tiles-prod` terrarium PNGs (`:119`) |
| Runtime tuning | `configureMapRuntime` (`:398`) sizes MapLibre worker count + parallel image requests from `hardwareConcurrency` |

Raster tiles are warmed via `warmRemoteResources` / `warmRemoteResource` (`assets.js:775`, `:732`) with bounded concurrency (default 6), caching only the *size* per URL (the bytes live in the browser HTTP cache under `force-cache`).

---

## Quick file map

| File | Role |
|---|---|
| `src/runtime/assets.js` | Client asset layer: read/write/warm/prime, caches, derived catalogs, basemap protocols |
| `src/runtime/preload.js` | 30 s startup warm sequence + progress model |
| `src/runtime/web/idb.js` | IndexedDB primitives + `STORES` (the `open-historia-web` database) |
| `src/runtime/web/router.js` | Fetch interceptor for `/api/*` (pmtiles → `VITE_OH_PMTILES_URL`) |
| `src/runtime/web/libraryStore.js` | Scenarios/games/runtime store + handlers (IndexedDB-backed) |
| `src/runtime/web/models.js` | Asset-key sets + `resolveOwnerRef` + meta readers |
| `src/runtime/web/contentTrust.js` | Hash-verified content-node fetch + signed-manifest verification |
| `src/runtime/shared/ownerMigration.js` | Owner-code → owner-name resolver (relocated from `server/`) |
| `scripts/fetch-map-assets.mjs` | Sync a local content-node tree to the `map-data` Release |
| `tools/content-node/` | Content-node software (`trust.js`, `node.js`, `security.test.js`) |
| `scripts/map-assets.json` | The Release manifest (paths, versioned asset names, sha256, bytes) |

Related pages: [World state](world-state.md) · [Web build](web-build.md) · [Web runtime](web-runtime.md) · [Runtime services](runtime-services.md)
