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
  "src/systems/player_pull_motion_smoother.js",
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
    const payload = { type, preventDefault() {}, ...event };
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
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
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
assert(!keyboardState.dragIncrease && !keyboardState.dragDecrease, "Rod Control suppresses drag keys");
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
assert(pointerState.isPulling, "Pointer pull stays active during Rod Control");
assert(pointerState.rodControlActive, "Horizontal pointer movement activates Rod Control");
assert(!pointerState.dragControlActive, "Rod Control blocks drag gesture mode");
pointerInput.dispose();

const config = {
  enabled: true,
  pixelsPerMeter: 50,
  force: {
    maxForceKg: 0.22,
    sidePullSpeedMultiplier: 1,
    fishWeightResistanceMultiplier: 0,
  },
  water: {
    motionResistance: 1000,
    speedMultiplier: 64,
  },
  tension: {
    sameDirectionMultiplier: 0,
    sideMultiplier: 1,
    oppositeDirectionMultiplier: 2.5,
  },
  rodVisual: {
    maxOffsetScreenRatio: 0.05,
    fallbackMaxOffsetPx: 55,
    moveResponsiveness: 8,
    returnResponsiveness: 5,
    edgePaddingPx: 16,
    clampToPlayableZone: true,
    weightSpeed: {
      fullSpeedMaxWeightRatio: 0.3,
      minimumSpeedWeightRatio: 1,
      minimumSpeedRatio: 0.5,
    },
  },
};

function controlFrame({
  direction = 1,
  inputRatio = 1,
  tension = 0,
  fishVelocityX = 0,
} = {}) {
  return new RodLateralControlSystem().update({
    dtSec: 1,
    inputState: {
      rodControlActive: true,
      rodControlDirectionX: direction,
      rodControlInputRatio: inputRatio,
    },
    fishPosition: { x: 0, y: 100 },
    rodLimitKg: 2,
    maxTackleLoadKg: 2,
    currentTensionKg: tension,
    fishVelocityX,
    fishWeightKg: 0,
    config,
  });
}

const centeredRight = controlFrame();
assert(centeredRight.canApply, "Centered fish does not block right Rod Control");
approx(centeredRight.directionX, 1, 0.001, "Input sets right movement direction");
approx(centeredRight.deliveredForceRatio, 1, 0.001, "Full input delivers full force ratio");

const centeredLeft = controlFrame({ direction: -1, inputRatio: 0.5 });
assert(centeredLeft.canApply, "Centered fish does not block left Rod Control");
approx(centeredLeft.directionX, -1, 0.001, "Input sets left movement direction");
approx(centeredLeft.requestedForceRatio, 0.5, 0.001, "Input ratio is requested force");
approx(centeredLeft.deliveredForceRatio, 0.5, 0.001, "Half input delivers half force");

const oppositeFish = controlFrame({ direction: -1, fishVelocityX: 10 });
approx(oppositeFish.tensionMultiplier, 2.5, 0.001, "Opposing fish uses maximum tension multiplier");
const sameDirectionFish = controlFrame({ direction: 1, fishVelocityX: 10 });
approx(sameDirectionFish.tensionMultiplier, 0, 0.001, "Same-direction fish uses minimum tension multiplier");

const noReserve = controlFrame({ tension: 2 });
assert(!noReserve.canApply, "No load reserve blocks Rod Control force");
assert(noReserve.blockedReason === "no_load_reserve", "No reserve has exact block reason");

const movementRecord = new RodLateralControlSystem();
const movementFrame = movementRecord.update({
  dtSec: 1,
  inputState: {
    rodControlActive: true,
    rodControlDirectionX: 1,
    rodControlInputRatio: 0.8,
  },
  fishPosition: { x: 0, y: 100 },
  rodLimitKg: 2,
  currentTensionKg: 0,
  fishWeightKg: 0,
  config,
});
movementRecord.recordAppliedMovement({ movedMeters: 0, movedPx: 0 });
approx(movementFrame.deliveredForceRatio, 0.8, 0.001, "Blocked movement does not mutate delivered force");
approx(movementFrame.actualMovementRatio, 0, 0.001, "Applied movement is tracked separately");

const lightVisual = new RodVisualOffsetSystem();
const lightOffset = lightVisual.update({
  dtSec: 0.05,
  inputState: {
    rodControlActive: true,
    rodControlDirectionX: 1,
    rodControlInputRatio: 1,
  },
  fightDebug: { fishWeightKg: 0.3, rodMaxLoadKg: 1 },
  config,
  canvasWidth: 1000,
});
assert(lightOffset > 0 && lightOffset < 55, "Visual rod starts smoothly");
approx(lightVisual.getFrame().weightSpeedRatio, 1, 0.001, "30% load keeps full visual speed");

const heavyVisual = new RodVisualOffsetSystem();
const heavyOffset = heavyVisual.update({
  dtSec: 0.05,
  inputState: {
    rodControlActive: true,
    rodControlDirectionX: 1,
    rodControlInputRatio: 1,
  },
  fightDebug: { fishWeightKg: 1, rodMaxLoadKg: 1 },
  config,
  canvasWidth: 1000,
});
approx(heavyVisual.getFrame().weightSpeedRatio, 0.5, 0.001, "100% load halves visual speed");
assert(heavyOffset > 0 && heavyOffset < lightOffset, "Heavy fish slows visual response");

const continuedOffset = heavyVisual.update({
  dtSec: 0.05,
  inputState: {
    rodControlActive: true,
    rodControlDirectionX: 1,
    rodControlInputRatio: 1,
  },
  fightDebug: { fishWeightKg: 1, rodMaxLoadKg: 1, rodControlMovePx: 0 },
  config,
  canvasWidth: 1000,
});
assert(continuedOffset > heavyOffset, "Visual rod ignores applied fish movement");

const releasedOffset = heavyVisual.update({
  dtSec: 0.05,
  inputState: {
    rodControlActive: false,
    rodControlDirectionX: 0,
    rodControlInputRatio: 0,
  },
  fightDebug: { fishWeightKg: 1, rodMaxLoadKg: 1 },
  config,
  canvasWidth: 1000,
});
assert(releasedOffset > 0 && releasedOffset < continuedOffset, "Visual rod returns smoothly");
`, context);

console.log("rod-control-ux-check passed:");
for (const message of checks) console.log("- " + message);
