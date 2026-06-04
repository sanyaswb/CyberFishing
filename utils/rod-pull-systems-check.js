const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const FILES = [
  "src/core/core.js",
  "src/config/databases/fish/presets/fish_profile_factory.js",
  "src/config/databases/fish/presets/fish_profile_presets.js",
  "src/config/databases/fish/species/peaceful_fish.js",
  "src/config/databases/fish/species/predator_fish.js",
  "src/config/databases/fish/species/rare_fish.js",
  "src/config/databases/fish/species/event_fish.js",
  "src/config/databases/fish/fish_categories.js",
  "src/config/databases/fish_db.js",
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
  "src/input/pull_input_mapper.js",
  "src/core/line/line_spool_state.js",
  "src/core/fishing/rod_pull_state.js",
  "src/core/fishing/rod_stroke_state.js",
  "src/core/fishing/rod_axis_stroke_state.js",
  "src/core/fishing/rod_stroke_tracker.js",
  "src/core/fishing/reel_auto_recovery_calculator.js",
  "src/core/fishing/reel_hold_recovery_system.js",
  "src/core/fishing/slack_calculator.js",
  "src/core/fishing/rod_pull_calculator.js",
  "src/core/fishing/retrieve_policy.js",
  "src/core/fishing/landing_policy.js",
  "src/core/fishing/fish_retrieve_result.js",
  "src/core/fishing/simple_fight_force_calculator.js",
  "src/core/fishing/drag_force_calculator.js",
  "src/core/fishing/landing_lift_tension_calculator.js",
  "src/core/fishing/line_tension_calculator.js",
  "src/systems/player_pull_motion_smoother.js",
  "src/systems/rod_pull_system.js",
  "src/systems/rod_lateral_control_system.js",
  "src/systems/fish_retrieve_system.js",
  "src/systems/reel_system.js",
  "src/systems/tension_system.js",
  "src/systems/tackle_stress_system.js",
  "src/systems/fight_physics_pipeline.js",
  "src/systems/fight_physics_system.js",
];

const scheduledTimeouts = new Map();
let nextTimeoutId = 1;
const context = vm.createContext({
  console,
  Math,
  Number,
  Date,
  setTimeout: (handler) => { const id = nextTimeoutId++; scheduledTimeouts.set(id, handler); return id; },
  clearTimeout: (id) => scheduledTimeouts.delete(id),
  __flushTimeouts: () => { const handlers = Array.from(scheduledTimeouts.values()); scheduledTimeouts.clear(); handlers.forEach((h) => h()); },
  window: {},
});
for (const file of FILES) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), context, { filename: file });
}

vm.runInContext(`
const checks = [];
function assert(condition, message) { if (!condition) throw new Error(message); checks.push(message); }
function approx(value, expected, tolerance, message) { assert(Math.abs(value - expected) <= tolerance, message + " (" + value + ")"); }

const physicsAdapter = CONFIG.fightPhysicsConfig;
const pixelsPerMeter = physicsAdapter.getPixelsPerMeter();
const rodPullConfig = physicsAdapter.getRodPullConfig();
const poleIdleRetrieveConfig = physicsAdapter.getPoleIdleRetrieveConfig();

const retrievePolicyResolver = new IdleRetrievePolicyResolver();
const poleIdleParams = retrievePolicyResolver.resolve({ rod: { hasReel: false }, reel: null }).getRetrieveParams({ config: CONFIG });
approx(poleIdleParams.targetSpeedPxPerSec, poleIdleRetrieveConfig.speedMetersPerSecond * pixelsPerMeter, 0.001, "pole idle retrieve keeps dedicated policy");

const spool = new LineSpoolState({ totalLineMeters: 20 });
approx(spool.release(25), 20, 0.001, "line spool releases the full 20m without rod-length subtraction");
approx(spool.releasedLineMeters, 20, 0.001, "line spool total usable line equals equipped line length");
approx(spool.remainingLineMeters, 0, 0.001, "line spool reserve reaches zero only after full line release");
approx(spool.recover(5, 18), 2, 0.001, "line spool recovery cannot shorten line below fish distance");

const strokeTracker = new RodStrokeTracker();
let yFrame = strokeTracker.calculate({ previousFishY: 100, currentFishY: 115, pixelsPerMeter: 50, towardPlayerYSign: 1 });
approx(yFrame.yTowardMeters, 0.3, 0.001, "Y-only tracker counts toward-player Y gain");
approx(yFrame.yAwayMeters, 0, 0.001, "Y-only tracker ignores away loss during Y gain");
yFrame = strokeTracker.calculate({ previousFishY: 115, currentFishY: 102.5, pixelsPerMeter: 50, towardPlayerYSign: 1 });
approx(yFrame.yTowardMeters, 0, 0.001, "Y-only tracker reports no gain during Y escape");
approx(yFrame.yAwayMeters, 0.25, 0.001, "Y-only tracker counts Y escape as stroke loss");

const strokeState = new RodStrokeState();
strokeState.setCapacity(1.8);
approx(strokeState.addWonDistance(1), 1, 0.001, "rod stroke stores won Y distance");
approx(strokeState.loseWonDistance(0), 0, 0.001, "zero Y side movement does not reduce stroke");
approx(strokeState.wonMeters, 1, 0.001, "side movement leaves stroke won unchanged");
approx(strokeState.loseWonDistance(0.25), 0.25, 0.001, "Y escape reduces won stroke during hold");
approx(strokeState.wonMeters, 0.75, 0.001, "rod stroke keeps remaining won distance after Y escape");

const calculator = new RodPullCalculator({
  ...rodPullConfig,
  capacityByRodLengthRatio: 1,
  distanceMultiplierByRodLength: 1,
});
approx(calculator.calculateStrokeCapacity({ rodLengthMeters: 3.6 }), 3.6, 0.001, "full rod stroke equals rod length when multiplier is 1");
approx(calculator.calculateAvailableDistance({ rodLengthMeters: 3.6, slackMeters: 2 }), 3.6, 0.001, "deprecated pump credit API no longer reduces rod stroke availability");

const forceLimit = calculator.calculateForceLimit({ rodLimitKg: 3, fishTensionKg: 1.1 });
approx(forceLimit.rodHoldMaxKg, 1.9, 0.001, "rodHoldMax = rodLimit - fishTension");
approx(forceLimit.controlledPullLimitKg, 1.9, 0.001, "rod hold force is not clamped by line limit here");

const rodPullSystem = new RodPullSystem({
  ...rodPullConfig,
  capacityByRodLengthRatio: 1,
  distanceMultiplierByRodLength: 1,
  chargeTimeSeconds: 0.5,
});
const rod = { lengthMeters: 3.6, engineStats: { maxLoadKg: 3, holdTensionRatio: 0.5 } };
const first = rodPullSystem.update({
  dtSec: 0.25,
  inputState: { pullHeld: true, pullStartedThisFrame: true },
  rod,
  pumpCreditMeters: 0,
  fishTensionKg: 1.1,
  rodLimitKg: 3,
  lineHasReserve: true,
  fishDistanceMeters: 10,
});
approx(first.rodHoldMaxKg, 1.9, 0.001, "RodPullSystem exposes rodHoldMax");
approx(first.forceKg, 0.95, 0.001, "rod hold charges by chargeTimeSeconds");
approx(first.holdTensionRatio, 0.5, 0.001, "rod hold reads holdTensionRatio from rod");
assert(first.strokeResetReason === "stroke_capacity_initialized", "rod stroke initializes capacity without clearing won distance");

const strokeApplied = rodPullSystem.recordAppliedStroke({ movedMeters: 0.5 });
approx(strokeApplied.rodStrokeUnrecoveredMeters, 0.5, 0.001, "rod stroke tracks unrecovered pull distance");
const strokeRecovered = rodPullSystem.recoverStroke({ recoveredMeters: 0.2 });
approx(strokeRecovered.strokeRecoveredMeters, 0.2, 0.001, "rod stroke exposes recovered meters");
assert(strokeRecovered.strokeResetReason === "recovered_by_reel", "rod stroke exposes reel recovery reason");
const strokeSynced = rodPullSystem.syncStrokeToPumpCredit({ pumpCreditMeters: 0.1 });
approx(strokeSynced.strokeSyncedMeters, 0, 0.001, "pump credit sync no longer changes rod stroke");
assert(strokeSynced.strokeSyncReason === "debug_only", "pump credit sync is diagnostic only");

const releasedHoldStrokeSystem = new RodPullSystem({
  ...rodPullConfig,
  capacityByRodLengthRatio: 0.5,
  distanceMultiplierByRodLength: 0.5,
});
releasedHoldStrokeSystem.update({
  dtSec: 0,
  inputState: { pullHeld: true, pullStartedThisFrame: true },
  rod,
  fishTensionKg: 0,
  rodLimitKg: 3,
  lineHasReserve: true,
  fishDistanceMeters: 10,
});
releasedHoldStrokeSystem.recordYMovement({ gainedMeters: 1.8 });
const strokeLostAfterHoldRelease = releasedHoldStrokeSystem.update({
  dtSec: 1 / 30,
  inputState: { pullHeld: false, pullReleasedThisFrame: true },
  rod,
  fishTensionKg: 0,
  rodLimitKg: 3,
  lineHasReserve: false,
  fishDistanceMeters: 10,
  yLostBeforePullMeters: 1.8,
});
approx(strokeLostAfterHoldRelease.strokeYLostMeters, 1.8, 0.001, "Y escape after hold release eats unrecovered rod stroke");
approx(strokeLostAfterHoldRelease.rodStrokeWonMeters, 0, 0.001, "released hold Y escape resets lost rod stroke credit");

const autoRecover = new ReelAutoRecoveryCalculator().calculate({
  hasReel: true,
  playerHoldActive: false,
  strokeWonMeters: 1,
  totalTensionKg: 0.5,
  reelMaxLoadKg: 1,
  retrieveSpeedMetersPerSec: 0.8,
  releasedLineMeters: 8,
  fishDistanceMeters: 7,
  dtSec: 1,
});
approx(autoRecover.recoverSpeedMetersPerSec, 0.4, 0.001, "auto recovery speed scales from reel tension load");
approx(autoRecover.recoveredMeters, 0.4, 0.001, "auto recovery recovers by scaled retrieve speed");
const blockedAutoRecover = new ReelAutoRecoveryCalculator().calculate({
  hasReel: true,
  playerHoldActive: false,
  strokeWonMeters: 1,
  totalTensionKg: 1,
  reelMaxLoadKg: 1,
  retrieveSpeedMetersPerSec: 0.8,
  releasedLineMeters: 8,
  fishDistanceMeters: 7,
  dtSec: 1,
});
approx(blockedAutoRecover.recoverSpeedMetersPerSec, 0, 0.001, "auto recovery stops at reel max load");
assert(blockedAutoRecover.blockedReason === "tension_at_or_above_reel_load", "auto recovery reports reel load block");
const noTeleportAutoRecover = new ReelAutoRecoveryCalculator().calculate({
  hasReel: true,
  playerHoldActive: false,
  strokeWonMeters: 1,
  totalTensionKg: 0,
  reelMaxLoadKg: 1,
  retrieveSpeedMetersPerSec: 0.8,
  releasedLineMeters: 7.1,
  fishDistanceMeters: 7,
  dtSec: 1,
});
approx(noTeleportAutoRecover.recoveredMeters, 0.1, 0.001, "auto recovery cannot recover below fish distance");
const lineTautAutoRecover = new ReelAutoRecoveryCalculator().calculate({
  hasReel: true,
  playerHoldActive: false,
  strokeWonMeters: 1,
  totalTensionKg: 0,
  reelMaxLoadKg: 1,
  retrieveSpeedMetersPerSec: 0.8,
  releasedLineMeters: 7,
  fishDistanceMeters: 7,
  dtSec: 1,
});
assert(lineTautAutoRecover.blockedReason === "line_taut", "taut geometric line blocks auto recovery without reducing stroke");
approx(lineTautAutoRecover.recoveredMeters, 0, 0.001, "taut geometric line recovers no released line");

const autoRecoveryStrokeState = new RodStrokeState();
autoRecoveryStrokeState.setCapacity(1.8);
autoRecoveryStrokeState.addWonDistance(1);
const autoRecoveryLineSystem = {
  releasedMeters: 8,
  getState() {
    return {
      releasedMeters: this.releasedMeters,
      distanceMeters: 7,
    };
  },
  recoverReleasedLine({ meters, minReleasedMeters }) {
    const recovered = Math.min(
      Math.max(0, Number(meters) || 0),
      Math.max(0, this.releasedMeters - minReleasedMeters),
    );
    this.releasedMeters -= recovered;
    return recovered;
  },
};
const autoRecoveryReelSystem = new ReelSystem();
const autoRecoveryResult = autoRecoveryReelSystem.recoverRodStrokeCredit({
  dtSec: 1,
  lineSystem: autoRecoveryLineSystem,
  reel: {
    hasReel: () => true,
    getEffectiveMaxLoadKg: () => 1,
    getRetrieveSpeedMetersPerSec: () => 0.8,
  },
  tensionKg: 0,
  playerHoldActive: false,
  strokeWonMeters: autoRecoveryStrokeState.wonMeters,
  fishDistanceMeters: 7,
});
autoRecoveryStrokeState.recoverWonDistance(autoRecoveryResult.recoveredMeters);
approx(autoRecoveryResult.recoveredMeters, 0.8, 0.001, "auto recovery recovers released line through spool channel");
approx(autoRecoveryLineSystem.releasedMeters, 7.2, 0.001, "auto recovery decreases released line");
approx(autoRecoveryStrokeState.wonMeters, 0.2, 0.001, "auto recovery decreases rod stroke by the same meters");
const dragSlipAutoRecoveryLineSystem = {
  recoverCalled: false,
  getState() {
    return {
      releasedMeters: 8,
      distanceMeters: 7,
    };
  },
  recoverReleasedLine() {
    this.recoverCalled = true;
    return 1;
  },
};
const dragSlipBlockedAutoRecovery = new ReelSystem().recoverRodStrokeCredit({
  dtSec: 1,
  lineSystem: dragSlipAutoRecoveryLineSystem,
  reel: {
    hasReel: () => true,
    getEffectiveMaxLoadKg: () => 1,
    getRetrieveSpeedMetersPerSec: () => 0.8,
  },
  tensionKg: 0.8,
  blockedReason: "raw_load_above_drag_limit",
  playerHoldActive: false,
  strokeWonMeters: 1,
  fishDistanceMeters: 7,
});
assert(!dragSlipBlockedAutoRecovery.active, "drag slip blocks auto recovery");
assert(dragSlipBlockedAutoRecovery.blockedReason === "raw_load_above_drag_limit", "auto recovery reports drag slip block");
approx(dragSlipBlockedAutoRecovery.recoveredMeters, 0, 0.001, "drag slip recovers no stroke credit");
assert(!dragSlipAutoRecoveryLineSystem.recoverCalled, "drag slip block does not touch released line recovery");

const reelHold = new ReelHoldRecoverySystem().update({
  dtMs: 1000,
  config: { enabled: true, requireRodStrokeFull: true, delayMs: 0, strokeRatio: 1 },
  hasReel: true,
  playerHoldActive: true,
  rodPullActive: true,
  strokeRatio: 1,
  strokeCapacityMeters: 1.8,
  strokeUnrecoveredMeters: 1.8,
  rawTensionKg: 0.5,
  dragLimitKg: 1,
  dragLocked: false,
  shouldSlipDrag: false,
  reelMaxLoadKg: 1,
  retrieveSpeedMetersPerSecond: 0.8,
  lineRecoverableMeters: 1,
});
assert(reelHold.active, "reel hold activates only as an explicit post-stroke mode");
approx(reelHold.recoverSpeedMetersPerSecond, 0.4, 0.001, "reel hold speed scales from reel load reserve");
approx(reelHold.maxMoveMeters, 0.4, 0.001, "reel hold exposes max movement for the frame");
const blockedReelHold = new ReelHoldRecoverySystem().update({
  dtMs: 1000,
  config: { enabled: true, requireRodStrokeFull: true, delayMs: 0, strokeRatio: 1 },
  hasReel: true,
  playerHoldActive: true,
  rodPullActive: true,
  strokeRatio: 1,
  strokeCapacityMeters: 1.8,
  strokeUnrecoveredMeters: 1.8,
  rawTensionKg: 0.5,
  dragLimitKg: 1,
  dragLocked: false,
  shouldSlipDrag: false,
  reelMaxLoadKg: 1,
  retrieveSpeedMetersPerSecond: 0.8,
  lineRecoverableMeters: 0,
});
assert(!blockedReelHold.active, "reel hold does not move fish without recoverable line");
assert(blockedReelHold.blockedReason === "no_recoverable_line", "reel hold reports missing recoverable line");
const reelHoldStrokeState = new RodStrokeState();
reelHoldStrokeState.setCapacity(1.8);
reelHoldStrokeState.addWonDistance(1);
const strokeBeforeReelHold = reelHoldStrokeState.wonMeters;
const reelHoldLineSystem = {
  recoveredMeters: 0,
  recoverLineCredit({ maxRecoverMeters }) {
    this.recoveredMeters = Math.max(0, Number(maxRecoverMeters) || 0);
    return this.recoveredMeters;
  },
};
const reelHoldRecoveredMeters = new ReelSystem().recoverLineCredit({
  dtSec: 1,
  lineSystem: reelHoldLineSystem,
  reel: {
    hasReel: () => true,
    getEffectiveMaxLoadKg: () => 1,
    getRetrieveSpeedMetersPerSec: () => 0.8,
  },
  tensionKg: 0,
  inputRecover: true,
  maxRecoverMeters: 0.25,
});
approx(reelHoldRecoveredMeters, 0.25, 0.001, "reel hold recovers released line through line channel");
approx(reelHoldStrokeState.wonMeters, strokeBeforeReelHold, 0.001, "reel hold does not mutate rod stroke");

const cappedHoldResult = new FishRetrieveResult({
  fishTensionKg: 0.035,
  playerHoldTensionKg: 0.035,
  rawPlayerHoldTensionKg: 1,
  totalTensionKg: 0.07,
  movableHoldTensionCapApplied: true,
  fishCanMoveTowardPlayer: true,
});
const strokeFullMovementBlock = cappedHoldResult.withAppliedMovement({
  appliedMoveMeters: 0,
  movementBlocked: true,
});
approx(strokeFullMovementBlock.playerHoldTensionKg, 0.035, 0.001, "stroke-full movement block keeps movable hold cap");
approx(strokeFullMovementBlock.totalTensionKg, 0.07, 0.001, "stroke-full movement block does not promote raw hold tension");
assert(strokeFullMovementBlock.movableHoldTensionCapApplied, "stroke-full movement block keeps cap applied");
assert(!strokeFullMovementBlock.tensionBlocked, "stroke-full movement block is not a hard tension block");
const hardBlockedHold = cappedHoldResult.withAppliedMovement({
  appliedMoveMeters: 0,
  movementBlocked: true,
  hardTensionBlocked: true,
});
approx(hardBlockedHold.playerHoldTensionKg, 1, 0.001, "hard tension block promotes raw hold tension");
assert(!hardBlockedHold.movableHoldTensionCapApplied, "hard tension block disables movable hold cap");

const simple = new FishRetrieveSystem(physicsAdapter).calculate({
  dtSec: 1,
  rodPullResult: {
    active: true,
    ratio: 1,
    forceKg: 1.2,
    rodLimitKg: 3,
    holdTensionRatio: 0.5,
  },
  forceData: {
    fishWeightKg: 2.5,
    fishBasePower: 1.2,
    fishBaseSpeed: 0.8,
    fishStateForceMultiplier: 1,
    fishStateSpeedMultiplier: 0.8,
    directionResistanceMultiplier: 1,
  },
  movementBlocked: false,
});
approx(simple.fishPassiveKg, 0.6, 0.001, "FishRetrieveSystem uses simplified passive force");
approx(simple.fishOppositionKg, 1.2, 0.001, "FishRetrieveSystem uses passive + active force");
approx(simple.playerHoldTensionKg, 0.6, 0.001, "hold tension ratio passes through simplified model");
assert(simple.towardPlayerSpeedMps === 0, "equal hold and opposition stays balanced");

const lateralControl = new RodLateralControlSystem();
const lateralConfig = {
  enabled: true,
  pixelsPerMeter: 50,
  alignment: {
    minInitialOffsetPx: 12,
    alignedThresholdPx: 8,
    maxEffectiveAngleDeg: 45,
    allowAwayDirection: false,
  },
  force: {
    maxForceKg: 0.4,
    sideMovePxPerSecond: 50,
    fishWeightResistanceMultiplier: 0,
  },
  tension: {
    sameDirectionMultiplier: 0,
    sideMultiplier: 1,
    oppositeDirectionMultiplier: 2.5,
  },
};
const lateralFrame = lateralControl.update({
  dtSec: 1,
  inputState: {
    rodControlActive: true,
    rodControlDirectionX: 1,
    rodControlInputRatio: 1,
  },
  fishPosition: { x: -100, y: 100 },
  rodTipPosition: { x: 0, y: 0 },
  rodLimitKg: 3,
  maxTackleLoadKg: 3,
  fishTensionKg: 0.5,
  fishVelocityX: -20,
  fishWeightKg: 0,
  config: lateralConfig,
});
assert(lateralFrame.canApply, "Rod Control X applies with active horizontal input");
approx(lateralFrame.towardRodDirectionX, 1, 0.001, "Rod Control X resolves direction toward rod alignment");
approx(lateralFrame.tensionMultiplier, 2.5, 0.001, "Rod Control X uses opposite-direction tension multiplier");
approx(lateralFrame.forceKg, 0.4, 0.001, "Rod Control X force follows configured max force");
approx(lateralFrame.alignmentProgress, 0, 0.001, "Rod Control X starts with zero alignment progress");
approx(lateralFrame.desiredMoveMeters, 1, 0.001, "Rod Control X movement follows angle-based side speed");
assert(lateralFrame.desiredMovePx > 0, "Rod Control X emits lateral pixel movement");
const lateralApplied = lateralControl.recordAppliedMovement({
  movedMeters: 0.5,
  movedPx: 25,
  currentFishX: -50,
  rodX: 0,
});
approx(lateralApplied.alignmentProgress, 0.5, 0.001, "Rod Control X reports alignment progress from offset reduction");

const lateralWrongDirection = new RodLateralControlSystem().update({
  dtSec: 1,
  inputState: {
    rodControlActive: true,
    rodControlDirectionX: -1,
    rodControlInputRatio: 1,
  },
  fishPosition: { x: -100, y: 100 },
  rodTipPosition: { x: 0, y: 0 },
  rodLimitKg: 3,
  maxTackleLoadKg: 3,
  fishTensionKg: 0,
  fishVelocityX: 0,
  fishWeightKg: 0,
  config: lateralConfig,
});
assert(!lateralWrongDirection.canApply, "Rod Control X blocks input away from rod alignment");
assert(lateralWrongDirection.blockedReason === "wrong_direction", "Rod Control X reports wrong-direction block reason");

const lateralAligned = new RodLateralControlSystem().update({
  dtSec: 1,
  inputState: {
    rodControlActive: true,
    rodControlDirectionX: 1,
    rodControlInputRatio: 1,
  },
  fishPosition: { x: -4, y: 100 },
  rodTipPosition: { x: 0, y: 0 },
  rodLimitKg: 3,
  maxTackleLoadKg: 3,
  fishTensionKg: 0,
  fishVelocityX: 0,
  fishWeightKg: 0,
  config: lateralConfig,
});
assert(!lateralAligned.canApply, "Rod Control X stops when fish is aligned with rod X");
assert(lateralAligned.blockedReason === "aligned", "Rod Control X reports aligned block reason");
approx(lateralAligned.alignmentProgress, 1, 0.001, "Rod Control X treats threshold offset as full alignment");

const pullSmoother = new PlayerPullMotionSmoother();
const smoothStart = pullSmoother.updateAxis({
  axis: "y",
  desiredMove: 1,
  deltaTime: 0.016,
  config: { inertiaSeconds: 0.16 },
});
assert(smoothStart.move > 0 && smoothStart.move < 1, "Player pull motion smoother eases in below raw move");
const smoothStop = pullSmoother.updateAxis({
  axis: "y",
  desiredMove: 0,
  deltaTime: 0.016,
  config: { inertiaSeconds: 0.16 },
});
assert(smoothStop.move > 0, "Player pull motion smoother keeps small stop inertia");
pullSmoother.reset();
const smoothBypass = pullSmoother.updateAxis({
  axis: "y",
  desiredMove: 1,
  deltaTime: 0.016,
  config: { inertiaSeconds: 0 },
});
approx(smoothBypass.move, 1, 0.001, "Player pull motion smoother bypasses when inertia is zero");

console.log("rod-pull-systems-check passed:");
for (const message of checks) console.log("- " + message);
`, context);
