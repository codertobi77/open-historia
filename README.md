<!-- Open Historia — portions (install, Android app, hub & preset docs) © 2026 Nicholas Krol, MIT (see src/Editor/LICENSE). -->
<h1 align="center">Open Historia</h1>

<div align="center">
  <strong>An open-source, community-driven alternative to <a href="https://www.paxhistoria.co/games">Pax Historia</a>.</strong>
</div>

<br />

<div align="center">
  <!-- Discord -->
  <a href="https://discord.gg/C3AVwHacZ4">
    <img src="https://img.shields.io/badge/discord-join-5865F2.svg?style=flat-square&logo=discord&logoColor=white"
      alt="Discord" />
  </a>
  <!-- Reddit -->
  <a href="https://www.reddit.com/r/OpenHistoria">
    <img src="https://img.shields.io/badge/reddit-r%2FOpenHistoria-FF4500.svg?style=flat-square&logo=reddit&logoColor=white"
      alt="Reddit" />
  </a>
  <!-- License -->
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square"
      alt="License: MIT" />
  </a>
  <!-- Status -->
  <a href="#">
    <img src="https://img.shields.io/badge/status-early%20development-orange.svg?style=flat-square"
      alt="Early Development" />
  </a>
</div>

<div align="center">
  <sub>Built with ❤︎ by <a href="https://github.com/Open-Historia/open-historia/graphs/contributors">contributors</a>.
</div>

<br />
<br />

![](https://github.com/Open-Historia/open-historia/blob/main/public/screenshot.png?raw=true)

---

## ✨ Features

- __interactive world map:__ watch territory, borders, and nations shift as history unfolds
- __ai-generated events:__ dynamic events shaped by your decisions and the state of the world
- __diplomacy:__ negotiate with AI-controlled nations through natural language chat — click any country to talk to it or get an AI intelligence briefing
- __ai advisor:__ consult your advisor for strategic guidance, economic analysis, and situation summaries
- __map editor:__ a full vector map editor (draw, split, merge, paint owners, cities) built into the scenario editor — build a world and hit *Apply & Play*
- __troops:__ deploy, move and battle armies; deployments stay pending until the AI resolves them; scenarios control which troop types exist in their era
- __scenario hub:__ browse, vote on and import community scenarios from the in-game **Community** tab, and publish your own
- __self-hostable:__ run your own instance with your own AI backend completely offline

---

## 🚀 Play

### In your browser

**[openhistoria.com](https://openhistoria.com)** — nothing to install. Games are saved in
your browser, and you bring your own AI key (it goes straight to your provider, never to
us). The world map is served by the community [content-node network](https://github.com/Open-Historia/open-historia-node).

Local AI (Ollama, LM Studio) needs one extra step in the browser: the local server has
to allow the site's origin, e.g. start Ollama with
`OLLAMA_ORIGINS=https://openhistoria.com`. Calls go straight browser → provider; nothing
reaches us.

### Manual (self-host / local dev)

Prerequisites: [Git](https://git-scm.com/) and [Node.js](https://nodejs.org/) 22 LTS or newer (minimum 20.19 / 22.12 — the build runs on Vite 7, which requires it), and [bun](https://bun.sh) (the repo uses `bun install`; the lockfile `bun.lock` is gitignored).

```bash
git clone https://github.com/Open-Historia/open-historia.git
cd open-historia
bun scripts/fetch-map-assets.mjs   # Download the world map data (see note below)
bun install                        # Install dependencies (includes OpenLayers etc. for the editor)
bun run dev:web                     # Local dev server (Vite, web mode)
```

Then open the URL Vite prints (default **http://localhost:5173**) in your browser. To
produce the deployable site bundle instead:

```bash
bun run build:site                  # → dist-site/  (the full openhistoria.com bundle)
```

> **Note:** the large map binaries (`*.pmtiles`, `public/assets/*-seed.*`, and
> `data/scenarios/default/regions.geojson`) are **not** in the repo — they are
> hosted as [GitHub Release assets](https://github.com/Open-Historia/open-historia/releases/tag/map-data)
> and downloaded by `scripts/fetch-map-assets.mjs`. No Git LFS is needed.

### Deploy

The site deploys to **Vercel**. `vercel.json` (committed) sets `installCommand: "bun install"`
and `buildCommand: "bun run build:site"` with `outputDirectory: "dist-site"`; Vercel detects
bun automatically. A push that runs `build:site` produces `dist-site/`, which is what Vercel
serves — nothing else is required for the live site.

---

## 🌍 Scenarios

**Modern Day** is the only built-in scenario. All other official presets — *World War II — 1939*,
*Medieval — 1200 AD*, *Rome — 117 AD*, *Mongol World — 1300 AD*, *New World — 1650*, and
*Bronze Age — 1200 BC* — live on the
[**Scenario Hub**](https://github.com/Open-Historia/Open-historia-scenarios), pinned at the top of
the in-game **Community** tab. Import any of them with one click, or publish your own.

To rebuild an official preset from source (specs live in `scripts/presets/`):

```bash
bun scripts/presets/build-preset.mjs scripts/presets/wwii-1939.spec.mjs
```

To regenerate the built-in Modern Day map: `bun scripts/build-default-map.mjs`

## 🗺️ Map editor

Open any scenario's editor and click **🗺️ Open Map Editor** (or visit
`http://localhost:5173/?editor=1` for the standalone editor — Vite's default dev port). Draw regions, split and
merge borders freehand, paint owners, import 70k cities, sign your map, then
**Apply & Play**.

## 🖥️ Host a server node

Want to help the network? Run a **content node** on your own device to cache and serve
the game's map data to nearby players so everyone loads faster. It's a one-click install
and deliberately safe — a node only ever serves **read-only, checksum-verified** map
files, and never touches anyone's games, accounts, AI keys, or code.

➡️ **[Set up a node → Open-Historia/open-historia-node](https://github.com/Open-Historia/open-historia-node)**

Your node registers itself and starts serving players once an admin accepts it. See the
[node README](https://github.com/Open-Historia/open-historia-node#readme) for the full
walkthrough (including a free Cloudflare Tunnel to put it online).
