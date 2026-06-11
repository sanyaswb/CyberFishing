const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const FILES = [
  "src/core/core.js",
  "src/core/casting_distance.js",
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
  "src/core/fishing/simple_fight_force_calculator.js",
  "src/core/fishing/hold_opposition_resolver.js",
  "src/core/fishing/fish_direction_intent_sampler.js",
  "src/core/fishing/fish_fight_direction_resolver.js",
  "src/core/fishing/drag_force_calculator.js",
  "src/core/fishing/line_radial_movement_splitter.js",
  "src/core/fishing/landing_lift_tension_calculator.js",
  "src/core/fishing/line_tension_calculator.js",
  "src/core/fishing/rod_pull_state.js",
  "src/core/fishing/rod_stroke_state.js",
  "src/core/fishing/rod_pull_calculator.js",
  "src/core/fishing/fish_retrieve_result.js",
  "src/entities/tackle.js",
  "src/entities/fish.js",
  "src/systems/fight_physics_pipeline.js",
  "src/systems/fish_retrieve_system.js",
  "src/systems/tension_system.js",
];

const context = vm.createContext({ console, Math, Number, Object, window: { innerWidth: 1280, innerHeight: 720 } });
for (const file of FILES) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), context, { filename: file });
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

const forbiddenFishKeys = [
  "resistanceProfile", "retrieveProfile", "minPowerRatio", "maxSpeedMetersPerSec",
  "speedForceMultiplier", "waterResistanceMultiplier", "pullResistance",
];
for (const fish of FISH_DB) {
  const physics = fish.physics || {};
  assert(!!physics.forceProfile, fish.id + " has forceProfile");
  assert(!!physics.staminaProfile, fish.id + " has staminaProfile");
  assert(!!physics.movementProfile, fish.id + " has movementProfile");
  assert(
    Array.isArray(physics.movementProfile.radialRange),
    fish.id + " has movementProfile.radialRange",
  );
  assert(
    Array.isArray(physics.movementProfile.lateralRange),
    fish.id + " has movementProfile.lateralRange",
  );
  assert(!!physics.behaviorProfile?.behaviors, fish.id + " has behaviorProfile.behaviors");
  for (const key of forbiddenFishKeys) {
    assert(!(key in physics), fish.id + " does not store old " + key);
  }
  for (const [stateName, state] of Object.entries(physics.behaviorProfile.behaviors)) {
    assert(!("powerRatio" in state), fish.id + "." + stateName + " uses no old powerRatio");
    assert(!("speedRatio" in state), fish.id + "." + stateName + " uses no old speedRatio");
    assert(Number.isFinite(Number(state.forceMultiplier)), fish.id + "." + stateName + " has forceMultiplier");
    assert(Number.isFinite(Number(state.speedMultiplier)), fish.id + "." + stateName + " has speedMultiplier");
  }
}

const calc = new SimpleFightForceCalculator();
const smallFish = calc.calculate({
  fishWeightKg: 0.2,
  fishBasePower: 1,
  fishBaseSpeed: 1,
  fishStateForceMultiplier: 1,
  fishStateSpeedMultiplier: 1,
  directionMultiplier: 2.5,
  tautBodyResistancePerKg: 0.2,
  rodLimitKg: 3,
  rodHoldKg: 2,
  rodAngleMultiplier: 1,
  holdTensionRatio: 1,
  movableHoldTensionCapRatio: 1,
  fishCanMoveTowardPlayer: true,
  waterMotionResistance: 1000,
  waterSpeedMultiplier: 64,
});
approx(smallFish.fishPassiveKg, 0.04, 0.0001, "small fish passive force is water weight");
approx(smallFish.fishActiveKg, 0.1, 0.0001, "active force uses state and direction");
approx(smallFish.movableHoldTensionCapKg, 0.14, 0.0001, "movable cap uses fish opposition");
approx(smallFish.playerHoldTensionKg, 0.14, 0.0001, "movable fish caps hold tension by opposition");
assert(smallFish.netForceKg > 0, "full rod hold still works against fish");
assert(smallFish.speedMps > 0, "excess hold becomes speed");

const blockedFish = calc.calculate({
  fishWeightKg: 0.2,
  fishBasePower: 1,
  fishStateForceMultiplier: 1,
  directionMultiplier: 2.5,
  tautBodyResistancePerKg: 0.2,
  rodLimitKg: 3,
  rodHoldKg: 2,
  holdTensionRatio: 1,
  movableHoldTensionCapRatio: 1,
  fishCanMoveTowardPlayer: false,
});
approx(blockedFish.playerHoldTensionKg, 2, 0.0001, "blocked fish receives full hold tension");

const oppositionCapNoClamp = calc.calculate({
  fishWeightKg: 0.8,
  fishBasePower: 0.5,
  fishBaseSpeed: 2,
  fishStateForceMultiplier: 1,
  fishStateSpeedMultiplier: 1,
  directionMultiplier: 2.5,
  tautBodyResistancePerKg: 0.2,
  rodLimitKg: 3,
  rodHoldKg: 0.4,
  rodAngleMultiplier: 1,
  holdTensionRatio: 0.5,
  movableHoldTensionCapRatio: 1,
  fishCanMoveTowardPlayer: true,
  waterMotionResistance: 1000,
  waterSpeedMultiplier: 64,
});
approx(oppositionCapNoClamp.fishPassiveKg, 0.08, 0.0001, "opposition cap test passive force");
approx(oppositionCapNoClamp.fishActiveKg, 0.2, 0.0001, "opposition cap test active force");
approx(oppositionCapNoClamp.fishOppositionKg, 0.28, 0.0001, "opposition cap test opposition");
approx(oppositionCapNoClamp.rawPlayerHoldTensionKg, 0.2, 0.0001, "opposition cap test raw hold tension");
approx(oppositionCapNoClamp.movableHoldTensionCapKg, 0.28, 0.0001, "opposition cap scales from full fish opposition");
approx(oppositionCapNoClamp.playerHoldTensionKg, 0.2, 0.0001, "opposition cap allows active fish to transfer hold tension");
approx(oppositionCapNoClamp.totalTensionKg, 0.48, 0.0001, "opposition cap total tension keeps fish plus player tension");

const lastDashBehavior = new FishBehavior({
  lastDashTrigger: {
    enabled: true,
    targetState: "lastDash",
    chance: 1,
    checkIntervalMs: 1,
    catchZoneMultiplier: 3,
  },
  behaviorProfile: {
    behaviors: {
      swim: {
        forceMultiplier: 1,
        speedMultiplier: 1,
        minTime: 1000,
        maxTime: 1000,
        weight: 1,
      },
      lastDash: {
        enabled: true,
        forceMultiplier: 1,
        speedMultiplier: 1,
        minTime: 1000,
        maxTime: 1000,
        weight: 0,
      },
    },
  },
}, { next: () => 0, range: (min) => min });
const radialOnlyLastDash = lastDashBehavior.evaluateLastDashTrigger({
  dtMs: 1000,
  landingDistanceMeters: 1,
  lineDistanceMeters: 0.5,
  horizontalDistanceMeters: 5,
});
assert(!radialOnlyLastDash.inZone, "lastDash ignores radial/circular distance outside horizontal zone");
assert(radialOnlyLastDash.zoneShape === "horizontal", "lastDash defaults to horizontal zone");
const horizontalLastDash = lastDashBehavior.evaluateLastDashTrigger({
  dtMs: 1000,
  landingDistanceMeters: 1,
  lineDistanceMeters: 10,
  horizontalDistanceMeters: 2,
});
assert(horizontalLastDash.inZone, "lastDash triggers from horizontal distance band");
assert(horizontalLastDash.active, "lastDash can activate inside horizontal zone");

const catchZoneBlockedLastDash = new FishBehavior({
  lastDashTrigger: {
    enabled: true,
    targetState: "lastDash",
    chance: 1,
    checkIntervalMs: 1,
    catchZoneMultiplier: 3,
  },
  behaviorProfile: {
    behaviors: {
      swim: {
        forceMultiplier: 1,
        speedMultiplier: 1,
        minTime: 1,
        maxTime: 1,
        weight: 1,
      },
      lastDash: {
        enabled: true,
        forceMultiplier: 2,
        speedMultiplier: 2,
        minTime: 1000,
        maxTime: 1000,
        weight: 1,
      },
    },
  },
}, { next: () => 0, range: (min) => min });
catchZoneBlockedLastDash.handleFightEvent({
  type: FISH_FIGHT_EVENT.CATCH_ZONE_ENTERED,
});
const blockedLastDash = catchZoneBlockedLastDash.evaluateLastDashTrigger({
  dtMs: 1000,
  landingDistanceMeters: 1,
  lineDistanceMeters: 0.5,
  horizontalDistanceMeters: 0.5,
});
assert(blockedLastDash.blockedByCatchZone, "catch zone event blocks lastDash trigger");
assert(!blockedLastDash.active, "lastDash does not activate after catch zone entry");
catchZoneBlockedLastDash.update(10);
assert(
  catchZoneBlockedLastDash.getStateData().name !== "lastDash",
  "catch zone event also excludes lastDash from random behavior selection",
);

const lineTension = new TensionSystem().calculate({
  fishTensionKg: 1.2,
  playerHoldTensionKg: 0.6,
  totalTensionKg: 1.8,
  rodLimitKg: 3,
  lineLimitKg: 2,
  hookLimitKg: 2,
  dragLocked: true,
});
approx(lineTension.totalTensionKg, 1.8, 0.0001, "total tension splits fish + player tension");
approx(lineTension.rodStressRatio, 0.6, 0.0001, "rod stress is separate");
approx(lineTension.lineStressRatio, 0.9, 0.0001, "line stress is separate");
approx(lineTension.hookStressRatio, 0.9, 0.0001, "hook stress is separate");

const dragSlipTension = new TensionSystem().calculate({
  fishTensionKg: 1.2,
  playerHoldTensionKg: 0.6,
  totalTensionKg: 1.8,
  rodLimitKg: 3,
  lineLimitKg: 2,
  hookLimitKg: 2,
  dragLimitKg: 0.5,
  lineHasReserve: true,
  dragLocked: false,
});
approx(dragSlipTension.tensionKg, 0.5, 0.0001, "drag caps final tension when line can slip");
approx(dragSlipTension.rawTotalTensionKg, 1.8, 0.0001, "drag keeps raw total tension for debug");
approx(dragSlipTension.lineStressRatio, 0.25, 0.0001, "drag-capped line stress uses final tension");
assert(dragSlipTension.shouldSlipDrag, "drag slip flag releases line");

const dragForceCalculator = new DragForceCalculator();
const radialMovementSplitter = new LineRadialMovementSplitter();
const holdOppositionResolver = new HoldOppositionResolver();
approx(
  holdOppositionResolver.resolve({
    activeRodHoldKg: 1,
    fishDirectionState: "toward_player",
  }).forceKg,
  0,
  0.0001,
  "rod hold does not oppose fish movement toward player",
);
approx(
  holdOppositionResolver.resolve({
    activeRodHoldKg: 1,
    fishDirectionState: "side",
  }).forceKg,
  0.35,
  0.0001,
  "rod hold partially opposes side movement",
);
approx(
  holdOppositionResolver.resolve({
    activeRodHoldKg: 1,
    fishDirectionState: "away",
  }).forceKg,
  1,
  0.0001,
  "rod hold fully opposes away movement",
);
const towardPlayerForce = dragForceCalculator.calculate({
  fishOppositionKg: 0.28,
  effectiveRodHoldKg: 0,
  yAwayRatio: 0,
  dragRatio: 1,
  dragLimitKg: 1,
  lineHasReserve: false,
  dragLocked: true,
  dragSupported: true,
  targetYSpeedPxPerSec: 42,
});
approx(
  towardPlayerForce.finalYSpeedPxPerSec,
  42,
  0.0001,
  "drag preserves fish Y movement toward player",
);
const openDragForce = dragForceCalculator.calculate({
  fishOppositionKg: 0.28,
  effectiveRodHoldKg: 0,
  yAwayRatio: 1,
  dragRatio: 0,
  dragLimitKg: 0,
  lineHasReserve: true,
  dragLocked: false,
  dragSupported: true,
  targetYSpeedPxPerSec: -107.08,
  waterMotionResistance: 1000,
  waterSpeedMultiplier: 64,
  fishBaseSpeed: 2,
  fishStateSpeedMultiplier: 1,
  pixelsPerMeter: 50,
});
approx(openDragForce.dragBlockedForceKg, 0, 0.0001, "open drag blocks no Y force");
approx(openDragForce.excessYForceKg, 0.28, 0.0001, "open drag lets the full fish-won Y force escape");
approx(openDragForce.yEscapeForceKg, 0.28, 0.0001, "open drag reports the full Y escape force");
const expectedOpenYSpeedPx = dragForceCalculator.speedFromForceKg({
  forceKg: 0.28,
  waterMotionResistance: 1000,
  waterSpeedMultiplier: 64,
  fishBaseSpeed: 2,
  fishStateSpeedMultiplier: 1,
  pixelsPerMeter: 50,
});
approx(openDragForce.finalYSpeedPxPerSec, -expectedOpenYSpeedPx, 0.0001, "open drag keeps base fish-won Y speed");
assert(!openDragForce.shouldSlipDrag, "open drag has no threshold to exceed");

const belowThresholdDragForce = dragForceCalculator.calculate({
  fishOppositionKg: 0.28,
  effectiveRodHoldKg: 0,
  yAwayRatio: 1,
  dragRatio: 0.3,
  dragLimitKg: 0.3,
  lineHasReserve: true,
  dragLocked: false,
  dragSupported: true,
  targetYSpeedPxPerSec: -107.08,
  waterMotionResistance: 1000,
  waterSpeedMultiplier: 64,
  fishBaseSpeed: 2,
  fishStateSpeedMultiplier: 1,
  pixelsPerMeter: 50,
});
approx(belowThresholdDragForce.dragBlockedForceKg, 0.28, 0.0001, "drag threshold blocks fish-won Y below the limit");
approx(belowThresholdDragForce.excessYForceKg, 0, 0.0001, "drag threshold has no excess below the limit");
approx(belowThresholdDragForce.finalYSpeedPxPerSec, 0, 0.0001, "drag threshold stops Y movement below the limit");
assert(!belowThresholdDragForce.shouldSlipDrag, "drag threshold does not slip below the limit");

const slackLineDragForce = dragForceCalculator.calculate({
  fishOppositionKg: 0.28,
  effectiveRodHoldKg: 0,
  yAwayRatio: 1,
  dragRatio: 0.3,
  dragLimitKg: 0.3,
  lineHasReserve: true,
  lineTaut: false,
  dragLocked: false,
  dragSupported: true,
  targetYSpeedPxPerSec: -107.08,
});
approx(
  slackLineDragForce.finalYSpeedPxPerSec,
  -107.08,
  0.0001,
  "slack released line lets fish move away without drag payout",
);
approx(
  slackLineDragForce.dragBlockedForceKg,
  0,
  0.0001,
  "slack released line does not load drag",
);
assert(
  !slackLineDragForce.shouldSlipDrag,
  "slack released line does not trigger drag slip",
);
assert(
  !slackLineDragForce.dragEngaged,
  "drag engages only after released line becomes taut",
);
const slackEmptySpoolDragForce = dragForceCalculator.calculate({
  fishOppositionKg: 0.28,
  effectiveRodHoldKg: 0,
  yAwayRatio: 1,
  dragRatio: 0,
  dragLimitKg: 0,
  lineHasReserve: false,
  lineTaut: false,
  dragLocked: false,
  dragSupported: true,
  targetYSpeedPxPerSec: -15,
});
approx(
  slackEmptySpoolDragForce.finalYSpeedPxPerSec,
  -15,
  0.0001,
  "slack empty spool preserves free outward speed",
);
approx(
  slackEmptySpoolDragForce.tautFinalYSpeedPxPerSec,
  0,
  0.0001,
  "empty spool blocks the constrained speed after released radius",
);
const splitAtReleasedRadius = radialMovementSplitter.resolveVelocity({
  position: { x: 0, y: -495 },
  rodTipPosition: { x: 0, y: 0 },
  freeVelocity: { x: 0, y: -15 },
  constrainedVelocity: { x: 0, y: 0 },
  releasedMeters: 10,
  pixelsPerMeter: 50,
  dtSec: 1,
});
approx(
  splitAtReleasedRadius.velocityY,
  -5,
  0.0001,
  "slack fish uses only free released radius before held drag stops it",
);
assert(
  splitAtReleasedRadius.crossedReleasedRadius,
  "slack-to-taut transition is resolved inside the frame",
);
approx(
  splitAtReleasedRadius.freeTimeSec,
  1 / 3,
  0.0001,
  "free movement ends exactly at released radius",
);
const emptySpoolFreeRadius = radialMovementSplitter.resolveVelocity({
  position: { x: 0, y: -495 },
  rodTipPosition: { x: 0, y: 0 },
  freeVelocity: {
    x: slackEmptySpoolDragForce.finalXSpeedPxPerSec,
    y: slackEmptySpoolDragForce.finalYSpeedPxPerSec,
  },
  constrainedVelocity: {
    x: slackEmptySpoolDragForce.finalXSpeedPxPerSec,
    y: slackEmptySpoolDragForce.tautFinalYSpeedPxPerSec,
  },
  releasedMeters: 10,
  pixelsPerMeter: 50,
  dtSec: 0.2,
});
approx(
  emptySpoolFreeRadius.velocityY,
  -15,
  0.0001,
  "empty spool still allows movement inside released radius",
);
assert(
  !emptySpoolFreeRadius.crossedReleasedRadius,
  "free movement does not engage the line before reaching its radius",
);
const openDragAfterRadius = radialMovementSplitter.resolveVelocity({
  position: { x: 0, y: -500 },
  rodTipPosition: { x: 0, y: 0 },
  freeVelocity: { x: 0, y: -15 },
  constrainedVelocity: { x: 0, y: -15 },
  releasedMeters: 10,
  pixelsPerMeter: 50,
  dtSec: 0.2,
});
approx(
  openDragAfterRadius.velocityY,
  -15,
  0.0001,
  "open drag keeps outward movement after released radius",
);
const heldDragAtRadius = radialMovementSplitter.resolveVelocity({
  position: { x: 0, y: -500 },
  rodTipPosition: { x: 0, y: 0 },
  freeVelocity: { x: 0, y: -15 },
  constrainedVelocity: { x: 0, y: 0 },
  releasedMeters: 10,
  pixelsPerMeter: 50,
  dtSec: 0.2,
});
approx(
  heldDragAtRadius.velocityY,
  0,
  0.0001,
  "held drag blocks outward movement at released radius",
);

const dragForce = dragForceCalculator.calculate({
  fishOppositionKg: 0.78,
  effectiveRodHoldKg: 0,
  yAwayRatio: 1,
  dragRatio: 0.5,
  dragLimitKg: 0.5,
  lineHasReserve: true,
  dragLocked: false,
  dragSupported: true,
  targetYSpeedPxPerSec: -107.08,
  waterMotionResistance: 1000,
  waterSpeedMultiplier: 64,
  fishBaseSpeed: 2,
  fishStateSpeedMultiplier: 1,
  pixelsPerMeter: 50,
});
approx(dragForce.fishWonForceKg, 0.78, 0.0001, "drag uses fish-won force as speed source");
approx(dragForce.fishWonYForceKg, 0.78, 0.0001, "drag projects won force onto Y");
approx(dragForce.dragBlockedForceKg, 0.5, 0.0001, "drag blocks only up to drag limit while line can slip");
approx(dragForce.excessYForceKg, 0.28, 0.0001, "only force above drag limit remains available for Y escape speed");
approx(dragForce.dragSlowedYSpeedPxPerSec, 0, 0.0001, "threshold drag does not keep a slowed base Y speed");
const expectedExcessYSpeedPx = dragForceCalculator.speedFromForceKg({
  forceKg: 0.28,
  waterMotionResistance: 1000,
  waterSpeedMultiplier: 64,
  fishBaseSpeed: 2,
  fishStateSpeedMultiplier: 1,
  pixelsPerMeter: 50,
});
approx(
  dragForce.finalYSpeedPxPerSec,
  -expectedExcessYSpeedPx,
  0.0001,
  "threshold drag converts only excess Y force into Y speed",
);
assert(dragForce.shouldSlipDrag, "fish-won Y excess marks drag slip");

const noReserveDragForce = dragForceCalculator.calculate({
  fishOppositionKg: 0.78,
  effectiveRodHoldKg: 0,
  yAwayRatio: 1,
  dragRatio: 0.5,
  dragLimitKg: 0.5,
  lineHasReserve: false,
  dragLocked: false,
  dragSupported: true,
  targetYSpeedPxPerSec: -107.08,
  waterMotionResistance: 1000,
  waterSpeedMultiplier: 64,
  fishBaseSpeed: 2,
  fishStateSpeedMultiplier: 1,
  pixelsPerMeter: 50,
});
approx(noReserveDragForce.dragBlockedForceKg, 0.78, 0.0001, "no reserve transfers all fish-won Y force into line load");
approx(noReserveDragForce.excessYForceKg, 0, 0.0001, "no reserve leaves no Y escape force");
approx(noReserveDragForce.finalYSpeedPxPerSec, 0, 0.0001, "no reserve blocks Y escape");

const diagonalDragForce = dragForceCalculator.calculate({
  fishOppositionKg: 1,
  effectiveRodHoldKg: 0,
  yAwayRatio: Math.SQRT1_2,
  dragRatio: 0.5,
  dragLimitKg: 0.5,
  lineHasReserve: true,
  dragLocked: false,
  dragSupported: true,
  targetYSpeedPxPerSec: -75,
  waterMotionResistance: 1000,
  waterSpeedMultiplier: 64,
  fishBaseSpeed: 1,
  fishStateSpeedMultiplier: 1,
  pixelsPerMeter: 50,
});
approx(
  diagonalDragForce.fishWonYForceKg,
  Math.SQRT1_2,
  0.0001,
  "45 degree drag projection uses normalized Y component",
);

const resolvedDragTension = new TensionSystem().calculate({
  fishTensionKg: 0.78,
  playerHoldTensionKg: 0.2,
  totalTensionKg: 0.98,
  rodLimitKg: 3,
  lineLimitKg: 2,
  hookLimitKg: 2,
  dragLimitKg: 0.5,
  lineHasReserve: true,
  dragLocked: false,
  dragAlreadyResolved: true,
  shouldSlipDrag: dragForce.shouldSlipDrag,
});
approx(resolvedDragTension.tensionKg, 0.5, 0.0001, "resolved movement drag still caps final line tension");
approx(resolvedDragTension.rawTotalTensionKg, 0.98, 0.0001, "resolved movement drag keeps raw tension for debug");
approx(resolvedDragTension.lineStressRatio, 0.25, 0.0001, "resolved movement drag uses capped tension for stress");
assert(resolvedDragTension.shouldSlipDrag, "resolved drag tension keeps slip flag for line release");

const landingLiftDragCap = new TensionSystem().calculate({
  fishTensionKg: 1.1,
  playerHoldTensionKg: 0,
  totalTensionKg: 1.1,
  rodLimitKg: 3,
  lineLimitKg: 2,
  hookLimitKg: 2,
  dragLimitKg: 0.7,
  lineHasReserve: true,
  dragLocked: false,
  dragAlreadyResolved: true,
  shouldSlipDrag: false,
});
approx(landingLiftDragCap.tensionKg, 0.7, 0.0001, "landing lift tension is capped by slipping drag");
approx(landingLiftDragCap.rawTotalTensionKg, 1.1, 0.0001, "landing lift keeps raw weight tension for debug");
assert(landingLiftDragCap.shouldSlipDrag, "landing lift over drag limit marks drag slip");

const hardLimitTension = new TensionSystem().calculate({
  fishTensionKg: 1.1,
  playerHoldTensionKg: 0,
  totalTensionKg: 1.1,
  rodLimitKg: 3,
  lineLimitKg: 2,
  hookLimitKg: 2,
  dragLimitKg: 0.7,
  hardLineLimit: true,
  lineHasReserve: true,
  dragLocked: false,
});
approx(hardLimitTension.tensionKg, 1.1, 0.0001, "hard line limit bypasses drag tension cap");
const lockedDragTension = new TensionSystem().calculate({
  fishTensionKg: 1.1,
  playerHoldTensionKg: 0,
  totalTensionKg: 1.1,
  rodLimitKg: 3,
  lineLimitKg: 2,
  hookLimitKg: 2,
  dragLimitKg: 0.7,
  lineHasReserve: true,
  dragLocked: true,
});
approx(lockedDragTension.tensionKg, 1.1, 0.0001, "locked drag bypasses drag tension cap");
assert(!lockedDragTension.shouldSlipDrag, "locked drag does not mark slip");

const holdWinsRetrieve = new FishRetrieveSystem({
  getWaterConfig: () => ({
    tautBodyResistancePerKg: 0.2,
    motionResistance: 1000,
    speedMultiplier: 64,
  }),
  getFightTensionConfig: () => ({
    movableHoldTensionCapRatio: 10,
  }),
  getPixelsPerMeter: () => 50,
}).calculate({
  dtSec: 1 / 30,
  rodPullResult: {
    active: true,
    forceKg: 0.4,
    rodLimitKg: 3,
    holdTensionRatio: 0.5,
    holdRatio: 1,
  },
  forceData: {
    fishWeightKg: 0.8,
    fishBasePower: 0.5,
    fishBaseSpeed: 2,
    fishStateForceMultiplier: 1,
    fishStateSpeedMultiplier: 1,
    directionResistanceMultiplier: 2.5,
    yAwayRatio: 1,
    player: { anglePenalty: 1 },
    modelFishEscapeVelocityX: 0,
    modelFishEscapeVelocityY: -107.08,
  },
  dragRatio: 0.5,
  dragLimitKg: 0.5,
  lineHasReserve: true,
});
approx(holdWinsRetrieve.fishOppositionKg, 0.28, 0.0001, "hold-wins case keeps fish opposition");
approx(holdWinsRetrieve.fishWonForceKg, 0, 0.0001, "hold-wins case has no fish escape force");
approx(holdWinsRetrieve.dragBlockedForceKg, 0, 0.0001, "hold-wins case has no drag-blocked escape force");
approx(holdWinsRetrieve.fishTensionKg, 0.28, 0.0001, "hold-wins case keeps fish tension from opposition");
approx(holdWinsRetrieve.playerHoldTensionKg, 0.2, 0.0001, "hold-wins case keeps player hold tension");
approx(holdWinsRetrieve.totalTensionKg, 0.48, 0.0001, "hold-wins case total tension is fish plus player tension");

const rodPullWithOpenDrag = new RodPullCalculator({
  chargeTimeSeconds: 0.35,
  distanceMultiplierByRodLength: 0.5,
}).calculateNextState({
  dtSec: 1,
  input: { pullHeld: true, pullStartedThisFrame: true },
  previousState: {},
  rodLengthMeters: 3,
  pumpCreditMeters: 0,
  maxTackleLoadKg: 3,
  rodLimitKg: 3,
  fishTensionKg: 0.5,
  dragLimitKg: 0,
  dragLocked: false,
  hardLineLimit: false,
  lineHasReserve: true,
  fishDistanceMeters: 5,
});
approx(rodPullWithOpenDrag.forceKg, 0, 0.0001, "open drag prevents rod hold from pulling fish");
approx(rodPullWithOpenDrag.rodHoldMaxKg, 2.5, 0.0001, "open drag keeps rod hold max visible from rod capacity");
assert(rodPullWithOpenDrag.dragSlipping, "open drag marks rod pull as slipping");

const rodPullAtHardLimit = new RodPullCalculator({
  chargeTimeSeconds: 0.35,
  distanceMultiplierByRodLength: 0.5,
}).calculateNextState({
  dtSec: 1,
  input: { pullHeld: true, pullStartedThisFrame: true },
  previousState: {},
  rodLengthMeters: 3,
  pumpCreditMeters: 0,
  maxTackleLoadKg: 3,
  rodLimitKg: 3,
  fishTensionKg: 0.5,
  dragLimitKg: 0,
  dragLocked: false,
  hardLineLimit: true,
  lineHasReserve: true,
  fishDistanceMeters: 5,
});
assert(rodPullAtHardLimit.forceKg > 0, "hard line limit bypasses drag slip and loads tackle");

const liftCalc = new LandingLiftTensionCalculator();
const landingLiftConfig = {
  enabled: true,
  liftWeightTensionRatio: 1,
  liftTimeSeconds: 0.35,
  releaseTimeSeconds: 0.2,
};
const noHoldLandingLift = liftCalc.calculate({
  previousLiftHoldKg: 0,
  fishWeightKg: 1.1,
  waterFightTensionKg: 0.3,
  inLandingZone: true,
  playerHoldActive: false,
  dtSec: 0.35,
  config: landingLiftConfig,
});
approx(noHoldLandingLift.liftHoldKg, 0, 0.0001, "landing zone without hold does not add real weight tension");
approx(noHoldLandingLift.fishTensionKg, 0.3, 0.0001, "landing zone without hold keeps water fight tension");

const halfLandingLift = liftCalc.calculate({
  previousLiftHoldKg: 0,
  fishWeightKg: 1.1,
  waterFightTensionKg: 0.3,
  inLandingZone: true,
  playerHoldActive: true,
  dtSec: 0.175,
  config: landingLiftConfig,
});
approx(halfLandingLift.liftHoldKg, 0.55, 0.0001, "landing hold gradually transfers half real fish weight");
approx(halfLandingLift.fishTensionKg, 0.55, 0.0001, "landing lift overrides lower water fight tension");

const fullLandingLift = liftCalc.calculate({
  previousLiftHoldKg: halfLandingLift.liftHoldKg,
  fishWeightKg: 1.1,
  waterFightTensionKg: 0.3,
  inLandingZone: true,
  playerHoldActive: true,
  dtSec: 0.175,
  config: landingLiftConfig,
});
approx(fullLandingLift.liftHoldKg, 1.1, 0.0001, "landing hold reaches full real fish weight");
approx(fullLandingLift.totalTensionKg, 1.1, 0.0001, "landing lift total tension avoids double counting player hold");

const releasedLandingLift = liftCalc.calculate({
  previousLiftHoldKg: fullLandingLift.liftHoldKg,
  fishWeightKg: 1.1,
  waterFightTensionKg: 0.3,
  inLandingZone: true,
  playerHoldActive: false,
  dtSec: 0.2,
  config: landingLiftConfig,
});
approx(releasedLandingLift.liftHoldKg, 0, 0.0001, "landing lift releases when hold stops");

const pipelineFrame = new FightPhysicsPipeline().startFrame();
for (const stepName of FightPhysicsPipeline.STEPS) pipelineFrame.run(stepName, () => null);
assert(pipelineFrame.toDebugData().length === FightPhysicsPipeline.STEPS.length, "pipeline records explicit frame steps");

console.log("fight-systems-check passed:");
for (const message of checks) console.log("- " + message);
`, context);
