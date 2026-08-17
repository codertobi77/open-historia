# Design System — `DESIGN.md` + `src/design/tokens.js`

The project's UI design language is specified in **`DESIGN.md`** at the repo root (installed via `npx getdesign add warp` — a warm near-charcoal, Inter-driven language with terminal-flavored chrome and deliberately quiet CTAs). **`src/design/tokens.js`** is its code form: the colors, type scale, spacing, radii, and ready-to-spread React style presets that UI code actually imports. The two files must stay in sync — `DESIGN.md` is the spec, `tokens.js` is the consumption path.

---

## Workflow for UI work

1. **Read `DESIGN.md` first.** Any change that renders pixels under `src/` (HUD panels, editor surfaces, the startup screen, new components) is written against this design language. The do/don'ts section at the bottom of `DESIGN.md` is normative.
2. **Import, don't hard-code.** Pull values from `src/design/tokens.js`; never inline raw hex values, radii, or font stacks. Component presets are complete surface treatments — spread one, then override only what the component needs:

```jsx
import { components, spacing, typography } from "../design/tokens.js";

// House chrome: canvas-soft fill, 1px hairline, 4px radius, no drop shadow.
<div style={{ ...components.cardContent, display: "grid", gap: spacing.sm }}>
  <h3 style={{ ...typography.displaySm, margin: 0 }}>Scenario details</h3>
  <button style={components.buttonPrimary}>Play</button>
</div>
```

3. **Elevation is hairlines + surface contrast.** `canvas-soft` on `canvas` with a 1px `hairline` border (see `DESIGN.md` §Elevation & Depth). Don't add drop shadows to cards or gradient/aurora backdrops.
4. **Fonts are already loaded** in `index.html` via Google Fonts (`display=swap`): Inter 400/500, DM Mono 400, Instrument Serif 400 (+ italic). The stacks live in `tokens.js` `fonts.*` — reuse them, don't redeclare them.

## The voice in one paragraph

Warm dark canvas (`#2b2622`, never pure black), warm off-white ink (`#f7f5f0`) that doubles as the only "accent" and the CTA fill, tight 3–4px button radii, Inter 400 display type with negative tracking, DM Mono for anything terminal/code-flavored, and no gradients or shadows. If a design seems to need a chromatic brand accent, it is off-spec — re-read the don'ts.

**Exemption — data and semantics:** the no-accent rule governs *brand chrome*, not gameplay data. Map ownership colors, unit-strength green/amber/red, difficulty and asset badges are data visualization and keep their functional colors.

## Scope & migration policy

| Surface | Policy |
|---|---|
| New UI under `src/` | Fully on the design system. |
| Existing HUD / editor surfaces | Touch-and-align: when a component is modified for other reasons, migrate its chrome to `tokens.js`. No wholesale restyles without an explicit task. |
| Landing page `site/index.html` | Out of scope — it keeps its established parchment/gold identity (Cinzel/EB Garamond). `DESIGN.md`'s band/card components are available if a redesign is ever decided. |

Legacy values being replaced (still present in `src/Editor/editorStyles.js`, `src/Game/GameUI/scenarioEditorStyles.js`, and the `baseStyle`/`surface` objects described in [Game UI](game-ui.md) §14): `rgba(17,24,39,0.9)` glass surfaces, `backdrop-filter: blur`, 12px radii, the blue `#3b82f6` accent, and pill (`999px`) buttons. They predate the design system — don't propagate them into new code.

## Keeping the spec and the tokens in sync

`DESIGN.md` may be regenerated or refined (re-running `npx getdesign`, or hand-editing as the project's taste evolves). Whenever it changes, update `src/design/tokens.js` in the same change so the code never drifts from the spec, and skim the do/don'ts for anything that invalidates in-flight UI work.
