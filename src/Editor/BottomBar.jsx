/*!
 * Open Historia Map Editor
 * Copyright (c) 2026 Nicholas Krol - MIT License (see src/Editor/LICENSE).
 */

// Bottom status bar: Regions / Features / Types counts (clickable to open their
// managers), a Layers button, the Basemap picker button (opens the full basemap
// overlay), the map name, and the save-status dot.

import Icon from "./Icon.jsx";
import { panelSurface, inputStyle } from "./editorStyles.js";
import { editorBasemapById } from "./basemaps.js";
import { colors, rounded } from "../design/tokens.js";

// Save-status colors are functional/semantic (green = saved, amber = dirty,
// red = error) — a DESIGN.md data-color exemption, not brand chrome.
const SAVE = {
  saved: { color: "#22c55e", label: "All saved" },
  dirty: { color: "#f59e0b", label: "Unsaved changes" },
  saving: { color: "#f59e0b", label: "Saving…" },
  error: { color: "#ef4444", label: "Save failed" },
};

const Chip = ({ icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    disabled={!onClick}
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "5px 10px",
      // Active state is the polarity flip (off-white fill + dark text), not a
      // chromatic accent.
      background: active ? colors.primary : colors.canvas,
      border: active ? `1px solid ${colors.primary}` : `1px solid ${colors.hairline}`,
      borderRadius: rounded.sm,
      fontSize: 12,
      fontWeight: 600,
      color: active ? colors.onPrimary : colors.ink,
      cursor: onClick ? "pointer" : "default",
    }}
  >
    <Icon name={icon} size={14} />
    {label}
  </button>
);

const BottomBar = ({
  counts,
  basemap,
  hasCustomBackground,
  onOpenBasemaps,
  name,
  onNameChange,
  saveStatus,
  openPanel,
  onOpenPanel,
  search,
}) => {
  const save = SAVE[saveStatus] || SAVE.saved;
  const basemapLabel = hasCustomBackground ? "Custom" : editorBasemapById(basemap)?.label || "Basemap";
  return (
    <div
      style={{
        ...panelSurface,
        position: "fixed",
        bottom: 12,
        left: 12,
        right: 12,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        zIndex: 30,
        flexWrap: "wrap",
      }}
    >
      {search}
      <Chip icon="list" label={`Regions: ${counts.regions}`} active={openPanel === "regions"} onClick={() => onOpenPanel("regions")} />
      <Chip icon="pin" label={`Features: ${counts.features}`} active={openPanel === "features"} onClick={() => onOpenPanel("features")} />
      <Chip icon="types" label={`Types: ${counts.types}`} active={openPanel === "types"} onClick={() => onOpenPanel("types")} />
      <Chip icon="layers" label="Layers" active={openPanel === "layers"} onClick={() => onOpenPanel("layers")} />
      <Chip icon="image" label="Reference" active={openPanel === "reference"} onClick={() => onOpenPanel("reference")} />

      <div style={{ flex: 1 }} />

      <button
        type="button"
        onClick={() => onOpenBasemaps?.()}
        title="Choose a built-in basemap, one of your uploaded basemaps, or upload a new one"
        style={{
          ...inputStyle,
          width: "auto",
          padding: "6px 11px",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <Icon name="layers" size={14} style={{ opacity: 0.75 }} />
        Basemap: {basemapLabel}
      </button>

      <input
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder="Map name"
        style={{ ...inputStyle, width: 190 }}
      />

      <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, color: colors.bodyStrong }}>
        {/* Status pill: full radius is sanctioned for status indicators. */}
        <span style={{ width: 9, height: 9, borderRadius: rounded.full, background: save.color }} />
        {save.label}
      </span>
    </div>
  );
};

export default BottomBar;
