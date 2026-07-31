const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");

class Assertion {
  static that(condition, message) {
    if (!condition) throw new Error(`Line allocation check failed: ${message}`);
  }

  static equal(actual, expected, message) {
    this.that(
      Object.is(actual, expected),
      `${message}; expected ${expected}, received ${actual}`,
    );
  }
}

class LineRuntimeLoader {
  load() {
    const context = vm.createContext({ console });
    this.#loadConstant(
      context,
      "src/config/physics/tackle_physics_config.js",
      "TACKLE_PHYSICS_CONFIG",
    );
    this.#loadClass(
      context,
      "src/core/line/line_allocation_policy.js",
      "LineAllocationPolicy",
    );
    this.#loadClass(
      context,
      "src/core/casting_distance.js",
      "CastDistanceCalculator",
    );
    return context;
  }

  #loadConstant(context, relativePath, constantName) {
    const source = fs.readFileSync(path.join(ROOT, relativePath), "utf8");
    vm.runInContext(
      `${source}\nglobalThis.${constantName} = ${constantName};`,
      context,
      { filename: relativePath },
    );
  }

  #loadClass(context, relativePath, className) {
    const source = fs.readFileSync(path.join(ROOT, relativePath), "utf8");
    vm.runInContext(
      `${source}\nglobalThis.${className} = ${className};`,
      context,
      { filename: relativePath },
    );
  }
}

class LineAllocationScenarioFactory {
  pole({ rodLengthMeters, sourceLineMeters }) {
    return {
      lineItem: { lengthMeters: sourceLineMeters },
      equipment: {
        rod: {
          type: "pole",
          engineStats: { lengthMeters: rodLengthMeters, hasReel: false },
        },
        reel: null,
      },
    };
  }

  reel({ rodLengthMeters, reelCapacityMeters, sourceLineMeters }) {
    return {
      lineItem: { lengthMeters: sourceLineMeters },
      equipment: {
        rod: {
          type: "spinning",
          engineStats: { lengthMeters: rodLengthMeters, hasReel: true },
        },
        reel: { engineStats: { lineCapacityMeters: reelCapacityMeters } },
      },
    };
  }
}

class LineAllocationCheck {
  #policy;
  #distanceCalculator;
  #scenarios = new LineAllocationScenarioFactory();

  constructor({
    LineAllocationPolicy,
    CastDistanceCalculator,
    TACKLE_PHYSICS_CONFIG,
  }) {
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
      line: { lengthMeters: result.equipLengthMeters },
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
      line: { lengthMeters: result.equipLengthMeters },
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
