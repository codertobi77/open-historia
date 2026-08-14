import React, { useRef, useState } from "react";
import {
  actionButtonStyle,
  surfaceStyle,
} from "./scenarioEditorStyles.js";
import {
  activateScenario,
  createScenario,
  ensureScenarioCatalog,
  removeScenario,
  useScenarioState,
} from "../../runtime/scenarios.js";
import {
  exportScenarioBundle as exportLibBundle,
  importScenarioBundle,
} from "../../runtime/library.js";
import ScenarioCreatorView from "./ScenarioCreatorView.jsx";
import { parseAdvancedPrompts, buildEditorState } from "./scenarios.jsx";
import { loadScenarioDetails, uploadScenarioAsset, clearScenarioAsset, saveScenario } from "../../runtime/scenarios.js";

const cardSurface = {
  ...surfaceStyle,
  borderRadius: "16px",
  color: "#fff",
  display: "flex",
  flexDirection: "column",
  gap: "0.55rem",
  padding: "0.9rem",
};

// Renders the local "My Scenarios" hub: a list of local scenarios from the
// scenario store with Create/Edit/Clone/Delete/Activate/Export/Import actions.
// Edit mounts ScenarioCreatorView as a full-screen overlay.
const HubCard = ({
  active,
  busy,
  onActivate,
  onClone,
  onDelete,
  onEdit,
  onExport,
  scenario,
}) => {
  const isBuiltIn = scenario.id === "default";
  const assetBadges = Object.entries({
    cities: "Cities",
    colors: "Colors",
    countries: "Countries",
    regions: "Regions",
  })
    .filter(([key]) => scenario.assetStatus?.[key])
    .map(([, label]) => label);

  return (
    <div
      style={{
        ...cardSurface,
        borderColor: active ? `${scenario.accentColor}66` : "rgba(255,255,255,0.08)",
        flex: "0 0 19rem",
        minHeight: "14rem",
        position: "relative",
      }}
    >
      <div
        style={{
          background:
            `linear-gradient(180deg, rgba(0,0,0,0.02) 0%, rgba(0,0,0,0.72) 100%), ` +
            `radial-gradient(circle at 14% 18%, ${scenario.accentColor}bb, transparent 34%), ` +
            "url('/loading_screen.jpg') center/cover",
          inset: 0,
          opacity: 0.92,
          position: "absolute",
          borderRadius: "16px",
        }}
      />
      <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between", position: "relative", zIndex: 1 }}>
        <div>
          <div style={{ alignItems: "center", display: "flex", gap: "0.45rem", justifyContent: "space-between" }}>
            <span
              style={{
                background: active ? `${scenario.accentColor}66` : "rgba(255,255,255,0.12)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: "999px",
                color: "rgba(248,250,252,0.94)",
                fontSize: "0.69rem",
                fontWeight: 700,
                letterSpacing: "0.08em",
                padding: "0.35rem 0.6rem",
                textTransform: "uppercase",
              }}
            >
              {scenario.eyebrow || (isBuiltIn ? "Built-In" : "Scenario")}
            </span>
            {active && (
              <span style={{ background: "rgba(255,255,255,0.18)", borderRadius: "999px", color: "#fff", fontSize: "0.72rem", fontWeight: 700, padding: "0.32rem 0.65rem" }}>
                Active
              </span>
            )}
          </div>
          <div style={{ marginTop: "3.4rem" }}>
            <div style={{ color: "#fff", fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1 }}>
              {scenario.heroTitle || scenario.name}
            </div>
            <div style={{ color: "rgba(240,244,255,0.7)", fontSize: "0.82rem", lineHeight: 1.4, marginTop: "0.5rem" }}>
              {scenario.heroSubtitle || scenario.subtitle || scenario.description}
            </div>
          </div>
        </div>
        <div>
          {assetBadges.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginBottom: "0.7rem" }}>
              {assetBadges.map((badge) => (
                <span key={badge} style={{ background: "rgba(255,255,255,0.14)", borderRadius: "999px", color: "rgba(255,255,255,0.9)", fontSize: "0.7rem", padding: "0.28rem 0.55rem" }}>
                  {badge}
                </span>
              ))}
            </div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem" }}>
            <button
              onClick={() => onActivate(scenario.id)}
              style={{ ...actionButtonStyle, background: active ? "rgba(255,255,255,0.16)" : `${scenario.accentColor}cc`, borderColor: active ? "rgba(255,255,255,0.22)" : `${scenario.accentColor}dd`, color: "#fff", flex: 1 }}
              type="button"
            >
              {active ? "Active" : "Activate"}
            </button>
            <button onClick={() => onEdit(scenario.id)} style={{ ...actionButtonStyle, flex: 1 }} type="button">
              Edit
            </button>
            <button onClick={() => onClone(scenario)} style={{ ...actionButtonStyle, flexBasis: "100%" }} type="button">
              Clone
            </button>
            <button onClick={() => onExport(scenario)} style={{ ...actionButtonStyle, background: "rgba(255,255,255,0.04)" }} type="button">
              Export
            </button>
            {scenario.canDelete && (
              <button
                onClick={() => onDelete(scenario)}
                style={{ ...actionButtonStyle, background: "rgba(127,29,29,0.34)", borderColor: "rgba(248,113,113,0.28)", color: "#fecaca" }}
                type="button"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const ScenarioHub = ({ onClose, onOpenMapEditor }) => {
  const {
    activeScenarioId,
    error,
    loaded,
    loading,
    scenarios,
  } = useScenarioState();

  const [busy, setBusy] = useState(false);
  const [hubError, setHubError] = useState(null);
  const [editorDetails, setEditorDetails] = useState(null);
  const [editorState, setEditorState] = useState(null);
  const [editorError, setEditorError] = useState(null);
  const fileInputsRef = useRef({});
  const importInputRef = useRef(null);

  React.useEffect(() => {
    if (!loaded) {
      ensureScenarioCatalog().catch(() => {});
    }
  }, [loaded]);

  const resetEditor = () => {
    setEditorDetails(null);
    setEditorState(null);
    setEditorError(null);
  };

  const openEditor = async (scenarioId) => {
    setEditorError(null);
    setBusy(true);
    try {
      const details = await loadScenarioDetails(scenarioId);
      setEditorDetails(details);
      setEditorState(buildEditorState(details));
    } catch (err) {
      setEditorError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = async () => {
    setEditorError(null);
    setBusy(true);
    try {
      const details = await createScenario({
        name: "New Scenario",
        setActive: true,
      });
      setEditorDetails(details);
      setEditorState(buildEditorState(details));
    } catch (err) {
      setEditorError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleClone = async (scenario) => {
    setHubError(null);
    setBusy(true);
    try {
      const details = await createScenario({
        accentColor: scenario.accentColor,
        name: `${scenario.name} Copy`,
        seedScenarioId: scenario.id,
        setActive: true,
        subtitle: scenario.subtitle,
      });
      setEditorDetails(details);
      setEditorState(buildEditorState(details));
    } catch (err) {
      setHubError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (scenario) => {
    if (!scenario.canDelete) return;
    if (!window.confirm(`Delete scenario "${scenario.name}"?`)) return;
    setHubError(null);
    setBusy(true);
    try {
      await removeScenario(scenario.id);
      if (editorDetails?.scenario?.id === scenario.id) resetEditor();
    } catch (err) {
      setHubError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleActivate = async (scenarioId) => {
    setHubError(null);
    setBusy(true);
    try {
      await activateScenario(scenarioId);
      if (editorDetails?.scenario?.id === scenarioId) {
        const details = await loadScenarioDetails(scenarioId);
        setEditorDetails(details);
        setEditorState(buildEditorState(details));
      }
    } catch (err) {
      setHubError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleExport = async (scenario) => {
    setHubError(null);
    setBusy(true);
    try {
      // Reuse the library's exportScenarioBundle (same as communityHub publish).
      const bundle = await exportLibBundle(scenario.id, "light");
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${scenario.id}-scenario.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setHubError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleImportFile = async (event) => {
    const [file] = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!file) return;

    setHubError(null);
    setBusy(true);
    try {
      const text = await file.text();
      const bundle = JSON.parse(text);
      const details = await importScenarioBundle(bundle);
      setEditorDetails(details);
      setEditorState(buildEditorState(details));
    } catch (err) {
      setHubError(`Import failed: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleEditorChange = (field, value) => {
    setEditorState((current) => ({ ...current, [field]: value }));
  };

  const handleSave = async () => {
    if (!editorDetails || !editorState) return;
    setEditorError(null);
    setBusy(true);
    try {
      const currentGame = editorDetails.data?.game ?? {};
      const currentPrompts = editorDetails.data?.prompts ?? {};
      const currentWorld = editorDetails.data?.world ?? {};
      const advancedPrompts = parseAdvancedPrompts(editorState.advancedPromptsText);
      const details = await saveScenario(editorDetails.scenario.id, {
        accentColor: editorState.accentColor,
        description: editorState.description,
        eyebrow: editorState.eyebrow,
        game: {
          ...currentGame,
          country: editorState.country,
          gameDate: editorState.gameDate,
          language: editorState.language,
          startDate: editorState.gameDate || currentGame.startDate || "",
        },
        heroSubtitle: editorState.heroSubtitle,
        heroTitle: editorState.heroTitle,
        name: editorState.name,
        prompts: {
          ...currentPrompts,
          advisor: editorState.systemPrompt,
          leader: editorState.leaderPrompt,
          ...advancedPrompts,
        },
        subtitle: editorState.subtitle,
        world: {
          ...currentWorld,
          labelFont: editorState.labelFont,
          labelHaloColor: editorState.labelHaloColor,
          labelTextColor: editorState.labelTextColor,
          language: editorState.language,
          simulationRules: editorState.simulationRules,
          startingTimelineText: editorState.startingTimelineText,
        },
      });
      setEditorDetails(details);
      setEditorState(buildEditorState(details));
    } catch (err) {
      setEditorError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleFileSelect = async (assetKey, event) => {
    const [file] = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!file || !editorDetails) return;
    setEditorError(null);
    setBusy(true);
    try {
      const details = await uploadScenarioAsset(editorDetails.scenario.id, assetKey, file);
      setEditorDetails(details);
      setEditorState(buildEditorState(details));
    } catch (err) {
      setEditorError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleClearAsset = async (assetKey) => {
    if (!editorDetails?.assetStatus?.[assetKey]) return;
    setEditorError(null);
    setBusy(true);
    try {
      const details = await clearScenarioAsset(editorDetails.scenario.id, assetKey);
      setEditorDetails(details);
      setEditorState(buildEditorState(details));
    } catch (err) {
      setEditorError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // Full-screen editor overlay takes over the hub view.
  if (editorDetails && editorState) {
    return (
      <ScenarioCreatorView
        details={editorDetails}
        editorError={editorError || error}
        fileInputsRef={fileInputsRef}
        formState={editorState}
        isBusy={busy || loading}
        onChange={handleEditorChange}
        onClearAsset={handleClearAsset}
        onClose={resetEditor}
        onDelete={async () => {
          if (!editorDetails?.scenario?.canDelete) return;
          if (!window.confirm(`Delete scenario "${editorDetails.scenario.name}"?`)) return;
          setEditorError(null);
          setBusy(true);
          try {
            await removeScenario(editorDetails.scenario.id);
            resetEditor();
          } catch (err) {
            setEditorError(err.message);
          } finally {
            setBusy(false);
          }
        }}
        onFileSelect={handleFileSelect}
        onOpenFileDialog={(assetKey) => fileInputsRef.current[assetKey]?.click()}
        onOpenMapEditor={onOpenMapEditor ? () => onOpenMapEditor(editorDetails) : undefined}
        onSave={handleSave}
        onSetActive={() => handleActivate(editorDetails?.scenario?.id)}
      />
    );
  }

  return (
    <div
      style={{
        background: "rgba(5,8,18,0.97)",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        fontFamily: "sans-serif",
        inset: 0,
        overflow: "hidden",
        position: "fixed",
        zIndex: 10060,
      }}
    >
      {/* Header */}
      <div
        style={{
          alignItems: "center",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          flexShrink: 0,
          gap: "0.8rem",
          height: "3.5rem",
          justifyContent: "space-between",
          padding: "0 1rem",
        }}
      >
        <div>
          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.72rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Scenario Studio
          </div>
          <div style={{ fontSize: "1.2rem", fontWeight: 800, letterSpacing: "-0.03em" }}>
            My Scenarios
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button onClick={handleCreate} style={{ ...actionButtonStyle, background: "rgba(124,58,237,0.3)", borderColor: "rgba(124,58,237,0.5)" }} type="button">
            + Create
          </button>
          <button onClick={() => importInputRef.current?.click()} style={actionButtonStyle} type="button">
            Import JSON
          </button>
          <button onClick={onClose} style={{ ...actionButtonStyle, background: "rgba(255,255,255,0.04)", minWidth: "2.35rem", padding: 0 }} type="button">
            ✕
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "1.2rem 1.4rem 2.5rem" }}>
        {(hubError || editorError || error) && (
          <div style={{ background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.34)", borderRadius: "14px", color: "#fecaca", marginBottom: "0.9rem", padding: "0.8rem 0.9rem" }}>
            {hubError || editorError || error}
          </div>
        )}

        {!loaded && (
          <div style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.85rem", padding: "1rem 0" }}>
            Loading scenarios…
          </div>
        )}

        {loaded && scenarios.length === 0 && (
          <div style={{ alignItems: "center", display: "flex", flexDirection: "column", justifyContent: "center", minHeight: "50vh", textAlign: "center" }}>
            <div style={{ fontSize: "1.4rem", fontWeight: 800, marginBottom: "0.6rem" }}>No scenarios yet</div>
            <div style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.9rem", lineHeight: 1.6, margin: "0 0 1.4rem", maxWidth: "24rem" }}>
              Create a new scenario from scratch or import one from a JSON bundle.
            </div>
            <div style={{ display: "flex", gap: "0.6rem" }}>
              <button onClick={handleCreate} style={{ ...actionButtonStyle, background: "rgba(124,58,237,0.3)", borderColor: "rgba(124,58,237,0.5)", minHeight: "2.6rem", padding: "0 1.3rem" }} type="button">
                + Create Scenario
              </button>
              <button onClick={() => importInputRef.current?.click()} style={{ ...actionButtonStyle, minHeight: "2.6rem", padding: "0 1.3rem" }} type="button">
                Import JSON
              </button>
            </div>
          </div>
        )}

        {loaded && scenarios.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.9rem" }}>
            {scenarios.map((scenario) => (
              <HubCard
                key={scenario.id}
                active={scenario.id === activeScenarioId}
                busy={busy}
                onActivate={handleActivate}
                onClone={handleClone}
                onDelete={handleDelete}
                onEdit={openEditor}
                onExport={handleExport}
                scenario={scenario}
              />
            ))}
          </div>
        )}
      </div>

      <input
        ref={importInputRef}
        accept=".json,application/json,.zip,application/zip"
        onChange={handleImportFile}
        style={{ display: "none" }}
        type="file"
      />
    </div>
  );
};

export default ScenarioHub;
