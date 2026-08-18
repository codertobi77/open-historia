// Shared style vocabulary for the scenario editor surfaces.
// Imported by scenarios.jsx (ScenarioTopBar) and ScenarioCreatorView.jsx
// (the 4-step wizard) so the two surfaces stay in sync without duplicating
// large inline style objects.
//
// Migrated to the project design language (DESIGN.md via src/design/tokens.js):
// the old glass chrome (dark gradient + backdrop blur + heavy shadow + pill
// buttons) is replaced by warm canvas-soft surfaces, 1px hairline borders, and
// tight 3–4px radii. Export names are unchanged — keep them stable.

import { colors, rounded, spacing, typography } from "../../design/tokens.js";

export const surfaceStyle = {
  background: colors.canvasSoft,
  border: `1px solid ${colors.hairline}`,
};

export const actionButtonStyle = {
  alignItems: "center",
  background: colors.canvas,
  border: `1px solid ${colors.hairline}`,
  borderRadius: rounded.sm,
  color: colors.ink,
  cursor: "pointer",
  display: "inline-flex",
  ...typography.buttonMd,
  gap: "0.4rem",
  justifyContent: "center",
  minHeight: "2.1rem",
  padding: `0 ${spacing.lg}px`,
  transition: "background 0.18s ease, border-color 0.18s ease",
};

export const fieldLabelStyle = {
  color: colors.bodyStrong,
  display: "block",
  ...typography.caption,
  fontWeight: 600,
  letterSpacing: "0.04em",
  marginBottom: "0.45rem",
  textTransform: "uppercase",
};

// Inputs sit INSIDE canvas-soft surfaces, so they take the darker canvas fill
// for contrast while keeping the hairline + tight-radius chrome.
export const inputStyle = {
  background: colors.canvas,
  border: `1px solid ${colors.hairline}`,
  borderRadius: rounded.sm,
  color: colors.ink,
  ...typography.bodySm,
  outline: "none",
  padding: `${spacing.sm}px ${spacing.md}px`,
  width: "100%",
};

export const textareaStyle = {
  ...inputStyle,
  minHeight: "8.5rem",
  resize: "vertical",
};

export const BAR_HEIGHT = 64;
export const TOP_BAR_OFFSET = "4.75rem";
