const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const FILES = [
  "src/core/core.js",
  "src/config/physics/environment_physics_config.js",
  "src/config/physics/retrieve_physics_config.js",
  "src/config/physics/fight_physics_config.js",
  "src/config/physics/tackle_physics_config.js",
  "src/config/physics/tension_physics_config.js",
  "src/config/physics/physics_config_adapter.js",
  "src/config/physics/physics_config.js",
  "src/config/runtime/config_override_store.js",
  "src/config/runtime/resolved_config_provider.js",
  "src/config/runtime/immutable_config.js",
  "src/config/config.js",
  "src/systems/rod_lateral_control_system.js",
  "src/systems/rod_visual_offset_system.js",
];

class FakeTarget {
  constructor() {
    this.handlers = new Map();
    this.clientWidth = 1000;
    this.width = 1000;
  }

  addEventListener(type, handler) {
    if (!this.handlers.has(type)) this.handlers.set(type, []);
    this.handlers.get(type).push(handler);
  }

  removeEventListener(type, handler) {
    const list = this.handlers.get(type) || [];
    const index = list.indexOf(handler);
    if (index >= 0) list.splice(index, 1);
  }

  dispatch(type, event = {}) {
    const payload = {
      type,
      preventDefault() {},
      ...event,
    };
    for (const handler of this.handlers.get(type) || []) handler(payload);
  }
}

const checks = [];
function assert(condition, message) {
  if (!condition) throw new Error(message);
  checks.push(message);
}

function approx(actual, expected, epsilon, message) {
  if (Math.abs(actual - expected) > epsilon) {
    throw new Error(
      `${message}: expected ${expected}, got ${actual}`,
    );
  }
  checks.push(`${message} (${actual})`);
}

const scheduledTimeouts = new Map();
let nextTimeoutId = 1;
const fakeWindow = new FakeTarget();
const context = vm.createContext({
  console,
  Math,
  Number,
  Date,
  assert,
  approx,
  setTimeout: (handler) => {
    const id = nextTimeoutId++;
    scheduledTimeouts.set(id, handler);
    return id;
  },
  clearTimeout: (id) => scheduledTimeouts.delete(id),
  FakeTarget,
  window: fakeWindow,
  document: {},
});

for (const file of FILES) {
  vm.runInContext(
    fs.readFileSync(path.join(ROOT, file), "utf8"),
    context,
    { filename: file },
  );
}

vm.runInContext(`
CONFIG.input.pullHoldMinMs = 0;

function key(target, type, code, keyValue = code) {
  target.dispatch(type, { code, key: keyValue });
}

const keyboardCanvas = new FakeTarget();
const keyboardInput = new InputManager(keyboardCanvas);
key(window, "keydown", "Space", " ");
key(window, "keydown", "KeyD", "d");
key(window, "keydown", "KeyS", "s");
const keyboardState = keyboardInput.getState();
assert(keyboardState.isPulling, "Space keeps Rod Hold active while D is held");
assert(keyboardState.rodControlActive, "D activates Rod Control while Space is held");
assert(!keyboardState.dragIncrease && !keyboardState.dragDecrease, "Rod Control suppresses drag/friction keys");
keyboardInput.dispose();
key(window, "keyup", "Space", " ");
key(window, "keyup", "KeyD", "d");
key(window, "keyup", "KeyS", "s");

const pointerCanvas = new FakeTarget();
const pointerInput = new InputManager(pointerCanvas);
pointerCanvas.dispatch("pointerdown", { clientX: 500, clientY: 500 });
pointerInput.getState();
pointerCanvas.dispatch("pointermove", { clientX: 650, clientY: 502 });
const pointerState = pointerInput.getState();
assert(pointerState.isPulling, "Pointer PULL stays active during horizontal Rod Control");
assert(pointerState.rodControlActive, "Pointer horizontal movement activates Rod Control");
assert(!pointerState.dragControlActive, "Pointer Rod Control blocks drag/friction gesture mode");
pointerInput.dispose();

const config = {
  enabled: true,
  pixelsPerMeter: 50,
  alignment: {
    minInitialOffsetPx: 1,
    alignedThresholdPx: 0,
    maxEffectiveAngleDeg: 45,
    allowAwayDirection: false,
    awayDirectionMultiplier: 0,
  },
  force: {
    maxForceKg: 0.22,
    sideMovePxPerSecond: 50,
    fishWeightResistanceMultiplier: 0,
  },
  tension: {
    sameDirectionMultiplier: 0,
    sideMultiplier: 1,
    oppositeDirectionMultiplier: 2.5,
  },
  rodVisual: {
    maxOffsetScreenRatio: 0.05,
    fallbackMaxOffsetPx: 55,
    moveSmoothing: 7,
    returnSmoothing: 5,
    edgePaddingPx: 16,
    clampToPlayableZone: true,
  },
};

const fullAngle = new RodLateralControlSystem().update({
  dtSec: 1,
  inputState: {
    rodControlActive: true,
    rodControlDirectionX: 1,
    rodControlInputRatio: 1,
  },
  fishPosition: { x: -100, y: 100 },
  rodTipPosition: { x: 0, y: 0 },
  rodControlTargetPosition: { x: 0, y: 0 },
  rodLimitKg: 2,
  maxTackleLoadKg: 2,
  currentTensionKg: 0,
  fishVelocityX: 0,
  fishWeightKg: 0,
  config,
});
approx(fullAngle.angleRatio, 1, 0.001, "45 degree line gives full angle ratio");
approx(fullAngle.deliveredForceRatio, 1, 0.001, "100% input at 45 degrees delivers 100% force");

const halfAngle = new RodLateralControlSystem().update({
  dtSec: 1,
  inputState: {
    rodControlActive: true,
    rodControlDirectionX: 1,
    rodControlInputRatio: 1,
  },
  fishPosition: { x: -41.421356, y: 100 },
  rodTipPosition: { x: 0, y: 0 },
  rodControlTargetPosition: { x: 0, y: 0 },
  rodLimitKg: 2,
  maxTackleLoadKg: 2,
  currentTensionKg: 0,
  fishVelocityX: 0,
  fishWeightKg: 0,
  config,
});
approx(halfAngle.angleRatio, 0.5, 0.001, "22.5 degree line gives half angle ratio");
approx(halfAngle.deliveredForceRatio, 0.5, 0.001, "100% input at 22.5 degrees delivers 50% force");

const wrongDirection = new RodLateralControlSystem().update({
  dtSec: 1,
  inputState: {
    rodControlActive: true,
    rodControlDirectionX: -1,
    rodControlInputRatio: 1,
  },
  fishPosition: { x: -100, y: 100 },
  rodTipPosition: { x: 0, y: 0 },
  rodControlTargetPosition: { x: 0, y: 0 },
  rodLimitKg: 2,
  maxTackleLoadKg: 2,
  currentTensionKg: 0,
  fishVelocityX: 0,
  fishWeightKg: 0,
  config,
});
approx(wrongDirection.deliveredForceRatio, 0, 0.001, "Wrong direction delivers zero force");
assert(wrongDirection.blockedReason === "wrong_direction", "Wrong direction reports blocked reason");

const noReserve = new RodLateralControlSystem().update({
  dtSec: 1,
  inputState: {
    rodControlActive: true,
    rodControlDirectionX: 1,
    rodControlInputRatio: 1,
  },
  fishPosition: { x: -100, y: 100 },
  rodTipPosition: { x: 0, y: 0 },
  rodControlTargetPosition: { x: 0, y: 0 },
  rodLimitKg: 0.2,
  maxTackleLoadKg: 0.2,
  currentTensionKg: 0.2,
  fishVelocityX: 0,
  fishWeightKg: 0,
  config,
});
approx(noReserve.forceKg, 0, 0.001, "No load reserve gives zero force");
approx(noReserve.deliveredForceRatio, 0, 0.001, "No load reserve gives zero delivered force ratio");
assert(noReserve.blockedReason === "no_load_reserve", "No load reserve reports blocked reason");

const nearCenter = new RodLateralControlSystem().update({
  dtSec: 1,
  inputState: {
    rodControlActive: true,
    rodControlDirectionX: 1,
    rodControlInputRatio: 1,
  },
  fishPosition: { x: 0, y: 100 },
  rodTipPosition: { x: 0, y: 0 },
  rodControlTargetPosition: { x: 0, y: 0 },
  rodLimitKg: 2,
  maxTackleLoadKg: 2,
  currentTensionKg: 0,
  fishVelocityX: 0,
  fishWeightKg: 0,
  config,
});
approx(nearCenter.angleRatio, 0, 0.001, "Fish near rod X has zero side angle ratio");
approx(nearCenter.deliveredForceRatio, 0, 0.001, "Fish near rod X gets zero delivered force");

const noOvershoot = new RodLateralControlSystem().update({
  dtSec: 1,
  inputState: {
    rodControlActive: true,
    rodControlDirectionX: 1,
    rodControlInputRatio: 1,
  },
  fishPosition: { x: -10, y: 10 },
  rodTipPosition: { x: 0, y: 0 },
  rodControlTargetPosition: { x: 0, y: 0 },
  rodLimitKg: 2,
  maxTackleLoadKg: 2,
  currentTensionKg: 0,
  fishVelocityX: 0,
  fishWeightKg: 0,
  config,
});
approx(noOvershoot.desiredMovePx, 10, 0.001, "Rod Control desired move is capped at target X");

const stableTargetSystem = new RodLateralControlSystem();
const stableFirst = stableTargetSystem.update({
  dtSec: 0.1,
  inputState: {
    rodControlActive: true,
    rodControlDirectionX: 1,
    rodControlInputRatio: 1,
  },
  fishPosition: { x: -100, y: 100 },
  rodTipPosition: { x: 0, y: 0 },
  rodControlTargetPosition: { x: 0, y: 0 },
  rodLimitKg: 2,
  maxTackleLoadKg: 2,
  currentTensionKg: 0,
  fishVelocityX: 0,
  fishWeightKg: 0,
  config,
});
const stableSecond = stableTargetSystem.update({
  dtSec: 0.1,
  inputState: {
    rodControlActive: true,
    rodControlDirectionX: 1,
    rodControlInputRatio: 1,
  },
  fishPosition: { x: -80, y: 100 },
  rodTipPosition: { x: 50, y: 0 },
  rodControlTargetPosition: { x: 50, y: 0 },
  rodLimitKg: 2,
  maxTackleLoadKg: 2,
  currentTensionKg: 0,
  fishVelocityX: 0,
  fishWeightKg: 0,
  config,
});
approx(stableFirst.targetRodX, 0, 0.001, "Rod Control stores initial target rod X");
approx(stableSecond.targetRodX, 0, 0.001, "Rod Control target rod X stays stable while visual rod moves");

const visual = new RodVisualOffsetSystem();
const visualOffset = visual.update({
  dtSec: 1,
  inputState: {
    rodControlActive: true,
    rodControlDirectionX: 1,
    rodControlInputRatio: 1,
  },
  fightDebug: {
    rodControlActive: true,
    rodControlInputDirectionX: 1,
    rodControlVisualRatio: 0.5,
  },
  config,
  canvasWidth: 1000,
});
assert(visualOffset > 0, "Rod visual offset follows input direction");
approx(stableSecond.targetRodX, 0, 0.001, "Rod visual offset does not change stable target rod X");
`, context);

console.log("rod-control-ux-check passed:");
for (const message of checks) console.log("- " + message);
