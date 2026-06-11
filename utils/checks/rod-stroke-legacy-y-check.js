const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..", "..");
const FILES = [
  "src/core/fishing/rod_pull_state.js",
  "src/core/fishing/rod_stroke_state.js",
  "src/core/fishing/rod_stroke_tracker.js",
  "src/core/fishing/rod_pull_calculator.js",
  "src/systems/rod_pull_system.js",
];

const context = vm.createContext({
  console,
  Math,
  Number,
  Object,
  window: {},
});

for (const file of FILES) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), context, {
    filename: file,
  });
}

vm.runInContext(`
const checks = [];
function assert(condition, message) {
  if (!condition) throw new Error(message);
  checks.push(message);
}
function approx(value, expected, tolerance, message) {
  assert(
    Math.abs(value - expected) <= tolerance,
    message + " (" + value + ")",
  );
}

const tracker = new RodStrokeTracker();
let frame = tracker.calculate({
  previousFishY: 100,
  currentFishY: 115,
  pixelsPerMeter: 50,
  towardPlayerYSign: 1,
});
approx(
  frame.yTowardMeters,
  0.3,
  0.001,
  "legacy Y tracker reports toward-player gain",
);
approx(
  frame.yAwayMeters,
  0,
  0.001,
  "legacy Y tracker ignores away loss during gain",
);

frame = tracker.calculate({
  previousFishY: 115,
  currentFishY: 102.5,
  pixelsPerMeter: 50,
  towardPlayerYSign: 1,
});
approx(
  frame.yTowardMeters,
  0,
  0.001,
  "legacy Y tracker reports no gain during escape",
);
approx(
  frame.yAwayMeters,
  0.25,
  0.001,
  "legacy Y tracker reports escape loss",
);

const system = new RodPullSystem({
  capacityByRodLengthRatio: 0.5,
  distanceMultiplierByRodLength: 0.5,
});
const rod = {
  lengthMeters: 3.6,
  engineStats: {
    maxLoadKg: 3,
    holdTensionRatio: 0.5,
  },
};

system.update({
  dtSec: 0,
  inputState: {
    pullHeld: true,
    pullStartedThisFrame: true,
  },
  rod,
  fishTensionKg: 0,
  rodLimitKg: 3,
  lineHasReserve: true,
  fishDistanceMeters: 10,
});
system.recordYMovement({ gainedMeters: 1.8 });

const released = system.update({
  dtSec: 1 / 30,
  inputState: {
    pullHeld: false,
    pullReleasedThisFrame: true,
  },
  rod,
  fishTensionKg: 0,
  rodLimitKg: 3,
  lineHasReserve: false,
  fishDistanceMeters: 10,
  yLostBeforePullMeters: 1.8,
});

approx(
  released.strokeYLostMeters,
  1.8,
  0.001,
  "legacy strokeYLostMeters alias follows distance loss",
);
approx(
  released.rodStrokeWonMeters,
  0,
  0.001,
  "legacy Y loss still clears compatibility stroke credit",
);

console.log("rod-stroke-legacy-y-check passed:");
for (const check of checks) console.log("- " + check);
`, context, {
  filename: "utils/checks/rod-stroke-legacy-y-check.js.vm",
});
