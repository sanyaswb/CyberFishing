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
  "src/core/fishing/simple_fight_force_calculator.js",
  "src/core/fishing/drag_force_calculator.js",
  "src/core/fishing/line_tension_calculator.js",
  "src/core/fishing/fish_retrieve_result.js",
  "src/systems/tension_system.js",
  "src/systems/fight_physics_pipeline.js",
];

const context = vm.createContext({ console, Math, Number, Object, window: {} });
for (const file of FILES) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), context, { filename: file });
}

vm.runInContext(`
const checks = [];
function assert(condition, message) { if (!condition) throw new Error(message); checks.push(message); }
function approx(value, expected, tolerance, message) { assert(Math.abs(value - expected) <= tolerance, message + " (" + value + ")"); }

const calc = new SimpleFightForceCalculator();

const example1 = calc.calculate({
  fishWeightKg: 1,
  fishBasePower: 1,
  fishBaseSpeed: 1,
  fishStateForceMultiplier: 1,
  fishStateSpeedMultiplier: 1.2,
  directionMultiplier: 2.5,
  tautBodyResistancePerKg: 0.2,
  rodLimitKg: 1,
  rodHoldKg: 0.1,
  rodAngleMultiplier: 1,
  holdTensionRatio: 1,
  movableHoldTensionCapRatio: 1,
  fishCanMoveTowardPlayer: true,
  waterMotionResistance: 1000,
  waterSpeedMultiplier: 64,
});
approx(example1.fishPassiveKg, 0.2, 0.0001, "example 1 passive force");
approx(example1.fishActiveKg, 0.5, 0.0001, "example 1 active force");
approx(example1.fishOppositionKg, 0.7, 0.0001, "example 1 opposition");
approx(example1.totalTensionKg, 0.8, 0.0001, "example 1 total tension");
approx(example1.awaySpeedMps, Math.sqrt(0.6 / 1000) * 64 * 1.2, 0.0001, "example 1 away speed");
assert(example1.direction === "away", "example 1 fish wins");

const example2 = calc.calculate({
  fishWeightKg: 2.5,
  fishBasePower: 1.2,
  fishBaseSpeed: 0.8,
  fishStateForceMultiplier: 1,
  fishStateSpeedMultiplier: 0.8,
  directionMultiplier: 1,
  tautBodyResistancePerKg: 0.2,
  rodLimitKg: 3,
  rodHoldKg: 1.6,
  rodAngleMultiplier: 0.9,
  holdTensionRatio: 0.5,
  movableHoldTensionCapRatio: 1,
  fishCanMoveTowardPlayer: true,
  waterMotionResistance: 1000,
  waterSpeedMultiplier: 64,
});
approx(example2.fishPassiveKg, 0.6, 0.0001, "example 2 passive force");
approx(example2.fishActiveKg, 0.6, 0.0001, "example 2 active force");
approx(example2.effectiveRodHoldKg, 1.44, 0.0001, "example 2 angle penalty applies");
approx(example2.playerHoldTensionKg, 0.6, 0.0001, "example 2 movable cap limits hold tension");
approx(example2.totalTensionKg, 1.8, 0.0001, "example 2 total tension");
approx(example2.towardPlayerSpeedMps, Math.sqrt(0.24 / 1000) * 64, 0.0001, "example 2 pull speed");
assert(example2.direction === "toward_player", "example 2 player wins");

const smallFish = calc.calculate({
  fishWeightKg: 0.2,
  fishBasePower: 1,
  fishStateForceMultiplier: 1,
  directionMultiplier: 2.5,
  tautBodyResistancePerKg: 0.2,
  rodLimitKg: 3,
  rodHoldKg: 2,
  holdTensionRatio: 1,
  movableHoldTensionCapRatio: 1,
  fishCanMoveTowardPlayer: true,
  waterMotionResistance: 1000,
  waterSpeedMultiplier: 64,
});
approx(smallFish.totalTensionKg, 0.18, 0.0001, "movable small fish does not overload line");
assert(smallFish.towardPlayerSpeedMps > 2.7, "small fish excess hold becomes speed");

const blockedSmallFish = calc.calculate({
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
approx(blockedSmallFish.totalTensionKg, 2.14, 0.0001, "blocked small fish can overload line");

const stress = new TensionSystem().calculate({
  totalTensionKg: 5.44,
  fishTensionKg: 3.84,
  playerHoldTensionKg: 1.6,
  rodLimitKg: 8,
  lineLimitKg: 6,
  hookLimitKg: 6,
  dragLocked: true,
});
approx(stress.rodStressRatio, 0.68, 0.0001, "rod stress from total tension");
approx(stress.lineStressRatio, 5.44 / 6, 0.0001, "line stress from total tension");
approx(stress.hookStressRatio, 5.44 / 6, 0.0001, "hook stress from total tension");

const pipelineFrame = new FightPhysicsPipeline().startFrame();
for (const stepName of FightPhysicsPipeline.STEPS) pipelineFrame.run(stepName, () => null);
assert(pipelineFrame.toDebugData()[0].step === "read_runtime_config", "pipeline starts with runtime config");
assert(pipelineFrame.toDebugData().at(-1).step === "write_debug_snapshot", "pipeline ends with debug snapshot");

console.log("physics-formula-golden-check passed:");
for (const message of checks) console.log("- " + message);
`, context);
