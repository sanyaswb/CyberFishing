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
  "src/core/fishing/rod_control_tension_mode_resolver.js",
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
  alignment: {
    enabled: true,
    useActualRodPositionAsTarget: true,
    maxEffectiveAngleDeg: 45,
    alignedThresholdPx: 0,
    allowAwayDirection: false,
    awayDirectionMultiplier: 0,
  },
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
  rodAim: {
    enabled: true,
    maxOffsetScreenRatio: 0.06,
    fallbackMaxOffsetPx: 80,
    baseAimSpeedPxPerSecond: 120,
    fishLoadMinSpeedRatio: 0.5,
    fishLoadMaxSpeedRatio: 1.1,
    fishLoadCurvePower: 1.0,
    tightLineAimMultiplier: 0.35,
    freeLineAimMultiplier: 1.0,
    dragSlipAimMultiplier: 1.3,
    minimumLoadSpeedRatio: 0.35,
    returnSpeedMultiplier: 0.75,
    edgePaddingPx: 16,
    clampToPlayableZone: true,
  },
  rodVisual: {
    maxOffsetScreenRatio: 0.05,
    fallbackMaxOffsetPx: 55,
    moveResponsiveness: 8,
    returnResponsiveness: 5,
    edgePaddingPx: 16,
    clampToPlayableZone: true,
    tightLineFollowsAppliedFish: true,
    followFishMovementRatio: 1,
    freeLineUsesInputDrivenVisual: true,
    freeLineResponsiveness: 8,
    weightSpeed: {
      fullSpeedMaxWeightRatio: 0.3,
      minimumSpeedWeightRatio: 1,
      minimumSpeedRatio: 0.5,
    },
  },
};

function controlFrame({
  direction = -1,
  inputRatio = 1,
  tension = 0,
  fishVelocity = null,
  fishVelocityX = 0,
  fishX = 100,
  fishY = 100,
  rodX = 0,
  rodY = 0,
} = {}) {
  return new RodLateralControlSystem().update({
    dtSec: 1,
    inputState: {
      rodControlActive: true,
      rodControlDirectionX: direction,
      rodControlInputRatio: inputRatio,
    },
    fishPosition: { x: fishX, y: fishY },
    rodTipPosition: { x: rodX, y: rodY },
    baseRodTipPosition: { x: rodX, y: rodY },
    actualRodTipPosition: { x: rodX, y: rodY },
    rodLimitKg: 2,
    maxTackleLoadKg: 2,
    currentTensionKg: tension,
    fishVelocity,
    fishVelocityX,
    fishWeightKg: 0,
    config,
  });
}

const fullAngle = controlFrame();
assert(fullAngle.canApply, "45-degree fish offset allows toward-rod Rod Control");
approx(fullAngle.directionX, -1, 0.001, "Toward-rod movement direction is left");
approx(fullAngle.angleRatio, 1, 0.001, "45-degree line angle reaches full angle ratio");
approx(fullAngle.deliveredForceRatio, 1, 0.001, "Full input at 45 degrees delivers full force ratio");

const halfAngle = controlFrame({ fishX: Math.tan(Math.PI / 8) * 100 });
assert(halfAngle.canApply, "22.5-degree fish offset still allows control");
approx(halfAngle.angleRatio, 0.5, 0.01, "22.5-degree angle delivers half angle ratio");
approx(halfAngle.deliveredForceRatio, 0.5, 0.01, "Full input at 22.5 degrees delivers half force");

const centeredFish = controlFrame({ fishX: 0, direction: 1 });
assert(!centeredFish.canApply, "Aligned fish blocks Rod Control");
assert(centeredFish.blockedReason === "aligned", "Aligned fish has exact block reason");

const wrongDirection = controlFrame({ direction: 1 });
assert(!wrongDirection.canApply, "Wrong-side Rod Control is blocked");
assert(wrongDirection.blockedReason === "wrong_direction", "Wrong direction has exact block reason");

const halfInput = controlFrame({ inputRatio: 0.5 });
approx(halfInput.requestedForceRatio, 0.5, 0.001, "Input and angle combine into requested force");
approx(halfInput.deliveredForceRatio, 0.5, 0.001, "Half input delivers half force at 45 degrees");

const oppositeFish = controlFrame({ direction: -1, fishVelocityX: 10 });
approx(oppositeFish.tensionMultiplier, 2.5, 0.001, "Opposing fish uses maximum tension multiplier");
assert(oppositeFish.tensionMode === "opposite_direction", "Opposing fish resolves opposite-direction tension mode");
approx(oppositeFish.fishControlAxisVelocityPxPerSecond, -10, 0.001, "Opposing fish has negative control-axis projection");
const sameDirectionFish = controlFrame({ direction: -1, fishVelocityX: -10 });
approx(sameDirectionFish.tensionMultiplier, 0, 0.001, "Same-direction fish uses minimum tension multiplier");
assert(sameDirectionFish.tensionMode === "same_direction", "Same-direction fish resolves matching tension mode");
approx(sameDirectionFish.fishControlAxisVelocityPxPerSecond, 10, 0.001, "Same-direction fish has positive control-axis projection");
const sideFish = controlFrame({ direction: -1, fishVelocityX: 0 });
approx(sideFish.tensionMultiplier, 1, 0.001, "Fish without control-axis movement uses side multiplier");
assert(sideFish.tensionMode === "side", "Fish without control-axis movement resolves side mode");

const axisResolver = new RodControlTensionModeResolver();
const rotatedSame = axisResolver.resolve({
  fishVelocity: { x: 3, y: 4 },
  controlAxis: { x: 0.6, y: 0.8 },
});
assert(rotatedSame.mode === "same_direction", "Rotated control axis detects same-direction movement");
approx(rotatedSame.alignment, 1, 0.001, "Aligned vectors produce full positive alignment");
approx(rotatedSame.projectionSpeedPxPerSec, 5, 0.001, "Rotated axis uses vector projection");
const rotatedOpposite = axisResolver.resolve({
  fishVelocity: { x: 3, y: 4 },
  controlAxis: { x: -0.6, y: -0.8 },
});
assert(rotatedOpposite.mode === "opposite_direction", "Reversed control axis detects opposite movement");
approx(rotatedOpposite.alignment, -1, 0.001, "Reversed vectors produce full negative alignment");
approx(rotatedOpposite.projectionSpeedPxPerSec, -5, 0.001, "Reversed axis keeps signed projection");
const rotatedSide = axisResolver.resolve({
  fishVelocity: { x: 3, y: 4 },
  controlAxis: { x: -0.8, y: 0.6 },
});
assert(rotatedSide.mode === "side", "Perpendicular fish movement resolves side mode");
approx(rotatedSide.alignment, 0, 0.001, "Perpendicular vectors have zero alignment");
approx(rotatedSide.projectionSpeedPxPerSec, 0, 0.001, "Perpendicular velocity has zero control-axis projection");

const horizontalSame = axisResolver.resolve({
  fishVelocity: { x: 100, y: 0 },
  controlAxis: { x: 1, y: 0 },
});
assert(horizontalSame.mode === "same_direction", "Horizontal fish velocity with control resolves same direction");
const horizontalOpposite = axisResolver.resolve({
  fishVelocity: { x: -100, y: 0 },
  controlAxis: { x: 1, y: 0 },
});
assert(horizontalOpposite.mode === "opposite_direction", "Horizontal fish velocity against control resolves opposite direction");
const verticalSide = axisResolver.resolve({
  fishVelocity: { x: 0, y: -100 },
  controlAxis: { x: 1, y: 0 },
});
assert(verticalSide.mode === "side", "Vertical fish velocity is side movement for horizontal control");
const diagonalSame = axisResolver.resolve({
  fishVelocity: { x: 70, y: -70 },
  controlAxis: { x: 1, y: 0 },
});
assert(diagonalSame.mode === "same_direction", "45-degree fish velocity exceeds same-direction threshold");
approx(diagonalSame.alignment, Math.SQRT1_2, 0.001, "Diagonal alignment is normalized");
const mostlyVertical = controlFrame({
  direction: 1,
  fishX: -100,
  fishVelocity: { x: 20, y: 100 },
  fishVelocityX: 20,
});
assert(mostlyVertical.tensionMode === "side", "Full-vector mode treats weak control-axis component as side");
approx(mostlyVertical.tensionMultiplier, 1, 0.001, "Full-vector side mode uses neutral multiplier");
const nearStopped = axisResolver.resolve({
  fishVelocity: { x: 0.2, y: 0 },
  controlAxis: { x: 1, y: 0 },
});
assert(nearStopped.mode === "side", "Fish below minimum autonomous speed resolves side");
const tunedThreshold = axisResolver.resolve({
  fishVelocity: { x: 20, y: 100 },
  controlAxis: { x: 1, y: 0 },
  config: {
    sameDirectionThreshold: 0.15,
    oppositeDirectionThreshold: -0.15,
    minFishSpeedPxPerSec: 0,
  },
});
assert(tunedThreshold.mode === "same_direction", "Configured threshold changes alignment classification");
const missingAxis = axisResolver.resolve({
  fishVelocity: { x: 100, y: 0 },
  controlAxis: { x: 0, y: 0 },
});
assert(missingAxis.mode === "side", "Near-zero control axis resolves side");

const noReserve = controlFrame({ tension: 2 });
assert(!noReserve.canApply, "No load reserve blocks Rod Control force");
assert(noReserve.blockedReason === "no_load_reserve", "No reserve has exact block reason");

const movementRecord = new RodLateralControlSystem();
const movementFrame = movementRecord.update({
  dtSec: 1,
  inputState: {
    rodControlActive: true,
    rodControlDirectionX: -1,
    rodControlInputRatio: 0.8,
  },
  fishPosition: { x: 100, y: 100 },
  rodTipPosition: { x: 0, y: 0 },
  actualRodTipPosition: { x: 0, y: 0 },
  rodLimitKg: 2,
  currentTensionKg: 0,
  fishWeightKg: 0,
  config,
});
movementRecord.recordAppliedMovement({ movedMeters: 0, movedPx: 0 });
approx(movementFrame.deliveredForceRatio, 0.8, 0.001, "Blocked movement does not mutate delivered force");
approx(movementFrame.actualMovementRatio, 0, 0.001, "Applied movement is tracked separately");

const releasedControl = new RodLateralControlSystem().update({
  dtSec: 0.05,
  inputState: {
    rodControlActive: false,
    rodControlDirectionX: 0,
    rodControlInputRatio: 0,
  },
  fishPosition: { x: 100, y: 100 },
  rodTipPosition: { x: 0, y: 0 },
  actualRodTipPosition: { x: 40, y: 0 },
  rodLimitKg: 2,
  currentTensionKg: 0,
  fishWeightKg: 0,
  config,
});
assert(releasedControl.targetRodX === null, "Released Rod Control removes visual rod from the physics target");

const tightVisual = new RodVisualOffsetSystem();
const tightOffset = tightVisual.update({
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
approx(tightVisual.getFrame().weightSpeedRatio, 0.5, 0.001, "Fish at rod load limit uses configured minimum rod aim speed");
approx(tightOffset, 1.05, 0.001, "Tight-line rod aim slows by relative fish load");
assert(tightVisual.getFrame().drivenByInput, "Tight-line rod aim is input-driven");
assert(!tightVisual.getFrame().drivenByFish, "Tight-line rod aim is not fish-driven");
assert(tightVisual.getFrame().lineMode === "tight_line", "Tight-line rod aim reports tight line mode");

const sameDirectionAim = new RodVisualOffsetSystem();
const sameDirectionOffset = sameDirectionAim.update({
  dtSec: 0.05,
  inputState: {
    rodControlActive: true,
    rodControlDirectionX: 1,
    rodControlInputRatio: 1,
  },
  fightDebug: {
    fishWeightKg: 1,
    rodMaxLoadKg: 1,
    rodControlLoadReserveRatio: 0,
    forces: { fX: 10 },
  },
  config,
  canvasWidth: 1000,
});
approx(sameDirectionAim.getFrame().directionSpeedRatio, 0.75, 0.001, "Rod aim with fish uses return speed multiplier");
approx(sameDirectionOffset, 2.75, 0.001, "Rod aim with fish adds fish X speed without load-reserve slowdown");
assert(sameDirectionAim.getFrame().withFishDirection, "Rod aim detects same X direction as fish");
assert(sameDirectionAim.getFrame().directionSpeedMode === "with_fish", "Rod aim reports with-fish speed mode");
assert(sameDirectionAim.getFrame().drivenByFish, "Rod aim with fish reports fish-driven visual movement");

const opposingDirectionAim = new RodVisualOffsetSystem();
const opposingDirectionOffset = opposingDirectionAim.update({
  dtSec: 0.05,
  inputState: {
    rodControlActive: true,
    rodControlDirectionX: 1,
    rodControlInputRatio: 1,
  },
  fightDebug: { fishWeightKg: 1, rodMaxLoadKg: 1, forces: { fX: -10 } },
  config,
  canvasWidth: 1000,
});
approx(opposingDirectionAim.getFrame().directionSpeedRatio, 0.35, 0.001, "Rod aim against fish uses tight-line speed multiplier");
approx(opposingDirectionOffset, 1.05, 0.001, "Rod aim against fish keeps tight-line speed");
assert(!opposingDirectionAim.getFrame().withFishDirection, "Rod aim detects opposing X direction from fish");

const centeredFollow = new RodLateralControlSystem().update({
  dtSec: 1,
  inputState: {
    rodControlActive: true,
    rodControlDirectionX: -1,
    rodControlInputRatio: 1,
  },
  fishPosition: { x: 0, y: 100 },
  rodTipPosition: { x: 0, y: 0 },
  actualRodTipPosition: { x: -100, y: 0 },
  rodLimitKg: 2,
  currentTensionKg: 0,
  fishWeightKg: 0,
  config,
});
assert(centeredFollow.canApply, "Fish centered on base rod follows shifted actual rod target");
approx(centeredFollow.directionX, -1, 0.001, "Centered fish moves toward shifted left rod aim");
approx(centeredFollow.deliveredForceRatio, 1, 0.001, "Shifted rod aim creates full force at 45 degrees");

const freeLineVisual = new RodVisualOffsetSystem();
const freeLineOffset = freeLineVisual.update({
  dtSec: 0.05,
  inputState: {
    rodControlActive: true,
    rodControlDirectionX: 1,
    rodControlInputRatio: 1,
  },
  fightDebug: { fishWeightKg: 0.3, rodMaxLoadKg: 1, lineCanRelease: true, reelSlip: true },
  config,
  canvasWidth: 1000,
});
assert(freeLineOffset > 0 && freeLineOffset < 55, "Free-line visual rod starts smoothly from input");
assert(freeLineVisual.getFrame().drivenByInput, "Free-line visual is input-driven");
assert(freeLineVisual.getFrame().freeLineMode, "Free-line visual mode is detected");
approx(freeLineVisual.getFrame().weightSpeedRatio, 0.92, 0.001, "Light fish keeps most free-line visual speed from relative load");
approx(freeLineVisual.getFrame().weightLoadRatio, 0.3, 0.001, "Rod aim weight load ratio uses fish load over rod load");

const heavyVisual = new RodVisualOffsetSystem();
const heavyOffset = heavyVisual.update({
  dtSec: 0.05,
  inputState: {
    rodControlActive: true,
    rodControlDirectionX: 1,
    rodControlInputRatio: 1,
  },
  fightDebug: { fishWeightKg: 1, rodMaxLoadKg: 1, lineCanRelease: true, reelSlip: true },
  config,
  canvasWidth: 1000,
});
approx(heavyVisual.getFrame().weightSpeedRatio, 0.5, 0.001, "Fish at rod load limit reaches minimum relative-load speed");
assert(heavyOffset > 0 && heavyOffset < freeLineOffset, "Heavy fish slows free-line visual response");



const tinyFishVisual = new RodVisualOffsetSystem();
tinyFishVisual.update({
  dtSec: 0.05,
  inputState: {
    rodControlActive: true,
    rodControlDirectionX: 1,
    rodControlInputRatio: 1,
  },
  fightDebug: { fishWeightKg: 0.05, rodMaxLoadKg: 1, lineCanRelease: true, reelSlip: true },
  config,
  canvasWidth: 1000,
});
approx(tinyFishVisual.getFrame().weightSpeedRatio, 1.07, 0.001, "0.05kg fish on 1kg rod keeps above-base rod aim speed");

const nearLimitFishVisual = new RodVisualOffsetSystem();
nearLimitFishVisual.update({
  dtSec: 0.05,
  inputState: {
    rodControlActive: true,
    rodControlDirectionX: 1,
    rodControlInputRatio: 1,
  },
  fightDebug: { fishWeightKg: 0.9, rodMaxLoadKg: 1, lineCanRelease: true, reelSlip: true },
  config,
  canvasWidth: 1000,
});
approx(nearLimitFishVisual.getFrame().weightSpeedRatio, 0.56, 0.001, "0.9kg fish on 1kg rod slows rod aim to roughly half speed");

const releasedOffset = heavyVisual.update({
  dtSec: 0.05,
  inputState: {
    rodControlActive: false,
    rodControlDirectionX: 0,
    rodControlInputRatio: 0,
  },
  fightDebug: { fishWeightKg: 1, rodMaxLoadKg: 1, lineCanRelease: true, reelSlip: true },
  config,
  canvasWidth: 1000,
});
assert(releasedOffset >= 0 && releasedOffset < heavyOffset, "Visual rod returns toward center without overshoot");
`, context);

console.log("rod-control-ux-check passed:");
for (const message of checks) console.log("- " + message);
