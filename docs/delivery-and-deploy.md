# Delivery, Deploy & Releases

Open Historia ships as **one web build**: the browser-only app that runs the hosted website [openhistoria.com](https://openhistoria.com) and any self-hosted copy. The deployable artifact is `dist-site/`, produced by `bun run build:site`, and is served by **Vercel** (config in the committed `vercel.json`). Surrounding the site are two external Cloudflare Workers — an import counter and a node registry — that the web build calls at runtime via `VITE_OH_*` URLs; they are *not* deploy targets from this repo. This page maps the surviving build scripts, the `build:site` → `assemble-site.mjs` pipeline, the Vercel deploy, the `map-data` Release, the web-mode seed, and how a change reaches the live site.

The Vite build has one load-bearing switch — `--mode web` — which flips `import.meta.env.VITE_OH_WEB` into a compile-time literal (`vite.config.ts`). There is no non-web build anymore; the deprecated desktop download and Android APK variants and their Express `/api` server were removed in the web-only refactor. The package manager is **bun** (`package.json` has `"packageManager": "bun@1.3.14"`; the lockfile `bun.lock` is gitignored) — use `bun install` / `bun run X` / `bun x X` in place of `npm install` / `npm run X` / `npx X`.

---

## 1. Build scripts (`package.json`)

Only the web-build scripts remain. Each flips `import.meta.env.VITE_OH_WEB` to `true` at compile time (`vite.config.ts`) so the whole `src/runtime/web/*` backend is statically pulled into the graph.

| Script | Command | Output dir | Base | Purpose |
|---|---|---|---|---|
| `dev` / `dev:web` | `node scripts/seed-web-defaults.mjs && vite --mode web` | — | — | Local dev. `dev` just runs `dev:web` now — there is no Express proxy anymore. |
| `build:web` | `node scripts/seed-web-defaults.mjs && vite build --mode web --outDir dist-web --emptyOutDir` | `dist-web/` | `/` | The browser game as a standalone site (base `/`). |
| `build:site` | `node scripts/seed-web-defaults.mjs && vite build --mode web --base /play/ --outDir dist-web --emptyOutDir && node scripts/assemble-site.mjs` | `dist-site/` | `/play/` | The **combined** `openhistoria.com`: landing page at `/`, game under `/play/`. This is what Vercel deploys. |
| `lint` | `eslint .` | — | — | Lint. |
| `preview:web` | `vite preview --outDir dist-web` | — | — | Preview a built `dist-web/` locally. |
| `test` | `node --test src/runtime/shared/ownerMigration.test.js src/runtime/gameplayStats.test.js tools/content-node/security.test.js` | — | — | The relocated unit tests (formerly `server/**/*.test.js`). |

`build` (desktop), `build:mobile-server` (APK embedded server), and the old `dev` Express-proxy variant are gone. (`node --test` is the test runner, so the `test` script intentionally keeps `node` rather than `bun`.)

**The map-binary trap** (`vite.config.ts`, `oh-drop-map-binaries` plugin): the ~160 MB pmtiles/geojson live in `public/` so the dev server can serve them off disk, but Vite copies `publicDir` wholesale into the bundle. The web build does not want them there — the site fetches them from content nodes — so the plugin deletes them from the output in `closeBundle()` (pmtiles, plus the editor seeds `regions-seed.geojson` / `cities-seed.json` from the web build only). Without the drop, `build:site` would ship multi-hundred-MB files that no host should be asked to serve. The trap "only fires on a machine that has actually played" (the files are gitignored and only arrive from the `map-data` Release), which is why fresh clones build fine and the failure looks random.

---

## 2. Contribution flow

There are no release channels or per-channel branches anymore. The flow is: fork the repo, branch from `main`, open a PR against `main`, and a maintainer merges it. Merged `main` is what Vercel builds and deploys (§3, §8).

> **Commit/PR attribution:** commit as the account-linked identity; **no** Claude `Co-Authored-By` trailer and **no** "Generated with Claude Code" footer (repo policy).

---

## 3. Deploy: Vercel

The site deploys via **Vercel**, not Cloudflare Pages. `vercel.json` (committed) pins the build:

```json
{
  "framework": null,
  "buildCommand": "bun run build:site",
  "outputDirectory": "dist-site",
  "installCommand": "bun install",
  "cleanUrls": true
}
```

Vercel detects bun from `package.json`'s `"packageManager": "bun@1.3.14"`, runs `bun install`, then `bun run build:site`, and serves `dist-site/` (landing page at `/`, game under `/play/`). A merged push to `main` is what triggers a production deploy; nothing else is required.

---

## 4. External services the web build calls (not deploy targets from this repo)

The web build reaches two Cloudflare Workers at runtime, via build-time env in `.env.web`. Their code lives outside this repo (the import counter's `worker.js` is mirrored in `tools/import-counter/` for reference, but the registry Worker lives in a separate admin repo). They are described here so you know what `VITE_OH_*` URLs point at — but you do **not** deploy them from this repo.

### Import counter

A tiny Worker that counts community-scenario imports. The web build pings it once per successful install through the registry Worker (the web router forwards `/api/hub/import-log` → `VITE_OH_HUB_URL`), giving real numbers even for scenarios GitHub can't count (issue attachments).

| Item | Value |
|---|---|
| Worker name | `oh-import-counter` (its `worker.js` + config are mirrored under `tools/import-counter/` for reference) |
| Entry | `worker.js` |
| Storage | KV binding `IMPORTS` (counts live in each key's metadata so `/counts` is one list call) |
| Dedup | Website: once per **account _and_ IP** (skip if either seen); anonymous web: once per **IP**. Raw IPs never stored — hashed with `HASH_SALT` |
| Read routes | `/counts` (all), `/count/<hub-issue-number>` (one) |

### Node registry

The web-mode control plane (source of truth: a separate admin repo). Serves the signed content-node directory, proxies map content, and hosts the scenario hub + magic-link/Google accounts + E2E sync. Worker name `open-historia-registry`.

| `VITE_OH_*` flag (.env.web) | Used for |
|---|---|
| `VITE_OH_PMTILES_URL` | Map tiles served/proxied by the registry |
| `VITE_OH_DIRECTORY_URL` | The signed content-node directory (`…/node-directory.json`) |
| `VITE_OH_HUB_URL` | Scenario hub proxy + import logging |
| `VITE_OH_ACCOUNT_URL` | Magic-link/Google accounts + E2E-encrypted sync |
| `VITE_OH_GOOGLE_CLIENT_ID` | Google sign-in |

(An admin panel in the separate admin repo manages the node directory: accepting/pausing/banning nodes, then re-signing the directory and POSTing it to the registry Worker. No game rebuild is needed for a directory change.)

---

## 5. The website build pipeline (`build:site` → `assemble-site.mjs`)

`build:site` runs three stages in order, then hands off to the assembler. The deploy target is **Vercel**, which runs this same command.

1. `node scripts/seed-web-defaults.mjs` — bundles the built-in default scenario for the browser (§7).
2. `vite build --mode web --base /play/ --outDir dist-web --emptyOutDir` — the game, based at `/play/`.
3. `node scripts/assemble-site.mjs` — stitches `site/` (landing page) + `dist-web/` (game) into `dist-site/`.

### `scripts/assemble-site.mjs`

Produces `dist-site/`: landing page at `/`, game under `/play/`.

| Constant / step | Location | Behavior |
|---|---|---|
| `siteDir` = `site/` | `assemble-site.mjs:10` | Marketing landing page source (`index.html`, `_redirects`) copied to `dist-site/` root |
| `gameDir` = `dist-web/` | `assemble-site.mjs:11` | Web game (base `/play/`) copied to `dist-site/play/` |
| `outDir` = `dist-site/` | `assemble-site.mjs:12` | The deployable output |
| `ROOT_PAGES` | `assemble-site.mjs:22` | Pages that must answer at the **root** (`guides`, `get-started`, `how-to-play`, `ai-setup`, `self-hosting`, `pax-historia-alternative`, `sitemap`, `guides.css`, `robots.txt`, `sitemap.xml`). Their only copy lives in `public/` (so a self-hosted install serves them offline too); assembler lifts them out of `/play/` up to `/`. **A listed page that's missing fails the build** (a dropped page would otherwise 404 only to a crawler) |
| `ROOT_ASSETS` | `assemble-site.mjs:34` | Images referenced by absolute `/…` paths from both root guides and the game (`logo.png`, five `loading_screen*`, PWA icons, `screenshot.png`). Copied to `/` if present; **silently skipped** if renamed (a missing image is a cosmetic 404, not build-fatal) |
| Guard | `assemble-site.mjs:41` | Fatal if `dist-web/index.html` is missing (build the game first) |

The `--base /play/` split is why absolute `/logo.png` in the game needs a duplicate at the site root: under `/play/` an absolute URL resolves against the origin, not the base.

---

## 6. Map-data Release & `fetch-map-assets.mjs`

The ~200 MB world-map binaries left Git LFS (whose free 1 GB/mo org-wide bandwidth was exhausted by a handful of full checkouts, then 403'd) and now ship as assets on the `map-data` GitHub Release, whose download bandwidth is free and unmetered.

- **Manifest:** `scripts/map-assets.json` — `owner`/`repo`/`release` (`Open-Historia`/`open-historia`/`map-data`) plus each asset's `path`, release `asset` name, `bytes`, and `sha256`.
- **Fetcher:** `scripts/fetch-map-assets.mjs` makes the local tree match the manifest. Full run verifies SHA-256 and re-fetches anything missing or changed; `--ensure` trusts byte-size for speed. **Best-effort — never exits non-zero**, so it can never block a launch, a `build:site`, or a first-run map download. Downloads to a `.download` temp then atomic-renames. Run it with bun: `bun scripts/fetch-map-assets.mjs`.
- **Name namespaces:** the manifest maps a *versioned* release asset name to a *stable* local path — e.g. `regions-seed-z8.geojson` (release) → `public/assets/regions-seed.geojson` (tree), and `default-regions-names.geojson` → `data/scenarios/default/regions.geojson`. The client always reads the stable path.
- **Callers:** the `map-data` Release is the only source of these binaries. Run `bun scripts/fetch-map-assets.mjs` to populate a local tree (e.g. before a self-hosted build or `build:site` on a machine that has not yet fetched them). The Vercel build does not need them — `dropMapBinaries` strips them from `dist-site/` and the site fetches tiles from the registry/content nodes at runtime. **Never re-add these files to Git LFS.**

When a map file changes: upload the new asset to the `map-data` Release, then update its `sha256` + `bytes` in `scripts/map-assets.json`.

---

## 7. Web-mode seed (`seed-web-defaults.mjs`)

`scripts/seed-web-defaults.mjs` runs only from `dev:web` / `build:web` / `build:site`. It bundles the built-in `default` scenario (`data/scenarios/default`) into JS modules under `src/runtime/web/generated/` (git-ignored) so a fresh browser can seed its IndexedDB library with a playable scenario.

| Output | Content |
|---|---|
| `defaultScenario.js` | `{ meta, cover (base64), colors, data{game,prompts,world,actions,advisor,chat,events} }` |
| `countryNames.js` | Canonical code→name registry, mirroring `data/country-names.json` (used by `canonicalizeCountryRef`) |
| `fallbackColors.js` | App-level default palette from `public/assets/colors.json`, immutable & scenario-independent |

It reads only from `data/`, which **is** committed — so the website build (including Vercel) needs nothing from the `map-data` Release.

---

## 8. End-to-end: how a change reaches the live site

| Surface | Landing branch | Build artifact | Delivery mechanism | Player action |
|---|---|---|---|---|
| **Website** | `main` | `dist-site/` | Vercel deploy (push to `main` → `bun install` → `bun run build:site` → serve `dist-site/`) | Nothing — next page load |
| **Node directory** | *runtime data* | signed JSON | The admin panel (separate admin repo) re-signs + POSTs to the registry Worker on any node change | Live, no game rebuild |
| **Map binaries** | *manual* | Release assets | Uploaded to the `map-data` Release; fetched by `bun scripts/fetch-map-assets.mjs` for local/self-hosted builds; served to the live site by the registry/content nodes | Fetched on first run |

Key invariants:

- **Map data is decoupled from code** — a code deploy does not re-cut the map; a map change is a manual `map-data` Release upload + manifest edit.
- **The Workers are external to this repo** — merging a change here never deploys the import-counter or registry Worker; those move through the separate admin repo.

---

## 9. Traps & invariants

- **Never re-add map binaries to Git LFS** — they live on the `map-data` Release only (§6).
- **Never let a pmtiles/large geojson into a deployed site** — the `oh-drop-map-binaries` Vite plugin (`vite.config.ts`) strips them from `dist-web/` / `dist-site/` in `closeBundle()`, because nothing in the web bundle loads a pmtiles archive from the bundle (tiles come from `VITE_OH_PMTILES_URL` / content nodes). Without the drop, `build:site` would emit multi-hundred-MB files no host should serve.
- **`ROOT_PAGES` is fail-hard, `ROOT_ASSETS` is fail-soft** — a dropped root *page* fails `build:site`; a dropped root *image* is only a cosmetic 404 (`assemble-site.mjs`, the `ROOT_PAGES` / `ROOT_ASSETS` constants).
- **Use bun** — `bun install` / `bun run X` / `bun x X`. There is no `package-lock.json`; the lockfile `bun.lock` is gitignored. Vercel reads `"packageManager": "bun@1.3.14"` and runs bun automatically.

---

### See also

- [World state](world-state.md) — the `world.json` shape that scenarios and the web seed carry
- [Web runtime](web-runtime.md) — the fetch-interceptor `/api` backend the site runs against
- [Map data & assets](assets-and-data.md) — map-data handling from the `map-data` Release through scenario override resolution to the browser caching/warming model
- [Architecture overview](architecture.md) — the tech stack, the one web build variant, the boot sequence, and the directory map
