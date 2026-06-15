const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const FILES = [
  "src/core/input/fight_input_action_composer.js",
];

const checks = [];
function assert(condition, message) {
  if (!condition) throw new Error(message);
  checks.push(message);
}

function approx(actual, expected, epsilon, message) {
  if (Math.abs(Number(actual) - expected) > epsilon) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
  checks.push(`${message} (${Number(actual).toFixed(3)})`);
}

const context = vm.createContext({ console, Math, Number, Object, window: {}, assert, approx });
for (const file of FILES) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), context, {
    filename: file,
  });
}

vm.runInContext(`
const composer = new FightInputActionComposer();
const config = {
  keys: {
    pull: ["Space"],
    left: ["KeyA", "ArrowLeft"],
    right: ["KeyD", "ArrowRight"],
  },
  rodControlInput: {
    minLockDistancePx: 10,
    fallbackFullPowerPx: 100,
    horizontalDominanceRatio: 1.25,
    directionDeadZonePx: 12,
  },
};

let actions = composer.compose({ pointerDown: true, pointerDelta: { x: 0, y: 0 } }, config);
assert(actions.hold.active, "Pointer down starts Fight Rod Hold immediately");
assert(!actions.lateralControl.active, "Centered pointer hold does not start Rod Control");

const rightSwipe = composer.compose({ pointerDown: true, pointerDelta: { x: 80, y: 4 } }, config);
assert(!rightSwipe.hold.active, "Right pointer Rod Control excludes pointer Rod Hold");
assert(rightSwipe.lateralControl.active, "Right pointer swipe starts Rod Control");
assert(rightSwipe.lateralControl.directionX === 1, "Right pointer swipe resolves right control direction");
approx(rightSwipe.lateralControl.inputRatio, 0.8, 0.001, "Right pointer swipe scales control ratio");

const leftSwipe = composer.compose({ pointerDown: true, pointerDelta: { x: -50, y: 3 } }, config);
assert(!leftSwipe.hold.active, "Left pointer Rod Control excludes pointer Rod Hold");
assert(leftSwipe.lateralControl.active, "Left pointer swipe starts Rod Control");
assert(leftSwipe.lateralControl.directionX === -1, "Left pointer swipe resolves left control direction");

const verticalSwipe = composer.compose({ pointerDown: true, pointerDelta: { x: 15, y: 80 } }, config);
assert(verticalSwipe.hold.active, "Vertical pointer gesture still keeps Fight Rod Hold active");
assert(!verticalSwipe.lateralControl.active, "Vertical pointer gesture does not become lateral Rod Control");

const released = composer.compose({ pointerDown: false, pointerDelta: { x: 80, y: 0 } }, config);
assert(!released.hold.active, "Pointer release stops Fight Rod Hold");
assert(!released.lateralControl.active, "Pointer release stops pointer Rod Control");

const space = composer.compose({ keys: { Space: true } }, config);
assert(space.hold.active, "Space starts Fight Rod Hold");
assert(!space.lateralControl.active, "Space alone does not start Rod Control");

const dOnly = composer.compose({ keys: { KeyD: true } }, config);
assert(!dOnly.hold.active, "D alone does not start Fight Rod Hold");
assert(dOnly.lateralControl.active, "D alone starts right Rod Control");
assert(dOnly.lateralControl.directionX === 1, "D resolves right control direction");

const aOnly = composer.compose({ keys: { KeyA: true } }, config);
assert(!aOnly.hold.active, "A alone does not start Fight Rod Hold");
assert(aOnly.lateralControl.active, "A alone starts left Rod Control");
assert(aOnly.lateralControl.directionX === -1, "A resolves left control direction");

const spaceD = composer.compose({ keys: { Space: true, KeyD: true } }, config);
assert(spaceD.hold.active, "Space + D keeps Fight Rod Hold active");
assert(spaceD.lateralControl.active, "Space + D starts right Rod Control");
assert(spaceD.lateralControl.directionX === 1, "Space + D resolves right control direction");

const pointerControlWithSpace = composer.compose({
  pointerDown: true,
  pointerDelta: { x: 80, y: 4 },
  keys: { Space: true },
}, config);
assert(
  pointerControlWithSpace.hold.active,
  "Explicit Space keeps Rod Hold active during pointer Rod Control",
);

const spaceA = composer.compose({ keys: { Space: true, KeyA: true } }, config);
assert(spaceA.hold.active, "Space + A keeps Fight Rod Hold active");
assert(spaceA.lateralControl.active, "Space + A starts left Rod Control");
assert(spaceA.lateralControl.directionX === -1, "Space + A resolves left control direction");

const legacy = composer.compose({
  pointerDown: true,
  isPulling: false,
  rodControlActive: true,
  rodControlDirectionX: 1,
  rodControlInputRatio: 0.6,
}, config);
assert(legacy.hold.active, "Unclassified pointer down still starts Fight Rod Hold");
assert(legacy.lateralControl.active, "Legacy Rod Control state is preserved for fight control");
approx(legacy.lateralControl.inputRatio, 0.6, 0.001, "Legacy Rod Control ratio is preserved");
`, context, { filename: "utils/fight-input-composition-check.js#scenario" });

console.log("fight-input-composition-check passed:");
for (const message of checks) console.log("- " + message);
