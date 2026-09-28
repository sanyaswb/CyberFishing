"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const vm = require("node:vm");

const RUNTIME = "dist/stage-3-compat-runtime/compat_runtime.iife.js";
const VECTOR2 = "src/core/math/vector2.js";
const GOD_MODE = "src/debug/god_mode.js";
const TACKLE = "src/entities/tackle.js";
const ADAPTERS = "src/app/adapters.js";
const FISHING = "src/app/fishing.js";
const APPLICATION = "src/app/application.js";
const BOOTSTRAP = "src/app/bootstrap.js";
const ENVIRONMENT_MODULE = "src/game/domain/items/quality/environmental_compensation_modifier.js";

const edit = (file, replacements) => Object.freeze({ path: file,
  replacements: Object.freeze(replacements.map(pair => Object.freeze(pair))) });
const entityCall = name => [`return new ${name}(x, y, config, config.maxDepth, rng, debugEvents);`,
  `return new ${name}(x, y, config, config.maxDepth, rng, debugEvents, undefined, devFlags);`];

// Bite scenarios: every GodMode configuration (enabled/disabled, every mode spelling), GodMode loaded or
// not, spinning idle lures and floats. `create` builds the entity the way each world composes it.
const SCENARIOS = `((create) => {
  const facts = [];
  const modes = [undefined, "default", "guaranteed", "normal", "NORMAL", "Guaranteed", "weird", ""];
  for (const enabled of [true, false, undefined]) {
    for (const biteSequenceMode of modes) {
      CONFIG.debug.godMode = { enabled, biteSequenceMode };
      for (const type of ["float", "spinner", "wobbler", "jig", "feeder"]) {
        for (const isPulling of [false, true]) {
          const entity = create(type);
          entity.startBite(isPulling, { chanceGuaranteed: 0.3, chanceNormal: 0.7, maxSequences: [1, 4],
            guaranteedIters: [1, 3], normalIters: [2, 5], sequenceIntervalMs: [100, 200], intervalMs: [50, 80] });
          facts.push([enabled, biteSequenceMode, type, isPulling, entity.constructor.name,
            JSON.parse(JSON.stringify(entity._activeBiteSequence)), entity._targetSequenceCount]);
        }
      }
    }
  }
  return JSON.stringify(facts);
})`;

// Stage 3.22 backlog task stage-3.22.prerequisite.entities-world-rules-decomposition, transition 1 (owner
// decisions 2026-09-29, point A): production no longer reads the GodMode DEV class. The water entities
// receive the DevFlagsProvider (a platform adapter that already reads GodMode under a verified debt), which
// the existing composition passes on (CastService from GameCompositionRoot, GameApplication); a new
// godModeValue(name) exposes the non-boolean biteSequenceMode. Without DEV (GodMode absent) or without an
// injected provider there is no override, exactly as before. No new edges; tackle.js loses its GodMode edges.
module.exports = Object.freeze({
  sequence: 18,
  slug: "tackle-god-mode-hook",
  afterBatch: "038",
  backlogTaskId: "stage-3.22.prerequisite.entities-world-rules-decomposition",
  intent: "Entities decomposition 1: the water entities read the DEV bite-sequence override through the injected DevFlagsProvider (godModeValue) instead of the GodMode DEV class; CastService and GameApplication pass the provider they already hold; identical bites with GodMode enabled, disabled or absent.",
  sourceEdits: Object.freeze([
    edit(TACKLE, [
      ["  _debugEvents;\n  _environmentalCompensationModifier;\n",
        "  _debugEvents;\n  _environmentalCompensationModifier;\n  _devFlags;\n"],
      ["    environmentalCompensationModifier = null,\n  ) {\n",
        "    environmentalCompensationModifier = null,\n    devFlags = null,\n  ) {\n"],
      ["    this._debugEvents = debugEvents || null;", "    this._debugEvents = debugEvents || null;\n    this._devFlags = devFlags || null;"],
      ["  _applyGodModeBiteSequence(seqCfg) {\n    if (typeof GodMode === \"undefined\") return seqCfg;\n" +
        "    const mode = GodMode.biteSequenceMode;\n",
      "  // DEV bite-sequence override through the injected DevFlagsProvider (none without DEV).\n" +
        "  _applyGodModeBiteSequence(seqCfg) {\n    const mode = this._devFlags?.godModeValue?.(\"biteSequenceMode\");\n"],
      ["  static create(type, x, y, config, equipment, rng = null, debugEvents = null) {",
        "  // The environmental compensation modifier keeps its default (undefined).\r\n" +
          "  static create(type, x, y, config, equipment, rng = null, debugEvents = null, devFlags = null) {"],
      entityCall("SpinnerEntity"),
      entityCall("WobblerEntity"),
      entityCall("FeederEntity"),
      entityCall("FloatEntity"),
      ["          rng,\n          debugEvents,\n        );\n",
        "          rng,\n          debugEvents,\n          undefined,\n          devFlags,\n        );\n"],
    ]),
    edit(ADAPTERS, [
      [" * @property {() => boolean} isDebugEnabled\n",
        " * @property {() => boolean} isDebugEnabled\n * @property {(name: string) => unknown} godModeValue\n"],
      ["    return !!(source && source[flag] === true);\n  }\n",
        "    return !!(source && source[flag] === true);\n  }\n\n" +
          "  // A raw GodMode setting for DEV overrides that are not flags (undefined without DEV).\n" +
          "  godModeValue(name) {\n    const source = this.#godModeSource?.();\n    return source ? source[name] : undefined;\n  }\n"],
    ]),
    edit(FISHING, [
      ["  #debugEvents;\n  #castReadinessEvaluator;\n", "  #debugEvents;\n  #castReadinessEvaluator;\n  #devFlags;\n"],
      ["    debugEvents = null,\n    castReadinessEvaluator = null,\n  }) {\n",
        "    debugEvents = null,\n    castReadinessEvaluator = null,\n    devFlags = null,\n  }) {\n"],
      ["    this.#debugEvents = debugEvents;\n    this.#castReadinessEvaluator =\n",
        "    this.#debugEvents = debugEvents;\n    this.#devFlags = devFlags;\n    this.#castReadinessEvaluator =\n"],
      ["      eq,\n      this.#rng,\n      this.#debugEvents,\n    );\n", "      eq,\n      this.#rng,\n      this.#debugEvents,\n" +
        "      this.#devFlags,\n    );\n"],
    ]),
    edit(APPLICATION, [
      ["      eq,\n      this.#rng,\n      this.#debugEvents,\n    );\n", "      eq,\n      this.#rng,\n      this.#debugEvents,\n" +
        "      this.#devFlags,\n    );\n"],
    ]),
    edit(BOOTSTRAP, [
      ["      debugEvents,\n      castReadinessEvaluator: (equipment) =>\n",
        "      debugEvents,\n      devFlags,\n      castReadinessEvaluator: (equipment) =>\n"],
    ]),
  ]),
  manifestUpdates: Object.freeze([
    Object.freeze({ currentPath: TACKLE, removedBlockers: Object.freeze([Object.freeze({ blocker: "dev-production-coupling",
      reason: "tackle.js no longer reads the GodMode DEV class: the DEV bite-sequence override arrives through the injected DevFlagsProvider (platform, existing verified GodMode debt), passed on by the existing composition." })]) }),
  ]),
  resolvedDebtIds: Object.freeze(["debt-boundary-dependency-8715908e957c", "debt-dev-leakage-869e5a2d7744"]),
  expectedEdges: Object.freeze({
    removed: Object.freeze([[TACKLE, GOD_MODE, "GodMode"].join("\u0000")]),
    added: Object.freeze([]),
  }),
  // Focused parity: bite sequences for every GodMode configuration, with GodMode loaded and absent, are
  // identical between the old GodMode read and the injected provider; tackle.js never names GodMode.
  parity({ read, before, after }) {
    const world = (tackle, godMode, withAdapters) => {
      const context = vm.createContext({ console, window: {} });
      vm.runInContext(read(RUNTIME), context, { filename: RUNTIME });
      vm.runInContext(`globalThis.EnvironmentalCompensationModifier = __CYBER_FISHING_COMPAT_RUNTIME__.modules[
        ${JSON.stringify(ENVIRONMENT_MODULE)}].EnvironmentalCompensationModifier;
        var CONFIG = { debug: { godMode: {} }, float: { biteSequence: {} } };`, context);
      vm.runInContext(read(VECTOR2), context, { filename: VECTOR2 });
      if (withAdapters) vm.runInContext(after(ADAPTERS), context, { filename: ADAPTERS });
      if (godMode) vm.runInContext(read(GOD_MODE), context, { filename: GOD_MODE });
      vm.runInContext(tackle, context, { filename: TACKLE });
      return context;
    };
    const rng = "{ next: () => 0.37 }";
    const results = [true, false].map(godMode => {
      const old = vm.runInContext(`${SCENARIOS}((type) => BaitFactory.create(type, 0, 0, { maxDepth: 3, type }, {}, ${rng}, null))`,
        world(before(TACKLE), godMode, false));
      const next = vm.runInContext(`${SCENARIOS}((type) => BaitFactory.create(type, 0, 0, { maxDepth: 3, type }, {}, ${rng}, null,
        new DevFlagsProvider({ config: CONFIG })))`, world(after(TACKLE), godMode, true));
      assert.equal(next, old, `bite sequences changed (GodMode ${godMode ? "loaded" : "absent"})`);
      return old;
    });
    assert.notEqual(results[0], results[1], "the scenarios exercise an active GodMode override");
    assert(!/\bGodMode\b/u.test(after(TACKLE).replace(/_applyGodModeBiteSequence/gu, "")),
      "tackle.js still names the GodMode DEV class");
    const facts = results.join("");
    return { cases: results.reduce((total, text) => total + JSON.parse(text).length, 0),
      factsSha256: crypto.createHash("sha256").update(facts).digest("hex") };
  },
});
