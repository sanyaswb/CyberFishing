const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const FILES = [
  "src/core/core.js",
  "src/core/fishing/fish_direction_intent_sampler.js",
  "src/core/fishing/fish_fight_direction_resolver.js",
  "src/core/fishing/drag_force_calculator.js",
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

const resolver = new FishFightDirectionResolver();
const rod = new Vector2(0, 0);
const fish = new Vector2(0, -100);

const outward = resolver.resolve({
  fishPosition: fish,
  rodTipPosition: rod,
  radialIntent: 1,
  lateralIntent: 0,
});
approx(outward.x, 0, 0.000001, "positive radial intent has no lateral drift");
approx(outward.y, -1, 0.000001, "positive radial intent moves away from the rod");

const inward = resolver.resolve({
  fishPosition: fish,
  rodTipPosition: rod,
  radialIntent: -1,
  lateralIntent: 0,
});
approx(inward.y, 1, 0.000001, "negative radial intent can move down toward the rod");

const lateral = resolver.resolve({
  fishPosition: fish,
  rodTipPosition: rod,
  radialIntent: 0,
  lateralIntent: 1,
});
approx(lateral.x, 1, 0.000001, "lateral intent resolves perpendicular to the line");
approx(lateral.y, 0, 0.000001, "pure lateral intent has no radial component");

const drag = new DragForceCalculator();
const common = {
  fishOppositionKg: 1,
  effectiveRodHoldKg: 0,
  awayDir: { x: 0, y: -1 },
  dragRatio: 1,
  dragLimitKg: 2,
  lineHasReserve: true,
  dragLocked: false,
  dragSupported: true,
  waterMotionResistance: 1000,
  waterSpeedMultiplier: 64,
  fishBaseSpeed: 1,
  fishStateSpeedMultiplier: 1,
  pixelsPerMeter: 50,
};

const tangent = drag.calculate({
  ...common,
  lineTaut: true,
  targetVelocity: { x: 70, y: 0 },
});
approx(tangent.finalXSpeedPxPerSec, 70, 0.000001, "taut drag preserves tangent movement");
approx(tangent.finalYSpeedPxPerSec, 0, 0.000001, "tangent movement adds no radial escape");

const inwardDrag = drag.calculate({
  ...common,
  lineTaut: true,
  targetVelocity: { x: 0, y: 60 },
});
approx(inwardDrag.finalYSpeedPxPerSec, 60, 0.000001, "taut drag preserves inward movement");

const slackOutward = drag.calculate({
  ...common,
  lineTaut: false,
  targetVelocity: { x: 0, y: -60 },
});
approx(slackOutward.finalYSpeedPxPerSec, -60, 0.000001, "slack line preserves outward movement");
approx(slackOutward.tautFinalYSpeedPxPerSec, 0, 0.000001, "taut boundary prediction applies drag");

const tautOutward = drag.calculate({
  ...common,
  lineTaut: true,
  targetVelocity: { x: 0, y: -60 },
});
approx(tautOutward.finalYSpeedPxPerSec, 0, 0.000001, "taut holding drag blocks outward movement");

const mixed = drag.calculate({
  ...common,
  lineTaut: true,
  targetVelocity: { x: 45, y: -60 },
});
approx(mixed.finalXSpeedPxPerSec, 45, 0.000001, "drag preserves tangent part of diagonal movement");
approx(mixed.finalYSpeedPxPerSec, 0, 0.000001, "drag blocks only outward part of diagonal movement");

function sampleBehaviorIntent({
  movementProfile = null,
  direction = null,
} = {}) {
  const state = {
    forceMultiplier: 1,
    speedMultiplier: 1,
    agility: 10,
    minTime: 10000,
    maxTime: 10000,
    weight: 1,
  };
  if (direction) state.direction = direction;
  const config = {
    agility: 10,
    dirChangeMinMs: 10000,
    dirChangeMaxMs: 10000,
    behaviors: { swim: state },
  };
  if (movementProfile) config.movementProfile = movementProfile;
  const sampledBehavior = new FishBehavior(
    config,
    { next: () => 0, range: (min) => min },
  );
  sampledBehavior.update(1000);
  return sampledBehavior.getStateData().movementIntent;
}

const stateOverrideIntent = sampleBehaviorIntent({
  movementProfile: {
    radialRange: [-0.3, 1],
    lateralRange: [-1, 1],
  },
  direction: {
    radialRange: [-0.8, -0.8],
    lateralRange: [0.4, 0.4],
  },
});
approx(stateOverrideIntent.radial, -0.8, 0.000001, "state radial range overrides movement profile");
approx(stateOverrideIntent.lateral, 0.4, 0.000001, "state lateral range overrides movement profile");

const movementFallbackIntent = sampleBehaviorIntent({
  movementProfile: {
    radialRange: [-0.3, -0.3],
    lateralRange: [-0.7, -0.7],
  },
});
approx(movementFallbackIntent.radial, -0.3, 0.000001, "missing state radial range uses movement profile");
approx(movementFallbackIntent.lateral, -0.7, 0.000001, "missing state lateral range uses movement profile");

const partialOverrideIntent = sampleBehaviorIntent({
  movementProfile: {
    radialRange: [-0.3, -0.3],
    lateralRange: [-0.6, -0.6],
  },
  direction: {
    radialRange: [0.8, 0.8],
  },
});
approx(partialOverrideIntent.radial, 0.8, 0.000001, "partial state direction overrides radial range");
approx(partialOverrideIntent.lateral, -0.6, 0.000001, "partial state direction inherits lateral range");

const engineFallbackIntent = sampleBehaviorIntent();
approx(engineFallbackIntent.radial, 0.35, 0.000001, "missing fish radial range uses engine fallback");
approx(engineFallbackIntent.lateral, -1, 0.000001, "missing fish lateral range uses engine fallback");
assert(
  Number.isFinite(engineFallbackIntent.radial) &&
    Number.isFinite(engineFallbackIntent.lateral),
  "legacy fish without direction ranges remains valid",
);

const normalizedPartialDirection = FishPhysicsProfile.toRuntimeConfig({
  movementProfile: {
    baseSpeed: 1,
    agility: 1,
    radialRange: [-0.3, 1],
    lateralRange: [-1, 1],
  },
  behaviorProfile: {
    behaviors: {
      dash: {
        forceMultiplier: 1,
        speedMultiplier: 1,
        minTime: 1000,
        maxTime: 1000,
        weight: 1,
        direction: {
          radialRange: [0.75, 1],
        },
      },
    },
  },
});
assert(
  !Object.prototype.hasOwnProperty.call(
    normalizedPartialDirection.behaviors.dash.direction,
    "lateralRange",
  ),
  "profile normalization preserves missing state range for runtime fallback",
);

const behavior = new FishBehavior({
  agility: 1,
  dirChangeMinMs: 10000,
  dirChangeMaxMs: 10000,
  behaviors: {
    rest: {
      forceMultiplier: 0.3,
      speedMultiplier: 1,
      minTime: 10000,
      maxTime: 10000,
      weight: 1,
      direction: {
        radialRange: [-1, -1],
        lateralRange: [0, 0],
        agility: 10,
      },
    },
  },
}, { next: () => 0, range: (min) => min });
behavior.update(1000);
const restIntent = behavior.getStateData().movementIntent;
assert(restIntent.radial < 0, "configured rest behavior emits inward radial intent");
const restDirection = resolver.resolve({
  fishPosition: fish,
  rodTipPosition: rod,
  radialIntent: restIntent.radial,
  lateralIntent: restIntent.lateral,
});
assert(restDirection.y > 0, "inward fish behavior produces downward world movement");

console.log("fish-2d-behavior-check passed:");
for (const check of checks) console.log("- " + check);
`, context);
