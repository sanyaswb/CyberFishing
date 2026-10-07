const { CheckAssertion } = require("./testing/core/check_assertion");
const { SourceRuntime } = require("./testing/core/source_runtime");

const Assertion = CheckAssertion.create("Line allocation check");

class LineRuntimeLoader {
  load() {
    const runtime = new SourceRuntime();
    this.#loadConstant(
      runtime,
      "src/game/config/raw/physics/tackle_physics.js",
      "TACKLE_PHYSICS_CONFIG",
    );
    this.#loadConstant(
      runtime,
      "src/game/presentation/inventory/equipment_slot_presentation.js",
      "EQUIPMENT_SLOT_PRESENTATION",
    );
    this.#loadConstant(
      runtime,
      "src/game/presentation/inventory/inventory_rule_messages.js",
      "INVENTORY_RULE_MESSAGES",
    );
    this.#loadClass(
      runtime,
      "src/game/domain/line/line_allocation_policy.js",
      "LineAllocationPolicy",
    );
    this.#loadConstant(
      runtime,
      "src/game/config/raw/items/item_stat_overrides.js",
      "ITEM_STAT_OVERRIDE_CONFIG",
    );
    this.#loadClass(
      runtime,
      "src/game/domain/items/item_stat_override_policy.js",
      "ItemStatOverridePolicy",
    );
    this.#loadClass(
      runtime,
      "src/game/domain/items/effective_item_stats_resolver.js",
      "EffectiveItemStatsResolver",
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
    return runtime.context;
  }

  #loadConstant(runtime, relativePath, constantName) {
    runtime.load(relativePath, { expose: [constantName] });
  }

  #loadClass(runtime, relativePath, className) {
    runtime.load(relativePath, { expose: [className] });
  }
}

class LineAllocationScenarioFactory {
  pole({ rodLengthMeters, sourceLineMeters }) {
    return {
      lineItem: { effectiveStats: { lengthMeters: sourceLineMeters } },
      equipment: {
        rod: {
          itemType: "rod",
          variant: "pole",
          effectiveStats: { lengthMeters: rodLengthMeters, hasReel: false },
        },
        reel: null,
      },
    };
  }

  reel({ rodLengthMeters, reelCapacityMeters, sourceLineMeters }) {
    return {
      lineItem: { effectiveStats: { lengthMeters: sourceLineMeters } },
      equipment: {
        rod: {
          itemType: "rod",
          variant: "spinning",
          effectiveStats: { lengthMeters: rodLengthMeters, hasReel: true },
        },
        reel: { itemType: "reel", effectiveStats: { lineCapacityMeters: reelCapacityMeters } },
      },
    };
  }
}

class LineAllocationCheck {
  #runtime;
  #policy;
  #distanceCalculator;
  #scenarios = new LineAllocationScenarioFactory();

  constructor({
    LineAllocationPolicy,
    CastDistanceCalculator,
    TACKLE_PHYSICS_CONFIG,
    ...runtime
  }) {
    this.#runtime = { TACKLE_PHYSICS_CONFIG, ...runtime };
    const lineConfig = TACKLE_PHYSICS_CONFIG.line;
    // Player-facing texts are injected the way composition injects them.
    this.#policy = new LineAllocationPolicy(lineConfig, {
      messages: runtime.INVENTORY_RULE_MESSAGES,
    });
    this.#distanceCalculator = new CastDistanceCalculator({
      pixelsPerMeter: 50,
      line: lineConfig,
    });
  }

  run() {
    this.#checkFiveMeterPoleRod();
    this.#checkThreeMeterReelRod();
    this.#checkUndersizedReel();
  }

  #checkFiveMeterPoleRod() {
    const scenario = this.#scenarios.pole({
      rodLengthMeters: 5,
      sourceLineMeters: 25,
    });
    const result = this.#policy.resolve(scenario);

    Assertion.equal(result.isValid, true, "5m pole rod accepts a sufficient line");
    Assertion.equal(result.minimumLengthMeters, 10, "5m pole rod requires 10m");
    Assertion.equal(result.maximumLengthMeters, 10, "fixed +1m is disabled");
    Assertion.equal(result.equipLengthMeters, 10, "5m pole rod equips exactly 10m");
    Assertion.equal(result.remainingLengthMeters, 15, "15m remains on the source spool");

    const distance = this.#distanceCalculator.describe({
      ...scenario.equipment,
      line: { effectiveStats: { lengthMeters: result.equipLengthMeters } },
    }, 1);
    Assertion.equal(distance.requiredLineMeters, 10, "pole rod base line requirement is 10m");
    Assertion.equal(distance.reserveMeters, 0, "pole rod has no line beyond its 10m reach");
    Assertion.equal(distance.maxDistanceMeters, 10, "pole rod maximum cast distance is 10m");
  }

  #checkThreeMeterReelRod() {
    const scenario = this.#scenarios.reel({
      rodLengthMeters: 3,
      reelCapacityMeters: 10,
      sourceLineMeters: 25,
    });
    const result = this.#policy.resolve(scenario);

    Assertion.equal(result.isValid, true, "3m reel rod accepts a 10m reel");
    Assertion.equal(result.minimumLengthMeters, 6, "3m reel rod requires at least 6m");
    Assertion.equal(result.maximumLengthMeters, 10, "reel capacity limits equipped line");
    Assertion.equal(result.equipLengthMeters, 10, "the full 10m reel capacity is equipped");
    Assertion.equal(result.remainingLengthMeters, 15, "15m remains on the source spool");

    const distance = this.#distanceCalculator.describe({
      ...scenario.equipment,
      line: { effectiveStats: { lengthMeters: result.equipLengthMeters } },
    }, 1);
    Assertion.equal(distance.requiredLineMeters, 6, "3m rod and reserve use 6m");
    Assertion.equal(distance.reserveMeters, 4, "4m remains available on the reel");
    Assertion.equal(distance.maxDistanceMeters, 10, "reel rod maximum cast distance is 10m");
  }

  #checkUndersizedReel() {
    const scenario = this.#scenarios.reel({
      rodLengthMeters: 6,
      reelCapacityMeters: 10,
      sourceLineMeters: 25,
    });
    const result = this.#policy.resolve(scenario);

    Assertion.equal(result.isValid, false, "6m rod rejects a 10m reel");
    Assertion.equal(result.minimumLengthMeters, 12, "6m reel rod requires at least 12m");
    Assertion.equal(result.maximumLengthMeters, 10, "rejected reel capacity is reported");
    Assertion.that(result.reason.includes("12"), "rejection explains the 12m minimum");
  }
}

const runtime = new LineRuntimeLoader().load();
new LineAllocationCheck(runtime).run();
console.log("Line allocation check passed.");
