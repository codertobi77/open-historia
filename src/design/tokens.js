/*! Open Historia — portions (design tokens: the code form of the DESIGN.md design language) © 2026 Nicholas Krol, MIT (see src/Editor/LICENSE). */

// Design tokens for the Open Historia UI.
//
// `DESIGN.md` at the repo root is the human/agent-readable spec (installed via
// `npx getdesign add warp`): a warm near-charcoal, Inter-driven design language
// with terminal-flavored chrome and deliberately quiet CTAs. THIS module is how
// components actually consume it — import from here instead of hard-coding hex
// values, radii, spacing, or font stacks. If DESIGN.md changes, update this
// file in the same change so the spec and the code never drift (see
// docs/design.md for the full workflow).
//
// The two load-bearing ideas from the spec, repeated here because they are the
// ones a well-meaning edit is most likely to "fix" back into a bug:
//
// 1. There is NO chromatic brand accent. The warm off-white `colors.primary`
//    doubles as default text on canvas AND as the button-primary fill. The
//    legacy HUD's blue #3b82f6 accent (src/Editor/editorStyles.js,
//    src/Game/GameUI/scenarioEditorStyles.js) predates this system and is
//    being migrated away. Functional/data colors — map ownership fills, unit
//    strength green/amber/red — are data visualization, not brand accents,
//    and stay.
// 2. Elevation comes from surface contrast (canvas-soft on canvas) plus 1px
//    hairline borders. No drop shadows on cards, no gradients, no aurora
//    backdrops. The canvas tone #2b2622 is deliberately warm (a hint of
//    brown-beige); pure black or neutral gray breaks the identity.

export const colors = {
  // The brand's "primary" is a warm off-white: CTA fill AND default text.
  primary: "#f7f5f0",
  // Text placed ON the primary fill (button-primary labels).
  onPrimary: "#2b2622",
  // Default text on canvas — intentionally identical to primary.
  ink: "#f7f5f0",
  // Secondary body text: captions, supporting copy, footer lines.
  body: "#c9c0ad",
  // Mid-emphasis body text.
  bodyStrong: "#dad2c1",
  // Lowest-priority text: timestamps, fine print.
  mute: "#aea69c",
  // THE page surface. Warm dark; never substitute pure black/neutral gray.
  canvas: "#2b2622",
  // Lighter warm-dark fill for cards, mockup chrome, tiles.
  canvasSoft: "#383330",
  // 1px solid divider on dark surfaces.
  hairline: "#3f3a36",
};

// The canonical face pairing: Inter for every narrative/label role (working
// weights 400/500), DM Mono for terminal mockups and code, Instrument Serif
// for the rare editorial italic moment. All three are loaded in index.html
// via Google Fonts (display=swap) — reuse these stacks, don't redeclare them.
export const fonts = {
  sans: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  mono: '"DM Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
  serif: '"Instrument Serif", Georgia, "Times New Roman", serif',
};

// React inline-style objects. Spread them, then override what the component
// needs (e.g. `{ ...typography.displaySm, margin: 0 }`). Negative letter
// tracking on display levels is part of the voice — don't zero it out.
export const typography = {
  // Hero headline: 64px Inter weight 400, quietly confident, not a billboard.
  displayXl: {
    fontFamily: fonts.sans,
    fontSize: "64px",
    fontWeight: 400,
    lineHeight: "70.4px",
    letterSpacing: "-1.6px",
  },
  // Section headlines.
  displayLg: {
    fontFamily: fonts.sans,
    fontSize: "48px",
    fontWeight: 400,
    lineHeight: "52.8px",
    letterSpacing: "-1.2px",
  },
  // Sub-section displays.
  displayMd: {
    fontFamily: fonts.sans,
    fontSize: "32px",
    fontWeight: 500,
    lineHeight: "40px",
    letterSpacing: "-0.8px",
  },
  // Card titles and lead emphasis.
  displaySm: {
    fontFamily: fonts.sans,
    fontSize: "24px",
    fontWeight: 500,
    lineHeight: "32px",
    letterSpacing: "-0.4px",
  },
  // Instrument Serif italic editorial moments — rare, tagline-style phrases.
  displaySerif: {
    fontFamily: fonts.serif,
    fontSize: "48px",
    fontWeight: 400,
    lineHeight: "52px",
    letterSpacing: "-0.5px",
  },
  // Lead paragraphs.
  bodyLg: { fontFamily: fonts.sans, fontSize: "18px", fontWeight: 400, lineHeight: "28px" },
  // Default body.
  bodyMd: { fontFamily: fonts.sans, fontSize: "16px", fontWeight: 400, lineHeight: "24px" },
  // Bold inline body.
  bodyMdStrong: { fontFamily: fonts.sans, fontSize: "16px", fontWeight: 500, lineHeight: "24px" },
  // Secondary body.
  bodySm: { fontFamily: fonts.sans, fontSize: "14px", fontWeight: 400, lineHeight: "20px" },
  // Nav link / button-adjacent labels.
  bodySmStrong: { fontFamily: fonts.sans, fontSize: "14px", fontWeight: 500, lineHeight: "20px" },
  // Captions, fine print.
  caption: { fontFamily: fonts.sans, fontSize: "12px", fontWeight: 400, lineHeight: "16px" },
  // Terminal mockup body (DM Mono).
  code: { fontFamily: fonts.mono, fontSize: "13px", fontWeight: 400, lineHeight: "18px" },
  // Inline command snippets (DM Mono).
  codeMd: { fontFamily: fonts.mono, fontSize: "14px", fontWeight: 400, lineHeight: "20px" },
  // Button labels.
  buttonMd: { fontFamily: fonts.sans, fontSize: "14px", fontWeight: 500, lineHeight: "20px" },
};

// Border radii in px (numbers — React inline styles append px, and numbers
// stay usable in arithmetic). The brand's signature is how TIGHT these are:
// buttons live at sm/md (3–4px), almost rectangular. `full` is reserved for
// icon containers and status pills — never for CTA buttons.
export const rounded = {
  none: 0,
  xxs: 1,
  xs: 2,
  sm: 3, // default button radius
  md: 4, // card chrome (the spec's --radius base)
  lg: 6,
  pill: 9999,
  full: 9999,
};

// Spacing scale in px (numbers, same rationale as `rounded`). Base unit 4px
// with the spec's occasional 10px step. Keys starting with a digit are quoted:
// access them as spacing["2xl"].
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 10,
  lg: 16,
  xl: 24,
  "2xl": 32,
  "3xl": 48,
  "4xl": 64,
  "5xl": 96,
};

// Ready-to-spread React style presets for the spec's component chrome. Each
// preset is the whole surface treatment (fill + text + hairline + radius +
// padding); interactive states (hover/focus/disabled) are the consuming
// component's job. `cursor: pointer` on the button presets is a deliberate,
// spec-silent addition so a bare <button> doesn't render with an I-beam.
export const components = {
  navBar: {
    backgroundColor: colors.canvas,
    color: colors.ink,
    ...typography.bodySmStrong,
    padding: `${spacing.md}px ${spacing.xl}px`,
  },
  navLink: {
    backgroundColor: colors.canvas,
    color: colors.ink,
    ...typography.bodySmStrong,
    borderRadius: rounded.sm,
    padding: `${spacing.xs}px ${spacing.md}px`,
  },
  // The off-white CTA on dark canvas. Tight 3px radius — never a pill.
  buttonPrimary: {
    backgroundColor: colors.primary,
    color: colors.onPrimary,
    ...typography.buttonMd,
    border: "none",
    borderRadius: rounded.sm,
    padding: `${spacing.sm}px ${spacing.lg}px`,
    cursor: "pointer",
  },
  // Ghost secondary for nav and tertiary actions: canvas fill, no border.
  buttonSecondaryGhost: {
    backgroundColor: colors.canvas,
    color: colors.ink,
    ...typography.buttonMd,
    border: "none",
    borderRadius: rounded.sm,
    padding: `${spacing.sm}px ${spacing.lg}px`,
    cursor: "pointer",
  },
  // Circular icon container (search, theme, close). The ONE place full radius
  // belongs.
  buttonIconCircular: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.canvas,
    color: colors.ink,
    border: "none",
    borderRadius: rounded.full,
    padding: spacing.xs,
    cursor: "pointer",
  },
  textInput: {
    backgroundColor: colors.canvasSoft,
    color: colors.ink,
    border: `1px solid ${colors.hairline}`,
    ...typography.bodySm,
    borderRadius: rounded.sm,
    padding: `${spacing.sm}px ${spacing.md}px`,
  },
  // The default content card: canvas-soft fill + 1px hairline. No shadow.
  cardContent: {
    backgroundColor: colors.canvasSoft,
    color: colors.ink,
    border: `1px solid ${colors.hairline}`,
    ...typography.bodyMd,
    borderRadius: rounded.md,
    padding: spacing.xl,
  },
  // Terminal-screenshot mockup card: same chrome, mono body when text appears.
  cardMockup: {
    backgroundColor: colors.canvasSoft,
    color: colors.ink,
    border: `1px solid ${colors.hairline}`,
    ...typography.code,
    borderRadius: rounded.md,
    padding: spacing.lg,
  },
  downloadTile: {
    backgroundColor: colors.canvasSoft,
    color: colors.ink,
    border: `1px solid ${colors.hairline}`,
    ...typography.bodyMdStrong,
    borderRadius: rounded.md,
    padding: spacing.xl,
  },
  // List rows sit ON the canvas band (no fill of their own); the hairline is
  // a bottom border only.
  pressRow: {
    backgroundColor: colors.canvas,
    color: colors.body,
    borderBottom: `1px solid ${colors.hairline}`,
    ...typography.bodyMd,
    padding: `${spacing.lg}px 0`,
  },
  jobRow: {
    backgroundColor: colors.canvas,
    color: colors.ink,
    borderBottom: `1px solid ${colors.hairline}`,
    ...typography.bodyMdStrong,
    padding: `${spacing.lg}px 0`,
  },
  // Dark hero band hosting the 64px Inter headline.
  heroBand: {
    backgroundColor: colors.canvas,
    color: colors.ink,
    ...typography.displayXl,
    padding: `${spacing["5xl"]}px ${spacing.xl}px`,
  },
  contentBand: {
    backgroundColor: colors.canvas,
    color: colors.ink,
    ...typography.displayMd,
    padding: `${spacing["5xl"]}px ${spacing.xl}px`,
  },
  partnerLogoTile: {
    backgroundColor: colors.canvasSoft,
    color: colors.ink,
    ...typography.bodyMdStrong,
    borderRadius: rounded.md,
    padding: spacing.lg,
  },
  testimonialCard: {
    backgroundColor: colors.canvasSoft,
    color: colors.ink,
    border: `1px solid ${colors.hairline}`,
    ...typography.bodyMd,
    borderRadius: rounded.md,
    padding: spacing.xl,
  },
  footer: {
    backgroundColor: colors.canvas,
    color: colors.body,
    ...typography.bodySm,
    padding: `${spacing["3xl"]}px ${spacing.xl}px`,
  },
};

// Illustrative example surfaces from DESIGN.md's `ex-*` block — auto-derived
// kit-mirror demonstrations re-skinned with the primitives above. Useful as
// starting points for pricing/auth/modal/toast-style surfaces; they are
// token bundles, not always complete style objects (e.g. dataTableCell maps
// table parts to tokens).
export const examples = {
  pricingTier: {
    backgroundColor: colors.canvasSoft,
    color: colors.ink,
    border: `1px solid ${colors.hairline}`,
    borderRadius: rounded.lg,
    padding: spacing.xl,
  },
  // Polarity-flipped featured tier: ink fill + dark text.
  pricingTierFeatured: {
    backgroundColor: colors.ink,
    color: colors.onPrimary,
    borderRadius: rounded.lg,
    padding: spacing.xl,
  },
  productSelector: {
    backgroundColor: colors.canvasSoft,
    borderRadius: rounded.lg,
    padding: spacing.xl,
  },
  cartDrawer: {
    backgroundColor: colors.canvas,
    borderRadius: rounded.lg,
    padding: spacing.xl,
    itemDivider: colors.hairline,
  },
  appShellRow: {
    backgroundColor: colors.canvas,
    activeIndicator: colors.primary,
    borderRadius: rounded.sm,
    padding: `${spacing.sm}px ${spacing.md}px`,
  },
  dataTableCell: {
    headerBackground: colors.canvasSoft,
    headerTypography: typography.caption,
    bodyTypography: typography.bodySm,
    cellPadding: `${spacing.sm}px ${spacing.md}px`,
    rowBorder: colors.hairline,
  },
  authFormCard: {
    backgroundColor: colors.canvasSoft,
    borderRadius: rounded.lg,
    padding: spacing.xl,
  },
  modalCard: {
    backgroundColor: colors.canvas,
    borderRadius: rounded.lg,
    padding: spacing.xl,
  },
  emptyStateCard: {
    backgroundColor: colors.canvasSoft,
    borderRadius: rounded.lg,
    padding: spacing["2xl"],
    captionTypography: typography.bodyMd,
  },
  toast: {
    backgroundColor: colors.canvas,
    borderRadius: rounded.md,
    padding: `${spacing.sm}px ${spacing.md}px`,
    typography: typography.bodySm,
  },
};
