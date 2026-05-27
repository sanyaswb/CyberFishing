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
  "src/core/fishing/rod_pull_state.js",
  "src/core/fishing/rod_stroke_state.js",
  "src/core/fishing/slack_calculator.js",
  "src/core/fishing/rod_pull_calculator.js",
  "src/core/fishing/retrieve_policy.js",
  "src/core/fishing/landing_policy.js",
  "src/core/fishing/fish_retrieve_result.js",
  "src/core/fishing/simple_fight_force_calculator.js",
  "src/core/fishing/landing_lift_tension_calculator.js",
  "src/core/fishing/line_tension_calculator.js",
  "src/systems/rod_pull_system.js",
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

const calculator = new RodPullCalculator({ ...rodPullConfig, distanceMultiplierByRodLength: 1 });
approx(calculator.calculateAvailableDistance({ rodLengthMeters: 3.6, slackMeters: 0 }), 3.6, 0.001, "full rod stroke equals rod length when multiplier is 1");
approx(calculator.calculateAvailableDistance({ rodLengthMeters: 3.6, slackMeters: 2 }), 1.6, 0.001, "pump credit reduces next rod stroke when enabled");

const forceLimit = calculator.calculateForceLimit({ rodLimitKg: 3, fishTensionKg: 1.1 });
approx(forceLimit.rodHoldMaxKg, 1.9, 0.001, "rodHoldMax = rodLimit - fishTension");
approx(forceLimit.controlledPullLimitKg, 1.9, 0.001, "rod hold force is not clamped by line limit here");

const rodPullSystem = new RodPullSystem({ ...rodPullConfig, distanceMultiplierByRodLength: 1, chargeTimeSeconds: 0.5 });
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

console.log("rod-pull-systems-check passed:");
for (const message of checks) console.log("- " + message);
`, context);
