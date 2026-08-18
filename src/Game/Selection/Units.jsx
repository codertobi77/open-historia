/*! Open Historia — troop selection & orders UI © 2026 Nicholas Krol, MIT (see src/Editor/LICENSE). */
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useMap } from "react-map-gl/maplibre";
import {
  subscribeUnits,
  getUnitById,
  getPlayerCode,
  setInteractionMode,
  removeUnit,
} from "../Map/unitsController.js";
import { useCountryDisplayName } from "../../runtime/polityNames.js";
import { colors, fonts, rounded } from "../../design/tokens.js";

let _setSelection = null;
let _currentSelection = null;
let _dismiss = null;

// Called by the map click dispatcher (Nations.jsx) when a unit is clicked.
export const onUnitSelected = ({ id, lngLat }) => {
  if (!_setSelection || !id) return;

  if (_currentSelection && _currentSelection.id === id) {
    _dismiss?.();
    return;
  }
  if (_currentSelection) _dismiss?.();
  _setSelection({ id, lngLat });
};

// Called by the dispatcher when a region (or empty space) is selected, so the
// two popups never show at once.
export const dismissUnitPopup = () => {
  if (_currentSelection) _dismiss?.();
};

const TYPE_LABEL = {
  infantry: "Infantry",
  armor: "Armor",
  air: "Air",
  naval: "Naval",
  artillery: "Artillery",
  garrison: "Garrison",
};
const TYPE_GLYPH = {
  infantry: "🛡",
  armor: "⚙",
  air: "✈",
  naval: "⚓",
  artillery: "💥",
  garrison: "🏰",
};

const ANIM_ID = "unit-popup-anims";
if (typeof document !== "undefined" && !document.getElementById(ANIM_ID)) {
  const style = document.createElement("style");
  style.id = ANIM_ID;
  style.textContent = `
  @keyframes unitPopupFadeIn {
    from { opacity: 0; transform: translateY(calc(-100% + 10px)); }
    to   { opacity: 1; transform: translateY(-100%); }
  }
  @keyframes unitPopupFadeOut {
    from { opacity: 1; transform: translateY(-100%); }
    to   { opacity: 0; transform: translateY(calc(-100% + 10px)); }
  }`;
  document.head.appendChild(style);
}

const ActionButton = ({ label, onClick, tone = "neutral" }) => {
  const [hovered, setHovered] = useState(false);
  // Primary = polarity flip (off-white fill + dark text); danger keeps its red
  // tint as a functional/semantic color, not brand chrome.
  const tones = {
    neutral: { background: colors.canvas, color: colors.ink },
    danger: { background: "rgba(220,70,70,0.25)", color: colors.ink },
    primary: { background: colors.primary, color: colors.onPrimary },
  };
  const toneStyle = tones[tone] ?? tones.neutral;
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: 1,
        background: hovered && tone !== "primary" ? colors.canvasSoft : toneStyle.background,
        border: `1px solid ${tone === "primary" ? colors.primary : colors.hairline}`,
        borderRadius: rounded.sm,
        color: toneStyle.color,
        cursor: "pointer",
        fontSize: "11px",
        fontWeight: 600,
        padding: "5px 0",
        transition: "background 0.15s",
      }}
    >
      {label}
    </button>
  );
};

const UnitPopup = () => {
  const [selection, setSelection] = useState(null);
  const [unit, setUnit] = useState(null);
  const [screenPos, setScreenPos] = useState(null);
  const [animKey, setAnimKey] = useState(0);
  const [dismissing, setDismissing] = useState(false);
  const { current: map } = useMap();

  _setSelection = (value) => {
    _currentSelection = value;
    setDismissing(false);
    setSelection(value);
    setUnit(value ? getUnitById(value.id) : null);
    if (value !== null) setAnimKey((key) => key + 1);
  };

  _dismiss = () => setDismissing(true);

  // Keep the shown unit in sync with controller state; auto-dismiss if it dies.
  useEffect(() => {
    const unsubscribe = subscribeUnits(() => {
      if (!_currentSelection) return;
      const fresh = getUnitById(_currentSelection.id);
      if (!fresh) {
        _dismiss?.();
      } else {
        setUnit(fresh);
      }
    });
    return unsubscribe;
  }, []);

  const handleAnimationEnd = (e) => {
    if (e.animationName !== "unitPopupFadeOut") return;
    _currentSelection = null;
    setSelection(null);
    setUnit(null);
    setDismissing(false);
  };

  useEffect(() => {
    if (!map || !selection) {
      setScreenPos(null);
      return;
    }

    const update = () => {
      const center = map.getCenter();
      const toRad = (deg) => (deg * Math.PI) / 180;
      const anchor = unit && Number.isFinite(unit.lng)
        ? { lng: unit.lng, lat: unit.lat }
        : selection.lngLat;
      const lat1 = toRad(center.lat);
      const lat2 = toRad(anchor.lat);
      const dLng = toRad(anchor.lng - center.lng);
      const cosAngle =
        Math.sin(lat1) * Math.sin(lat2) + Math.cos(lat1) * Math.cos(lat2) * Math.cos(dLng);

      if (cosAngle < 0) {
        setScreenPos(null);
        return;
      }

      const point = map.project(anchor);
      setScreenPos((prev) => {
        if (prev && Math.abs(prev.x - point.x) < 0.5 && Math.abs(prev.y - point.y) < 0.5) {
          return prev;
        }
        return { x: point.x, y: point.y };
      });
    };

    let frameId = 0;
    const scheduleUpdate = () => {
      if (frameId) return;
      frameId = requestAnimationFrame(() => {
        frameId = 0;
        update();
      });
    };

    update();
    map.on("move", scheduleUpdate);
    return () => {
      if (frameId) cancelAnimationFrame(frameId);
      map.off("move", scheduleUpdate);
    };
  }, [map, selection, unit]);

  // Full owner name, never the code (called before the early return —
  // hook order must not depend on the selection).
  const ownerName = useCountryDisplayName(unit?.ownerCode || "");

  if (!selection || !screenPos || !unit) return null;

  const POPUP_WIDTH = 220;
  const isOwn = unit.ownerCode === getPlayerCode();
  const strengthPct = Math.max(2, Math.min(100, (unit.strength / 1000) * 100));

  const beginMove = () => {
    setInteractionMode({ kind: "move", unitId: unit.id });
    _dismiss?.();
  };
  const beginAttack = () => {
    setInteractionMode({ kind: "attack", unitId: unit.id });
    _dismiss?.();
  };
  const disband = () => {
    removeUnit(unit.id);
    _dismiss?.();
  };

  return createPortal(
    <div
      key={animKey}
      onAnimationEnd={handleAnimationEnd}
      style={{
        position: "fixed",
        left: screenPos.x - POPUP_WIDTH / 2,
        top: screenPos.y - 14,
        width: `${POPUP_WIDTH}px`,
        zIndex: 21,
        pointerEvents: dismissing ? "none" : "auto",
        animation: dismissing
          ? "unitPopupFadeOut 0.18s cubic-bezier(0.4, 0, 1, 1) both"
          : "unitPopupFadeIn 0.22s cubic-bezier(0.22, 1, 0.36, 1) both",
        fontFamily: fonts.sans,
      }}
    >
      {/* Tokenized chrome: warm canvas-soft + hairline, no blur/shadow. */}
      <div
        style={{
          backgroundColor: colors.canvasSoft,
          borderRadius: rounded.md,
          overflow: "hidden",
          border: `1px solid ${colors.hairline}`,
          color: colors.ink,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "9px", padding: "10px 12px 8px" }}>
          <span style={{ fontSize: "1.5rem", lineHeight: 1 }}>{TYPE_GLYPH[unit.type] ?? "🛡"}</span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: "13px", wordBreak: "break-word" }}>{unit.name}</div>
            <div style={{ fontSize: "11px", color: colors.mute }}>
              {TYPE_LABEL[unit.type] ?? unit.type} · {ownerName}
            </div>
          </div>
          <button
            onClick={() => _dismiss?.()}
            style={{
              background: colors.canvas,
              border: `1px solid ${colors.hairline}`,
              borderRadius: rounded.sm,
              width: "20px",
              height: "20px",
              cursor: "pointer",
              color: colors.mute,
              fontSize: "11px",
              padding: 0,
              flexShrink: 0,
            }}
          >
            {"✕"}
          </button>
        </div>

        <div style={{ padding: "0 12px 10px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: colors.body, marginBottom: "3px" }}>
            <span>Strength</span>
            <span style={{ fontWeight: 600, color: colors.ink }}>{unit.strength}</span>
          </div>
          {/* Strength bar green/amber/red is unit-strength data visualization —
              a DESIGN.md functional-color exemption. */}
          <div style={{ height: "6px", borderRadius: rounded.sm, background: colors.canvas, overflow: "hidden" }}>
            <div
              style={{
                width: `${strengthPct}%`,
                height: "100%",
                background: unit.strength > 600 ? "#4ade80" : unit.strength > 250 ? "#fbbf24" : "#f87171",
              }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: colors.mute, marginTop: "7px" }}>
            <span>Status</span>
            <span style={{ color: colors.ink, textTransform: "capitalize" }}>{unit.status}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: colors.mute, marginTop: "3px" }}>
            <span>Location</span>
            <span style={{ color: colors.bodyStrong }}>
              {unit.lat.toFixed(1)}, {unit.lng.toFixed(1)}
            </span>
          </div>

          {isOwn ? (
            <div style={{ display: "flex", gap: "5px", marginTop: "10px" }}>
              <ActionButton label="Move" tone="primary" onClick={beginMove} />
              <ActionButton label="Attack" tone="danger" onClick={beginAttack} />
              <ActionButton label="Disband" onClick={disband} />
            </div>
          ) : (
            <div style={{ marginTop: "9px", fontSize: "10px", color: colors.mute, textAlign: "center" }}>
              Enemy unit — select one of your own units to attack it.
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default UnitPopup;
