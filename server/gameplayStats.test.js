// Unit tests for the persistent national-stat-sheet merge in
// `applyEventImpactsToWorld` (Chantier 3 — "stats persist and only change
// when the AI changes them"). Run with `npm test` (node --test).
//
// These exercise the invariant the [National Statistics Evolution] directive
// relies on: the AI sends ONLY the fields that moved this turn, and the engine
// merges them into the stored sheet (deep-merging the indices/economy/
// gdpBreakdown groups) so every omitted field keeps its prior value. A polity's
// stats must never silently reset because the AI left them out.
import assert from "node:assert/strict";
import { test } from "node:test";
import { applyEventImpactsToWorld } from "../src/runtime/gameState.js";

// `toCountryName` (run on every polity change's code) returns invented names
// untouched, so an invented polity keeps a stable key end to end — no dependency
// on the GADM country-names map.
const POLITY = "Ruritania";

const baseSheet = () => ({
  capital: "Streslau",
  leader: "King Rudolf V",
  government: "constitutional monarchy",
  stability: 62,
  indices: {
    foodAutonomy: 70,
    economicIndependence: 55,
    internationalReputation: 50,
  },
  economy: {
    gdp: 48000,
    gdpPerCapita: 12,
    gdpGrowth: 1.8,
    publicDebt: 38,
    budgetBalance: -3.5,
  },
  gdpBreakdown: {
    services: 58,
    industry: 30,
    agriculture: 12,
  },
});

const worldWithSheet = () => ({
  countryStats: { [POLITY]: baseSheet() },
});

// Helper: one event carrying a single polityChange with a partial `stats`.
const eventWithStats = (stats, { code = POLITY } = {}) => ({
  title: "Turn event",
  description: "A turn event for the merge test.",
  impacts: { polityChanges: [{ code, stats }] },
});

test("polityChanges.stats merges into the persistent sheet without overwriting omitted top-level fields", () => {
  const before = worldWithSheet();
  const { world } = applyEventImpactsToWorld({
    events: [eventWithStats({ stability: 40, leader: "Queen Flavia I" })],
    world: before,
  });

  const sheet = world.countryStats[POLITY];
  // Changed fields move.
  assert.equal(sheet.stability, 40, "stability moved");
  assert.equal(sheet.leader, "Queen Flavia I", "leader moved");
  // Omitted fields persist untouched — the whole point of a PARTIAL diff.
  assert.equal(sheet.capital, "Streslau", "capital preserved");
  assert.equal(sheet.government, "constitutional monarchy", "government preserved");
});

test("nested groups (economy/indices/gdpBreakdown) deep-merge field-by-field, not wholesale replace", () => {
  const before = worldWithSheet();
  // A war drains the treasury but leaves GDP per capita and growth as they were.
  const { world } = applyEventImpactsToWorld({
    events: [
      eventWithStats({
        economy: { publicDebt: 52, budgetBalance: -9.2 },
        indices: { foodAutonomy: 60 },
      }),
    ],
    world: before,
  });

  const sheet = world.countryStats[POLITY];
  // Changed nested fields move.
  assert.equal(sheet.economy.publicDebt, 52, "economy.publicDebt moved");
  assert.equal(sheet.economy.budgetBalance, -9.2, "economy.budgetBalance moved");
  assert.equal(sheet.indices.foodAutonomy, 60, "indices.foodAutonomy moved");
  // Sibling fields in the SAME group are preserved (deep merge, not replace).
  assert.equal(sheet.economy.gdp, 48000, "economy.gdp preserved within the group");
  assert.equal(sheet.economy.gdpPerCapita, 12, "economy.gdpPerCapita preserved within the group");
  assert.equal(sheet.economy.gdpGrowth, 1.8, "economy.gdpGrowth preserved within the group");
  // A group the AI did not touch is entirely preserved.
  assert.equal(sheet.gdpBreakdown.services, 58, "gdpBreakdown untouched group preserved");
  assert.deepEqual(
    sheet.gdpBreakdown,
    { services: 58, industry: 30, agriculture: 12 },
    "gdpBreakdown whole group preserved",
  );
});

test("a polity with no prior sheet gets the partial sheet stored (first-time seed merge)", () => {
  const world = { countryStats: {} };
  const { world: next } = applyEventImpactsToWorld({
    events: [eventWithStats({ leader: "Premier Gregor", stability: 30 })],
    world,
  });

  const sheet = next.countryStats[POLITY];
  assert.ok(sheet, "a sheet was created for the new polity");
  assert.equal(sheet.leader, "Premier Gregor", "sent field stored");
  assert.equal(sheet.stability, 30, "sent field stored");
  // Fields the AI omitted are simply absent (no prior sheet to preserve from),
  // NOT reset to a hardcoded default — the Stats pane tolerates missing fields.
  assert.equal(sheet.capital, undefined, "omitted field is absent, not reset");
  assert.equal(sheet.economy, undefined, "omitted group is absent, not reset");
});

test("stats.indices.internationalReputation mirrors into world.internationalReputation (clamped 0-100)", () => {
  const before = worldWithSheet();
  const { world } = applyEventImpactsToWorld({
    events: [eventWithStats({ indices: { internationalReputation: 74 } })],
    world: before,
  });

  // The merged sheet carries the new index...
  assert.equal(
    world.countryStats[POLITY].indices.internationalReputation,
    74,
    "sheet index moved",
  );
  // ...and the authoritative reputation store mirrors it (lines 1250-1253).
  assert.equal(world.internationalReputation[POLITY], 74, "authoritative reputation mirrored");
});

test("partial stats across two sequential events accumulate without losing fields", () => {
  // The cross-turn guarantee: turn 1 changes the leader + economy, turn 2 changes
  // stability + a different economy field. The union must survive, proving the
  // sheet is persistent state the AI evolves, not a snapshot it overwrites.
  const before = worldWithSheet();

  const afterTurn1 = applyEventImpactsToWorld({
    events: [eventWithStats({ leader: "Queen Flavia I", economy: { publicDebt: 45 } })],
    world: before,
  }).world;

  const afterTurn2 = applyEventImpactsToWorld({
    events: [eventWithStats({ stability: 48, economy: { budgetBalance: -6.1 } })],
    world: afterTurn1,
  }).world;

  const sheet = afterTurn2.countryStats[POLITY];
  assert.equal(sheet.leader, "Queen Flavia I", "turn 1 leader survives turn 2");
  assert.equal(sheet.economy.publicDebt, 45, "turn 1 economy.publicDebt survives turn 2");
  assert.equal(sheet.stability, 48, "turn 2 stability applied");
  assert.equal(sheet.economy.budgetBalance, -6.1, "turn 2 economy.budgetBalance applied");
  // Untouched-since-seed fields still hold.
  assert.equal(sheet.capital, "Streslau", "seed capital still present after two turns");
  assert.equal(sheet.economy.gdpGrowth, 1.8, "seed economy.gdpGrowth still present after two turns");
});

test("omitting stats entirely leaves the sheet byte-for-byte unchanged (quiet period)", () => {
  // A polity the AI did not touch this turn must keep its sheet exactly as it was
  // — the directive's "quiet period = NO polityChanges entry (or one without stats)".
  const before = worldWithSheet();
  const beforeSheet = JSON.stringify(before.countryStats[POLITY]);

  const { world } = applyEventImpactsToWorld({
    events: [
      {
        title: "Unrelated event",
        description: "Does not touch Ruritania's stats.",
        impacts: { polityChanges: [{ code: POLITY, note: "no stat change" }] },
      },
    ],
    world: before,
  });

  assert.equal(
    JSON.stringify(world.countryStats[POLITY]),
    beforeSheet,
    "sheet unchanged when no stats sent",
  );
});
