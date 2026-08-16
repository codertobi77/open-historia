/*! Open Historia — in-app update-check helpers © 2026 Nicholas Krol, MIT (see src/Editor/LICENSE). */

// Pure, dependency-free so the version comparison is unit-tested without a browser
// or a running server. The banner (AppUpdateBanner.jsx) is the only consumer.
//
// On the web build the page carries no stamped build number, so `toBuild` returns
// null and the banner never reports an update — it is inert. The helpers below are
// kept so the banner logic is exercised by the unit tests and stays available for
// any future self-hosted build that stamps a build number.

// Effective poll cadence (the banner checks at this interval; inert on the web
// build, which has no build number).
export const APP_UPDATE_CHECK_INTERVAL_MS = 3 * 60 * 1000;
// A re-check when the app regains focus, throttled so rapid focus flips can't hammer it.
export const APP_UPDATE_REFOCUS_THROTTLE_MS = 60 * 1000;

// A positive integer build number, or null for anything else (the web build has no
// stamped build, so it can never see an "update available").
export const toBuild = (value) => {
  // Number(symbol) throws; guard so a hostile/unexpected value can never crash a check.
  if (value == null || typeof value === "symbol") return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
};

// Normalize an /api/app-update payload into { build, apk, notes }, or null if it
// carries no usable build number.
export const parseUpdateManifest = (data) => {
  if (!data || typeof data !== "object") return null;
  const build = toBuild(data.build);
  if (build == null) return null;
  return {
    build,
    apk: typeof data.apk === "string" ? data.apk.trim() : "",
    notes: typeof data.notes === "string" ? data.notes.trim() : "",
  };
};

// True only when `latest` is a well-formed manifest describing a build strictly newer
// than the running one. A null/invalid current build (dev, web, desktop) is never an
// update.
export const isUpdateAvailable = (currentBuild, latest) => {
  const current = toBuild(currentBuild);
  const manifest = parseUpdateManifest(latest);
  if (current == null || !manifest) return false;
  return manifest.build > current;
};
