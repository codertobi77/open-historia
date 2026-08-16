/*! Open Historia — portions (vendor chunks + web build plugins) © 2026 Nicholas Krol, MIT (see src/Editor/LICENSE). */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

// The big map binaries live in public/ so the dev server can serve them off disk,
// but the web build does NOT ship them in the bundle: the site fetches them from
// the content nodes / VITE_OH_PMTILES_URL, hash-verified against the signed manifest.
//
// Vite copies publicDir wholesale and offers no partial exclude, so without this
// plugin `bun run build:site` would duplicate ~160MB into dist-web/ and emit files
// no host should be asked to serve (regions.pmtiles alone is ~101 MB).
//
// The trap is that it only fires on a machine that has actually played. The files
// are gitignored and arrive from the map-data Release at first launch, so CI and a
// fresh clone build fine and the deploy failure looks random. Dropping them after
// the copy is the fix; "remember to delete them before deploying" is not.
const PMTILES = [
  'assets/regions.pmtiles',
  'assets/countries.pmtiles',
  'assets/cities.pmtiles',
]

// The map editor loads these seeds, but the web build resolves them from
// VITE_OH_PMTILES_URL instead (see regionImport.js), so it never reads them from
// the bundle — and it must not carry them: regions-seed.geojson is 52.8MB at z8
// and no host should be asked to serve a file that large.
const EDITOR_SEEDS = [
  'assets/regions-seed.geojson',
  'assets/cities-seed.json',
]

const dropMapBinaries = (isWeb) => {
  // Take outDir from the resolved config rather than assuming: --outDir varies
  // (dist-web for build:web/build:site).
  let outDir = 'dist'
  return {
    name: 'oh-drop-map-binaries',
    apply: 'build' as const,
    configResolved(config: { build: { outDir: string } }) {
      outDir = config.build.outDir
    },
    closeBundle() {
      for (const rel of isWeb ? [...PMTILES, ...EDITOR_SEEDS] : PMTILES) {
        const target = path.resolve(outDir, rel)
        if (fs.existsSync(target)) fs.rmSync(target)
      }
    },
  }
}

// Identifies THIS web build. It is baked into the bundle (VITE_WEB_BUILD) and written
// to version.json beside it, so a running page can tell whether the copy of the site
// it booted from is still the one being served. Computed once per build so both halves
// always agree. A plain timestamp is enough — it only ever has to differ from the last
// deploy and compare as "newer".
const WEB_BUILD_ID = String(Date.now())

// Emits version.json into the web build output. Deployed as /play/version.json (the
// assemble step copies dist-web wholesale), which is what the update banner polls.
const emitWebVersion = (isWeb: boolean) => {
  let outDir = 'dist'
  return {
    name: 'oh-web-version',
    apply: 'build' as const,
    configResolved(config: { build: { outDir: string } }) {
      outDir = config.build.outDir
    },
    closeBundle() {
      if (!isWeb) return
      fs.writeFileSync(
        path.resolve(outDir, 'version.json'),
        JSON.stringify({ build: WEB_BUILD_ID }),
      )
    },
  }
}

// https://vite.dev/config/
// `--mode web` (bun run build:web / build:site / dev:web) builds the website —
// the only surviving build mode.
export default defineConfig(({ mode }) => ({
  define: {
    // Empty off the web, which is what keeps the update banner inert in dev.
    'import.meta.env.VITE_WEB_BUILD': JSON.stringify(mode === 'web' ? WEB_BUILD_ID : ''),
    // Make the web flag a COMPILE-TIME literal so Rollup treats every
    // `if (import.meta.env.VITE_OH_WEB)` branch — and the web backend they
    // dynamically import (src/runtime/web/*) — as a constant. Boolean is safe:
    // every use site is a plain truthiness check.
    'import.meta.env.VITE_OH_WEB': JSON.stringify(mode === 'web'),
  },
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
    dropMapBinaries(mode === 'web'),
    emitWebVersion(mode === 'web'),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-maplibre': ['maplibre-gl'],
          'vendor-chartjs': ['chart.js'],
          'vendor-ol': ['ol'],
        },
      },
    },
  },
}))
