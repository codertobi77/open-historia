/*! Open Historia — portions (model discovery picker) © 2026 Nicholas Krol, MIT (see src/Editor/LICENSE). */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { discoverModels } from "../AI/main.jsx";

// Style vocabulary mirrored from settings.jsx (kept module-local there) so the
// picker matches the rest of the settings panel without reaching into another
// module's internals. If settings.jsx tweaks these, mirror the change here.
const labelStyle = {
    display: "block",
    fontSize: "0.82rem",
    marginBottom: "0.45rem",
    color: "rgba(255,255,255,0.92)",
    cursor: "text",
};

const inputStyle = {
    width: "100%",
    padding: "0.65rem 0.7rem",
    borderRadius: "8px",
    border: "1px solid rgba(255,255,255,0.16)",
    backgroundColor: "rgba(0,0,0,0.22)",
    color: "white",
    fontSize: "0.85rem",
    outline: "none",
    boxSizing: "border-box",
    cursor: "text",
};

const helperStyle = {
    marginTop: "0.35rem",
    fontSize: "0.74rem",
    color: "rgba(255,255,255,0.58)",
    lineHeight: 1.45,
};

const fieldGroupStyle = {
    marginBottom: "0.85rem",
};

// OpenAI, native NVIDIA, and Gemini use well-known fixed hosts; the compatible /
// NIM variants take their endpoint from props. Keeping the map in one place lets
// the caller stay dumb — it only knows the provider id and (optionally) its endpoint.
const FIXED_ENDPOINTS = {
    gemini: "https://generativelanguage.googleapis.com/v1beta",
    openai: "https://api.openai.com/v1",
    nvidia: "https://integrate.api.nvidia.com/v1",
};

function resolveDiscoveryEndpoint(provider, endpointProp) {
    const fixed = FIXED_ENDPOINTS[provider];
    if (fixed) return fixed;
    return endpointProp ?? "";
}

function buildDiscoveryHeaders(provider, apiKey, headersProp) {
    // The caller may pass a ready-made headers object (e.g. an OpenAI-compatible
    // gateway that needs a non-bearer scheme). If it does, use it verbatim.
    if (headersProp && typeof headersProp === "object") {
        return headersProp;
    }

    // Gemini authenticates with a `key=` query parameter (handled inside
    // discoverModels), never a header — sending a Bearer key would be wrong.
    if (provider === "gemini") {
        return {};
    }

    const trimmedKey = (apiKey ?? "").trim();
    return trimmedKey ? { Authorization: `Bearer ${trimmedKey}` } : {};
}

// Same plain text input the panel uses for the model field, inlined here (and
// kept in sync) because SettingsInput is not exported from settings.jsx. Shown
// whenever discovery is off, the endpoint is unknown, or discovery errored — a
// manual entry is always reachable so a broken /models never blocks play.
const PlainModelInput = ({ label, value, onChange, placeholder, helperText }) => (
    <div style={fieldGroupStyle}>
        <label style={labelStyle}>
            {label}
        </label>
        <input
            type="text"
            value={value ?? ""}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            autoComplete="off"
            spellCheck={false}
            style={inputStyle}
        />
        {helperText && (
            <div style={helperStyle}>
                {helperText}
            </div>
        )}
    </div>
);

const ModelPicker = ({
    provider,
    endpoint,
    apiKey,
    headers,
    value,
    onChange,
    placeholder,
    helperText,
    supportsDiscovery,
}) => {
    const discoveryEndpoint = resolveDiscoveryEndpoint(provider, endpoint);
    const canDiscover = !!supportsDiscovery && !!discoveryEndpoint;

    const [models, setModels] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [query, setQuery] = useState("");

    const abortRef = useRef(null);
    const fetchedKeyRef = useRef("");

    const fetchModels = useCallback(async () => {
        // Cancel any in-flight discovery (Refresh pressed while one is loading).
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setLoading(true);
        setError("");

        try {
            const discovered = await discoverModels({
                provider,
                endpoint: discoveryEndpoint,
                headers: buildDiscoveryHeaders(provider, apiKey, headers),
                apiKey,
                signal: controller.signal,
            });
            if (controller.signal.aborted) return;
            setModels(Array.isArray(discovered) ? discovered : []);
        } catch (err) {
            if (controller.signal.aborted || err?.name === "AbortError") return;
            setError(err?.message || "Could not load models.");
            setModels([]);
        } finally {
            if (!controller.signal.aborted) {
                setLoading(false);
            }
        }
    }, [discoveryEndpoint, apiKey, headers]);

    // Fetch on mount (and whenever the endpoint/credentials it depends on
    // change), keyed so a transient prop blip doesn't refetch the same list.
    useEffect(() => {
        if (!canDiscover) {
            setModels([]);
            setError("");
            setLoading(false);
            return;
        }

        const fetchKey = `${discoveryEndpoint}|${(apiKey ?? "").trim()}`;
        if (fetchedKeyRef.current === fetchKey && models.length > 0) {
            return;
        }
        fetchedKeyRef.current = fetchKey;

        fetchModels();
        // fetchModels is stable per its deps, which already cover the inputs we
        // react to; listing it would refire every time those change AND again on
        // the lint-driven identity change. Keep inputs explicit here instead.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canDiscover, provider, discoveryEndpoint, apiKey]);

    // Cancel any pending discovery on unmount.
    useEffect(() => () => {
        abortRef.current?.abort();
    }, []);

    if (!canDiscover) {
        return (
            <PlainModelInput
                label="Model"
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                helperText={helperText}
            />
        );
    }

    const modelIds = models
        .map((entry) => entry?.id)
        .filter((id) => typeof id === "string" && id.trim());
    // Gemini discovery also returns a human displayName; show it beside the id
    // so the list reads like AI Studio instead of raw slugs. Providers without
    // one (OpenAI-style) fall back to the bare id.
    const displayNames = new Map(
        models
            .filter((entry) => typeof entry?.id === "string" && typeof entry?.displayName === "string" && entry.displayName.trim())
            .map((entry) => [entry.id, entry.displayName.trim()]),
    );
    const normalizedQuery = query.trim().toLowerCase();
    const filteredIds = normalizedQuery
        ? modelIds.filter((id) => (
            id.toLowerCase().includes(normalizedQuery)
            || (displayNames.get(id) ?? "").toLowerCase().includes(normalizedQuery)
        ))
        : modelIds;

    const currentValue = (value ?? "").trim();
    const valueInList = currentValue && modelIds.includes(currentValue);

    return (
        <div style={fieldGroupStyle}>
            <label style={labelStyle}>
                Model
            </label>
            <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.4rem" }}>
                <input
                    type="text"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search models..."
                    autoComplete="off"
                    spellCheck={false}
                    style={{ ...inputStyle, marginBottom: 0 }}
                />
                <button
                    type="button"
                    onClick={fetchModels}
                    disabled={loading}
                    style={{
                        padding: "0.55rem 0.75rem",
                        borderRadius: "8px",
                        border: "1px solid rgba(255,255,255,0.16)",
                        backgroundColor: "rgba(0,0,0,0.22)",
                        color: "white",
                        fontSize: "0.8rem",
                        cursor: loading ? "default" : "pointer",
                        opacity: loading ? 0.6 : 1,
                        whiteSpace: "nowrap",
                    }}
                >
                    {loading ? "Loading..." : "Refresh"}
                </button>
            </div>
            <select
                data-no-translate
                value={valueInList ? currentValue : ""}
                onChange={(event) => onChange(event.target.value)}
                style={{ ...inputStyle, cursor: "pointer", opacity: loading ? 0.6 : 1 }}
            >
                <option value="">Auto (discover)</option>
                {/* A model the user typed/picked that isn't in the discovered
                    list: show it as the selected option so it's visible without
                    being silently dropped. Re-rendered each list change. */}
                {currentValue && !valueInList && (
                    <option value={currentValue} style={{ color: "black" }}>
                        {currentValue}
                    </option>
                )}
                {!loading && filteredIds.length === 0 && !currentValue && (
                    <option value="" disabled>
                        {modelIds.length === 0 ? "No models found" : "No matching model"}
                    </option>
                )}
                {filteredIds.map((id) => (
                    <option key={id} value={id} style={{ color: "black" }}>
                        {displayNames.has(id) ? `${displayNames.get(id)} (${id})` : id}
                    </option>
                ))}
            </select>
            {error && (
                <div style={{ ...helperStyle, color: "rgba(252,165,165,0.9)" }}>
                    {error} You can still type a model manually below.
                </div>
            )}
            {helperText && (
                <div style={helperStyle}>
                    {helperText}
                </div>
            )}
            {/* Always-available manual entry: discovery is best-effort. If the
                list loaded, the select above is the primary control; this only
                needs to show when discovery failed or hasn't returned yet. */}
            {(error || (!loading && models.length === 0)) && (
                <input
                    type="text"
                    value={value ?? ""}
                    onChange={(event) => onChange(event.target.value)}
                    placeholder={placeholder}
                    autoComplete="off"
                    spellCheck={false}
                    style={{ ...inputStyle, marginTop: "0.4rem" }}
                />
            )}
        </div>
    );
};

export default ModelPicker;
