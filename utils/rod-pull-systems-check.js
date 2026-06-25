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
  "src/core/fishing/reel_retrieve_speed_calculator.js",
  "src/entities/tackle.js",
  "src/input/pull_input_mapper.js",
  "src/core/line/line_spool_state.js",
  "src/core/fishing/rod_pull_state.js",
  "src/core/fishing/rod_stroke_state.js",
  "src/core/fishing/reel_hold_load_policy.js",
  "src/core/fishing/rod_stroke_tracker.js",
  "src/core/fishing/rod_stroke_distance_tracker.js",
  "src/core/fishing/player_force_budget_allocator.js",
  "src/core/fishing/reel_auto_recovery_calculator.js",
  "src/core/fishing/reel_hold_recovery_system.js",
  "src/core/fishing/reel_recovery_fish_slowdown_policy.js",
  "src/core/fishing/slack_calculator.js",
  "src/core/fishing/rod_pull_calculator.js",
  "src/core/fishing/retrieve_policy.js",
  "src/core/fishing/landing_policy.js",
  "src/core/fishing/fish_retrieve_result.js",
  "src/core/fishing/simple_fight_force_calculator.js",
  "src/core/fishing/fish_fight_direction_resolver.js",
  "src/core/fishing/drag_force_calculator.js",
  "src/core/fishing/landing_lift_tension_calculator.js",
  "src/core/fishing/landing_lift_readiness_policy.js",
  "src/core/fishing/line_tension_calculator.js",
  "src/core/fishing/line_constraint_state_resolver.js",
  "src/core/fishing/line_constrained_fish_motion_resolver.js",
  "src/core/fishing/line_radial_movement_splitter.js",
  "src/core/fishing/rod_control_movement_projector.js",
  "src/core/fishing/tackle_failure_selector.js",
  "src/core/fishing/tackle_stress_accumulator.js",
  "src/systems/player_pull_motion_smoother.js",
  "src/systems/rod_pull_system.js",
  "src/core/fishing/rod_control_tension_mode_resolver.js",
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
approx(rodPullConfig.tensionCeilingMultiplier, 1.05, 0.001, "Rod Hold gameplay ceiling is configurable");
approx(physicsAdapter.getRodControlConfig().tensionCeilingMultiplier, 1.15, 0.001, "Rod Control gameplay ceiling is configurable");
approx(physicsAdapter.getReelConfig().bearingRetrieveSpeedBonusMetersPerSec, 0.2, 0.001, "reel bearing retrieve speed bonus is configurable");

const bearingReel = new Reel(1, 1, {
  retrieveSpeedMetersPerSec: 0.8,
  bearingCount: 3,
  bearingRetrieveSpeedBonusMetersPerSec: 0.2,
});
approx(bearingReel.getBaseRetrieveSpeedMetersPerSec(), 0.8, 0.001, "reel keeps base retrieve speed");
approx(bearingReel.getBearingCount(), 3, 0.001, "reel stores bearing count");
approx(bearingReel.getRetrieveSpeedMetersPerSec(), 1.4, 0.001, "reel bearings increase retrieve speed");

const recoverySlowdownPolicy = new ReelRecoveryFishSlowdownPolicy();
const recoverySlowdownState = recoverySlowdownPolicy.createState();
recoverySlowdownPolicy.update({
  target: recoverySlowdownState,
  autoRecoveredMeters: 0.2,
  holdRecoveredMeters: 0,
  config: physicsAdapter.getReelRecoveryConfig(),
});
assert(recoverySlowdownState.active, "reel recovery slowdown activates when line is recovered");
approx(recoverySlowdownState.multiplier, 0.5, 0.001, "reel recovery slowdown uses configured fish speed multiplier");
assert(recoverySlowdownState.source === "auto_recovery", "reel recovery slowdown tracks auto recovery source");
approx(recoverySlowdownPolicy.getMotionMultiplier(recoverySlowdownState), 0.5, 0.001, "reel recovery slowdown exposes motion multiplier");
recoverySlowdownPolicy.update({
  target: recoverySlowdownState,
  autoRecoveredMeters: 0,
  holdRecoveredMeters: 0,
  config: physicsAdapter.getReelRecoveryConfig(),
});
assert(!recoverySlowdownState.active, "reel recovery slowdown resets without recovered line");
approx(recoverySlowdownPolicy.getMotionMultiplier(recoverySlowdownState), 1, 0.001, "inactive reel recovery keeps full fish speed");

const retrievePolicyResolver = new IdleRetrievePolicyResolver();
const poleIdleParams = retrievePolicyResolver.resolve({ rod: { hasReel: false }, reel: null }).getRetrieveParams({ config: CONFIG });
approx(poleIdleParams.targetSpeedPxPerSec, poleIdleRetrieveConfig.speedMetersPerSecond * pixelsPerMeter, 0.001, "pole idle retrieve keeps dedicated policy");

const spool = new LineSpoolState({ totalLineMeters: 20 });
approx(spool.release(25), 20, 0.001, "line spool releases the full 20m without rod-length subtraction");
approx(spool.releasedLineMeters, 20, 0.001, "line spool total usable line equals equipped line length");
approx(spool.remainingLineMeters, 0, 0.001, "line spool reserve reaches zero only after full line release");
approx(spool.recover(5, 18), 2, 0.001, "line spool recovery cannot shorten line below fish distance");

const strokeState = new RodStrokeState();
strokeState.setCapacity(1.8);
approx(strokeState.addWonDistance(1), 1, 0.001, "rod stroke stores won line distance");
approx(strokeState.loseWonDistance(0), 0, 0.001, "zero line-distance loss does not reduce stroke");
approx(strokeState.wonMeters, 1, 0.001, "stable line distance leaves stroke won unchanged");
approx(strokeState.loseWonDistance(0.25), 0.25, 0.001, "line-distance loss reduces won stroke during hold");
approx(strokeState.wonMeters, 0.75, 0.001, "rod stroke keeps remaining won line distance");

const calculator = new RodPullCalculator({
  ...rodPullConfig,
  tensionCeilingMultiplier: 1,
  capacityByRodLengthRatio: 1,
  distanceMultiplierByRodLength: 1,
});
approx(calculator.calculateStrokeCapacity({ rodLengthMeters: 3.6 }), 3.6, 0.001, "full rod stroke equals rod length when multiplier is 1");
approx(calculator.calculateAvailableDistance({ rodLengthMeters: 3.6, slackMeters: 2 }), 3.6, 0.001, "deprecated pump credit API no longer reduces rod stroke availability");

const forceLimit = calculator.calculateForceLimit({ rodLimitKg: 3, fishTensionKg: 1.1 });
approx(forceLimit.rodHoldMaxKg, 1.9, 0.001, "rodHoldMax = rodLimit - fishTension");
approx(forceLimit.controlledPullLimitKg, 1.9, 0.001, "rod hold force is not clamped by line limit here");
const openDragBudgetLimit = calculator.calculateForceLimit({
  rodLimitKg: 3,
  fishTensionKg: 1.1,
  rodHoldMaxKg: 1.9,
  dragLimitKg: 0,
  dragLocked: false,
  lineHasReserve: true,
  hardLineLimit: false,
});
approx(openDragBudgetLimit.controlledPullLimitKg, 0, 0.001, "open drag blocks external Rod Hold budget transfer");
approx(openDragBudgetLimit.rodHoldMaxKg, 1.9, 0.001, "open drag preserves potential Rod Hold budget");
assert(openDragBudgetLimit.dragSlipping, "open drag marks external Rod Hold budget as slipping");
assert(
  openDragBudgetLimit.blockedReason === "drag_open_no_force_transfer",
  "open drag reports blocked external Rod Hold transfer",
);
const hardLimitBudget = calculator.calculateForceLimit({
  rodLimitKg: 3,
  fishTensionKg: 1.1,
  rodHoldMaxKg: 1.9,
  dragLimitKg: 0,
  dragLocked: false,
  lineHasReserve: false,
  hardLineLimit: true,
});
approx(hardLimitBudget.controlledPullLimitKg, 1.9, 0.001, "hard line bypasses drag gate for external Rod Hold budget");
const overloadForceLimit = new RodPullCalculator({
  tensionCeilingMultiplier: 1.1,
}).calculateForceLimit({
  rodLimitKg: 1,
  fishTensionKg: 0.76,
});
approx(overloadForceLimit.tensionCeilingKg, 1.1, 0.001, "Rod Hold ceiling scales from rod load");
approx(overloadForceLimit.rodHoldMaxKg, 0.34, 0.001, "Rod Hold can use only the reserve below its overload ceiling");

const rodPullSystem = new RodPullSystem({
  ...rodPullConfig,
  tensionCeilingMultiplier: 1,
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
  tensionCeilingMultiplier: 1,
  pixelsPerMeter: 50,
  alignment: {
    enabled: true,
    maxEffectiveAngleDeg: 45,
    alignedThresholdPx: 0,
    centerStartThresholdPx: 0.5,
  },
  force: {
    maxForceKg: 0.4,
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
};
const lateralFrame = lateralControl.update({
  dtSec: 1,
  inputState: {
    rodControlActive: true,
    rodControlDirectionX: 1,
    rodControlInputRatio: 1,
  },
  fishPosition: { x: -50, y: 50 },
  rodTipPosition: { x: 0, y: 0 },
  actualRodTipPosition: { x: 0, y: 0 },
  rodLimitKg: 3,
  maxTackleLoadKg: 3,
  fishTensionKg: 0.5,
  fishVelocityX: -20,
  fishWeightKg: 0,
  config: lateralConfig,
});
assert(lateralFrame.canApply, "Rod Control X applies when input pulls fish toward rod X");
approx(lateralFrame.directionX, 1, 0.001, "Rod Control X moves toward the rod target");
approx(lateralFrame.tensionMultiplier, 2.5, 0.001, "Rod Control X uses opposite-direction tension multiplier");
assert(lateralFrame.tensionMode === "opposite_direction", "Rod Control X exposes opposite tension mode");
approx(lateralFrame.fishControlAxisVelocityPxPerSecond, -20, 0.001, "Rod Control X exposes signed fish projection");
approx(lateralFrame.forceKg, 0.4, 0.001, "Rod Control X force follows configured max force");
approx(lateralFrame.maxPullSpeedMetersPerSecond, 1.28, 0.001, "Rod Control X speed derives from delivered force");
approx(lateralFrame.desiredMoveMeters, 1, 0.001, "Rod Control X movement is clamped to rod target distance");
assert(lateralFrame.desiredMovePx > 0, "Rod Control X emits lateral pixel movement");
const lateralApplied = lateralControl.recordAppliedMovement({
  movedMeters: 0.5,
  movedPx: 25,
});
approx(lateralApplied.deliveredForceRatio, 1, 0.001, "Applied movement does not reduce delivered Rod Control force");
approx(lateralApplied.forceKg, 0.4, 0.001, "Applied movement does not reduce Rod Control force");
assert(lateralApplied.actualMovementRatio > 0 && lateralApplied.actualMovementRatio < 1, "Actual movement ratio stays separate from delivered force");

const blockedApplied = new RodLateralControlSystem();
const blockedAppliedFrame = blockedApplied.update({
  dtSec: 1,
  inputState: {
    rodControlActive: true,
    rodControlDirectionX: 1,
    rodControlInputRatio: 0.8,
  },
  fishPosition: { x: -50, y: 50 },
  rodTipPosition: { x: 0, y: 0 },
  actualRodTipPosition: { x: 0, y: 0 },
  rodLimitKg: 3,
  maxTackleLoadKg: 3,
  fishTensionKg: 0,
  fishVelocityX: 0,
  fishWeightKg: 0,
  config: lateralConfig,
});
blockedApplied.recordAppliedMovement({ movedMeters: 0, movedPx: 0 });
approx(blockedAppliedFrame.deliveredForceRatio, 0.8, 0.001, "Zero applied movement does not mutate delivered force");
approx(blockedAppliedFrame.actualMovementRatio, 0, 0.001, "Zero applied movement is reported separately");

const lateralLeft = new RodLateralControlSystem().update({
  dtSec: 1,
  inputState: {
    rodControlActive: true,
    rodControlDirectionX: -1,
    rodControlInputRatio: 0.5,
  },
  fishPosition: { x: 50, y: 50 },
  rodTipPosition: { x: 0, y: 0 },
  actualRodTipPosition: { x: 0, y: 0 },
  rodLimitKg: 3,
  maxTackleLoadKg: 3,
  fishTensionKg: 0,
  fishVelocityX: -20,
  fishWeightKg: 0,
  config: lateralConfig,
});
assert(lateralLeft.canApply, "Rod Control X accepts left input when fish is right of rod");
approx(lateralLeft.directionX, -1, 0.001, "Left input pulls the right-side fish toward rod target");
approx(lateralLeft.requestedForceRatio, 0.5, 0.001, "Input ratio exposes requested force");
approx(lateralLeft.deliveredForceRatio, 0.5, 0.001, "Delivered force follows requested force with full reserve");
approx(lateralLeft.tensionMultiplier, 0, 0.001, "Same-direction fish movement uses zero tension multiplier");
assert(lateralLeft.tensionMode === "same_direction", "Same-direction fish exposes matching tension mode");

const lateralNoReserve = new RodLateralControlSystem().update({
  dtSec: 1,
  inputState: {
    rodControlActive: true,
    rodControlDirectionX: 1,
    rodControlInputRatio: 1,
  },
  fishPosition: { x: -50, y: 50 },
  rodTipPosition: { x: 0, y: 0 },
  actualRodTipPosition: { x: 0, y: 0 },
  rodLimitKg: 0.4,
  maxTackleLoadKg: 0.4,
  currentTensionKg: 0.4,
  fishVelocityX: 0,
  fishWeightKg: 0,
  config: lateralConfig,
});
assert(!lateralNoReserve.canApply, "Rod Control X blocks without load reserve");
assert(lateralNoReserve.blockedReason === "no_load_reserve", "Rod Control X reports load reserve block");

const dragLimitedLateral = new RodLateralControlSystem().update({
  dtSec: 1,
  inputState: {
    rodControlActive: true,
    rodControlDirectionX: 1,
    rodControlInputRatio: 1,
  },
  fishPosition: { x: -50, y: 50 },
  rodTipPosition: { x: 0, y: 0 },
  actualRodTipPosition: { x: 0, y: 0 },
  rodLimitKg: 1,
  maxTackleLoadKg: 1,
  currentTensionKg: 0.6,
  fishVelocityX: -20,
  fishWeightKg: 0,
  dragLimitKg: 0.6,
  dragLocked: false,
  lineHasReserve: true,
  hardLineLimit: false,
  config: lateralConfig,
});
assert(dragLimitedLateral.canSlipDrag, "Rod Control detects available drag slip");
assert(dragLimitedLateral.dragLimited, "Rod Control reports drag-limited force");
approx(dragLimitedLateral.dragReserveKg, 0, 0.001, "Full drag load leaves no lateral tension reserve");
approx(dragLimitedLateral.playerTensionKg, 0, 0.001, "Rod Control adds no tension above active drag limit");
assert(!dragLimitedLateral.canApply, "Rod Control fish movement stops when drag reserve is exhausted");
assert(dragLimitedLateral.blockedReason === "drag_limit_reached", "Rod Control reports exhausted drag reserve");

const externalBudgetOpenDragLateral = new RodLateralControlSystem().update({
  dtSec: 1,
  inputState: {
    rodControlActive: true,
    rodControlDirectionX: 1,
    rodControlInputRatio: 1,
  },
  fishPosition: { x: -50, y: 50 },
  rodTipPosition: { x: 0, y: 0 },
  actualRodTipPosition: { x: 0, y: 0 },
  rodLimitKg: 1,
  maxTackleLoadKg: 1,
  currentTensionKg: 0,
  fishVelocityX: -20,
  fishWeightKg: 0,
  playerForceBudget: {
    enabled: true,
    controlBudgetKg: 0.5,
    controlShare: 0.5,
    combinedCeilingMultiplier: 1.1,
    combinedTensionCeilingKg: 1.1,
  },
  dragLimitKg: 0,
  dragLocked: false,
  lineHasReserve: true,
  hardLineLimit: false,
  config: lateralConfig,
});
assert(externalBudgetOpenDragLateral.playerForceBudgetEnabled, "Rod Control recognizes external player budget");
approx(externalBudgetOpenDragLateral.loadReserveKg, 0.5, 0.001, "Rod Control preserves potential external budget");
approx(externalBudgetOpenDragLateral.dragReserveKg, 0, 0.001, "open drag exposes zero transferable control reserve");
approx(externalBudgetOpenDragLateral.playerTensionKg, 0, 0.001, "open drag blocks external Rod Control tension");
assert(!externalBudgetOpenDragLateral.canApply, "open drag blocks external Rod Control movement");
assert(
  externalBudgetOpenDragLateral.blockedReason === "drag_limit_reached",
  "open drag reports blocked external Rod Control transfer",
);

const partialDragReserve = new RodLateralControlSystem().update({
  dtSec: 1,
  inputState: {
    rodControlActive: true,
    rodControlDirectionX: 1,
    rodControlInputRatio: 1,
  },
  fishPosition: { x: -50, y: 50 },
  rodTipPosition: { x: 0, y: 0 },
  actualRodTipPosition: { x: 0, y: 0 },
  rodLimitKg: 1,
  maxTackleLoadKg: 1,
  currentTensionKg: 0.5,
  fishVelocityX: -20,
  fishWeightKg: 0,
  dragLimitKg: 0.6,
  dragLocked: false,
  lineHasReserve: true,
  hardLineLimit: false,
  config: lateralConfig,
});
approx(partialDragReserve.dragReserveKg, 0.1, 0.001, "Rod Control exposes remaining drag tension reserve");
approx(partialDragReserve.effectiveForceLimitKg, 0.04, 0.001, "Opposite-direction multiplier is included in force limit");
approx(partialDragReserve.playerTensionKg, 0.1, 0.001, "Lateral tension stays inside drag reserve");

const hardLineLateral = new RodLateralControlSystem().update({
  dtSec: 1,
  inputState: {
    rodControlActive: true,
    rodControlDirectionX: 1,
    rodControlInputRatio: 1,
  },
  fishPosition: { x: -50, y: 50 },
  rodTipPosition: { x: 0, y: 0 },
  actualRodTipPosition: { x: 0, y: 0 },
  rodLimitKg: 1,
  maxTackleLoadKg: 1,
  currentTensionKg: 0.6,
  fishVelocityX: -20,
  fishWeightKg: 0,
  dragLimitKg: 0.6,
  dragLocked: false,
  lineHasReserve: false,
  hardLineLimit: true,
  config: lateralConfig,
});
assert(!hardLineLateral.canSlipDrag, "Fully extended line disables Rod Control drag protection");
assert(hardLineLateral.playerTensionKg > 0, "Rod Control can add stress at hard line limit");

const overloadLateralConfig = {
  ...lateralConfig,
  tensionCeilingMultiplier: 1.15,
};
const overloadLateral = new RodLateralControlSystem().update({
  dtSec: 1,
  inputState: {
    rodControlActive: true,
    rodControlDirectionX: 1,
    rodControlInputRatio: 1,
  },
  fishPosition: { x: -50, y: 50 },
  rodTipPosition: { x: 0, y: 0 },
  actualRodTipPosition: { x: 0, y: 0 },
  rodLimitKg: 1,
  maxTackleLoadKg: 1,
  currentTensionKg: 1,
  fishVelocityX: -20,
  fishWeightKg: 0,
  dragLocked: true,
  config: overloadLateralConfig,
});
approx(overloadLateral.tensionCeilingKg, 1.15, 0.001, "Rod Control ceiling scales from rod load");
approx(overloadLateral.loadReserveKg, 0.15, 0.001, "Rod Control receives only current-frame overload reserve");
approx(overloadLateral.playerTensionKg, 0.15, 0.001, "Opposite-direction tension reaches but does not exceed Rod Control ceiling");

const stackedCeilingBlocked = new RodLateralControlSystem().update({
  dtSec: 1,
  inputState: {
    rodControlActive: true,
    rodControlDirectionX: 1,
    rodControlInputRatio: 1,
  },
  fishPosition: { x: -50, y: 50 },
  rodTipPosition: { x: 0, y: 0 },
  actualRodTipPosition: { x: 0, y: 0 },
  rodLimitKg: 1,
  maxTackleLoadKg: 1,
  currentTensionKg: 1.15,
  fishVelocityX: -20,
  fishWeightKg: 0,
  dragLocked: true,
  config: overloadLateralConfig,
});
approx(stackedCeilingBlocked.loadReserveKg, 0, 0.001, "Rod Control overload budget does not stack above its ceiling");
approx(stackedCeilingBlocked.playerTensionKg, 0, 0.001, "Rod Control adds no tension after another action fills its ceiling");
assert(stackedCeilingBlocked.blockedReason === "no_load_reserve", "Rod Control reports exhausted overload reserve");

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
pullSmoother.updateAxis({
  axis: "x",
  desiredMove: 1,
  deltaTime: 0.016,
  config: { inertiaSeconds: 0.16 },
});
pullSmoother.resetAxis("x");
approx(
  pullSmoother.getDebugData().velocityX,
  0,
  0.001,
  "Player pull motion smoother can stop only the lateral axis",
);

console.log("rod-pull-systems-check passed:");
for (const message of checks) console.log("- " + message);
`, context);
