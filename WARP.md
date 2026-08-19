# Open Historia — Project Rules

## UI development (read before any UI change)

- `DESIGN.md` (repo root) is the project's design-language reference. Read it before writing or modifying any UI code under `src/`. Full workflow and policy: `docs/design.md`.
- Consume the design system through `src/design/tokens.js` (the code form of DESIGN.md). Import colors, typography, spacing, radii, and component presets from it — do not hard-code hex values, radii, or font stacks in components.
- Hard constraints (from DESIGN.md's do/don'ts):
  - Warm dark canvas `#2b2622` is the page surface. Never pure black or neutral gray — the warmth IS the identity.
  - No chromatic brand accents. The off-white `#f7f5f0` doubles as primary text and CTA fill. Exemption: functional/data colors (map ownership fills, unit-strength green/amber/red, semantic badges) are data visualization, not brand chrome, and stay.
  - Button radii are 3–4px (`rounded.sm` / `rounded.md`). No pill CTAs — `rounded.full` is reserved for icon containers and status pills.
  - Display type is Inter weight 400 with negative letter tracking; never 700+ headlines. Inter for narrative, DM Mono for code/terminal content.
  - Elevation = hairline borders + surface contrast (`canvas-soft` on `canvas`). No drop shadows on cards, no gradients/aurora backdrops.
- Scope: applies to the app UI in `src/` (game HUD, map editor, startup screen, new components). The landing page `site/index.html` keeps its established parchment/gold identity (Cinzel/EB Garamond) unless the maintainer explicitly decides to redesign it.
- Migration policy: the legacy glass chrome — `rgba(17,24,39,0.9)` surfaces, `backdrop-filter: blur`, 12px radii, blue `#3b82f6` accent, pill buttons (see `src/Editor/editorStyles.js`, `src/Game/GameUI/scenarioEditorStyles.js`, `docs/game-ui.md` §14) — predates the design system. When you touch a component for other reasons, align its chrome with `tokens.js`. Do not perform wholesale restyles unless explicitly asked.
- If `DESIGN.md` is edited or regenerated (e.g. via `npx getdesign`), update `src/design/tokens.js` in the same change so spec and code never drift.

## General

- Package manager is **bun** (`bun install`, `bun run dev`, `bun test`). Web build only — there is no mobile/Electron/desktop variant.
- Contributing conventions (license banners on new files, verbose why-comments, commit/attribution rules, frozen identifiers): `docs/conventions.md`.
