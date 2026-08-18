/*!
 * Open Historia Map Editor
 * Copyright (c) 2026 Nicholas Krol - MIT License (see src/Editor/LICENSE).
 */
// Shared UI constants for the map editor, matching the game's GameUI look.
//
// Migrated to the project design language (DESIGN.md via src/design/tokens.js):
// warm canvas-soft surfaces with 1px hairline borders, tight 3–4px radii, no
// blur and no drop shadows (elevation = surface contrast + hairlines). The old
// dark-glass chrome (rgba(17,24,39,.9) + backdrop blur + 12px radii + blue
// #3b82f6 accent) is gone from these presets; active/selected states now use
// the polarity flip (off-white fill + dark text) instead of a chromatic accent.
//
// Export names and signatures are unchanged — every editor panel imports from
// here, so keep them stable when restyling.

import { colors, fonts, rounded, typography } from "../design/tokens.js";

// LEGACY EXPORTS — kept only because map RENDERING still consumes them:
// olStyle.js uses ACCENT_RGB for selection highlights on the map itself, which
// is data visualization, not brand chrome (DESIGN.md's no-accent rule governs
// UI chrome, not gameplay data). Do NOT introduce new chrome consumers of
// these; use the token-based presets below.
export const ACCENT = "#3b82f6";
export const ACCENT_RGB = [59, 130, 246];

export const panelSurface = {
  backgroundColor: colors.canvasSoft,
  border: `1px solid ${colors.hairline}`,
  borderRadius: rounded.md,
  color: colors.ink,
  fontFamily: fonts.sans,
};

// Active state is the design system's polarity flip: off-white fill + dark
// text (the same move as the featured pricing tier in DESIGN.md's examples).
export const toolButton = (active, disabled) => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
  minWidth: "34px",
  height: "34px",
  padding: "0 8px",
  background: active ? colors.primary : colors.canvas,
  border: active ? `1px solid ${colors.primary}` : `1px solid ${colors.hairline}`,
  borderRadius: rounded.sm,
  color: disabled ? colors.mute : active ? colors.onPrimary : colors.ink,
  cursor: disabled ? "not-allowed" : "pointer",
  fontSize: "13px",
  fontWeight: 600,
  transition: "background 0.12s, border 0.12s",
});

export const pillButton = (active) => ({
  background: active ? colors.primary : colors.canvas,
  border: active ? `1px solid ${colors.primary}` : `1px solid ${colors.hairline}`,
  borderRadius: rounded.sm,
  color: active ? colors.onPrimary : colors.ink,
  cursor: "pointer",
  fontSize: "12px",
  fontWeight: 600,
  padding: "5px 9px",
});

// Inputs sit INSIDE canvas-soft panels, so they take the darker canvas fill
// for contrast (DESIGN.md's text-input preset targets inputs on the canvas
// band; inverting the fill here keeps the same hairline + tight-radius chrome).
export const inputStyle = {
  width: "100%",
  padding: "0.5rem 0.6rem",
  borderRadius: rounded.sm,
  border: `1px solid ${colors.hairline}`,
  backgroundColor: colors.canvas,
  color: colors.ink,
  fontSize: "0.85rem",
  outline: "none",
  boxSizing: "border-box",
};

export const labelDim = {
  color: colors.mute,
  ...typography.caption,
  fontWeight: 600,
  letterSpacing: "0.02em",
  textTransform: "uppercase",
};
