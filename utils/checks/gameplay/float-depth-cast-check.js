const { CheckAssertion } = require("../../testing/core/check_assertion");
const { SourceRuntime } = require("../../testing/core/source_runtime");

const Assertion = CheckAssertion.create("Float depth check");

class RuntimeLoader {
  load() {
    const runtime = new SourceRuntime();
    this.#loadClass(
      runtime,
      "src/game/domain/fishing/float_tackle_line_budget_policy.js",
      "FloatTackleLineBudgetPolicy",
    );
    this.#loadClass(
      runtime,
      "src/game/domain/casting/distance_unit_converter.js",
      "DistanceUnitConverter",
    );
    this.#loadClass(
      runtime,
      "src/game/domain/casting/cast_distance_calculator.js",
      "CastDistanceCalculator",
    );
    this.#loadClass(
      runtime,
      "src/game/domain/fishing/rod_stroke_capacity_resolver.js",
      "RodStrokeCapacityResolver",
    );
    this.#loadRules(runtime);
    runtime.load("src/game/config/raw/items/item_database.js", { expose: ["ITEM_DB"] });
    return runtime.context;
  }

  #loadClass(runtime, relativePath, className) {
    runtime.load(relativePath, { expose: [className] });
  }

  #loadRules(runtime) {
    runtime.load("src/game/domain/rules/equipment_rules.js", { expose: ["EquipmentRules"] });
  }
}

class EquipmentFactory {
  floatRig({ rodLengthMeters, lineLengthMeters, hasReel, floatMount = null }) {
    return {
      rod: {
        itemType: "rod",
        variant: hasReel ? "float" : "pole",
        effectiveStats: {
          lengthMeters: rodLengthMeters,
          hasReel,
          castPowerCoefficient: 1,
        },
      },
      reel: hasReel
        ? { itemType: "reel", effectiveStats: { lineCapacityMeters: lineLengthMeters } }
        : null,
      line: { itemType: "fishing_line", effectiveStats: { lengthMeters: lineLengthMeters } },
      float: { itemType: "float", variant: "day", effectiveStats: floatMount ? { mount: floatMount } : {} },
      baits: [],
    };
  }

  feeder({ lineLengthMeters }) {
    return {
      rod: {
        itemType: "rod",
        variant: "feeder",
        effectiveStats: {
          lengthMeters: 3,
          hasReel: true,
          castPowerCoefficient: 1,
        },
      },
      reel: { itemType: "reel", effectiveStats: { lineCapacityMeters: lineLengthMeters } },
      line: { itemType: "fishing_line", effectiveStats: { lengthMeters: lineLengthMeters } },
      float: null,
      feederRig: { itemType: "feeder_rig", effectiveStats: { maxDepth: 10 } },
      baits: [],
    };
  }

  spinning({ lineLengthMeters }) {
    return {
      rod: {
        itemType: "rod",
        variant: "spinning",
        effectiveStats: {
          lengthMeters: 2.4,
          hasReel: true,
          castPowerCoefficient: 1,
        },
      },
      reel: { itemType: "reel", effectiveStats: { lineCapacityMeters: lineLengthMeters } },
      line: { itemType: "fishing_line", effectiveStats: { lengthMeters: lineLengthMeters } },
      float: null,
      baits: [{ itemType: "lure", variant: "jig", effectiveStats: { maxDepth: 6.5 } }],
    };
  }
}

class FloatDepthCastCheck {
  #calculator;
  #rules;
  #strokeResolver;
  #equipment = new EquipmentFactory();
  #catalog;

  constructor(runtime) {
    this.#catalog = runtime.ITEM_DB;
    const config = {
      pixelsPerMeter: 50,
      casting: {
        floatDepth: {
          minimumDepthMeters: 0.1,
          surfaceDepthToleranceMeters: 0.001,
        },
      },
    };
    this.#calculator = new runtime.CastDistanceCalculator(config);
    this.#rules = new runtime.EquipmentRules(this.#calculator, config);
    this.#strokeResolver = new runtime.RodStrokeCapacityResolver({
      capacityByLineLengthRatio: 1,
      capacityByRodLengthRatio: 1,
    });
  }

  run() {
    this.#checkPoleRig();
    this.#checkReelFloatRig();
    this.#checkFloatTrigger();
    this.#checkSlidingFloat();
    this.#checkFloatCatalog();
    this.#checkFeederIsUnchanged();
    this.#checkSpinningIsUnchanged();
  }

  #checkPoleRig() {
    const equipment = this.#equipment.floatRig({
      rodLengthMeters: 5,
      lineLengthMeters: 10,
      hasReel: false,
    });

    Assertion.close(
      this.#rules.getMaxHookDepth(equipment, {}),
      5,
      "10m line on a 5m pole exposes 5m maximum depth",
    );
    Assertion.close(
      this.#calculator.getMaxCastDistanceMeters(equipment, 0, {
        selectedDepthMeters: 0.1,
      }),
      10,
      "surface depth preserves the full 10m cast",
    );
    Assertion.close(
      this.#calculator.getMaxCastDistanceMeters(equipment, 0, {
        selectedDepthMeters: 3,
      }),
      7,
      "3m depth leaves 7m pole cast distance",
    );
    Assertion.close(
      this.#calculator.getMaxCastDistanceMeters(equipment, 0, {
        selectedDepthMeters: 5,
      }),
      5,
      "maximum pole depth leaves one rod length of cast distance",
    );
    Assertion.close(
      this.#strokeResolver.resolve({
        rodLengthMeters: 5,
        lineLengthMeters: 7,
        hasReel: false,
      }),
      7,
      "pole stroke follows the active depth-adjusted line",
    );
  }

  #checkReelFloatRig() {
    const equipment = this.#equipment.floatRig({
      rodLengthMeters: 3,
      lineLengthMeters: 10,
      hasReel: true,
    });

    Assertion.close(
      this.#rules.getMaxHookDepth(equipment, {}),
      7,
      "10m line on a 3m reel rod exposes 7m maximum depth",
    );
    Assertion.close(
      this.#calculator.getMaxCastDistanceMeters(equipment, 0, {
        selectedDepthMeters: 3,
      }),
      7,
      "3m depth leaves 7m cast distance on a reel float rod",
    );
    Assertion.close(
      this.#strokeResolver.resolve({
        rodLengthMeters: 3,
        lineLengthMeters: 7,
        hasReel: true,
      }),
      3,
      "reel rod stroke remains tied to rod length",
    );
  }

  #checkFloatTrigger() {
    const equipment = this.#equipment.floatRig({
      rodLengthMeters: 5,
      lineLengthMeters: 10,
      hasReel: false,
    });
    Assertion.that(
      this.#rules.canSelectDepth(equipment),
      "equipped float enables the depth selector",
    );

    equipment.float = null;
    Assertion.that(
      !this.#rules.canSelectDepth(equipment),
      "missing float disables the float depth selector",
    );
  }

  // A sliding float sets the depth without taking line from the cast; the depth limit stays line minus rod.
  #checkSlidingFloat() {
    const fixedPole = this.#equipment.floatRig({
      rodLengthMeters: 5, lineLengthMeters: 10, hasReel: false, floatMount: "fixed",
    });
    Assertion.close(
      this.#calculator.getMaxCastDistanceMeters(fixedPole, 0, { selectedDepthMeters: 3 }),
      7,
      "an explicitly fixed float keeps the depth line cost",
    );

    const pole = this.#equipment.floatRig({
      rodLengthMeters: 5, lineLengthMeters: 10, hasReel: false, floatMount: "sliding",
    });
    Assertion.close(
      this.#rules.getMaxHookDepth(pole, {}),
      5,
      "a sliding float on a 5m pole keeps the 5m maximum depth",
    );
    for (const depth of [0.1, 3, 5]) {
      Assertion.close(
        this.#calculator.getMaxCastDistanceMeters(pole, 0, { selectedDepthMeters: depth }),
        10,
        `a sliding float keeps the full 10m pole cast at ${depth}m depth`,
      );
    }
    const budget = this.#calculator.getFloatLineBudget(pole, 5);
    Assertion.that(
      budget.applies && budget.depthLineCostMeters === 0 && budget.selectedDepthMeters === 5,
      "a sliding float budget still limits depth but costs no line",
    );

    const reelRod = this.#equipment.floatRig({
      rodLengthMeters: 3, lineLengthMeters: 10, hasReel: true, floatMount: "sliding",
    });
    Assertion.close(
      this.#calculator.getMaxCastDistanceMeters(reelRod, 0, { selectedDepthMeters: 7 }),
      10,
      "a sliding float keeps the full cast on a reel float rod at maximum depth",
    );
  }

  #checkFloatCatalog() {
    const floats = this.#catalog.floats;
    Assertion.that(
      floats.float_day.gameplayStats.mount === "fixed",
      "the day float is a fixed float",
    );
    const sliding = floats.float_sliding;
    Assertion.that(
      sliding?.itemType === "float" && sliding.gameplayStats.mount === "sliding",
      "the catalog has a sliding float",
    );
  }

  #checkFeederIsUnchanged() {
    const equipment = this.#equipment.feeder({ lineLengthMeters: 10 });
    Assertion.that(
      !this.#rules.canSelectDepth(equipment),
      "feeder does not expose the depth selector",
    );
    Assertion.close(
      this.#calculator.getMaxCastDistanceMeters(equipment, 0, {
        selectedDepthMeters: 5,
      }),
      10,
      "feeder cast distance is not reduced by depth",
    );
  }

  #checkSpinningIsUnchanged() {
    const equipment = this.#equipment.spinning({ lineLengthMeters: 10 });
    Assertion.that(
      this.#rules.canSelectDepth(equipment),
      "jig keeps its existing depth selector",
    );
    Assertion.close(
      this.#calculator.getMaxCastDistanceMeters(equipment, 0, {
        selectedDepthMeters: 3,
      }),
      10,
      "spinning cast distance is not reduced by jig depth",
    );
  }
}

const runtime = new RuntimeLoader().load();
new FloatDepthCastCheck(runtime).run();

// TK-192 / TK-192.1 on the starting float rig (rod_test_float 5 m without a reel, line_test_1 25 m, float_day fixed):
// before the player sets a depth it is half the tackle's deepest depth (20 m -> 10 m); a chosen depth is kept, the
// shallowest 0.1 m too (TK-192 marked "not chosen" with 0.1, so a chosen 0.1 m became 10 m and the cast 25 -> 15 m);
// a tackle change re-applies the default only while nothing was chosen; a clamp to a lower maximum is not a choice.
{
  const assert = require("node:assert/strict");
  const scoutRuntime = new SourceRuntime();
  const load = (file) => scoutRuntime.importModule(file);
  const { ScoutingState } = load("src/game/application/state/scouting_state.js");
  const { CastDistanceCalculator } = load("src/game/domain/casting/cast_distance_calculator.js");
  const { EquipmentRules } = load("src/game/domain/rules/equipment_rules.js");
  const { CONFIG } = load("src/game/config/runtime/game_config.js");
  const { ITEM_DB } = load("src/game/config/raw/items/item_database.js");
  const item = (id) => {
    const source = Object.values(ITEM_DB).find((group) => group?.[id])[id];
    return { id, itemType: source.itemType, variant: source.variant, effectiveStats: { ...source.gameplayStats } };
  };
  let equipment = { rod: item("rod_test_float"), line: item("line_test_1"), float: item("float_day"), reel: null };
  const rules = new EquipmentRules(new CastDistanceCalculator(CONFIG), CONFIG, {});
  // The depth owner as GameApplication composes it.
  let depth = 1, chosen = false;
  const depthRef = { get: () => depth, set: (value) => { depth = value; }, choose: (value) => { depth = value; chosen = true; },
    isChosen: () => chosen, clearChoice: () => { chosen = false; } };
  let report = null, shown = null;
  const depthUI = { isActive: false, isOpen: false, show(max, current, onChange) { this.isActive = true; report = onChange; shown = current; },
    updateMax() {}, setValue(value) { shown = value; }, setIcon() {}, hide() { this.isActive = false; } };
  const scouting = new ScoutingState({ config: CONFIG, projector: { focusOnVirtualPos() {} }, rng: {},
    world: { getWaterMetric: () => ({ topBasePixels: 1e9 }) }, getViewportSize: () => ({ width: 1000, height: 1000 }),
    commands: { panViewport() {} }, ui: { setScoutingPointerDimmed() {} }, isAimingChum: () => false, canPlayerCast: () => true,
    inventory: { getEquipped: () => equipment }, rules: { equipment: rules }, depthUI, currentHookDepthRef: depthRef,
    getMaxHookDepth: () => rules.getFloatLineBudget(equipment, null).maxDepthMeters });
  const frame = () => scouting.update(16, { bottom: 1000 }, { input: {} });
  const castMeters = () => rules.getCastDistanceInfo(equipment, null, depth).effectiveDistanceMeters;
  frame();
  assert.deepEqual([depth, shown, chosen], [10, 10, false], "before a choice: half of the tackle's 20 m");
  report(0.2); frame();
  assert.deepEqual([depth, chosen], [0.2, true], "a chosen 0.2 m stays");
  assert.equal(castMeters(), 24.8, "the fixed float costs its depth: 25 - 0.2 m");
  report(0.1); frame(); frame();
  assert.equal(depth, 0.1, "a chosen 0.1 m (the shallowest) stays 0.1 m");
  assert.equal(castMeters(), 25, "and casts the whole 25 m line (surface depth costs nothing)");
  report(3, { byPlayer: false });
  assert.equal(chosen, true, "a clamp is not a new choice");
  equipment = { ...equipment, line: { ...equipment.line, effectiveStats: { ...equipment.line.effectiveStats, lengthMeters: 6 } } };
  frame();
  assert.equal(depth, 1, "a chosen depth beyond a shorter tackle's range is clamped to it (6 - 5 m)");
  chosen = false; frame();
  assert.equal(depth, 0.5, "an unchosen depth follows the current tackle's default (half of 1 m)");
}
console.log("Float depth cast check passed.");
