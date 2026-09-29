"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const vm = require("node:vm");

const UTILS = "src/app/utils.js";
const NORMALIZE = "src/core/math/normalize_distance.js";
const INDEX = "index.html";
const BASELINE = "architecture/guards/global_provider_baseline.json";
const SPLITS = "architecture/migration/legacy_slot_splits.json";
const RECORD = "architecture/migration/stage_3_prerequisites/028_normalize-distance-classic-extraction.json";
const SLOT = 390;
const MIXED = "mixed-responsibility-requires-decomposition";
const DECLARATION = "function normalizeDistance(raw, fallback = Infinity) {\r\n" +
  "  if (raw === \"max\") return Infinity;\r\n" +
  "  if (raw == null) return fallback;\r\n\r\n" +
  "  const value = Number(raw);\r\n" +
  "  return Number.isFinite(value) ? Math.max(1, value) : fallback;\r\n" +
  "}\r\n";
const compare = (left, right) => (left < right ? -1 : left > right ? 1 : 0);
const SCENARIOS = `(() => JSON.stringify([
  ...[undefined, null, "max", 0, 0.5, 1, 12.5, "7", "x", NaN, Infinity, -5]
    .map(value => [String(value), normalizeDistance(value), normalizeDistance(value, 17)]),
  ["arity", normalizeDistance.length],
]))()`;
const RNG_SCENARIOS = `(() => {
  const facts = [];
  for (const seed of [undefined, 0, 1, -1, "fish", null]) {
    const rng = new SeededRng(seed);
    facts.push([String(seed), rng.next(), rng.range(-2, 3), rng.int(2, 7), rng.chance(0.5), rng.pick(["a", "b", "c"])]);
  }
  facts.push(Object.getOwnPropertyNames(SeededRng.prototype).sort());
  return JSON.stringify(facts);
})()`;

// The Stage 3.41 preflight exposed a frozen-review omission: gameplay_rules consumes the generic
// normalizeDistance utility, but the proposed ESM target had no import for it. Checkpoint A splits
// the function byte-for-byte from the SeededRng script at the same logical slot. ESM ownership is a
// separate prerequisite so both transitions stay independently replayable and reversible.
module.exports = Object.freeze({
  sequence: 28,
  slug: "normalize-distance-classic-extraction",
  afterBatch: "039",
  backlogTaskId: "stage-3.22.prerequisite.entities-world-rules-decomposition",
  intent: "Checkpoint A: extract the exact normalizeDistance function from src/app/utils.js into src/core/math/normalize_distance.js, loaded immediately before the residual SeededRng script at the same logical legacy slot 390; preserve both globals, call results and load timing without adding an ESM owner yet.",
  sourceEdits: Object.freeze([
    Object.freeze({ path: UTILS, replacements: Object.freeze([Object.freeze([`${DECLARATION}\r\n`, ""])]) }),
    Object.freeze({ path: INDEX, replacements: Object.freeze([Object.freeze([
      `    <script src="${UTILS}"></script>\n`,
      `    <script src="${NORMALIZE}" data-legacy-slot="${SLOT}"></script>\n` +
        `    <script src="${UTILS}" data-legacy-slot="${SLOT}"></script>\n`,
    ])]) }),
  ]),
  createdFiles: Object.freeze([Object.freeze({ path: NORMALIZE, bytes({ read }) {
    assert(read(UTILS).startsWith(`${DECLARATION}\r\nclass SeededRng`),
      "app/utils.js no longer starts with the reviewed normalizeDistance function");
    return DECLARATION;
  } })]),
  manifestEntries: Object.freeze([Object.freeze({ currentPath: NORMALIZE, currentArea: "core/math",
    legacyLoadOrder: SLOT, architecture: Object.freeze({ migrationStatus: "classified",
      roles: Object.freeze(["engine-utility"]), targetBoundary: "engine",
      targetPath: "src/engine/math/normalize_distance.js", migrationWave: 1 }),
    blockers: Object.freeze({ status: "verified", items: Object.freeze(["legacy-global-contract"]) }) })]),
  manifestUpdates: Object.freeze([Object.freeze({ currentPath: UTILS,
    removedBlockers: Object.freeze([Object.freeze({ blocker: MIXED,
      reason: "The independent normalizeDistance mechanism moved byte-for-byte to its own Engine-classified source; src/app/utils.js now owns only SeededRng." })]) })]),
  metadataWrites({ read }) {
    const baseline = JSON.parse(read(BASELINE));
    const moved = baseline.providers.filter(provider =>
      provider.currentPath === UTILS && provider.symbol === "normalizeDistance");
    assert.equal(moved.length, 1, "exactly one normalizeDistance provider moves");
    const providers = baseline.providers.map(provider => (provider === moved[0]
      ? { ...provider, currentPath: NORMALIZE }
      : provider)).sort((left, right) => compare(left.currentPath, right.currentPath) ||
        compare(left.symbol, right.symbol) || compare(left.mechanism, right.mechanism));
    const splits = JSON.parse(read(SPLITS));
    assert(!splits.splits.some(split => split.slot === SLOT), "legacy slot 390 is already split");
    const nextSplits = { ...splits, splits: [...splits.splits,
      { slot: SLOT, members: [NORMALIZE, UTILS], transition: RECORD }].sort((a, b) => a.slot - b.slot) };
    return new Map([
      [BASELINE, `${JSON.stringify({ ...baseline, providers }, null, 2)}\n`],
      [SPLITS, `${JSON.stringify(nextSplits, null, 2)}\n`],
    ]);
  },
  resolvedDebtIds: Object.freeze([]),
  expectedEdges: Object.freeze({
    removed: Object.freeze([["src/app/rules.js", UTILS, "normalizeDistance"].join("\u0000")]),
    added: Object.freeze([["src/app/rules.js", NORMALIZE, "normalizeDistance"].join("\u0000")]),
  }),
  parity({ before, after }) {
    const run = sources => {
      const context = vm.createContext({});
      for (const [source, filename] of sources) vm.runInContext(source, context, { filename });
      return { distance: vm.runInContext(SCENARIOS, context), rng: vm.runInContext(RNG_SCENARIOS, context) };
    };
    const baseline = run([[before(UTILS), UTILS]]);
    assert.equal(after(NORMALIZE), before(UTILS).slice(0, DECLARATION.length),
      "the extracted normalizeDistance declaration differs from the old one");
    assert(!/\bfunction normalizeDistance\b/u.test(after(UTILS)), "app/utils.js still declares normalizeDistance");
    assert.deepEqual(run([[after(NORMALIZE), NORMALIZE], [after(UTILS), UTILS]]), baseline,
      "normalizeDistance or SeededRng behavior changed");
    const facts = JSON.stringify(baseline);
    return { cases: JSON.parse(baseline.distance).length + JSON.parse(baseline.rng).length,
      factsSha256: crypto.createHash("sha256").update(facts).digest("hex") };
  },
});
