const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const FILES = [
  "src/core/core.js",
  "src/core/fishing/fish_fight_direction_resolver.js",
  "src/core/fishing/drag_force_calculator.js",
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
