const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const FILES = ["src/core/fishing/rod_stroke_distance_tracker.js"];

const checks = [];
function assert(condition, message) {
  if (!condition) throw new Error(message);
  checks.push(message);
}

function approx(actual, expected, epsilon, message) {
  if (Math.abs(Number(actual) - expected) > epsilon) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
  checks.push(`${message} (${Number(actual).toFixed(4)})`);
}

const context = vm.createContext({ console, Math, Number, Object, assert, approx });
for (const file of FILES) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), context, {
    filename: file,
  });
}

vm.runInContext(`
const tracker = new RodStrokeDistanceTracker();

let frame = tracker.calculate({
  previousDistanceMeters: 10,
  currentDistanceMeters: 9.5,
});
approx(frame.gainedMeters, 0.5, 0.000001, "Distance gain increases rod stroke");
approx(frame.lostMeters, 0, 0.000001, "Distance gain does not lose rod stroke");
assert(frame.reason === "line_distance_distance_gained", "Distance gain reason is reported");

frame = tracker.calculate({
  previousDistanceMeters: 9.5,
  currentDistanceMeters: 10,
});
approx(frame.gainedMeters, 0, 0.000001, "Distance loss does not gain rod stroke");
approx(frame.lostMeters, 0.5, 0.000001, "Distance loss decreases rod stroke");
assert(frame.reason === "line_distance_distance_lost", "Distance loss reason is reported");

frame = tracker.calculate({
  previousDistanceMeters: 10,
  currentDistanceMeters: 10,
});
approx(frame.gainedMeters, 0, 0.000001, "Arc movement does not gain rod stroke");
approx(frame.lostMeters, 0, 0.000001, "Arc movement does not lose rod stroke");
assert(frame.reason === "line_distance_stable_distance", "Stable distance reason is reported");

frame = tracker.calculateFromPositions({
  previousFishPosition: { x: 300, y: 400 },
  currentFishPosition: { x: 150, y: 400 },
  rodTipPosition: { x: 0, y: 0 },
  pixelsPerMeter: 50,
});
const previousMeters = Math.hypot(300, 400) / 50;
const currentMeters = Math.hypot(150, 400) / 50;
approx(frame.previousDistanceMeters, previousMeters, 0.000001, "Position tracker records previous line distance");
approx(frame.currentDistanceMeters, currentMeters, 0.000001, "Position tracker records current line distance");
approx(frame.gainedMeters, previousMeters - currentMeters, 0.000001, "X-only movement that reduces line distance gains stroke");

frame = tracker.calculate({
  previousDistanceMeters: 2,
  currentDistanceMeters: 2.0000001,
  epsilonMeters: 0.001,
});
approx(frame.gainedMeters, 0, 0.000001, "Epsilon suppresses tiny gain/loss jitter");
approx(frame.lostMeters, 0, 0.000001, "Epsilon suppresses tiny loss jitter");
`, context, { filename: "utils/rod-stroke-distance-check.js#scenario" });

console.log("rod-stroke-distance-check passed:");
for (const message of checks) console.log("- " + message);
