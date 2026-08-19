/*! Open Historia — portions (serverless AI relay for CORS-blocked providers) © 2026 Nicholas Krol, MIT (see src/Editor/LICENSE). */
// POST /api/ai/relay — re-issues a player's AI-provider request server-side so
// providers that refuse browser CORS calls (NVIDIA NIM, most OpenAI-compatible
// gateways) still work from the hosted site. The browser sends
// { url, method, headers, payload } and this function forwards the request,
// handing the provider's status + body straight back (see relayFetch /
// tryRelayFetch in src/Game/AI/main.jsx for the client half of the contract).
//
// This function is PUBLIC — anyone who can reach the site can call it — so it
// is deliberately narrow: https-only, GET/POST only, an allowlist of
// forwardable headers, a body-size cap, no redirects, and a DNS-resolution
// SSRF guard so it can never be pointed at private/internal addresses. It is a
// relay for AI APIs, not a general-purpose proxy.
//
// Known limit (documented, not an oversight): the DNS check and the fetch
// resolve the hostname independently, so a malicious DNS rebinding between the
// two could in theory slip a private IP through. Closing that fully would
// require pinning the resolved address into the connection (a custom fetch
// dispatcher); the accepted residual risk is bounded by https-only + the fact
// that the target is a provider the player themself configured with their own
// key, and by the hostname blocklist covering the common internal names.

import { promises as dns } from "node:dns";
import net from "node:net";

// Vercel's Node-function body limit is 4.5 MB; stay under it. A chat payload is
// a system prompt + history JSON, so this is far beyond any real game turn.
const MAX_BODY_BYTES = 4 * 1024 * 1024;
// Just under the function's maxDuration (vercel.json: 60s) so THIS function
// times the provider out and answers 504 instead of being killed mid-write.
const RELAY_TIMEOUT_MS = 55_000;

// The only headers ever forwarded to the provider. Everything else — cookie,
// host, origin, referer, x-forwarded-*, any custom header — is dropped, so the
// relay can't be used to smuggle request context or site credentials upstream.
// This set covers every header the client builds: Authorization (OpenAI-style
// Bearer keys), x-api-key + anthropic-version (Anthropic-style), Content-Type,
// Accept, and Anthropic's browser-access opt-in.
const FORWARD_HEADERS = new Set([
    "authorization",
    "x-api-key",
    "api-key",
    "content-type",
    "accept",
    "anthropic-version",
    "anthropic-dangerous-direct-browser-access",
]);

class RelayError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

// Every relay answer — including errors — carries x-open-historia-relay so the
// client can tell a real relay response apart from a static host's SPA
// fallback (which answers an unknown POST with 200 text/html).
function jsonResponse(status, message) {
    return new Response(JSON.stringify({ error: { message } }), {
        status,
        headers: {
            "content-type": "application/json",
            "cache-control": "no-store",
            "x-open-historia-relay": "1",
        },
    });
}

function isBlockedIpv4(ip) {
    const parts = ip.split(".").map(Number);
    if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) return true;
    const [a, b, c] = parts;
    if (a === 0) return true;                                  // 0.0.0.0/8 "this network"
    if (a === 10) return true;                                 // RFC1918 private
    if (a === 100 && b >= 64 && b <= 127) return true;         // RFC6598 CGNAT
    if (a === 127) return true;                                // loopback
    if (a === 169 && b === 254) return true;                   // link-local (cloud metadata!)
    if (a === 172 && b >= 16 && b <= 31) return true;          // RFC1918 private
    if (a === 192 && b === 0 && (c === 0 || c === 2)) return true; // IETF protocol reserves / TEST-NET-1
    if (a === 192 && b === 88 && c === 99) return true;        // 6to4 relay anycast
    if (a === 192 && b === 168) return true;                   // RFC1918 private
    if (a === 198 && (b === 18 || b === 19)) return true;      // benchmarking
    if (a === 198 && b === 51 && c === 100) return true;       // TEST-NET-2
    if (a === 203 && b === 0 && c === 113) return true;        // TEST-NET-3
    if (a >= 224) return true;                                 // multicast + reserved + broadcast
    return false;
}

function isBlockedIpv6(ip) {
    const lower = ip.toLowerCase();
    if (lower === "::" || lower === "::1") return true;        // unspecified / loopback
    if (lower.startsWith("fe80:")) return true;                // link-local
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique-local (fc00::/7)
    if (lower.startsWith("ff")) return true;                   // multicast (ff00::/8)
    // IPv4-mapped forms — the classic SSRF bypass, so both spellings.
    const dotted = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
    if (dotted) return isBlockedIpv4(dotted[1]);
    const hexed = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(lower);
    if (hexed) {
        const high = parseInt(hexed[1], 16);
        const low = parseInt(hexed[2], 16);
        return isBlockedIpv4(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`);
    }
    return false;
}

export function isBlockedAddress(ip) {
    const version = net.isIP(ip);
    if (version === 4) return isBlockedIpv4(ip);
    if (version === 6) return isBlockedIpv6(ip);
    return true; // not an IP at all — treat as blocked, callers check hostnames separately
}

export function isBlockedHostname(hostname) {
    // URL.hostname wraps IPv6 literals in brackets; strip them (and any DNS trailing dot).
    const host = String(hostname).toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
    if (!host) return true;
    if (net.isIP(host)) return isBlockedAddress(host);         // IP-literal host
    if (host === "localhost" || host.endsWith(".localhost")) return true;
    if (host.endsWith(".local") || host.endsWith(".internal")) return true;
    if (host.endsWith(".lan") || host.endsWith(".home.arpa")) return true;
    return false;
}

// Resolve BEFORE fetching and refuse any private/reserved answer, so a
// hostname that points into the deployment's own network (127.0.0.1, the
// cloud metadata IP, RFC1918) can't be reached through the relay.
async function assertPublicHost(hostname) {
    let addresses;
    try {
        addresses = await dns.lookup(hostname, { all: true, verbatim: true });
    } catch {
        throw new RelayError(403, `The relay could not resolve ${hostname}.`);
    }
    if (!addresses.length) throw new RelayError(403, `The relay could not resolve ${hostname}.`);
    for (const { address } of addresses) {
        if (isBlockedAddress(address)) {
            throw new RelayError(403, "The relay only forwards to public AI provider endpoints.");
        }
    }
}

export function sanitizeHeaders(headers) {
    const forwarded = {};
    if (!headers || typeof headers !== "object") return forwarded;
    for (const [key, value] of Object.entries(headers)) {
        const lower = String(key).toLowerCase();
        if (FORWARD_HEADERS.has(lower) && typeof value === "string") forwarded[lower] = value;
    }
    return forwarded;
}

async function handler(request) {
    if (request.method !== "POST") return jsonResponse(405, "The AI relay only accepts POST.");

    let raw;
    try {
        raw = await request.text();
    } catch {
        return jsonResponse(400, "The relay could not read the request body.");
    }
    if (raw.length > MAX_BODY_BYTES) return jsonResponse(413, "The relay request body is too large.");

    let envelope;
    try {
        envelope = JSON.parse(raw);
    } catch {
        return jsonResponse(400, "The relay request body must be JSON.");
    }

    const { url, method = "POST", headers, payload } = envelope ?? {};

    const upstreamMethod = String(method).toUpperCase();
    if (upstreamMethod !== "GET" && upstreamMethod !== "POST") {
        return jsonResponse(405, "The relay only forwards GET and POST requests.");
    }

    let target;
    try {
        target = new URL(String(url));
    } catch {
        return jsonResponse(400, "The relay requires a valid target URL.");
    }
    // https-only: a public relay must never carry a key (or anything else) in
    // cleartext, and mixed-content http endpoints can't be called from the
    // hosted https page anyway.
    if (target.protocol !== "https:") return jsonResponse(400, "The relay only forwards https URLs.");
    if (isBlockedHostname(target.hostname)) {
        return jsonResponse(403, "The relay only forwards to public AI provider endpoints.");
    }

    try {
        await assertPublicHost(target.hostname);
    } catch (error) {
        if (error instanceof RelayError) return jsonResponse(error.status, error.message);
        return jsonResponse(403, "The relay only forwards to public AI provider endpoints.");
    }

    const forwardHeaders = sanitizeHeaders(headers);
    const body = payload !== undefined ? JSON.stringify(payload) : undefined;
    if (body !== undefined && !forwardHeaders["content-type"]) forwardHeaders["content-type"] = "application/json";

    let upstream;
    try {
        upstream = await fetch(target, {
            method: upstreamMethod,
            headers: forwardHeaders,
            ...(body !== undefined ? { body } : {}),
            // redirect:"error" — a 3xx away could bounce the request (and the
            // Authorization header) at a host the guards above never vetted.
            redirect: "error",
            signal: AbortSignal.timeout(RELAY_TIMEOUT_MS),
        });
    } catch (error) {
        if (error?.name === "TimeoutError" || error?.name === "AbortError") {
            return jsonResponse(504, "The AI provider did not answer the relay in time.");
        }
        return jsonResponse(502, "The relay could not reach the AI provider.");
    }

    // Hand the provider's answer back verbatim — status, content-type, and a
    // STREAMED body — so the client's existing ok/json/SSE handling works
    // unchanged (buffered chat completions and advisor SSE alike).
    const responseHeaders = new Headers({
        "cache-control": "no-store",
        "x-open-historia-relay": "1",
    });
    const contentType = upstream.headers.get("content-type");
    if (contentType) responseHeaders.set("content-type", contentType);
    return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: responseHeaders,
    });
}

// Vercel's Node.js runtime invokes a bare `export default function (req, res)`
// with the LEGACY (req, res) => void signature — `req` is Node's IncomingMessage
// and the returned Web Response is silently discarded, so every request hung
// until FUNCTION_INVOCATION_TIMEOUT (a 504 after the full maxDuration) no matter
// what was sent. The `{ fetch }` object export is the signature the runtime
// recognizes for Web Request/Response handlers, so it receives a real Request
// and ships the returned Response back to the client.
// See vercel.com/docs/functions/runtimes/node-js ("fetch Web Standard export").
export default { fetch: handler };
