"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const vm = require("node:vm");

const PHYSICS_FILES = Object.freeze([
  "src/config/physics/environment_physics_config.js",
  "src/config/physics/retrieve_physics_config.js",
  "src/config/physics/fight_physics_config.js",
  "src/config/physics/tackle_physics_config.js",
  "src/config/physics/tension_physics_config.js",
  "src/config/physics/physics_config_adapter.js",
  "src/config/physics/physics_config.js",
]);
const LANDING = "src/core/fishing/landing_policy.js";
const RETRIEVE = "src/core/fishing/retrieve_policy.js";
const CASTING = "src/core/casting_distance.js";
const FISH_FORCE = "src/systems/fish_force_system.js";
const EDITED = Object.freeze([LANDING, RETRIEVE, CASTING, FISH_FORCE]);
const MIXED = "mixed-responsibility-requires-decomposition";

const FALLBACK = "  if (config?.fightPhysicsConfig) return config.fightPhysicsConfig;\n" +
  "  if (typeof FightPhysicsConfigAdapter !== \"undefined\") {\n    return new FightPhysicsConfigAdapter(config);\n  }\n" +
  "  return null;\n";
const RESOLVER_COMMENT = "// Composition passes a config carrying its FightPhysicsConfigAdapter (CONFIG or ConfigProvider);\n" +
  "// it is read on every call, so DEV overrides stay live.\n";
const edit = (file, replacements) => Object.freeze({ path: file,
  replacements: Object.freeze(replacements.map(pair => Object.freeze(pair))) });
// Both classic files declare the identical global helper; they stay byte-identical (the later one,
// retrieve_policy.js at slot 121, keeps winning).
const resolverEdit = file => edit(file, [[
  `function resolveFightPhysicsConfig(config) {\n${FALLBACK}}\n`,
  `${RESOLVER_COMMENT}function resolveFightPhysicsConfig(config) {\n` +
    "  if (config?.fightPhysicsConfig) return config.fightPhysicsConfig;\n  return null;\n}\n",
]]);

// Parity scenarios. `configs` carry the adapter the way production does (CONFIG: non-enumerable
// property; ConfigProvider: getter); every result must be identical in both worlds.
const SCENARIOS = `(() => {
  const facts = [];
  const record = (label, value) => facts.push([label, JSON.stringify(value, (key, item) =>
    typeof item === "number" && !Number.isFinite(item) ? String(item) : item)]);
  const raws = [{ physics: PHYSICS_CONFIG }, { physics: { ...PHYSICS_CONFIG, simulation: { pixelsPerMeter: 40 } } },
    { physics: {} }, {}];
  const configs = [];
  for (const raw of raws) {
    const adapter = new FightPhysicsConfigAdapter(raw);
    configs.push(Object.defineProperty({ ...raw }, "fightPhysicsConfig", { value: adapter, enumerable: false }));
    configs.push({ get fightPhysicsConfig() { return adapter; }, get physics() { return raw.physics || {}; } });
  }
  const rods = [null, {}, { effectiveStats: { lengthMeters: 4 } }, { effectiveStats: { lengthMeters: 3.5, hasReel: false } },
    { getLengthMeters: () => 6, hasReel: () => false }, { effectiveStats: { hasReel: true, lengthMeters: 2.7 } }];
  const reels = [null, {}, { effectiveStats: { lineCapacityMeters: 100 } }, { effectiveStats: { basePower: 2 } },
    { hasReel: () => true }];
  const landing = new LandingPolicyResolver();
  const retrieve = new IdleRetrievePolicyResolver();
  for (const config of configs) {
    for (const rod of rods) {
      for (const reel of reels) {
        const policy = landing.resolve({ rod, reel });
        for (const lineDistanceMeters of [0, 0.8, 3, 12, "x"]) {
          const context = { rod, reel, config, lineDistanceMeters };
          record("landing", [policy.constructor.name, policy.getLandingDistanceMeters(context), policy.isInLandingZone(context)]);
        }
        const idle = retrieve.resolve({ rod, reel });
        record("retrieve", [idle.constructor.name, idle.getRetrieveParams({ rod, reel, config })]);
      }
    }
    const calculator = new CastDistanceCalculator(config);
    record("pixels", [calculator.pixelsPerMeter, calculator.metersToPixels(3.5), calculator.pixelsToMeters(90)]);
    for (const rod of rods) {
      for (const hasReel of [true, false]) record("reach", calculator.getRodBaseReachMeters(rod, hasReel));
      const equipment = { rod, reel: reels[2], line: { effectiveStats: { lengthMeters: 30 } } };
      record("maxCast", [calculator.getMaxCastDistanceMeters(equipment, 10), calculator.getMaxCastDistancePx(equipment),
        calculator.getBuildCastPowerCoefficient(equipment, 0.5), calculator.describe(equipment, 0.8)]);
    }
  }
  return JSON.stringify(facts);
})()`;

// Stage 3.22 backlog task stage-3.22.prerequisite.fishing-systems-decomposition, transition 1 (owner
// decision 2026-09-28, point 5): the Domain fallback that constructed a FightPhysicsConfigAdapter from a
// raw config (a forbidden Domain -> game-config edge) is removed from LandingPolicy, RetrievePolicy,
// CastDistanceCalculator and FishForceSystem. Every production call passes a config carrying its adapter
// (CONFIG defines it; GameApplication's ConfigProvider always exposes it) and reads it on every call, so
// DEV overrides stay live; a runtime probe over the gameplay, inventory, items, quick, architecture and
// tools suites observed no fallback construction.
module.exports = Object.freeze({
  sequence: 15,
  slug: "fight-physics-config-fallback-removal",
  afterBatch: "038",
  backlogTaskId: "stage-3.22.prerequisite.fishing-systems-decomposition",
  intent: "Fishing-systems decomposition 1: LandingPolicy, RetrievePolicy, CastDistanceCalculator and FishForceSystem no longer construct a FightPhysicsConfigAdapter from raw config; they read the adapter the composed config carries (CONFIG / ConfigProvider) on every call, so DEV overrides stay live; identical results for every composed config.",
  sourceEdits: Object.freeze([
    resolverEdit(LANDING),
    resolverEdit(RETRIEVE),
    edit(CASTING, [[
      "  #resolvePhysicsConfigAdapter(config) {\n    if (config?.fightPhysicsConfig) return config.fightPhysicsConfig;\n" +
        "    const candidate = config?.physics || config;\n    if (\n" +
        "      typeof FightPhysicsConfigAdapter !== \"undefined\" &&\n" +
        "      (candidate?.simulation || candidate?.tackle || candidate?.fight)\n    ) {\n" +
        "      return new FightPhysicsConfigAdapter(config);\n    }\n    return null;\n  }\n",
      "  // Composition passes a config carrying its FightPhysicsConfigAdapter (CONFIG or ConfigProvider).\n" +
        "  #resolvePhysicsConfigAdapter(config) {\n    if (config?.fightPhysicsConfig) return config.fightPhysicsConfig;\n" +
        "    return null;\n  }\n",
    ]]),
    edit(FISH_FORCE, [[
      "  #resolvePhysicsConfigAdapter(config) {\n    if (config?.fightPhysicsConfig) return config.fightPhysicsConfig;\n" +
        "    if (typeof FightPhysicsConfigAdapter !== \"undefined\") {\n      return new FightPhysicsConfigAdapter(config);\n" +
        "    }\n    return null;\n  }\n",
      "  // Composition passes a config carrying its FightPhysicsConfigAdapter (CONFIG or ConfigProvider).\n" +
        "  #resolvePhysicsConfigAdapter(config) {\n    if (config?.fightPhysicsConfig) return config.fightPhysicsConfig;\n" +
        "    return null;\n  }\n",
    ]]),
  ]),
  manifestUpdates: Object.freeze([LANDING, RETRIEVE].map(currentPath => Object.freeze({ currentPath,
    removedBlockers: Object.freeze([Object.freeze({ blocker: MIXED,
      reason: "The raw-config adaptation (constructing a FightPhysicsConfigAdapter, a forbidden Domain -> game-config edge) is gone; the file keeps one policy family and its resolver, reading the adapter the composed config carries on every call." })]) }))),
  // The four forbidden Domain -> game-config edges to the adapter disappear.
  resolvedDebtIds: Object.freeze([
    "debt-boundary-dependency-e9b2c7838d91",
    "debt-boundary-dependency-4b1c9821e6ed",
    "debt-boundary-dependency-71f856da4ba4",
    "debt-boundary-dependency-3e33b8422f4d",
  ]),
  expectedEdges: Object.freeze({
    removed: Object.freeze([LANDING, RETRIEVE, CASTING, FISH_FORCE].sort().map(source =>
      [source, "src/config/physics/physics_config_adapter.js", "FightPhysicsConfigAdapter"].join("\u0000"))),
    added: Object.freeze([]),
  }),
  // Focused parity: landing distances and zones, idle-retrieve parameters and cast-distance results are
  // identical for every composed config shape; the removed branch is documented: the new sources never
  // construct an adapter (configs without one now resolve null, which no production call passes).
  parity({ read, before, after }) {
    const world = source => {
      const constructed = [];
      const context = vm.createContext({ console });
      for (const file of PHYSICS_FILES) vm.runInContext(read(file), context, { filename: file });
      context.__constructed = constructed;
      vm.runInContext(`{ const Base = FightPhysicsConfigAdapter; FightPhysicsConfigAdapter = class extends Base {
        constructor(...args) { super(...args); __constructed.push(new Error().stack.split("\\n")[2] || "?"); } }; }`, context);
      for (const file of [LANDING, RETRIEVE, CASTING]) vm.runInContext(source(file), context, { filename: file });
      return { context, constructed };
    };
    const old = world(before);
    const next = world(after);
    const baseline = vm.runInContext(SCENARIOS, old.context);
    const composed = vm.runInContext(SCENARIOS, next.context);
    assert.equal(composed, baseline, "results for composed configs changed");
    const fallbackSites = sites => sites.filter(site => /landing_policy|retrieve_policy|casting_distance/u.test(site));
    assert.equal(fallbackSites(old.constructed).length, 0, "old sources used the fallback for composed configs");
    // The removed branch: a raw config without an adapter.
    for (const { context, constructed } of [old, next]) {
      vm.runInContext(`new LandingPolicyResolver().resolve({}).getLandingDistanceMeters({ config: { physics: PHYSICS_CONFIG } });
        new IdleRetrievePolicyResolver().resolve({}).getRetrieveParams({ config: { physics: PHYSICS_CONFIG } });
        new CastDistanceCalculator({ physics: PHYSICS_CONFIG });`, context);
      context.__fallbacks = fallbackSites(constructed).length;
    }
    assert(old.context.__fallbacks > 0, "the old fallback branch is exercised");
    assert.equal(next.context.__fallbacks, 0, "the new sources construct a FightPhysicsConfigAdapter");
    for (const file of EDITED) {
      assert(!/new FightPhysicsConfigAdapter|typeof FightPhysicsConfigAdapter/u.test(after(file)),
        `Domain source still constructs the adapter: ${file}`);
    }
    const landingHelper = after(LANDING).slice(after(LANDING).indexOf("// Composition passes"));
    assert(after(RETRIEVE).includes(landingHelper.slice(0, landingHelper.indexOf("}\n") + 2)),
      "the two resolveFightPhysicsConfig declarations stay identical");
    return { cases: JSON.parse(baseline).length, factsSha256: crypto.createHash("sha256").update(baseline).digest("hex") };
  },
});
