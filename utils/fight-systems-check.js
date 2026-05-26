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
approx(smallFish.playerHoldTensionKg, 0.04, 0.0001, "movable fish caps hold tension");
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

const pipelineFrame = new FightPhysicsPipeline().startFrame();
for (const stepName of FightPhysicsPipeline.STEPS) pipelineFrame.run(stepName, () => null);
assert(pipelineFrame.toDebugData().length === FightPhysicsPipeline.STEPS.length, "pipeline records explicit frame steps");

console.log("fight-systems-check passed:");
for (const message of checks) console.log("- " + message);
`, context);
