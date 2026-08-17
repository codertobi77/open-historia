# Contributing & Conventions

Open Historia is an open-source, community-driven alternative to Pax Historia: a React + Vite **web** client, a vector map editor, and a small fleet of build/release scripts. There is **one build variant**: the web build, produced by `bun run build:site` and deployed via Vercel. The web "backend" is a browser `window.fetch` interceptor (`src/runtime/web/router.js`) that routes same-origin `/api/*` calls to IndexedDB-backed store handlers — there is no Express server, no Electron app, no Android APK, and no GitHub Actions CI anymore. The package manager is **bun** (`bun.lock` is the lockfile, gitignored; `package.json` declares `"packageManager": "bun@1.3.14"`). This page is the practical orientation for a new contributor — where the code lives, how it deploys to openhistoria.com, how to run and test it locally, the commit/style rules the maintainer enforces, and the handful of identifiers and data-hosting rules you must **not** break. There is no `CONTRIBUTING.md` in the repo; this doc is the closest thing, distilled from `README.md`, `package.json`, `vercel.json`, the license banners in the source, and `.gitattributes`/`.gitignore`.

For the systems these conventions govern, see [Architecture](architecture.md), [Web build](web-build.md), [Web runtime](web-runtime.md), [Assets & data](assets-and-data.md), and [Runtime services](runtime-services.md).

---

## 1. Repository & remote layout

The canonical repo is the **`Open-Historia` GitHub org**: `Open-Historia/open-historia`. That is what `README.md` tells players to clone (`git clone https://github.com/Open-Historia/open-historia.git`) and what every license banner and asset manifest points back to.

This working clone (`work-repo`) has several remotes configured — useful to know so you push to the right place:

| Remote | URL | Role |
|--------|-----|------|
| `upstream` | `github.com/Open-Historia/open-historia` | The canonical org repo. PRs land here; this is "the repo". |
| `origin` | `github.com/Arkniem/pax-historia-2` | Maintainer's personal working fork. |
| `beta` | `github.com/Arkniem/Open-Historia-Beta` | Beta staging fork. |
| `ltfork` | `github.com/lt20202122/open-historia` | A contributor fork. |

`scripts/map-assets.json` hard-codes `"owner": "Open-Historia", "repo": "open-historia", "release": "map-data"` — the org repo is also where the large binary release assets live (see §9).

Sibling repos in the same org that the code and docs reference (not part of this repo):

| Repo | Purpose |
|------|---------|
| `Open-Historia/open-historia-node` | Community **content node** — caches/serves read-only, checksum-verified map data. |
| `Open-Historia/open-historia-admin` | Private registry Worker (D1) + signing panel; publishes the signed node directory. |
| `Open-Historia/Open-historia-scenarios` | The Scenario Hub — official presets + community scenarios. |

---

## 2. Branches & deploy model

There is **one branch that matters: `main`**. There is no release-channel topology anymore — no `main`/`beta`/`alpha` channel split, no per-channel GitHub Releases, no GitHub Actions CI. The site is the single deployable, and it ships to players via **Vercel on every merge to `main`**.

- `vercel.json` (committed) sets `installCommand: "bun install"` and `buildCommand: "bun run build:site"`. Vercel detects bun automatically from `package.json`'s `"packageManager": "bun@1.3.14"` and runs `bun run build:site`, which seeds web defaults → `vite build --mode web --base /play/ --outDir dist-web` → `scripts/assemble-site.mjs` → `dist-site/` (landing page at `/`, game at `/play/`).
- Merges to `main` are deployed automatically; there is no manual deploy button, no admin-panel deploy engine, and no Cloudflare Pages path anymore.
- Because the 60–100 MB pmtiles archives are too large for a static site, they live on the `map-data` GitHub Release and the web build fetches them through the registry Worker's CORS+range proxy and the hash-verified content-node swarm (see [Assets & data](assets-and-data.md) and [Web build](web-build.md)).

Feature work happens on topic branches off `main` and lands via pull request. Don't open `beta`/`alpha`-targeted PRs — those channels no longer exist. When in doubt about the target branch, ask the maintainer.

---

## 3. The PR-only workflow (submit; maintainer merges)

**Contributors submit pull requests. A maintainer reviews and merges — you do not merge your own PR.** The git history is almost entirely `Merge pull request #NNN from Open-Historia/<branch>` commits authored by the maintainer (`Arkniem`), i.e. every change lands through a reviewed PR.

Practical flow:

1. Fork `Open-Historia/open-historia` (or branch, if you have push access).
2. Create a topic branch off the appropriate base.
3. Make your change; run `bun run lint` and `bun test` locally (see §7–8).
4. Open a PR against the org repo. Describe *why*, not just *what* — the codebase's comment culture (§5) extends to PR descriptions.
5. A maintainer merges. Do not force-push shared branches or self-merge.

---

## 4. Commit identity & attribution rules

These are hard rules — the maintainer enforces them on every commit and PR.

### No AI attribution — ever

**Do not add `Co-Authored-By: Claude …` trailers, `Generated with Claude Code` footers, or any AI-attribution line** to commit messages or PR bodies. This applies whether or not an AI tool touched the change. Commits and PRs read as authored by a human contributor, full stop.

### Author identity

Commit under **your own GitHub-linked identity** (use your GitHub `noreply` email so commits attribute to your account, e.g. `<id>+<user>@users.noreply.github.com`). The maintainer commits as `Arkniem` (Nicholas Krol). Do not impersonate another contributor's name/email.

### License-banner authorship is separate from Git authorship

The **file-header license banners** (§5) credit **Nicholas Krol** because they mark the portions covered by the map-editor MIT license — that is a *licensing* statement, not a claim of Git authorship. Don't remove or rewrite an existing banner when you edit a file; leave the attribution intact.

---

## 5. Coding style & conventions

### License banners on source files

Almost every source file across `src/`, `scripts/`, and `tools/` opens with a one-line (or short block) MIT banner pointing at `src/Editor/LICENSE`. Two forms are in use:

```js
/*! Open Historia — portions (short description of what this file does) © 2026 Nicholas Krol, MIT (see src/Editor/LICENSE). */
```

```js
/*!
 * Open Historia Map Editor
 * Copyright (c) 2026 Nicholas Krol - MIT License (see src/Editor/LICENSE).
 */
```

Even config and `.gitattributes` carry the banner (`vite.config.ts:1`, `eslint.config.js` excepted). **When you add a new file, add a banner** in the same style with a short parenthetical describing the file's role. When you edit an existing file, keep its banner.

Licensing is split by directory: the map editor and its tooling — the contents of `src/Editor/`, `scripts/extract-regions.mjs`, and `src/runtime/web/editorStore.js` — are MIT © Nicholas Krol per `src/Editor/LICENSE`; the project as a whole is MIT © "Developers of the Open-Historia Project" per the top-level `LICENSE`.

### Verbose, explanatory comments (the house style)

The single most distinctive convention: **comments explain *why*, name the trap, and often cite the failure mode** — not what the next line literally does. They are frequently multi-sentence and read like short design notes. Representative examples worth imitating:

- `vite.config.ts` `dropMapBinaries` plugin — a full paragraph on why the pmtiles are dropped from the bundle (too large for a static-site host; nothing loads a pmtiles archive from the bundle anyway — the web build fetches them from content nodes, hash-verified).
- `src/runtime/shared/ownerMigration.js` + its test — notes fixtures are "TRANSCRIBED FROM THE REAL SHIPPED DATA, not invented."
- `src/runtime/web/router.js` `installWebApiRouter` — the comment block explains *why* only `window.fetch` is patched and why cover images are embedded as `data:` URLs (an `<img src>` load bypasses the interceptor and would 404 to the SPA fallback).

Match this: when you write a non-obvious line, leave a comment that would stop the next person from "fixing" it back into a bug.

### Linting, TypeScript, and the React compiler

| Tool | Config | Notes |
|------|--------|-------|
| ESLint 9 (flat config) | `eslint.config.js` | Runs on `**/*.{ts,tsx}` with `js.configs.recommended`, `typescript-eslint`, `react-hooks`, and `react-refresh` (Vite). `dist` is globally ignored. Run: `bun run lint`. |
| TypeScript 5.9 | `tsconfig*.json` | `.ts`/`.tsx` are type-checked and linted; much of the game UI is `.jsx` (not strictly typed). Both coexist. |
| React 19 + React Compiler | `vite.config.ts:77-82` | The build enables `babel-plugin-react-compiler`. Don't hand-write memoization that fights the compiler; follow the Rules of Hooks (react-hooks lint enforces this). |

Note ESLint only targets `.ts`/`.tsx` — the many `.jsx`/`.js` files are not linted by the current config, so rely on review and the comment culture there.

### Line endings

`.gitattributes` forces **LF** on shell scripts (`*.sh`, `*.command`) and a few other text classes — "CRLF breaks bash on Linux/macOS." Don't let an editor rewrite them to CRLF.

---

## 6. Running the app locally

Prerequisites: **bun** (the repo's package manager; `package.json` declares `"packageManager": "bun@1.3.14"`) and Git. Node 22 LTS or newer is still required by the toolchain (`package.json:engines`, minimum `^20.19.0 || >=22.12.0`; Vite 7 needs it), but `bun install` / `bun run …` are the commands you actually type.

### First-time setup

```bash
git clone https://github.com/Open-Historia/open-historia.git
cd open-historia
bun install
```

The world-map binaries (pmtiles, seed geojson/json, the default scenario's `regions.geojson`) are **not** in the repo and are **not** needed for `bun run build:site`. The web build fetches them at runtime from the `map-data` GitHub Release through the registry Worker proxy / content-node swarm, exactly like production. You only need `scripts/fetch-map-assets.mjs` if you are doing something that reads them off disk locally (see §9).

### Running it

**A. Production-style (matches what players get):**

```bash
bun run build:site   # seeds web defaults → vite build --mode web --base /play/ → assemble-site.mjs → dist-site/
```

Then serve `dist-site/` with any static file server (e.g. `bunx serve dist-site`, `bun run preview:web`, or the dev-time `bun run dev:web`). There is no server process to start — open the served URL in a browser and the `window.fetch` interceptor in `src/runtime/web/router.js` answers every same-origin `/api/*` call from IndexedDB, with heavy map tiles fetched over the network from the content origin. See [Web build](web-build.md) and [Web runtime](web-runtime.md).

**B. Hot-reload dev:**

```bash
bun run dev:web   # seeds web defaults (scripts/seed-web-defaults.mjs) then vite --mode web (HMR)
```

A single process — there is no Express server to run alongside the Vite dev server anymore. The vite dev server serves the bundle; the fetch interceptor answers `/api/*` against IndexedDB in-browser, same as production.

### Scripts (`package.json:scripts`)

| Script | What it does |
|--------|--------------|
| `bun run dev` | == `dev:web`. |
| `bun run dev:web` | Seeds web defaults (`scripts/seed-web-defaults.mjs`) then `vite --mode web` (HMR). |
| `bun run build:web` | Web build → `dist-web/` (base `/`). See [Web build](web-build.md). |
| `bun run build:site` | Web build at base `/play/` + `scripts/assemble-site.mjs` (landing page at `/`, game at `/play/`) → `dist-site/`. This is the script Vercel runs. |
| `bun run lint` | ESLint over the repo. |
| `bun run preview:web` | Serve a built web bundle for inspection. |
| `bun test` | Run the test suite (see §7). |

The only build mode left is `--mode web`, gated by `VITE_OH_WEB`. `import.meta.env.VITE_OH_WEB` is compiled to a literal so Rollup keeps the web runtime (`src/runtime/web/**`) in the bundle; there is no desktop/Android branch in the build anymore. (The desktop/Android branches that used to be tree-shaken away were removed in the web-only refactor.)

---

## 7. Running tests

```bash
bun test
# or: node --test (the built-in Node test runner)
```

The `package.json` `test` script runs `node --test` over the three load-bearing test files:

```
node --test src/runtime/shared/ownerMigration.test.js src/runtime/gameplayStats.test.js tools/content-node/security.test.js
```

`bun test` is the shorter way to invoke the same suite (bun ships its own runner that understands `node --test`-style files). `bun test <path>` can also be pointed at a glob to pick up the other colocated tests that aren't wired into the `test` script — e.g. `bun test src/runtime/appUpdate.test.js`, `src/runtime/eventDedup.test.js`, `src/Game/AI/regionVocab.test.js`.

The suite uses the **built-in Node test runner** plus `node:assert/strict` — **no test framework, no extra deps**. The tests target pure, dependency-light helpers that run without booting anything:

| Test file (surviving path) | Covers |
|-----------|--------|
| `tools/content-node/security.test.js` | Path containment, the CSRF/origin guard, HTTP range parsing, the hub host allowlist — the guards that used to live in `server/security.js`, relocated to the content-node tooling under `tools/content-node/`. |
| `src/runtime/shared/ownerMigration.test.js` | The owner-code → owner-name resolver, with fixtures transcribed from real shipped scenario data (`src/runtime/shared/ownerMigration.js`, relocated from `server/ownerMigration.js`). |
| `src/runtime/gameplayStats.test.js` | Derived gameplay-stat math. |
| `src/runtime/appUpdate.test.js`, `src/runtime/eventDedup.test.js`, `src/Game/AI/regionVocab.test.js` | App-update + event-dedup + AI region-vocabulary helpers (colocated with their modules; not wired into the `test` script, but picked up by `bun test <path>`). |

Convention when adding tests: colocate a `*.test.js` next to the module it covers, keep the tested functions **pure** so they need no server or browser, and prefer real transcribed fixtures over invented ones. UI/render-path changes in `src/` have no automated suite — verify them by actually booting the web build (`bun run dev:web`).

---

## 8. Load-bearing identifiers that must never change

These strings are wired into external contracts — the `map-data` GitHub Release assets the web build fetches at runtime, and the signed node-directory / content-manifest URLs the client verifies against. Renaming any of them silently breaks the content fetch or the trust chain. **Treat them as frozen.** (The desktop-bundle / Android-APK identifiers that used to live here — `Open-Historia.zip`, `app-stable`/`app-beta` release tags, `pax-historia.apk`, `io.github.arkniem.paxhistoria`, `app.paxhistoria`, the `Build: N` self-update convention — were removed with the desktop and Android builds.)

| Identifier | Where | Why it's frozen |
|-----------|-------|-----------------|
| **`map-data`** (release) + the per-asset names | `scripts/map-assets.json` | The map-binary release and asset names (`regions.pmtiles`, `regions-seed-z8.geojson`, `default-regions-names.geojson`, …). The fetch script resolves these by name, and the web build's content-trust layer hashes/verifies them; a rename orphans every fetch and breaks every hash check. |
| **`openhistoria.com`** origin + `/play/` base | `vercel.json`, `vite.config.ts` `--base /play/` | The site's canonical origin and the game's base path. The signed node directory, content manifest, and account/sync endpoints are keyed to this origin; the bundle's absolute URLs are built relative to `/play/`. |
| **`open-historia-web`** IndexedDB database name | `src/runtime/web/idb.js` | Bumping `DB_VERSION` is additive; renaming the database orphans every existing player's local scenarios/games. |
| Pinned root public key id **`oh-root-1`** | `src/runtime/web/trust/pinned-key.js` | The Ed25519 root key the content manifest / node directory are signed against. The private key is offline; rotation = ship both keys for one release, then drop the old one. |
| **`pax-historia-scenario-bundle/2`** bundle schema | `src/runtime/web/models.js` (`SCENARIO_BUNDLE_SCHEMA`) | The only compatibility gate on a scenario-bundle file strangers swap. The schema string moves with the owner rename, so an old build can't silently mis-resolve a name-keyed bundle. |

When a map file legitimately changes, you upload a *new* asset to the `map-data` release and update its `sha256`/`bytes` in `scripts/map-assets.json` — you don't rename the contract-facing asset names.

---

## 9. The map-data-off-LFS rule

**The large world-map binaries are not in the repo and must never be re-added to Git (or Git LFS).** They are hosted as assets on the `map-data` GitHub Release and downloaded on demand by `scripts/fetch-map-assets.mjs`, which reads `scripts/map-assets.json`.

Why: LFS's free bandwidth (1 GB/month, shared org-wide) was exhausted by a handful of player installs. Release-asset download bandwidth is free and unmetered. This is stated three times in the tree so it can't be missed: `.gitattributes:6-11`, `.gitignore` ("Large world-map binaries" block), and `scripts/map-assets.json:_comment`.

The gitignored / release-hosted files:

| File | Manifest asset name |
|------|--------------------|
| `public/assets/regions.pmtiles` | `regions.pmtiles` |
| `public/assets/countries.pmtiles` | `countries.pmtiles` |
| `public/assets/cities.pmtiles` | `cities.pmtiles` |
| `public/assets/cities-seed.json` | `cities-seed.json` |
| `public/assets/regions-seed.geojson` | `regions-seed-z8.geojson` |
| `data/scenarios/default/regions.geojson` | `default-regions-names.geojson` |

Rules of thumb:
- **Never `git add`** any `*.pmtiles`, the seed geojson/json, or the default scenario's `regions.geojson`. They're gitignored; don't `-f` them in.
- **To change a map file:** upload the new asset to the `map-data` release, then update its `sha256` + `bytes` in `scripts/map-assets.json`. `fetch-map-assets.mjs` re-downloads any listed file that's missing or hash-mismatched.
- **The web build actively drops these from the bundle** — `vite.config.ts`'s `dropMapBinaries` plugin deletes the pmtiles (and the editor seeds) after copy: at ~100 MB each they're too large for a static-site host and nothing loads a pmtiles archive from the bundle anyway, since the web build resolves pmtiles via the registry Worker's CORS+range proxy / content nodes (`VITE_OH_PMTILES_URL`), hash-verified. Don't defeat this plugin. See [Assets & data](assets-and-data.md).

Related gitignored-but-not-in-LFS runtime artifacts you also shouldn't commit: `/fmg/` (vendored Fantasy Map Generator, fetched by `scripts/fetch-fmg.mjs`), `/src/runtime/web/generated/` (web seed), `/node-content/` (content-node store), and the offline signing keys `trust/*.key.pem` / `*.key` (**never commit a signing key**).

---

## 10. Quick reference — where things live

| You want to… | Look at |
|--------------|---------|
| Change the web "API" / routes | `src/runtime/web/router.js`, `src/runtime/web/*Store.js`, [Web runtime](web-runtime.md), [Web build](web-build.md) |
| Touch the shared owner-migration resolver | `src/runtime/shared/ownerMigration.js` (+ `ownerMigration.test.js`) |
| Touch the content-node trust guards / signing | `tools/content-node/` (`trust.js`, `node.js`, `security.test.js`) |
| Edit the map editor | `src/Editor/` (separately licensed — `src/Editor/LICENSE`) |
| Edit the game map / UI | `src/Game/` — see [Game map](game-map.md), [Game UI](game-ui.md) |
| Change UI styling / design tokens | `DESIGN.md` (spec) + `src/design/tokens.js` (code) — see [Design system](design.md) |
| World-state fields & flow | [World state](world-state.md) |
| Runtime services (library/scenario stores, i18n, resolver) | [Runtime services](runtime-services.md), `src/runtime/` |
| AI prompts / schemas | [AI overview](ai-overview.md), [AI schemas](ai-schemas.md), [AI prompts](ai-prompts.md) |
| Build / deploy plumbing | `vercel.json`, `package.json:scripts`, `scripts/`, `vite.config.ts` |
| Map-data hosting | `scripts/map-assets.json`, `scripts/fetch-map-assets.mjs` (§9) |
| Rebuild an official preset | `scripts/presets/build-preset.mjs <spec>` |
| Web/site deploy | [Web build](web-build.md), [Delivery & deploy](delivery-and-deploy.md) |
