/*! Open Historia — portions (panel sizing on small screens) © 2026 Nicholas Krol, MIT (see src/Editor/LICENSE). */
import React from "react";
import dayjs from "dayjs";
import advancedFormat from "dayjs/plugin/advancedFormat";
import { JSON_URLS, readJson } from "../../runtime/assets.js";
import { useCountryDisplayName } from "../../runtime/polityNames.js";
import { generateActionSuggestions, refinePlayerAction } from "../AI/gameplay.js";
import { revertUnitOrder } from "../Map/unitsController.js";
import {
    buildActionDisplayText,
    normalizeActionEntry,
    readActionsState,
    writeActionsState,
} from "../../runtime/gameState.js";
import FloatPanel from "./FloatPanel.jsx";
import { useIsMobile } from "../../runtime/useIsMobile.js";
import { colors, fonts, rounded } from "../../design/tokens.js";

dayjs.extend(advancedFormat);

const ACTIONS_STYLE_ID = "actions-style";

const ensureActionsStyles = () => {
    if (typeof document === "undefined" || document.getElementById(ACTIONS_STYLE_ID)) {
        return;
    }

    const style = document.createElement("style");
    style.id = ACTIONS_STYLE_ID;
    style.textContent = `
    @keyframes actions-spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }

    .actions-composer {
        -ms-overflow-style: none;
        scrollbar-width: none;
    }

    .actions-composer::-webkit-scrollbar {
        display: none;
    }
    `;
    document.head.appendChild(style);
};

const SparkleIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 2L13.5 9.5L21 11L13.5 12.5L12 20L10.5 12.5L3 11L10.5 9.5L12 2Z" />
    </svg>
);

const SendIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
    </svg>
);

const SpinnerRing = ({ size = 14, tone = "rgba(255,255,255,0.88)" }) => {
    React.useEffect(() => {
        ensureActionsStyles();
    }, []);

    return (
        <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        style={{ animation: "actions-spin 0.7s linear infinite" }}
        >
        <circle cx="12" cy="12" r="8" stroke="rgba(255,255,255,0.2)" strokeWidth="2.2" />
        <path d="M12 4a8 8 0 0 1 8 8" stroke={tone} strokeWidth="2.2" strokeLinecap="round" />
        </svg>
    );
};

const saveActions = async (actions) => writeActionsState(actions);
const loadActions = async () => readActionsState();

const createManualAction = (input) =>
normalizeActionEntry({
    kind: "action",
    rawInput: input,
    source: "manual",
    status: "planned",
    text: input,
    title: input,
});

const normalizeSuggestionAction = (action) =>
normalizeActionEntry({
    ...action,
    source: "suggested",
    status: "planned",
});

const ActionItem = ({ action, onDelete }) => {
    const [hovered, setHovered] = React.useState(false);
    const normalized = normalizeActionEntry(action);

    if (!normalized) {
        return null;
    }

    const label = buildActionDisplayText(normalized);
    const showTitle = normalized.title && normalized.title !== label;

    return (
        <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
            alignItems: "center",
            backgroundColor: colors.canvas,
            border: `1px solid ${colors.hairline}`,
            borderRadius: rounded.sm,
            color: colors.bodyStrong,
            display: "flex",
            gap: "0.5rem",
            justifyContent: "space-between",
            lineHeight: "1.75",
            padding: "0.55rem 0.85rem",
            transition: "background 0.15s",
        }}
        >
        <div style={{ flex: 1, minWidth: 0 }}>
        {showTitle && (
            <div style={{ color: colors.primary, fontSize: "0.78rem", fontWeight: 700, marginBottom: "0.15rem" }}>
            {normalized.title}
            </div>
        )}
        <div style={{ color: colors.body, fontSize: "0.82rem", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
        {label}
        </div>
        <div
        style={{
            color: colors.mute,
            fontSize: "0.68rem",
            letterSpacing: "0.06em",
            marginTop: "0.25rem",
            textTransform: "uppercase",
        }}
        >
        {normalized.kind} • {normalized.status}
        </div>
        </div>
        <button
        type="button"
        onClick={onDelete}
        title="Delete action"
        style={{
            alignItems: "center",
            background: hovered ? "rgba(239,68,68,0.1)" : "none",
            border: "none",
            borderRadius: "6px",
            color: hovered ? "rgba(239,68,68,0.95)" : "rgba(239,68,68,0.8)",
            cursor: "pointer",
            display: "flex",
            flexShrink: 0,
            fontSize: "1rem",
            lineHeight: 1,
            opacity: hovered ? 1 : 0,
            padding: "0.18rem 0.3rem",
            pointerEvents: hovered ? "auto" : "none",
            transition: "opacity 0.15s, color 0.15s, background 0.15s",
        }}
        >
        {"\u2715"}
        </button>
        </div>
    );
};

const SuggestionCard = ({ topic, onQueue, queuedIds }) => (
    <div
    style={{
        background: colors.canvas,
        border: `1px solid ${colors.hairline}`,
        borderRadius: rounded.sm,
        display: "flex",
        flexDirection: "column",
        gap: "0.55rem",
        padding: "0.7rem 0.8rem",
    }}
    >
    <div>
    <div style={{ color: colors.primary, fontSize: "0.8rem", fontWeight: 700 }}>{topic.title}</div>
    <div style={{ color: colors.mute, fontSize: "0.76rem", lineHeight: "1.5", marginTop: "0.2rem" }}>
    {topic.description}
    </div>
    </div>
    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
    {topic.actions.map((action) => {
        const isQueued = queuedIds?.has(action.id);
        return (
            <button
            key={action.id}
            type="button"
            disabled={isQueued}
            onClick={() => onQueue(action)}
            style={{
                // Queued keeps a green success tint (functional color);
                // unqueued = neutral canvas + hairline.
                background: isQueued ? "rgba(34,197,94,0.12)" : colors.canvasSoft,
                border: isQueued ? "1px solid rgba(74,222,128,0.35)" : `1px solid ${colors.hairline}`,
                borderRadius: rounded.sm,
                color: colors.bodyStrong,
                cursor: isQueued ? "default" : "pointer",
                fontFamily: fonts.sans,
                padding: "0.55rem 0.7rem",
                textAlign: "left",
            }}
            >
            <div style={{ fontSize: "0.76rem", fontWeight: 700 }}>
            {isQueued ? `✓ Queued — ${action.title}` : action.title}
            </div>
            <div style={{ color: colors.mute, fontSize: "0.74rem", lineHeight: "1.45", marginTop: "0.18rem" }}>
            {action.text}
            </div>
            </button>
        );
    })}
    </div>
    </div>
);

const ActionsPanel = ({ isOpen, onClose, onOpenAdvisor }) => {
    const isMobile = useIsMobile();
    const [actions, setActions] = React.useState([]);
    const [inputValue, setInputValue] = React.useState("");
    const [country, setCountry] = React.useState("your nation");
    // Full display name for the header, never the code.
    const countryDisplayName = useCountryDisplayName(country);
    const [gameDate, setGameDate] = React.useState("the current date");
    const [suggestions, setSuggestions] = React.useState([]);
    const [queuedSuggestionIds, setQueuedSuggestionIds] = React.useState(() => new Set());
    const [hasRequestedSuggestions, setHasRequestedSuggestions] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [isImproving, setIsImproving] = React.useState(false);
    const [isSuggesting, setIsSuggesting] = React.useState(false);
    const inputRef = React.useRef(null);
    const lastRoundRef = React.useRef(null);

    React.useEffect(() => {
        if (!isOpen) {
            return undefined;
        }

        let cancelled = false;
        ensureActionsStyles();
        setSuggestions([]);
        setHasRequestedSuggestions(false);

        loadActions().then((saved) => {
            if (!cancelled) {
                setActions(saved);
            }
        });

        const fetchGameData = () => {
            readJson(JSON_URLS.game, { defaultValue: {}, force: true })
            .then((data) => {
                if (cancelled) {
                    return;
                }

                if (data.country) {
                    setCountry(data.country);
                }

                if (data.gameDate) {
                    setGameDate(dayjs(data.gameDate).format("MMMM Do, YYYY"));
                }

                // After a jump, applySimulationResult re-marks last round's actions
                // "resolved" (submittedActions filters those out) — but this panel never
                // re-read the store, so they lingered. Reload when the round advances so
                // the previous turn's actions clear automatically. First tick just seeds
                // the ref (no spurious reload); a freshly queued next-turn action is
                // already persisted, so the reload keeps it.
                if (typeof data.round === "number") {
                    if (lastRoundRef.current !== null && data.round !== lastRoundRef.current) {
                        loadActions().then((saved) => { if (!cancelled) setActions(saved); });
                    }
                    lastRoundRef.current = data.round;
                }
            })
            .catch(() => {});
        };

        fetchGameData();
        const interval = setInterval(fetchGameData, 5000);

        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [isOpen]);

    const persistActions = async (nextActions) => {
        setActions(nextActions);
        try {
            await saveActions(nextActions);
        } catch (error) {
            console.error("Failed to save actions:", error);
        }
    };

    const submittedActions = React.useMemo(
        () =>
        actions
        .map((action, index) => ({
            normalized: normalizeActionEntry(action, index),
                                 originalIndex: index,
        }))
        .filter(({ normalized }) => normalized?.status === "planned"),
                                           [actions],
    );

    const handleSubmit = async () => {
        const trimmed = inputValue.trim();
        if (!trimmed || isSubmitting || isImproving) {
            return;
        }

        const nextAction = createManualAction(trimmed);
        if (!nextAction) {
            return;
        }

        setIsSubmitting(true);
        try {
            await persistActions([...actions, nextAction]);
            setInputValue("");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleImprove = async () => {
        const trimmed = inputValue.trim();
        if (!trimmed || isImproving || isSubmitting) {
            return;
        }

        setIsImproving(true);
        try {
            const refined = await refinePlayerAction(trimmed, { persist: false });
            const improvedText = refined?.text || buildActionDisplayText(refined) || trimmed;
            setInputValue(improvedText);
            inputRef.current?.focus();
        } catch (error) {
            console.error("Failed to improve action:", error);
        } finally {
            setIsImproving(false);
        }
    };

    const handleDelete = async (index) => {
        const removed = actions[index];
        // Deleting a queued troop order also undoes what it did to the map —
        // otherwise a manual move/deploy stays in place while the AI is never
        // told about it (#368). Only planned orders carry a revert; anything
        // already resolved by a jump keeps its outcome.
        if (removed?.unitRevert && (removed.status ?? "planned") === "planned") {
            try {
                await revertUnitOrder(removed.unitRevert);
            } catch (error) {
                console.warn("[actions] could not revert the unit order:", error);
            }
        }
        await persistActions(actions.filter((_, actionIndex) => actionIndex !== index));
    };

    const handleQueueSuggestion = async (action) => {
        const queuedAction = normalizeSuggestionAction(action);
        if (!queuedAction) {
            // Malformed AI suggestion — say so instead of doing nothing.
            console.warn("[actions] suggestion could not be queued (no usable text):", action);
            return;
        }

        await persistActions([...actions, queuedAction]);
        // Visible click feedback: the suggestion button flips to "✓ Queued".
        setQueuedSuggestionIds((previous) => new Set(previous).add(action.id));
    };

    const refreshSuggestions = async () => {
        if (isSuggesting) {
            return;
        }

        setHasRequestedSuggestions(true);
        setIsSuggesting(true);
        try {
            const topics = await generateActionSuggestions({ force: true });
            setSuggestions(topics);
            setQueuedSuggestionIds(new Set());
        } catch (error) {
            console.error("Failed to generate suggestions:", error);
            setSuggestions([]);
        } finally {
            setIsSuggesting(false);
        }
    };

    const handleKeyDown = (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            handleSubmit();
        }
    };

    const suggestionButtonLabel = hasRequestedSuggestions
    ? (isSuggesting ? "Refreshing AI suggestions..." : "Refresh AI suggestions")
    : (isSuggesting ? "Loading AI suggestions..." : "Get AI suggestions");

    // Desktop renders the chromeless body inside FloatPanel (drag/resize/persist);
    // mobile keeps the legacy bottom-anchored fixed panel with its own header.
    const panelBody = (
        <>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem", padding: "0.875rem 1.25rem", flex: 1, minHeight: 0, overflow: "hidden" }}>
        <p
        style={{
            color: colors.body,
            fontSize: "0.82rem",
            lineHeight: "1.55",
            margin: 0,
        }}
        >
        Submit actions for {countryDisplayName} for {gameDate}. Your actions will affect how the game world responds.
        </p>

        {/* Secondary buttons: canvas fill + hairline, per the design language. */}
        <button
        type="button"
        onClick={onOpenAdvisor}
        style={{
            background: colors.canvas,
            border: `1px solid ${colors.hairline}`,
            borderRadius: rounded.sm,
            color: colors.bodyStrong,
            cursor: "pointer",
            fontSize: "0.82rem",
            fontWeight: 500,
            letterSpacing: "0.01em",
            padding: "0.55rem 1rem",
            transition: "background 0.15s, border-color 0.15s",
            width: "100%",
        }}
        >
        Help brainstorm actions
        </button>

        <button
        type="button"
        onClick={refreshSuggestions}
        style={{
            alignItems: "center",
            background: colors.canvas,
            border: `1px solid ${colors.hairline}`,
            borderRadius: rounded.sm,
            color: colors.bodyStrong,
            cursor: "pointer",
            display: "flex",
            fontSize: "0.8rem",
            gap: "0.5rem",
            justifyContent: "center",
            padding: "0.52rem 1rem",
            transition: "background 0.15s, border-color 0.15s",
            width: "100%",
        }}
        >
        {isSuggesting && <SpinnerRing size={14} />}
        <span>{suggestionButtonLabel}</span>
        </button>

        {(hasRequestedSuggestions || isSuggesting || suggestions.length > 0) && (
            <div
            style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                maxHeight: "13rem",
                overflowY: "auto",
                scrollbarWidth: "none",
            }}
            >
            {hasRequestedSuggestions && !isSuggesting && suggestions.length === 0 && (
                <p style={{ color: colors.mute, fontSize: "0.78rem", fontStyle: "italic", margin: 0 }}>
                No AI suggestions generated yet.
                </p>
            )}
            {suggestions.map((topic) => (
                <SuggestionCard key={topic.id} topic={topic} onQueue={handleQueueSuggestion} queuedIds={queuedSuggestionIds} />
            ))}
            </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
        <p
        style={{
            color: colors.bodyStrong,
            fontSize: "0.78rem",
            fontWeight: 700,
            letterSpacing: "0.06em",
            margin: "0 0 0.5rem 0",
            textTransform: "uppercase",
        }}
        >
        Your Submitted Actions
        </p>

        <div
        style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.4rem",
            flex: 1,
            overflowY: "auto",
            scrollbarWidth: "none",
        }}
        >
        {submittedActions.length === 0 && (
            <p style={{ color: colors.mute, fontSize: "0.8rem", fontStyle: "italic", margin: 0 }}>
            No actions submitted yet.
            </p>
        )}
        {submittedActions.map(({ normalized, originalIndex }) => (
            <ActionItem key={normalized.id || originalIndex} action={normalized} onDelete={() => handleDelete(originalIndex)} />
        ))}
        </div>
        </div>
        </div>

        <div
        style={{
            alignItems: "center",
            borderTop: `1px solid ${colors.hairline}`,
            display: "flex",
            gap: "0.5rem",
            padding: "0.75rem 1rem",
            flexShrink: 0,
        }}
        >
        <div style={{ alignItems: "stretch", display: "flex", flex: 1, position: "relative" }}>
        <textarea
        ref={inputRef}
        className="actions-composer"
        placeholder="Enter your action…  (Shift+Enter for a new line)"
        value={inputValue}
        onChange={(event) => setInputValue(event.target.value)}
        onKeyDown={handleKeyDown}
        style={{
            background: colors.canvas,
            border: `1px solid ${colors.hairline}`,
            borderRadius: rounded.sm,
            boxSizing: "border-box",
            color: colors.primary,
            fontFamily: fonts.sans,
            fontSize: "0.82rem",
            outline: "none",
            padding: "0.7rem 2.8rem 0.7rem 0.85rem",
            resize: "vertical",
            transition: "border-color 0.2s",
            minHeight: "3rem",
            lineHeight: "1.45",
            overflowY: "auto",
            width: "100%",
        }}
        onFocus={(event) => {
            event.target.style.borderColor = colors.primary;
        }}
        onBlur={(event) => {
            event.target.style.borderColor = colors.hairline;
        }}
        />
        <button
        type="button"
        onClick={handleImprove}
        title="Improve action text"
        aria-label="Improve action text"
        style={{
            alignItems: "center",
            background: "none",
            border: "none",
            borderRadius: rounded.sm,
            color: inputValue.trim() ? colors.body : colors.mute,
            cursor: inputValue.trim() ? "pointer" : "default",
            display: "flex",
            height: "1.8rem",
            justifyContent: "center",
            padding: 0,
            position: "absolute",
            right: "0.45rem",
            top: "0.55rem",
            width: "1.8rem",
        }}
        >
        {isImproving ? <SpinnerRing size={14} tone={colors.body} /> : <SparkleIcon />}
        </button>
        </div>

        {/* Send = polarity flip (off-white fill, dark icon); disabled dims. */}
        <button
        type="button"
        onClick={handleSubmit}
        disabled={!inputValue.trim() || isSubmitting || isImproving}
        style={{
            alignItems: "center",
            background: colors.primary,
            border: "none",
            borderRadius: rounded.sm,
            color: colors.onPrimary,
            cursor: inputValue.trim() && !isSubmitting && !isImproving ? "pointer" : "not-allowed",
            display: "flex",
            flexShrink: 0,
            height: "2.2rem",
            justifyContent: "center",
            opacity: inputValue.trim() && !isSubmitting && !isImproving ? 1 : 0.45,
            transition: "opacity 0.15s",
            width: "2.2rem",
        }}
        >
        {isSubmitting ? <SpinnerRing size={14} tone={colors.onPrimary} /> : <SendIcon />}
        </button>
        </div>
        </>
        );

        return (
            <>
            {isMobile ? (
                <div
                    style={{
                        backgroundColor: colors.canvasSoft,
                        border: `1px solid ${colors.hairline}`,
                        borderRadius: rounded.md,
                        bottom: isOpen ? "4.25rem" : "-30rem",
                        color: colors.primary,
                        display: "flex",
                        flexDirection: "column",
                        fontFamily: fonts.sans,
                        height: "min(calc(100vh - 9rem), max(calc(100vh - 16rem), 30rem))",
                        minHeight: "10rem",
                        left: "0rem",
                        maxWidth: "calc(100vw - 1rem)",
                        opacity: isOpen ? 1 : 0,
                        overflow: "hidden",
                        pointerEvents: isOpen ? "auto" : "none",
                        position: "fixed",
                        transition: "bottom 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.35s ease",
                        width: "26.25rem",
                        zIndex: 9998,
                    }}
                >
                    <div
                        style={{
                            alignItems: "center",
                            borderBottom: `1px solid ${colors.hairline}`,
                            display: "flex",
                            justifyContent: "space-between",
                            padding: "1rem 1.25rem 0.75rem",
                            flexShrink: 0,
                        }}
                    >
                        <span style={{ fontSize: "1rem", fontWeight: 700, letterSpacing: "0.01em" }}>Actions</span>
                        <button
                            type="button"
                            onClick={onClose}
                            style={{
                                background: "none",
                                border: "none",
                                borderRadius: rounded.sm,
                                color: colors.mute,
                                cursor: "pointer",
                                fontSize: "1.1rem",
                                lineHeight: 1,
                                padding: "0.15rem 0.3rem",
                                transition: "color 0.15s",
                            }}
                        >
                            {"\u2715"}
                        </button>
                    </div>
                    {panelBody}
                </div>
            ) : (
                <FloatPanel
                    panelId="actions"
                    title="Actions"
                    isOpen={isOpen}
                    onClose={onClose}
                    initialW={420}
                    initialH={480}
                    minW={320}
                    minH={360}
                    zIndex={9998}
                    hideWhenClosed={true}
                >
                    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                        {panelBody}
                    </div>
                </FloatPanel>
            )}
            </>
        );
};

const Actions = ({ onOpenAdvisor, hovered, setHovered, isOpen, onToggle }) => {
    const [hasOpened, setHasOpened] = React.useState(false);

    React.useEffect(() => {
        if (isOpen) {
            setHasOpened(true);
        }
    }, [isOpen]);

    return (
        <>
        {hasOpened && (
            <ActionsPanel
            isOpen={isOpen}
            onClose={onToggle}
            onOpenAdvisor={onOpenAdvisor}
            />
        )}
        {/* Toolbar launcher: canvas-soft square + hairline; open state flips
            to the off-white fill (no gradients, no shadows). */}
        <button
        type="button"
        title="Actions"
        style={{
            alignItems: "center",
            background: isOpen ? colors.primary : colors.canvasSoft,
            border: `1px solid ${isOpen ? colors.primary : colors.hairline}`,
            borderRadius: rounded.md,
            color: isOpen ? colors.onPrimary : colors.primary,
            cursor: "pointer",
            display: "flex",
            fontFamily: fonts.sans,
            fontSize: "1.2rem",
            height: "3.3rem",
            justifyContent: "center",
            outline: "none",
            transition: "background 0.12s ease, color 0.12s ease",
            width: "3.3rem",
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={onToggle}
        >
        <SparkleIcon />
        </button>
        </>
    );
};

export { Actions };
