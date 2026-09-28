"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const vm = require("node:vm");
const { StageThreeHotLoopSourceReview } = require("../../../review_queue/hot_loop_source_review");

const RUNTIME = "dist/stage-3-compat-runtime/compat_runtime.iife.js";
const VECTOR2 = "src/core/math/vector2.js";
const CONVERTER = "src/core/distance_unit_converter.js";
const PHYSICS_FILES = Object.freeze([
  "src/config/physics/environment_physics_config.js",
  "src/config/physics/retrieve_physics_config.js",
  "src/config/physics/fight_physics_config.js",
  "src/config/physics/tackle_physics_config.js",
  "src/config/physics/tension_physics_config.js",
  "src/config/physics/physics_config_adapter.js",
  "src/config/physics/physics_config.js",
]);
const MIGRATED = Object.freeze({
  EnvironmentalCompensationModifier: "src/game/domain/items/quality/environmental_compensation_modifier.js",
  ReelRetrieveSpeedCalculator: "src/game/domain/fishing/reel_retrieve_speed_calculator.js",
  HookPowerPolicy: "src/game/domain/items/hook/hook_power_policy.js",
  NetQualityModifier: "src/game/domain/items/quality/net_quality_modifier.js",
});
const TACKLE = "src/entities/tackle.js";
const FISHING = "src/app/fishing.js";
const APPLICATION = "src/app/application.js";
const BOOTSTRAP = "src/app/bootstrap.js";
const CLASSES = Object.freeze(["Reel", "Net", "WaterEntity", "SpinnerEntity", "WobblerEntity", "JigEntity", "FeederEntity",
  "FloatEntity", "BaitFactory"]);
const HELPERS = Object.freeze({ _fightPhysicsConfig: 0, _passiveRetrieveConfig: 1, _floatMotionConfig: 2,
  _lureRetrieveConfig: 1 });
const GETTER_NAMES = Object.freeze(["getGlobalFightPhysicsConfig", "getGlobalRuntimePhysicsConfig",
  "getGlobalPassiveRetrieveConfig", "getGlobalFloatMotionConfig", "getGlobalLureRetrieveConfig", "getGlobalReelConfig"]);

// The six raw-config getters heading tackle.js (all read the CONFIG global).
const GETTERS = "function getGlobalFightPhysicsConfig() {\n  if (typeof CONFIG === \"undefined\") return null;\n" +
  "  if (CONFIG.fightPhysicsConfig) return CONFIG.fightPhysicsConfig;\n  if (typeof FightPhysicsConfigAdapter !== \"undefined\") {\n" +
  "    return new FightPhysicsConfigAdapter(CONFIG);\n  }\n  return null;\n}\n\n" +
  "function getGlobalRuntimePhysicsConfig() {\n  const physicsConfig = getGlobalFightPhysicsConfig();\n  return (\n" +
  "    physicsConfig?.getDistanceConfig?.() ||\n    {}\n  );\n}\n\n" +
  "function getGlobalPassiveRetrieveConfig() {\n  const physicsConfig = getGlobalFightPhysicsConfig();\n" +
  "  return physicsConfig?.getPassiveRetrieveConfig?.() || {};\n}\n\n" +
  "function getGlobalFloatMotionConfig() {\n  const physicsConfig = getGlobalFightPhysicsConfig();\n  return (\n" +
  "    physicsConfig?.getFloatMotionConfig?.() ||\n    getGlobalRuntimePhysicsConfig().floatMotion ||\n    {}\n  );\n}\n\n" +
  "function getGlobalLureRetrieveConfig() {\n  const physicsConfig = getGlobalFightPhysicsConfig();\n" +
  "  return physicsConfig?.getLureRetrieveConfig?.() || {};\n}\n\n" +
  "function getGlobalReelConfig() {\n  const physicsConfig = getGlobalFightPhysicsConfig();\n" +
  "  return physicsConfig?.getReelConfig?.() || {};\n}\n\n";
// WaterEntity accessors reproducing the getters' expressions over the injected live runtime config.
const ACCESSORS = "  // The composition passes the live runtime config object; its adapter is read on every call, so\n" +
  "  // DEV adapter overrides stay live.\n  _fightPhysicsConfig() {\n    return this._runtimeConfig?.fightPhysicsConfig || null;\n  }\n\n" +
  "  _passiveRetrieveConfig() {\n    return this._fightPhysicsConfig()?.getPassiveRetrieveConfig?.() || {};\n  }\n\n" +
  "  _floatMotionConfig() {\n    const physicsConfig = this._fightPhysicsConfig();\n    return (\n" +
  "      physicsConfig?.getFloatMotionConfig?.() ||\n      (physicsConfig?.getDistanceConfig?.() || {}).floatMotion ||\n" +
  "      {}\n    );\n  }\n\n  _lureRetrieveConfig() {\n    return this._fightPhysicsConfig()?.getLureRetrieveConfig?.() || {};\n  }\n\n";

const edit = (file, replacements) => Object.freeze({ path: file,
  replacements: Object.freeze(replacements.map(pair => Object.freeze(pair))) });
const entityCall = name => [`return new ${name}(x, y, config, config.maxDepth, rng, debugEvents, undefined, devFlags);`,
  `return new ${name}(x, y, config, config.maxDepth, rng, debugEvents, undefined, devFlags, runtimeConfig);`];

// Hot-loop scenario: every entity type is cast and updated through pulling and idle frames with
// varying deltaTime; every step's position, velocity, depth and visual state is recorded. `create`
// builds the entity the way each world composes it.
const SCENARIOS = `((create) => {
  const facts = [];
  const state = (entity) => JSON.parse(JSON.stringify({ position: entity.getPosition(), velocity: entity.getVelocity(),
    depth: entity.getCurrentHookDepth(), bottom: entity.isBottomLocked(), visual: entity.getVisualState(),
    biting: entity.isBiting(), hooked: entity.isHooked() }, (key, value) =>
      typeof value === "number" && !Number.isFinite(value) ? String(value) : value));
  const bounds = { left: 0, right: 2000, top: 0, bottom: 1500 };
  const checkWater = (x, y) => ({ depth: 2 + ((x + y) % 5) * 0.5 });
  const environment = { wind: { direction: 1, gustAngleRange: [0.05, 0.3], breezeAngleRange: [0.01, 0.1],
    gustFluctuationMs: [40, 120], gustChancePerSec: 0.8, gustDurationMs: [200, 500] },
    current: { speedPxPerSec: 12, direction: { x: 0.6, y: 0.8 } } };
  const dts = [16.67, 8, 33, 50, 120, 0, 16.67, 16.67];
  for (const type of ["float", "spinner", "wobbler", "jig", "feeder"]) {
    const entity = create(type);
    if (typeof entity.cast === "function") entity.cast(400, 300, 1.5, false, { weight: 2 }, 0.6);
    facts.push([type, "cast", state(entity)]);
    for (let step = 0; step < 48; step += 1) {
      const pulling = step % 12 < 5;
      entity.update(bounds, dts[step % dts.length], environment, checkWater,
        { isPulling: pulling }, pulling ? 0.8 : 0, pulling ? { x: 0.6, y: 0.8 } : null);
      facts.push([type, step, state(entity)]);
      if (step === 30) {
        entity.startBite(false, { chanceGuaranteed: 0.5, chanceNormal: 0.5, maxSequences: [1, 3],
          guaranteedIters: [1, 2], normalIters: [1, 3], sequenceIntervalMs: [20, 40], intervalMs: [10, 20] });
        facts.push([type, "bite", JSON.parse(JSON.stringify(entity._activeBiteSequence))]);
      }
    }
  }
  return JSON.stringify(facts);
})`;
const REEL_SCENARIOS = `((reelOptions) => {
  const facts = [];
  for (const options of [{}, { bearingCount: 3 }, { bearingCount: 5, bearingRetrieveSpeedBonusMetersPerSec: 0.2 },
    { bearingCount: 2, bearingRetrieveSpeedBonusMetersPerSec: "x" }, { lineCapacityMeters: 0 }]) {
    const reel = new Reel(2, 1.5, reelOptions(options));
    facts.push([reel.getBearingRetrieveSpeedBonusMetersPerSec(), reel.getRetrieveSpeedMetersPerSec(),
      reel.getBaseRetrieveSpeedMetersPerSec(), reel.getBearingCount()]);
  }
  return JSON.stringify(facts);
})`;

// Stage 3.22 backlog task stage-3.22.prerequisite.entities-world-rules-decomposition, transition 3 (owner
// decision 2026-09-29, point B): tackle.js no longer reads the raw CONFIG global. Its six global config
// getters are removed (exact recorded global-provider removals); Reel (through its options) and the water
// entities receive the live runtime config that the composition creates once — CONFIG itself, not the
// caching ConfigProvider, so DEV adapter overrides stay live — and read its adapter on every call through
// accessors reproducing the getters' expressions (same allocation sites per call). GameApplication keeps the
// raw config it wraps and passes it on; FightSessionFactory and CastService forward it. Net's getter
// fallback is dropped: both production constructions pass a distance config object.
module.exports = Object.freeze({
  sequence: 20,
  slug: "tackle-runtime-config-provider",
  afterBatch: "038",
  backlogTaskId: "stage-3.22.prerequisite.entities-world-rules-decomposition",
  intent: "Entities decomposition 3: tackle.js drops its six raw-CONFIG global getters (recorded removals); Reel and the water entities read the live runtime config (CONFIG) that composition injects once and reads per call (DEV overrides stay live), through accessors with the getters' exact expressions; identical per-frame behaviour and allocation sites.",
  sourceEdits: Object.freeze([
    edit(TACKLE, [
      [GETTERS, ""],
      ["      getGlobalReelConfig().bearingRetrieveSpeedBonusMetersPerSec,",
        "      // The composition passes the live runtime config object.\r\n" +
          "      (options.runtimeConfig?.fightPhysicsConfig?.getReelConfig?.() || {}).bearingRetrieveSpeedBonusMetersPerSec,"],
      ["      physicsConfig ||\n      getGlobalRuntimePhysicsConfig() ||\n      {};\n", "      physicsConfig ||\n      {};\n"],
      ["  _environmentalCompensationModifier;\n  _devFlags;\n", "  _environmentalCompensationModifier;\n  _devFlags;\n  _runtimeConfig;\n"],
      ["    devFlags = null,\n  ) {\n", "    devFlags = null,\n    runtimeConfig = null,\n  ) {\n"],
      ["    this._devFlags = devFlags || null;", "    this._devFlags = devFlags || null;\n    this._runtimeConfig = runtimeConfig || null;"],
      ["  _getClampedDtSec(dt) {\n    const maxDtMs = getGlobalFightPhysicsConfig()?.getMaxDtMs?.() ?? 50;\n",
        `${ACCESSORS}  _getClampedDtSec(dt) {\n    const maxDtMs = this._fightPhysicsConfig()?.getMaxDtMs?.() ?? 50;\n`],
      ["getGlobalPassiveRetrieveConfig()", "this._passiveRetrieveConfig()"],
      ["getGlobalFloatMotionConfig()", "this._floatMotionConfig()", 5],
      ["getGlobalLureRetrieveConfig()", "this._lureRetrieveConfig()", 5],
      ["CONFIG.float.biteSequence", "this._runtimeConfig.float.biteSequence"],
      ["rng = null, debugEvents = null, devFlags = null) {", "rng = null, debugEvents = null, devFlags = null, runtimeConfig = null) {"],
      entityCall("SpinnerEntity"),
      entityCall("WobblerEntity"),
      entityCall("FeederEntity"),
      entityCall("FloatEntity"),
      ["          devFlags,\n        );\n", "          devFlags,\n          runtimeConfig,\n        );\n"],
    ]),
    edit(FISHING, [
      ["  #castReadinessEvaluator;\n  #devFlags;\n", "  #castReadinessEvaluator;\n  #devFlags;\n  #runtimeConfig;\n"],
      ["    castReadinessEvaluator = null,\n    devFlags = null,\n  }) {\n",
        "    castReadinessEvaluator = null,\n    devFlags = null,\n    runtimeConfig = null,\n  }) {\n"],
      ["    this.#devFlags = devFlags;\n    this.#castReadinessEvaluator =\n",
        "    this.#devFlags = devFlags;\n    this.#runtimeConfig = runtimeConfig;\n    this.#castReadinessEvaluator =\n"],
      ["      this.#debugEvents,\n      this.#devFlags,\n    );\n",
        "      this.#debugEvents,\n      this.#devFlags,\n      this.#runtimeConfig,\n    );\n"],
      ["  constructor({ config, rng, castDistanceCalculator = null, devFlags = null }) {\n    this.config = config;\n",
        "  // runtimeConfig is the live runtime config (CONFIG) whose adapter DEV overrides replace.\n" +
          "  constructor({ config, rng, castDistanceCalculator = null, devFlags = null, runtimeConfig = null }) {\n" +
          "    this.config = config;\n    this.runtimeConfig = runtimeConfig;\n"],
      ["              reelStats.durabilityMaxLoadLossPerPercent,",
        "              reelStats.durabilityMaxLoadLossPerPercent,\n            runtimeConfig: this.runtimeConfig,", 2],
      ["      : new Reel(0, 0, { lineCapacityMeters: 0 });",
        "      : new Reel(0, 0, { lineCapacityMeters: 0, runtimeConfig: this.runtimeConfig });", 2],
    ]),
    edit(APPLICATION, [
      ["  #rng;\n  #devFlags;\n  #debugEvents;\n  #windowTarget;\n",
        "  #rng;\n  #devFlags;\n  #runtimeConfig;\n  #debugEvents;\n  #windowTarget;\n"],
      ["    this.#config = new ConfigProvider(config);\n",
        "    this.#config = new ConfigProvider(config);\n    // The live runtime config the tackle entities read (DEV adapter overrides stay live).\n" +
          "    this.#runtimeConfig = config;\n"],
      ["      devFlags: this.#devFlags,\n      audio,\n", "      devFlags: this.#devFlags,\n      runtimeConfig: this.#runtimeConfig,\n      audio,\n"],
      ["      this.#debugEvents,\n      this.#devFlags,\n    );\n",
        "      this.#debugEvents,\n      this.#devFlags,\n      this.#runtimeConfig,\n    );\n"],
    ]),
    edit(BOOTSTRAP, [
      ["    devFlags,\n    audio,\n    debugEvents,\n    canvasMetrics,\n    biteEnvData,\n  }) {\n",
        "    devFlags,\n    runtimeConfig,\n    audio,\n    debugEvents,\n    canvasMetrics,\n    biteEnvData,\n  }) {\n"],
      ["      devFlags,\n      castReadinessEvaluator: (equipment) =>\n",
        "      devFlags,\n      runtimeConfig,\n      castReadinessEvaluator: (equipment) =>\n"],
      ["        devFlags,\n        castDistanceCalculator: runtime.castDistanceCalculator,\n      }),\n",
        "        devFlags,\n        runtimeConfig,\n        castDistanceCalculator: runtime.castDistanceCalculator,\n      }),\n"],
    ]),
  ]),
  globalProviderRemovals: Object.freeze(GETTER_NAMES.map(symbol => Object.freeze({ currentPath: TACKLE, symbol,
    mechanism: "global-function",
    reason: "A raw-CONFIG global getter of tackle.js; Reel and the water entities read the injected live runtime config instead." }))),
  // tackle.js no longer reads the raw CONFIG global or constructs the adapter.
  resolvedDebtIds: Object.freeze(["debt-boundary-dependency-fa61692643c8", "debt-boundary-dependency-c2ba4b73478d"]),
  expectedEdges: Object.freeze({
    removed: Object.freeze([
      [TACKLE, "src/config/config.js", "CONFIG"].join("\u0000"),
      [TACKLE, "src/config/physics/physics_config_adapter.js", "FightPhysicsConfigAdapter"].join("\u0000"),
    ]),
    added: Object.freeze([]),
  }),
  // Focused parity. Static (034 hot-loop review): every member of the traced classes keeps its allocation
  // counts; the only new members are the four WaterEntity accessors, whose allocation sites are exactly
  // the removed getters' object fallbacks; no class names CONFIG, a getter or a new free identifier.
  // Runtime: every entity type through cast, pulling/idle frames with varying deltaTime and a bite, and
  // Reel bearing fallbacks, are identical with the old CONFIG reads and the injected live config.
  parity({ read, before, after }) {
    const review = new StageThreeHotLoopSourceReview();
    const counts = allocations => Object.values(allocations || {}).reduce((total, value) => total + value, 0);
    const staticFacts = CLASSES.map(className => {
      const old = review.review({ source: before(TACKLE), currentPath: TACKLE, className });
      const next = review.review({ source: after(TACKLE), currentPath: TACKLE, className });
      const oldMembers = new Map(old.members.map(member => [`${member.kind}\0${member.name}`, member]));
      for (const member of next.members) {
        const previous = oldMembers.get(`${member.kind}\0${member.name}`);
        if (!previous && className === "WaterEntity" && member.kind === "field" && member.name === "_runtimeConfig") continue;
        if (!previous) {
          assert(className === "WaterEntity" && member.name in HELPERS, `unexpected new member ${className}.${member.name}`);
          assert.equal(counts(member.allocations), HELPERS[member.name], `accessor allocation sites: ${member.name}`);
          assert.equal(member.allocations.objectExpressions, HELPERS[member.name], `accessor fallbacks: ${member.name}`);
          continue;
        }
        // Constructors run at construction, not per frame (Reel's gains the inline `|| {}` fallback); the
        // file-wide observer also merges same-named constructors of the file's classes.
        if (member.kind === "constructor") continue;
        assert.equal(counts(member.allocations), counts(previous.allocations),
          `allocation sites changed: ${className}.${member.name}`);
      }
      assert.equal(next.members.length, old.members.length + (className === "WaterEntity" ? 5 : 0),
        `members removed from ${className}`);
      const names = new Set(next.freeIdentifiers.map(item => item.name));
      assert(!names.has("CONFIG") && GETTER_NAMES.every(name => !names.has(name)), `${className} still reads raw config`);
      const oldNames = new Set(old.freeIdentifiers.map(item => item.name));
      assert([...names].every(name => oldNames.has(name)), `${className} gains a free identifier`);
      assert.deepEqual(next.wallClockReads, [], `${className} reads a wall clock`);
      return [className, next.members.map(member => [member.name, member.bodySha256])];
    });
    assert(!/\bgetGlobal[A-Z]\w*\b|\bCONFIG\b/u.test(after(TACKLE)), "tackle.js still names a getter or CONFIG");
    const world = tackle => {
      const context = vm.createContext({ console, window: {} });
      vm.runInContext(read(RUNTIME), context, { filename: RUNTIME });
      for (const [name, module] of Object.entries(MIGRATED)) {
        vm.runInContext(`globalThis.${name} = __CYBER_FISHING_COMPAT_RUNTIME__.modules[${JSON.stringify(module)}].${name};`, context);
      }
      for (const file of [...PHYSICS_FILES, VECTOR2, CONVERTER]) vm.runInContext(read(file), context, { filename: file });
      vm.runInContext(`var CONFIG = { physics: PHYSICS_CONFIG, float: { biteSequence: { chanceGuaranteed: 0.2,
        chanceNormal: 0.8, maxSequences: [1, 3], guaranteedIters: [1, 2], normalIters: [1, 3], sequenceIntervalMs: [30, 60],
        intervalMs: [10, 30] } } };
        Object.defineProperty(CONFIG, "fightPhysicsConfig", { value: new FightPhysicsConfigAdapter(CONFIG), configurable: true });
        var seededRng = () => { let seed = 7; return { next: () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646 }; };`,
      context);
      vm.runInContext(tackle, context, { filename: TACKLE });
      return context;
    };
    const create = injected => `(type) => BaitFactory.create(type, 100, 100, { maxDepth: 4, type, sinkingDurationMs: 900 },
      {}, seededRng(), null, null${injected ? ", CONFIG" : ""})`;
    const oldWorld = world(before(TACKLE));
    const newWorld = world(after(TACKLE));
    const baseline = vm.runInContext(`${SCENARIOS}(${create(false)})`, oldWorld);
    assert.equal(vm.runInContext(`${SCENARIOS}(${create(true)})`, newWorld), baseline, "per-frame entity behaviour changed");
    const reelBaseline = vm.runInContext(`${REEL_SCENARIOS}((options) => options)`, oldWorld);
    assert.equal(vm.runInContext(`${REEL_SCENARIOS}((options) => ({ ...options, runtimeConfig: CONFIG }))`, newWorld),
      reelBaseline, "Reel bearing fallback changed");
    // A live DEV override (the adapter replaced on CONFIG) reaches an existing entity on its next call.
    for (const context of [oldWorld, newWorld]) {
      vm.runInContext(`globalThis.__entity = BaitFactory.create("float", 0, 0, { maxDepth: 3, type: "day" }, {}, seededRng(),
        null, null, CONFIG); globalThis.__before = __entity._getClampedDtSec(500);
        Object.defineProperty(CONFIG, "fightPhysicsConfig", { value: { getMaxDtMs: () => 200 }, configurable: true });
        globalThis.__after = __entity._getClampedDtSec(500);`, context);
    }
    assert.deepEqual([newWorld.__before, newWorld.__after], [oldWorld.__before, oldWorld.__after], "DEV override liveness differs");
    assert.notEqual(newWorld.__before, newWorld.__after, "the DEV override scenario is exercised");
    const facts = `${JSON.stringify(staticFacts)}${baseline}${reelBaseline}`;
    return { cases: JSON.parse(baseline).length + JSON.parse(reelBaseline).length + CLASSES.length,
      factsSha256: crypto.createHash("sha256").update(facts).digest("hex") };
  },
});
