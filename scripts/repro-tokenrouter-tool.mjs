/*! Open Historia — portions (TokenRouter tool-calling reproduction harness) © 2026 Nicholas Krol, MIT (see src/Editor/LICENSE). */
// Diagnostic harness for the "test connection OK, but real generation fails with
// bad_response_status_code" bug. The in-game test button sends a PLAIN text
// request (no tool/JSON schema); every real task (actions, advisor-less jumps,
// stats, countryStatSheet) goes through runJsonTask, which passes a `tool` and
// therefore sends `tools` + `tool_choice:"required"` (and, while the Model
// reasoning toggle is ON, `reasoning_effort:"medium"`). Those are the only
// differences between the path that works and the path that fails. This script
// sends each variant in isolation against the same endpoint/model so we can
// see exactly which component the upstream backend rejects.
//
// The payloads are built by hand here (not by importing main.jsx, which pulls
// browser-only code) but mirror callOpenAIStyleChatCompletions in
// src/Game/AI/main.jsx verbatim — same keys, same shapes, same tool schema.
//
// Usage:
//   TOKENROUTER_ENDPOINT="https://api.tokenrouter.com/v1" \
//   TOKENROUTER_API_KEY="<key>" \
//   TOKENROUTER_MODEL="qwen/qwen3.8-max-free" \
//   bun run scripts/repro-tokenrouter-tool.mjs
//
// Exit code 0 when every step behaved as expected; 1 when a step mixed up
// expected <-> actual (so CI/automation can catch the first regression).

const ENDPOINT = (process.env.TOKENROUTER_ENDPOINT || "").replace(/\/$/, "");
const API_KEY = process.env.TOKENROUTER_API_KEY || "";
const MODEL = process.env.TOKENROUTER_MODEL || "";

if (!ENDPOINT || !API_KEY || !MODEL) {
    console.error([
        "Missing required env vars. Provide all three:",
        "  TOKENROUTER_ENDPOINT (e.g. https://api.tokenrouter.com/v1)",
        "  TOKENROUTER_API_KEY",
        "  TOKENROUTER_MODEL (e.g. qwen/qwen3.8-max-free)",
    ].join("\n"));
    process.exit(2);
}

const URL = `${ENDPOINT}/chat/completions`;
const headers = {
    Authorization: `Bearer ${API_KEY}`,
    "Content-Type": "application/json",
};

const SYSTEM_PROMPT = "You are a terse test assistant. Follow the tool/JSON instructions exactly.";

// Minimal messages payload — the same shape toOpenAIMessages produces.
const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: "Reply with exactly: OK" },
];

// --- Tool schemas (copied from src/Game/AI/gameplaySchemas.js) ---

// Small schema: enough to exercise tool-calling without shipping megabytes.
const smallSchema = {
    type: "object",
    description: "A single value.",
    properties: { answer: { type: "string", description: "The short reply." } },
    required: ["answer"],
    additionalProperties: false,
};

// The real jump schema (full source of stress for payload size).
const jumpSchema = {
    type: "object",
    description: "A simulated timeline jump containing dated events and the resulting campaign state.",
    properties: {
        events: {
            type: "array",
            description: "Events occurring during the simulated period.",
            items: {
                type: "object",
                description: "One dated event.",
                properties: {
                    date: { type: "string", description: "Date the event occurred." },
                    title: { type: "string", description: "Concise event headline." },
                    description: { type: "string", description: "Narrative description." },
                    impacts: {
                        type: "object",
                        description: "Structured world-state changes the event applies.",
                        properties: {
                            regionTransfers: { type: "array", description: "Ownership changes.", items: { type: "object" } },
                            polityChanges: { type: "array", description: "Polity deltas.", items: { type: "object" } },
                            unitOps: { type: "array", description: "Military unit ops.", items: { type: "object" } },
                            markerOps: { type: "array", description: "Named place ops.", items: { type: "object" } },
                        },
                        required: ["regionTransfers", "polityChanges", "unitOps", "markerOps"],
                        additionalProperties: false,
                    },
                },
                required: ["date", "title", "description", "impacts"],
                additionalProperties: false,
            },
        },
        stopDate: { type: "string", description: "Date at which the simulation stops." },
        summary: { type: "string", description: "Concise summary of the period." },
        clearActions: { type: "boolean", description: "Whether planned player actions were resolved." },
        catalyst: { type: ["object", "null"], description: "An interactive catalyst scene." },
        diplomaticOutreach: { type: "array", description: "Unprompted diplomatic feelers.", items: { type: "object" } },
    },
    required: ["events", "stopDate", "summary", "clearActions"],
    additionalProperties: false,
};

const makeTool = (name, description, schema) => ({ name, description, schema });

const JUMP_TOOL = makeTool("submit_jump_result", "Submit the events, stop date, summary, resolved-action state, and optional catalyst from a timeline jump.", jumpSchema);
const SMALL_TOOL = makeTool("submit_answer", "Submit the short answer.", smallSchema);

// --- Request builders (mirror callOpenAIStyleChatCompletions payload) ---

function textPayload() {
    return { model: MODEL, messages };
}

function textWithReasoningPayload() {
    return { model: MODEL, messages, reasoning_effort: "medium" };
}

function toolPayload(tool, { withReasoning } = {}) {
    const payload = {
        model: MODEL,
        messages,
        ...(withReasoning ? { reasoning_effort: "medium" } : {}),
        tools: [{ type: "function", function: { name: tool.name, description: tool.description, parameters: tool.schema } }],
        tool_choice: "required",
    };
    return payload;
}

async function attempt(name, body) {
    const started = Date.now();
    let res;
    try {
        res = await fetch(URL, { method: "POST", headers, body: JSON.stringify(body) });
    } catch (err) {
        console.log(`\n[${name}] network error (${Date.now() - started}ms): ${err.message}`);
        return { ok: false, status: "network", summary: `network error: ${err.message}` };
    }

    const text = await res.text();
    const ms = Date.now() - started;
    let data = null;
    try { data = JSON.parse(text); } catch { /* non-JSON body */ }

    const status = res.status;
    const code = data?.error?.code || data?.error?.type || "";
    const message = data?.error?.message || text.slice(0, 300);
    const content = data?.choices?.[0]?.message?.content ?? "";
    const toolCalls = data?.choices?.[0]?.message?.tool_calls;

    console.log(`\n[${name}]`);
    console.log(`  HTTP ${status} (${ms}ms)`);
    if (data?.error) {
        console.log(`  error: ${JSON.stringify({ type: data.error.type, code: data.error.code, message: data.error.message ?? (data.error.message || "") })}`);
    }
    if (toolCalls) {
        const call = toolCalls[0];
        console.log(`  tool_calls: name="${call?.function?.name}" args=${(call?.function?.arguments || "").slice(0, 120)}`);
    }
    if (content) console.log(`  content: ${content.slice(0, 120)}`);
    if (!data?.error && !toolCalls && !content) console.log(`  raw: ${text.slice(0, 300)}`);

    return { ok: status >= 200 && status < 300, status, code, summary: `HTTP ${status} ${code} ${message.slice(0, 120)}`.trim() };
}

async function main() {
    console.log("Target:", URL);
    console.log("Model:", MODEL);

    // Sentinel of the "works" control. Plain text must succeed, matching the
    // in-game button test — if THIS fails, the whole premise is inverted.
    const baseline = await attempt("1. text (no tool, no reasoning) [control]", textPayload());
    console.log("→ expected OK:", baseline.ok ? "PASS" : "FAIL");

    // Isolate the reasoning param alone (no tool).
    const reasoningOnly = await attempt("2. text + reasoning_effort=medium", textWithReasoningPayload());

    // Isolate tool-calling alone (no reasoning): small schema.
    const smallTool = await attempt("3. tools + tool_choice=required (small schema, no reasoning)", toolPayload(SMALL_TOOL));

    // Tool + reasoning together — the exact payload the app sends while the
    // Model reasoning toggle is ON.
    const smallToolReasoning = await attempt("4. tools + tool_choice=required + reasoning_effort=medium (small schema)", toolPayload(SMALL_TOOL, { withReasoning: true }));

    // Stress the FULL jump schema (payload size + schema complexity) with the
    // same auth as a real turn.
    const jumpTool = await attempt("5. tools + tool_choice=required (real jump schema, no reasoning)", toolPayload(JUMP_TOOL));
    const jumpToolReasoning = await attempt("6. tools + tool_choice=required + reasoning_effort=medium (real jump schema)", toolPayload(JUMP_TOOL, { withReasoning: true }));

    console.log("\n" + "=".repeat(64));
    console.log("SUMMARY");
    console.log(`  1. text (control)                    ${baseline.ok ? "✅ ok" : "❌ " + baseline.summary}`);
    console.log(`  2. text + reasoning                  ${reasoningOnly.ok ? "✅ ok" : "❌ " + reasoningOnly.summary}`);
    console.log(`  3. tools (small, no reasoning)       ${smallTool.ok ? "✅ ok" : "❌ " + smallTool.summary}`);
    console.log(`  4. tools + reasoning (small)         ${smallToolReasoning.ok ? "✅ ok" : "❌ " + smallToolReasoning.summary}`);
    console.log(`  5. tools (jump schema, no reasoning) ${jumpTool.ok ? "✅ ok" : "❌ " + jumpTool.summary}`);
    console.log(`  6. tools + reasoning (jump schema)   ${jumpToolReasoning.ok ? "✅ ok" : "❌ " + jumpToolReasoning.summary}`);

    console.log("\nInterpretation:");
    if (!baseline.ok) {
        console.log("  Baseline text request itself failed — the endpoint/key/model reject even the simplest call.");
    } else if (!reasoningOnly.ok) {
        console.log("  => reasoning_effort alone triggers the rejection.");
    } else if (!smallTool.ok) {
        console.log("  => tool-calling (tools + tool_choice=required) triggers the rejection, independent of size or reasoning.");
    } else if (!smallToolReasoning.ok) {
        console.log("  => tool-calling + reasoning_effort together trigger it, but each alone is fine.");
    } else if (!jumpTool.ok) {
        console.log("  => the full jump schema (payload size / schema complexity) triggers it; small tool calls work.");
    } else if (!jumpToolReasoning.ok) {
        console.log("  => only the FULL combo (jump schema + reasoning) triggers it.");
    } else {
        console.log("  All variants succeeded — the rejection is not reproducible from these payloads. Check auth, quota, or a model-specific limit.");
    }

    // Exit non-zero if the doctor's control regressioned (baseline text failed).
    process.exit(baseline.ok ? 0 : 1);
}

main().catch((err) => {
    console.error("Unhandled error:", err);
    process.exit(1);
});