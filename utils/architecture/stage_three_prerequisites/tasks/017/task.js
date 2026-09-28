"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const vm = require("node:vm");

const CASTING = "src/core/casting_distance.js";
const CONVERTER = "src/core/distance_unit_converter.js";
const FISH_FORCE = "src/systems/fish_force_system.js";
const TACKLE_STRESS = "src/systems/tackle_stress_system.js";
const INDEX = "index.html";
const BASELINE = "architecture/guards/global_provider_baseline.json";
const SPLITS = "architecture/migration/legacy_slot_splits.json";
const RECORD = "architecture/migration/stage_3_prerequisites/017_distance-converter-split-and-review.json";
const SLOT = 89;
const MIXED = "mixed-responsibility-requires-decomposition";
const compare = (left, right) => (left < right ? -1 : left > right ? 1 : 0);
// The exact DistanceUnitConverter declaration heading casting_distance.js (CRLF); it moves byte-for-byte.
const DECLARATION = "class DistanceUnitConverter {\r\n  #pixelsPerMeter;\r\n\r\n  constructor(config = {}) {\r\n" +
  "    const physicsConfig = config?.physics || config || {};\r\n    this.#pixelsPerMeter = Math.max(\r\n      1,\r\n" +
  "      Number(\r\n        physicsConfig.simulation?.pixelsPerMeter ??\r\n          physicsConfig.pixelsPerMeter,\r\n" +
  "      ) || 50,\r\n    );\r\n  }\r\n\r\n  get pixelsPerMeter() {\r\n    return this.#pixelsPerMeter;\r\n  }\r\n\r\n" +
  "  metersToPixels(meters) {\r\n    const value = Number(meters);\r\n    if (!Number.isFinite(value)) return 0;\r\n" +
  "    return value * this.#pixelsPerMeter;\r\n  }\r\n\r\n  pixelsToMeters(pixels) {\r\n    const value = Number(pixels);\r\n" +
  "    if (!Number.isFinite(value)) return 0;\r\n    return value / this.#pixelsPerMeter;\r\n  }\r\n}\r\n";

const SCENARIOS = `(() => {
  const facts = [];
  const configs = [undefined, null, {}, { pixelsPerMeter: 40 }, { physics: { simulation: { pixelsPerMeter: 64 } } },
    { simulation: { pixelsPerMeter: "x" } }, { pixelsPerMeter: 0.5 }, { physics: {}, pixelsPerMeter: 70 }];
  for (const config of configs) {
    const converter = new DistanceUnitConverter(config);
    facts.push([converter.pixelsPerMeter, ...[0, 1, 2.5, -3, "4", NaN, Infinity].map((value) =>
      [converter.metersToPixels(value), converter.pixelsToMeters(value)])]);
  }
  facts.push(["methods", Object.getOwnPropertyNames(DistanceUnitConverter.prototype).sort()]);
  return JSON.stringify(facts);
})()`;

// Stage 3.22 backlog task stage-3.22.prerequisite.fishing-systems-decomposition, transition 3 (owner
// decision 2026-09-29): DistanceUnitConverter (also used by tackle.js) leaves casting_distance.js
// byte-for-byte for its own file, a reviewed split member of legacy slot 89 loaded before the
// calculator; its global provider moves with it. FishForceSystem and TackleStressSystem keep production
// diagnostic snapshots (read by fishing.js and fed by FightPhysicsSystem) and have no DEV dependency:
// their blockers are removed without a source edit on recorded guard/Manifest evidence.
module.exports = Object.freeze({
  sequence: 17,
  slug: "distance-converter-split-and-review",
  afterBatch: "038",
  backlogTaskId: "stage-3.22.prerequisite.fishing-systems-decomposition",
  intent: "Fishing-systems decomposition 3: DistanceUnitConverter moves byte-for-byte from casting_distance.js into src/core/distance_unit_converter.js (reviewed split member of legacy slot 89, provider moved, no new global); evidence-backed removal of the mixed-responsibility and dev-production-coupling blockers from the unchanged FishForceSystem and TackleStressSystem.",
  sourceEdits: Object.freeze([
    Object.freeze({ path: CASTING, replacements: Object.freeze([Object.freeze([`${DECLARATION}\r\n`, ""])]) }),
    Object.freeze({ path: INDEX, replacements: Object.freeze([Object.freeze([
      `    <script src="${CASTING}"></script>\n`,
      `    <script src="${CONVERTER}" data-legacy-slot="${SLOT}"></script>\n` +
        `    <script src="${CASTING}" data-legacy-slot="${SLOT}"></script>\n`,
    ])]) }),
  ]),
  createdFiles: Object.freeze([Object.freeze({ path: CONVERTER, bytes({ read }) {
    assert(read(CASTING).startsWith(`${DECLARATION}\r\nclass CastDistanceCalculator`),
      "casting_distance.js no longer starts with the reviewed DistanceUnitConverter");
    return DECLARATION;
  } })]),
  manifestEntries: Object.freeze([Object.freeze({ currentPath: CONVERTER, currentArea: "core", legacyLoadOrder: SLOT,
    architecture: Object.freeze({ migrationStatus: "classified", roles: Object.freeze(["domain-behavior"]),
      targetBoundary: "game-domain", targetPath: "src/game/domain/casting/distance_unit_converter.js", migrationWave: 1 }),
    blockers: Object.freeze({ status: "verified", items: Object.freeze(["legacy-global-contract"]) }) })]),
  reviewedWithoutEdit: Object.freeze([FISH_FORCE, TACKLE_STRESS]),
  manifestUpdates: Object.freeze([
    Object.freeze({ currentPath: CASTING, removedBlockers: Object.freeze([Object.freeze({ blocker: MIXED,
      reason: "The generic pixel/metre DistanceUnitConverter (also used by tackle.js) moved to its own file; since 015 the calculator reads the composed physics adapter and no longer adapts raw config. The file keeps only the cast-distance rule." })]) }),
    Object.freeze({ currentPath: FISH_FORCE, removedBlockers: Object.freeze([Object.freeze({ blocker: MIXED,
      reason: "One per-frame fish-force rule; its getDebugData snapshot is production fight data read by fishing.js (fish state, multipliers), not a DEV dependency (recorded evidence: game-domain/engine dependencies only). Renaming debug -> diagnostics is Stage 7." })]) }),
    Object.freeze({ currentPath: TACKLE_STRESS, removedBlockers: Object.freeze([
      Object.freeze({ blocker: "dev-production-coupling",
        reason: "No DEV module dependency (recorded evidence): the debug data it merges is production fight data set by FightPhysicsSystem and read for the stress HUD." }),
      Object.freeze({ blocker: MIXED,
        reason: "One tackle-stress rule over the accumulator, failure selector and weakest-limit resolver; its diagnostic snapshot is production data. Renaming debug -> diagnostics is Stage 7." }),
    ]) }),
  ]),
  // The DistanceUnitConverter provider moves with its declaration; slot 89 splits.
  metadataWrites({ read }) {
    const baseline = JSON.parse(read(BASELINE));
    const moved = baseline.providers.filter(provider => provider.currentPath === CASTING && provider.symbol === "DistanceUnitConverter");
    assert.equal(moved.length, 1, "exactly one DistanceUnitConverter provider moves");
    const providers = baseline.providers.map(provider => (provider === moved[0] ? { ...provider, currentPath: CONVERTER } : provider))
      .sort((left, right) => compare(left.currentPath, right.currentPath) || compare(left.symbol, right.symbol) ||
        compare(left.mechanism, right.mechanism));
    const registry = JSON.parse(read(SPLITS));
    assert(!registry.splits.some(split => split.slot === SLOT), "slot 89 is not split yet");
    const splits = [...registry.splits, { slot: SLOT, members: [CONVERTER, CASTING], transition: RECORD }]
      .sort((left, right) => left.slot - right.slot);
    return new Map([
      [BASELINE, `${JSON.stringify({ ...baseline, providers }, null, 2)}\n`],
      [SPLITS, `${JSON.stringify({ ...registry, splits }, null, 2)}\n`],
    ]);
  },
  resolvedDebtIds: Object.freeze([]),
  // tackle.js now reads the converter from its own file; the calculator gains the edge it had internally.
  expectedEdges: Object.freeze({
    removed: Object.freeze([["src/entities/tackle.js", CASTING, "DistanceUnitConverter"].join("\u0000")]),
    added: Object.freeze([
      [CASTING, CONVERTER, "DistanceUnitConverter"].join("\u0000"),
      ["src/entities/tackle.js", CONVERTER, "DistanceUnitConverter"].join("\u0000"),
    ]),
  }),
  // Focused parity: the extracted class is textually identical to the old declaration and behaves
  // identically; the calculator's source is otherwise unchanged; the reviewed sources are pinned.
  parity({ read, before, after }) {
    const oldCasting = before(CASTING);
    assert.equal(after(CONVERTER), DECLARATION, "the extracted declaration differs");
    assert.equal(after(CASTING), oldCasting.slice(DECLARATION.length + 2), "casting_distance.js changed beyond the extraction");
    const facts = source => {
      const context = vm.createContext({});
      vm.runInContext(source, context, { filename: "converter" });
      return vm.runInContext(SCENARIOS, context);
    };
    const baseline = facts(oldCasting.slice(0, DECLARATION.length));
    assert.equal(facts(after(CONVERTER)), baseline, "DistanceUnitConverter behaviour changed");
    const pinned = [FISH_FORCE, TACKLE_STRESS].map(file => crypto.createHash("sha256").update(read(file)).digest("hex")).join();
    return { cases: JSON.parse(baseline).length,
      factsSha256: crypto.createHash("sha256").update(`${baseline}${pinned}`).digest("hex") };
  },
});
