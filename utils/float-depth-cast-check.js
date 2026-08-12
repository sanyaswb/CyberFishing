const { CheckAssertion } = require("./testing/core/check_assertion");
const { SourceRuntime } = require("./testing/core/source_runtime");

const Assertion = CheckAssertion.create("Float depth check");

class RuntimeLoader {
  load() {
    const runtime = new SourceRuntime();
    this.#loadClass(
      runtime,
      "src/core/float_tackle_line_budget_policy.js",
      "FloatTackleLineBudgetPolicy",
    );
    this.#loadClass(
      runtime,
      "src/core/casting_distance.js",
      "CastDistanceCalculator",
    );
    this.#loadClass(
      runtime,
      "src/core/fishing/rod_stroke_capacity_resolver.js",
      "RodStrokeCapacityResolver",
    );
    this.#loadRules(runtime);
    return runtime.context;
  }

  #loadClass(runtime, relativePath, className) {
    runtime.load(relativePath, { expose: [className] });
  }

  #loadRules(runtime) {
    runtime.load("src/app/rules.js", { expose: ["EquipmentRules"] });
  }
}

class EquipmentFactory {
  floatRig({ rodLengthMeters, lineLengthMeters, hasReel }) {
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
      float: { itemType: "float", variant: "day", effectiveStats: {} },
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

  constructor(runtime) {
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
console.log("Float depth cast check passed.");
