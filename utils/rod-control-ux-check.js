const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const FILES = [
  "src/core/input/fight_input_action_composer.js",
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
assert(!pointerState.fightActions?.hold?.active, "Horizontal pointer Rod Control excludes pointer Rod Hold");
assert(pointerState.rodControlActive, "Horizontal pointer movement activates Rod Control");
assert(!pointerState.dragControlActive, "Rod Control blocks drag gesture mode");
assert(pointerState.pointerAction === "rod_control_x", "Pointer action locks to Rod Control X");
window.dispatch("pointerup", { clientX: 650, clientY: 502 });
const releasedControlState = pointerInput.getState();
assert(!releasedControlState.fightActions?.hold?.active, "Releasing Rod Control ends Fight Rod Hold");
assert(!releasedControlState.rodControlActive, "Releasing pointer ends Rod Control");
pointerCanvas.dispatch("pointerdown", { clientX: 500, clientY: 500 });
const nextPointerHoldState = pointerInput.getState();
assert(nextPointerHoldState.fightActions?.hold?.active, "A new pointer hold can start Fight Rod Hold after Rod Control");
assert(!nextPointerHoldState.rodControlActive, "A new centered hold does not reuse Rod Control state");
pointerInput.dispose();

const config = {
  enabled: true,
  pixelsPerMeter: 50,
  alignment: {
    enabled: true,
    targetAnchorMode: "current_base",
    maxEffectiveAngleDeg: 45,
    alignedThresholdPx: 0,
    centerStartThresholdPx: 0.5,
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
assert(centeredFish.canApply, "Centered fish can start Rod Control to either side");
assert(centeredFish.targetMode === "center_start", "Centered Rod Control latches the start direction");
assert(centeredFish.centered, "Exact-center Rod Control reports centered state");
assert(centeredFish.controlStartedCentered, "Exact-center Rod Control records session started centered");
assert(centeredFish.centerStartActive, "Exact-center Rod Control reports center-start active state");
approx(centeredFish.directionX, 1, 0.001, "Centered Rod Control follows the initial input direction");

const nearCenterConfig = {
  ...config,
  alignment: {
    ...config.alignment,
    alignedThresholdPx: 8,
    centerStartThresholdPx: 0.5,
  },
};
const nearCenterSameSide = new RodLateralControlSystem().update({
  dtSec: 1,
  inputState: {
    rodControlActive: true,
    rodControlDirectionX: 1,
    rodControlInputRatio: 1,
  },
  fishPosition: { x: 4, y: 100 },
  rodTipPosition: { x: 0, y: 0 },
  baseRodTipPosition: { x: 0, y: 0 },
  actualRodTipPosition: { x: 0, y: 0 },
  rodLimitKg: 2,
  currentTensionKg: 0,
  fishWeightKg: 0,
  config: nearCenterConfig,
});
assert(!nearCenterSameSide.centered, "Near-center fish is not exact center for free direction start");
assert(!nearCenterSameSide.centerStartActive, "Near-center fish cannot latch same-side center start");
assert(!nearCenterSameSide.canApply, "Near-center same-side Rod Control stays blocked");
assert(nearCenterSameSide.blockedReason === "aligned", "Near-center same-side block remains aligned");

const centerCrossingControl = new RodLateralControlSystem();
const centerCrossingStart = centerCrossingControl.update({
  dtSec: 1,
  inputState: {
    rodControlActive: true,
    rodControlDirectionX: -1,
    rodControlInputRatio: 1,
  },
  fishPosition: { x: 100, y: 100 },
  rodTipPosition: { x: 0, y: 0 },
  baseRodTipPosition: { x: 0, y: 0 },
  actualRodTipPosition: { x: 0, y: 0 },
  rodLimitKg: 2,
  currentTensionKg: 0,
  fishWeightKg: 0,
  config,
});
assert(centerCrossingStart.canApply, "Side-start Rod Control can pull fish toward center");
assert(!centerCrossingStart.controlStartedCentered, "Side-start Rod Control records non-centered session start");
const centerCrossingAligned = centerCrossingControl.update({
  dtSec: 1,
  inputState: {
    rodControlActive: true,
    rodControlDirectionX: -1,
    rodControlInputRatio: 1,
  },
  fishPosition: { x: 0, y: 100 },
  rodTipPosition: { x: 0, y: 0 },
  baseRodTipPosition: { x: 0, y: 0 },
  actualRodTipPosition: { x: 0, y: 0 },
  rodLimitKg: 2,
  currentTensionKg: 0,
  fishWeightKg: 0,
  config,
});
assert(centerCrossingAligned.centered, "Fish reaching center is reported as centered");
assert(!centerCrossingAligned.controlStartedCentered, "Arriving at center does not rewrite session start state");
assert(!centerCrossingAligned.centerStartActive, "Arriving at center does not activate center-start mode");
assert(centerCrossingAligned.targetMode !== "center_start", "Arriving at center does not switch to center_start");
approx(centerCrossingAligned.targetRodX, 0, 0.001, "Arriving at center keeps a valid target rod X");
assert(!centerCrossingAligned.canApply, "Rod Control stops when side-start fish reaches center");
assert(centerCrossingAligned.blockedReason === "aligned", "Center crossing blocks as aligned while input remains held");

const intentResolver = new RodLateralControlSystem();
const alignedIntent = intentResolver.resolveIntent({
  inputState: {
    rodControlActive: true,
    rodControlDirectionX: 1,
    rodControlInputRatio: 1,
  },
  fishPosition: { x: 0, y: 100 },
  rodTipPosition: { x: 0, y: 0 },
  actualRodTipPosition: { x: 0, y: 0 },
  config,
});
assert(
  alignedIntent.canRequestForce,
  "Centered Rod Control intent remains eligible before force-budget allocation",
);
assert(
  alignedIntent.blockedReason === "none",
  "Centered intent has no block reason while the gesture is active",
);

const wrongDirection = controlFrame({ direction: 1 });
assert(!wrongDirection.canApply, "Wrong-side Rod Control is blocked");
assert(wrongDirection.blockedReason === "wrong_direction", "Wrong direction has exact block reason");

const wrongDirectionIntent = new RodLateralControlSystem().resolveIntent({
  inputState: {
    rodControlActive: true,
    rodControlDirectionX: 1,
    rodControlInputRatio: 1,
  },
  fishPosition: { x: 100, y: 100 },
  rodTipPosition: { x: 0, y: 0 },
  actualRodTipPosition: { x: 0, y: 0 },
  config,
});
assert(
  !wrongDirectionIntent.canRequestForce,
  "Wrong-direction control is ineligible before force-budget allocation",
);

const visualTargetMustNotOverrideFishSide = new RodLateralControlSystem().update({
  dtSec: 1,
  inputState: {
    rodControlActive: true,
    rodControlDirectionX: 1,
    rodControlInputRatio: 1,
  },
  fishPosition: { x: 40, y: 100 },
  rodTipPosition: { x: 0, y: 0 },
  baseRodTipPosition: { x: 0, y: 0 },
  actualRodTipPosition: { x: 120, y: 0 },
  rodLimitKg: 2,
  currentTensionKg: 0,
  fishWeightKg: 0,
  config,
});
assert(
  !visualTargetMustNotOverrideFishSide.canApply,
  "Visual rod target cannot allow pulling toward the fish side",
);
assert(
  visualTargetMustNotOverrideFishSide.blockedReason === "wrong_direction",
  "Same-side control stays blocked even when the visual rod is farther right",
);

const castAnchorTarget = new RodLateralControlSystem().update({
  dtSec: 1,
  inputState: {
    rodControlActive: true,
    rodControlDirectionX: -1,
    rodControlInputRatio: 1,
  },
  fishPosition: { x: 100, y: 100 },
  rodTipPosition: { x: 0, y: 0 },
  baseRodTipPosition: { x: 50, y: 0, mode: "cast_base" },
  actualRodTipPosition: { x: 120, y: 0 },
  rodLimitKg: 2,
  currentTensionKg: 0,
  fishWeightKg: 0,
  config,
});
assert(castAnchorTarget.canApply, "Rod Control can use an injected cast-base anchor");
assert(castAnchorTarget.targetMode === "cast_base", "Rod Control reports injected cast-base target mode");
approx(castAnchorTarget.targetRodX, 50, 0.001, "Rod Control target X follows the injected anchor");
approx(castAnchorTarget.fishOffsetX, 50, 0.001, "Rod Control fish offset is measured from the injected anchor");

const currentAnchorTarget = new RodLateralControlSystem().update({
  dtSec: 1,
  inputState: {
    rodControlActive: true,
    rodControlDirectionX: -1,
    rodControlInputRatio: 1,
  },
  fishPosition: { x: 100, y: 100 },
  rodTipPosition: { x: 0, y: 0 },
  baseRodTipPosition: { x: 0, y: 0, mode: "current_base" },
  actualRodTipPosition: { x: 120, y: 0 },
  rodLimitKg: 2,
  currentTensionKg: 0,
  fishWeightKg: 0,
  config,
});
assert(currentAnchorTarget.targetMode === "current_base", "Rod Control reports injected current-base target mode");
approx(currentAnchorTarget.targetRodX, 0, 0.001, "Current-base target X follows the current base anchor");

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
assert(tightVisual.getFrame().lineMode === "tight_line", "Tight-line rod aim reports tight line mode");

const sameSideBlockedAim = new RodVisualOffsetSystem();
const sameSideBlockedOffset = sameSideBlockedAim.update({
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
    rodControlDirectionX: -1,
    rodControlDirectionFactor: 0,
    rodControlBlockedReason: "wrong_direction",
    forces: { fX: 10 },
  },
  config,
  canvasWidth: 1000,
});
approx(sameSideBlockedOffset, 0, 0.001, "Same-side Rod Control does not move visual rod");
assert(!sameSideBlockedAim.getFrame().drivenByInput, "Same-side Rod Control does not drive visual input");
assert(!("withFishDirection" in sameSideBlockedAim.getFrame()), "Rod aim no longer exposes with-fish movement mode");
assert(!("drivenByFish" in sameSideBlockedAim.getFrame()), "Rod aim no longer exposes fish-driven visual mode");

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
assert(!("withFishDirection" in opposingDirectionAim.getFrame()), "Rod aim does not expose with-fish movement mode");

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
assert(centeredFollow.canApply, "Centered fish can start left Rod Control");
approx(centeredFollow.directionX, -1, 0.001, "Centered fish latches left input until release");
approx(centeredFollow.deliveredForceRatio, 1, 0.001, "Centered start creates full control force");

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
