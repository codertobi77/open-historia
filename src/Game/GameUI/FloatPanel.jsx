/*! Open Historia — portions (draggable/resizable panel wrapper) © 2026 Nicholas Krol, MIT (see src/Editor/LICENSE). */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useIsMobile } from "../../runtime/useIsMobile.js";
// Design tokens (DESIGN.md / tokens.js): warm canvas-soft surface + hairline
// replaces the legacy glass chrome (rgba/blur/shadow, 16px radius, blue accents).
import { colors, fonts, rounded } from "../../design/tokens.js";

// A reusable fixed-position panel you can drag by its header and resize from its
// bottom-right corner. Geometry (x/y/w/h) is persisted to localStorage and
// clamped to the viewport, mirroring the advisor-width pattern (main.jsx).
// On mobile the wrapper becomes a no-op passthrough so each panel keeps its own
// adaptive mobile layout (panels there are full-width bars/drawers, not floats).

const STORAGE_PREFIX = "oh-floatpanel-";
const HEADER_HEIGHT = "2.35rem";

const finiteOr = (value, fallback) => (Number.isFinite(value) ? value : fallback);

const clampViewport = ({ x, y, w, h }) => {
  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 720;
  const width = Math.min(Math.max(w, 0), vw);
  const height = Math.min(Math.max(h, 0), vh);
  return {
    x: Math.min(Math.max(x, 0), Math.max(0, vw - width)),
    y: Math.min(Math.max(y, 0), Math.max(0, vh - height)),
    w: width,
    h: height,
  };
};

const readStored = (panelId) => {
  if (!panelId) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + panelId);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const x = finiteOr(Number(parsed.x), NaN);
    const y = finiteOr(Number(parsed.y), NaN);
    const w = finiteOr(Number(parsed.w), NaN);
    const h = finiteOr(Number(parsed.h), NaN);
    if (![x, y, w, h].every(Number.isFinite)) return null;
    return { x, y, w, h };
  } catch { /* private-mode storage — fall through */ }
  return null;
};

const writeStored = (panelId, geom) => {
  if (!panelId) return;
  try {
    window.localStorage.setItem(STORAGE_PREFIX + panelId, JSON.stringify(geom));
  } catch { /* ignore */ }
};

const FloatPanel = ({
  panelId,
  title,
  subtitle,
  isOpen = true,
  onClose,
  initialX,
  initialY,
  initialW,
  initialH,
  minW = 280,
  minH = 280,
  zIndex = 9998,
  resizeEnabled = true,
  dragEnabled = true,
  // Extra style applied to the inner content surface (border, background, ...).
  surfaceStyle = {},
  // When closed, keep the node mounted for transitions but hide it.
  hideWhenClosed = true,
  children,
}) => {
  const isMobile = useIsMobile();
  const storedRef = useRef(null);
  if (storedRef.current === null) storedRef.current = readStored(panelId);

  const computedInitial = (() => {
    const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
    const vh = typeof window !== "undefined" ? window.innerHeight : 720;
    return {
      x: Number.isFinite(initialX) ? initialX : Math.max(8, Math.round(vw * 0.04)),
      y: Number.isFinite(initialY) ? initialY : Math.max(8, Math.round(vh * 0.12)),
      w: Number.isFinite(initialW) ? initialW : Math.min(420, vw - 16),
      h: Number.isFinite(initialH) ? initialH : Math.min(520, vh - 16),
    };
  })();

  const [geom, setGeom] = useState(() => {
    const base = {
      x: computedInitial.x,
      y: computedInitial.y,
      w: Math.max(computedInitial.w, minW),
      h: Math.max(computedInitial.h, minH),
    };
    return storedRef.current
      ? clampViewport({ ...base, ...storedRef.current })
      : clampViewport(base);
  });

  const dragRef = useRef(null);
  const resizeRef = useRef(null);

  const persist = useCallback((next) => {
    setGeom((current) => {
      const merged = { ...current, ...next };
      const clamped = clampViewport({
        ...merged,
        w: Math.max(merged.w, minW),
        h: Math.max(merged.h, minH),
      });
      writeStored(panelId, clamped);
      return clamped;
    });
  }, [minW, minH, panelId]);

  // Keep geometry valid if the viewport shrinks below it while hidden.
  useEffect(() => {
    const onResize = () => setGeom((g) => clampViewport({ ...g, w: Math.max(g.w, minW), h: Math.max(g.h, minH) }));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [minW, minH]);

  // Drag handlers — pointer events for unified mouse/touch. Dragging is disabled
  // on mobile and when dragEnabled is false; the header still renders but its
  // cursor stays default and the handler no-ops.
  const onHeaderPointerDown = useCallback((event) => {
    if (!dragEnabled || isMobile || event.button !== 0) return;
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const origin = { x: geom.x, y: geom.y };
    const controller = new AbortController();
    const move = (ev) => {
      persist({ x: origin.x + (ev.clientX - startX), y: origin.y + (ev.clientY - startY) });
    };
    const up = () => {
      controller.abort();
    };
    dragRef.current = controller;
    window.addEventListener("pointermove", move, { signal: controller.signal });
    window.addEventListener("pointerup", up, { signal: controller.signal });
  }, [dragEnabled, isMobile, geom.x, geom.y, persist]);

  const onResizePointerDown = useCallback((event) => {
    if (!resizeEnabled || isMobile || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startY = event.clientY;
    const origin = { w: geom.w, h: geom.h };
    const controller = new AbortController();
    const move = (ev) => {
      persist({ w: origin.w + (ev.clientX - startX), h: origin.h + (ev.clientY - startY) });
    };
    const up = () => { controller.abort(); };
    resizeRef.current = controller;
    window.addEventListener("pointermove", move, { signal: controller.signal });
    window.addEventListener("pointerup", up, { signal: controller.signal });
  }, [resizeEnabled, isMobile, geom.w, geom.h, persist]);

  // Abort any in-flight drag/resize if the panel closes mid-gesture.
  useEffect(() => {
    if (!isOpen) {
      dragRef.current?.abort();
      resizeRef.current?.abort();
    }
  }, [isOpen]);

  if (isMobile) {
    // Passthrough: render the children directly so the panel keeps its own
    // adaptive mobile layout (bottom-docked bars / drawer, full-width, etc.).
    return hideWhenClosed && !isOpen ? null : children;
  }

  const headerVisible = Boolean(title || onClose);
  // Warm canvas-soft surface + 1px hairline, no blur/shadow. Token-driven chrome
  // (DESIGN.md: elevation = surface contrast + hairlines, not glass + shadows).
  // Callers may still override anything via surfaceStyle for panel-specific needs;
  // the defaults here establish the shared FloatPanel identity.
  const mergedSurface = {
    backgroundColor: colors.canvasSoft,
    border: `1px solid ${colors.hairline}`,
    borderRadius: `${rounded.md}px`,
    color: colors.ink,
    fontFamily: fonts.sans,
    ...surfaceStyle,
  };

  return (
    <div
      style={{
        position: "fixed",
        left: `${geom.x}px`,
        top: `${geom.y}px`,
        width: `${geom.w}px`,
        height: `${geom.h}px`,
        zIndex,
        pointerEvents: isOpen ? "auto" : "none",
        opacity: isOpen ? 1 : 0,
        visibility: hideWhenClosed && !isOpen ? "hidden" : "visible",
        transition: "opacity 0.35s ease",
        ...mergedSurface,
      }}
    >
      {headerVisible && (
        <div
          onPointerDown={onHeaderPointerDown}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: HEADER_HEIGHT,
            padding: "0 0.75rem",
            borderBottom: `1px solid ${colors.hairline}`,
            cursor: dragEnabled ? "grab" : "default",
            flexShrink: 0,
            userSelect: "none",
            touchAction: "none",
          }}
        >
          <span style={{ fontSize: "0.82rem", fontWeight: 700, letterSpacing: "0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-flex", alignItems: "baseline", gap: "0.45rem", color: colors.ink }}>
            {title || ""}
            {subtitle && (
              <span style={{ fontSize: "0.72rem", fontWeight: 500, color: colors.mute, letterSpacing: "0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {subtitle}
              </span>
            )}
          </span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close panel"
              style={{
                background: "none",
                border: "none",
                borderRadius: `${rounded.sm}px`,
                color: colors.mute,
                cursor: "pointer",
                fontSize: "1.05rem",
                lineHeight: 1,
                padding: "0.15rem 0.35rem",
                flexShrink: 0,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = colors.primary; e.currentTarget.style.background = colors.canvas; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = colors.mute; e.currentTarget.style.background = "none"; }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {"\u2715"}
            </button>
          )}
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {children}
      </div>
      {resizeEnabled && (
        <div
          onPointerDown={onResizePointerDown}
          aria-hidden="true"
          style={{
            position: "absolute",
            right: 0,
            bottom: 0,
            width: "1.1rem",
            height: "1.1rem",
            cursor: "nwse-resize",
            touchAction: "none",
            // A subtle corner grip drawn with two L borders.
            borderBottomRightRadius: `${rounded.md}px`,
          }}
        >
          <span style={{ position: "absolute", right: "0.3rem", bottom: "0.2rem", width: "0.55rem", height: "0.55rem", borderBottom: `2px solid ${colors.hairline}`, borderRight: `2px solid ${colors.hairline}` }} />
        </div>
      )}
    </div>
  );
};

export { FloatPanel };
export default FloatPanel;
