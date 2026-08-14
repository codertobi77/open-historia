// Shared style vocabulary for the scenario editor surfaces.
// Imported by scenarios.jsx (ScenarioTopBar) and ScenarioCreatorView.jsx
// (the 4-step wizard) so the two surfaces stay in sync without duplicating
// large inline style objects.

export const surfaceStyle = {
  background:
    "linear-gradient(180deg, rgba(8, 10, 17, 0.97) 0%, rgba(8, 10, 15, 0.94) 100%)",
  border: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "0 20px 50px rgba(0,0,0,0.35)",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
};

export const actionButtonStyle = {
  alignItems: "center",
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "999px",
  color: "rgba(244,246,255,0.92)",
  cursor: "pointer",
  display: "inline-flex",
  fontSize: "0.82rem",
  fontWeight: 600,
  gap: "0.4rem",
  justifyContent: "center",
  minHeight: "2.1rem",
  padding: "0 0.95rem",
  transition: "background 0.18s ease, border-color 0.18s ease, transform 0.18s ease",
};

export const fieldLabelStyle = {
  color: "rgba(255,255,255,0.72)",
  display: "block",
  fontSize: "0.75rem",
  fontWeight: 600,
  letterSpacing: "0.04em",
  marginBottom: "0.45rem",
  textTransform: "uppercase",
};

export const inputStyle = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "12px",
  color: "#f8fafc",
  fontSize: "0.9rem",
  outline: "none",
  padding: "0.8rem 0.9rem",
  width: "100%",
};

export const textareaStyle = {
  ...inputStyle,
  minHeight: "8.5rem",
  resize: "vertical",
};

export const BAR_HEIGHT = 64;
export const TOP_BAR_OFFSET = "4.75rem";
