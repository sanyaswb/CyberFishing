const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const FILES = [
  "src/core/core.js",
  "src/core/fishing/fish_direction_intent_sampler.js",
  "src/core/fishing/fish_fight_direction_resolver.js",
  "src/core/fishing/endurance/endurance_movement_debuff_calculator.js",
  "src/entities/fish.js",
];

const context = vm.createContext({
  console,
  Math,
  Number,
  Object,
  window: {},
});

for (const file of FILES) {
  vm.runInContext(
    fs.readFileSync(path.join(ROOT, file), "utf8"),
    context,
    { filename: file },
  );
}

vm.runInContext(`
const checks = [];
function assert(condition, message) {
  if (!condition) throw new Error(message);
  checks.push(message);
}
function approx(value, expected, tolerance, message) {
  assert(Math.abs(value - expected) <= tolerance, message + " (" + value + ")");
}

const config = {
  enabled: true,
  curvePower: 1,
  direction: {
    enabled: true,
    exhaustedRadialRange: [-0.5, 0.25],
  },
  behaviorWeights: {
    enabled: true,
    multipliersAtZeroEndurance: {
      dash: 0.35,
      lastDash: 0.25,
      swim: 0.65,
      idle: 1.6,
      rest: 2.0,
    },
  },
};
const baseRadialRange = [-0.3, 1.0];
const calculator = new EnduranceMovementDebuffCalculator();

const staminaPhase = calculator.calculate({
  phase: "stamina",
  currentExhaustion: 0,
  maxEndurance: 100,
  baseRadialRange,
  config,
});
assert(!staminaPhase.active, "phase stamina keeps movement debuff inactive");
approx(staminaPhase.enduranceProgress, 0, 0.000001, "inactive frame reports zero progress");
assert(staminaPhase.radialRangeOverride === null, "inactive frame has no radial override");

const exhaustionFull = calculator.calculate({
  phase: "exhaustion",
  currentExhaustion: 100,
  maxEndurance: 100,
  baseRadialRange,
  config,
});
assert(exhaustionFull.active, "phase exhaustion activates enabled movement debuff");
approx(exhaustionFull.enduranceProgress, 0, 0.000001, "full endurance gives progress 0");
approx(exhaustionFull.debuffPower, 0, 0.000001, "full endurance gives debuff power 0");
approx(exhaustionFull.radialRangeOverride[0], -0.3, 0.000001, "progress 0 keeps base radial min");
approx(exhaustionFull.radialRangeOverride[1], 1.0, 0.000001, "progress 0 keeps base radial max");
approx(exhaustionFull.behaviorWeightMultipliers.dash, 1.0, 0.000001, "progress 0 keeps dash weight");

const exhaustionZero = calculator.calculate({
  phase: "exhaustion",
  currentExhaustion: 0,
  maxEndurance: 100,
  baseRadialRange,
  config,
});
approx(exhaustionZero.enduranceProgress, 1, 0.000001, "zero endurance gives progress 1");
approx(exhaustionZero.debuffPower, 1, 0.000001, "linear curve gives power 1 at zero endurance");
approx(exhaustionZero.radialRangeOverride[0], -0.5, 0.000001, "zero endurance reaches exhausted radial min");
approx(exhaustionZero.radialRangeOverride[1], 0.25, 0.000001, "zero endurance reaches exhausted radial max");
approx(exhaustionZero.behaviorWeightMultipliers.dash, 0.35, 0.000001, "dash reaches exhausted multiplier");
approx(exhaustionZero.behaviorWeightMultipliers.swim, 0.65, 0.000001, "swim reaches exhausted multiplier");
approx(exhaustionZero.behaviorWeightMultipliers.idle, 1.6, 0.000001, "idle reaches exhausted multiplier");
approx(exhaustionZero.behaviorWeightMultipliers.rest, 2.0, 0.000001, "rest reaches exhausted multiplier");

const exhaustionHalf = calculator.calculate({
  phase: "exhaustion",
  currentExhaustion: 50,
  maxEndurance: 100,
  baseRadialRange,
  config,
});
approx(exhaustionHalf.enduranceProgress, 0.5, 0.000001, "half endurance gives progress 0.5");
approx(exhaustionHalf.radialRangeOverride[0], -0.4, 0.000001, "radial min lerps halfway");
approx(exhaustionHalf.radialRangeOverride[1], 0.625, 0.000001, "radial max lerps halfway");
approx(exhaustionHalf.behaviorWeightMultipliers.dash, 0.675, 0.000001, "dash multiplier lerps halfway");
approx(exhaustionHalf.behaviorWeightMultipliers.swim, 0.825, 0.000001, "swim multiplier lerps halfway");
approx(exhaustionHalf.behaviorWeightMultipliers.idle, 1.3, 0.000001, "idle multiplier lerps halfway");
approx(exhaustionHalf.behaviorWeightMultipliers.rest, 1.5, 0.000001, "rest multiplier lerps halfway");

const curved = calculator.calculate({
  phase: "exhaustion",
  currentExhaustion: 50,
  maxEndurance: 100,
  baseRadialRange,
  config: { ...config, curvePower: 2 },
});
approx(curved.debuffPower, 0.25, 0.000001, "curvePower affects debuff power");

const invalidMax = calculator.calculate({
  phase: "exhaustion",
  currentExhaustion: 0,
  maxEndurance: 0,
  baseRadialRange,
  config,
});
approx(invalidMax.enduranceProgress, 0, 0.000001, "maxEndurance <= 0 gives progress 0");

const directionDisabled = calculator.calculate({
  phase: "exhaustion",
  currentExhaustion: 0,
  maxEndurance: 100,
  baseRadialRange,
  config: { ...config, direction: { ...config.direction, enabled: false } },
});
assert(directionDisabled.radialRangeOverride === null, "direction disabled gives no radial override");

const weightsDisabled = calculator.calculate({
  phase: "exhaustion",
  currentExhaustion: 0,
  maxEndurance: 100,
  baseRadialRange,
  config: {
    ...config,
    behaviorWeights: { ...config.behaviorWeights, enabled: false },
  },
});
assert(
  Object.keys(weightsDisabled.behaviorWeightMultipliers).length === 0,
  "behavior weights disabled gives empty multiplier map",
);

const beforeConfig = JSON.stringify(config);
calculator.calculate({
  phase: "exhaustion",
  currentExhaustion: 25,
  maxEndurance: 100,
  baseRadialRange,
  config,
});
assert(JSON.stringify(config) === beforeConfig, "calculator does not mutate base config");

const behaviorByWeight = new FishBehavior({
  agility: 10,
  dirChangeMinMs: 1000,
  dirChangeMaxMs: 1000,
  behaviors: {
    dash: {
      forceMultiplier: 1,
      speedMultiplier: 1,
      minTime: 1,
      maxTime: 1,
      weight: 1,
    },
    rest: {
      forceMultiplier: 1,
      speedMultiplier: 1,
      minTime: 1,
      maxTime: 1,
      weight: 1,
    },
  },
}, { next: () => 0, range: (min) => min });
behaviorByWeight.update(2, {
  behaviorWeightMultipliers: {
    dash: 0,
    rest: 1,
  },
});
assert(
  behaviorByWeight.getStateData().name === "rest",
  "weighted behavior pick uses runtime effectiveWeight",
);

const behaviorByDirection = new FishBehavior({
  agility: 10,
  dirChangeMinMs: 1,
  dirChangeMaxMs: 1,
  movementProfile: {
    radialRange: [1, 1],
    lateralRange: [0, 0],
  },
  behaviors: {
    swim: {
      forceMultiplier: 1,
      speedMultiplier: 1,
      minTime: 1,
      maxTime: 1,
      weight: 1,
      direction: {
        radialRange: [1, 1],
        lateralRange: [0, 0],
        agility: 10,
      },
    },
  },
}, { next: () => 0, range: (min) => min });
behaviorByDirection.update(1000, {
  radialRangeOverride: [-0.4, -0.4],
  behaviorWeightMultipliers: {},
});
approx(
  behaviorByDirection.getStateData().movementIntent.radial,
  -0.4,
  0.000001,
  "direction sampler uses runtime radialRangeOverride",
);

const stateSpecificStart = new FishBehavior({
  agility: 10,
  dirChangeMinMs: 1,
  dirChangeMaxMs: 1,
  movementProfile: {
    radialRange: [-0.3, 1],
    lateralRange: [0, 0],
  },
  behaviors: {
    dash: {
      forceMultiplier: 1,
      speedMultiplier: 1,
      minTime: 1,
      maxTime: 1,
      weight: 1,
      direction: {
        radialRange: [0.8, 0.8],
        lateralRange: [0, 0],
        agility: 10,
      },
    },
  },
}, { next: () => 0, range: (min) => min });
stateSpecificStart.update(1000, exhaustionFull);
approx(
  stateSpecificStart.getStateData().movementIntent.radial,
  0.8,
  0.000001,
  "progress 0 preserves state-specific radial range",
);

const stateSpecificExhausted = new FishBehavior({
  agility: 10,
  dirChangeMinMs: 1,
  dirChangeMaxMs: 1,
  movementProfile: {
    radialRange: [-0.3, 1],
    lateralRange: [0, 0],
  },
  behaviors: {
    dash: {
      forceMultiplier: 1,
      speedMultiplier: 1,
      minTime: 1,
      maxTime: 1,
      weight: 1,
      direction: {
        radialRange: [0.8, 0.8],
        lateralRange: [0, 0],
        agility: 10,
      },
    },
  },
}, { next: () => 0, range: (min) => min });
stateSpecificExhausted.update(1000, exhaustionZero);
approx(
  stateSpecificExhausted.getStateData().movementIntent.radial,
  -0.5,
  0.000001,
  "progress 1 moves state-specific radial range to exhausted target",
);

console.log("endurance-movement-debuff-check passed:");
for (const check of checks) console.log("- " + check);
`, context);
