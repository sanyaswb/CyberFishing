const { CheckAssertion } = require("./testing/core/check_assertion");
const { SourceRuntime } = require("./testing/core/source_runtime");

const Assertion = CheckAssertion.create("Line allocation check");

class LineRuntimeLoader {
  load() {
    const runtime = new SourceRuntime();
    this.#loadConstant(
      runtime,
      "src/config/physics/tackle_physics_config.js",
      "TACKLE_PHYSICS_CONFIG",
    );
    this.#loadClass(
      runtime,
      "src/core/line/line_allocation_policy.js",
      "LineAllocationPolicy",
    );
    this.#loadConstant(
      runtime,
      "src/config/items/item_stat_override_config.js",
      "ITEM_STAT_OVERRIDE_CONFIG",
    );
    this.#loadClass(
      runtime,
      "src/core/items/item_stat_override_policy.js",
      "ItemStatOverridePolicy",
    );
    this.#loadClass(
      runtime,
      "src/core/items/effective_item_stats_resolver.js",
      "EffectiveItemStatsResolver",
    );
    this.#loadClass(
      runtime,
      "src/core/casting_distance.js",
      "CastDistanceCalculator",
    );
    this.#loadClass(
      runtime,
      "src/core/line/line_inventory_controller.js",
      "LineInventoryController",
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
    this.#policy = new LineAllocationPolicy(lineConfig);
    this.#distanceCalculator = new CastDistanceCalculator({
      pixelsPerMeter: 50,
      line: lineConfig,
    });
  }

  run() {
    this.#checkFiveMeterPoleRod();
    this.#checkThreeMeterReelRod();
    this.#checkUndersizedReel();
    this.#checkSplitInheritance();
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

  #checkSplitInheritance() {
    const source = {
      instanceId: "source-line",
      itemId: "line_test",
      quantity: 1,
      statOverrides: { lengthMeters: 25, quality: 8 },
      rarity: { tier: 3, isUnique: false },
      rolledStats: { coating: 0.4 },
    };
    const items = new Map([[source.instanceId, source]]);
    const inventory = {
      getInstance: (instanceId) => items.get(instanceId) || null,
      addItem: (item) => items.set(item.instanceId, item),
      getAll: () => Array.from(items.values()),
      remove: (instanceId) => items.delete(instanceId),
    };
    const controller = new this.#runtime.LineInventoryController({
      inventory,
      db: {
        getItemData: () => ({
          id: "line_test",
          itemType: "fishing_line",
          gameplayStats: {
            lengthMeters: 25,
            diameterMm: 0.2,
            maxLoadKg: 1,
            quality: 5,
          },
        }),
      },
      makeId: () => "split-line",
      lineConfig: this.#runtime.TACKLE_PHYSICS_CONFIG.line,
      isEquipped: () => false,
    });
    const segmentId = controller.prepareLineForEquip({
      slotPath: "line",
      instanceId: source.instanceId,
      itemData: {
        itemType: "fishing_line",
        effectiveStats: { lengthMeters: 25 },
      },
      equipment: {
        rod: {
          itemType: "rod",
          variant: "pole",
          effectiveStats: { lengthMeters: 5, hasReel: false },
        },
        reel: null,
      },
    });
    const segment = items.get(segmentId);
    Assertion.equal(segment.statOverrides.lengthMeters, 10, "split segment receives allocated length");
    Assertion.equal(source.statOverrides.lengthMeters, 15, "source line keeps remaining length");
    Assertion.equal(segment.statOverrides.quality, 8, "split segment inherits runtime quality");
    Assertion.equal(
      JSON.stringify(segment.rarity),
      JSON.stringify(source.rarity),
      "split segment inherits rarity",
    );
    Assertion.equal(
      JSON.stringify(segment.rolledStats),
      JSON.stringify(source.rolledStats),
      "split segment inherits rolled stats",
    );
  }
}

const runtime = new LineRuntimeLoader().load();
new LineAllocationCheck(runtime).run();
console.log("Line allocation check passed.");
