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
  "src/config/physics/physics_formula_map.js",
  "src/config/physics/physics_config_adapter.js",
  "src/config/physics/physics_config.js",
  "src/config/runtime/config_override_store.js",
  "src/config/runtime/resolved_config_provider.js",
  "src/config/runtime/immutable_config.js",
  "src/config/config.js",
  "src/core/fishing/fish_retrieve_result.js",
  "src/core/fishing/fish_retrieve_physics_settings.js",
  "src/core/fishing/fish_motion_load_calculator.js",
  "src/core/fishing/fish_retrieve_resistance_calculator.js",
  "src/core/fishing/pull_water_drag_calculator.js",
  "src/core/fishing/player_pressure_transfer_calculator.js",
  "src/core/fishing/line_tension_calculator.js",
  "src/core/fishing/simple_fight_force_calculator.js",
  "src/core/fishing/fish_pull_resistance_model.js",
  "src/entities/fish.js",
  "src/systems/player_force_system.js",
  "src/systems/fish_force_system.js",
  "src/systems/tension_system.js",
  "src/systems/fight_physics_pipeline.js",
];

const context = vm.createContext({
  console,
  Math,
  Number,
  setTimeout,
  clearTimeout,
  window: { innerWidth: 1280, innerHeight: 720 },
});

for (const file of FILES) {
  const source = fs.readFileSync(path.join(ROOT, file), "utf8");
  vm.runInContext(source, context, { filename: file });
}

vm.runInContext(`
const checks = [];
function assert(condition, message) {
  if (!condition) throw new Error(message);
  checks.push(message);
}
function approx(value, expected, tolerance, message) {
  assert(Math.abs(value - expected) <= tolerance, message + " (actual " + value + ", expected " + expected + ")");
}
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
function makeFormulaConfig({ dynamicLoadEnabled = true } = {}) {
  const config = { physics: clone(CONFIG.physics) };
  config.physics.simulation.pixelsPerMeter = 50;
  config.physics.environment.water.fishMotionLoad.speedLoadKgPerKgPerMps = 2.2;
  config.physics.environment.water.currentInfluenceMultiplier = 1.0;
  config.physics.fight.fishForce.dynamicLoadFromMotion.enabled = dynamicLoadEnabled;
  config.physics.fight.fishForce.dynamicLoadFromMotion.directionMultiplier = {
    sameDirection: 0.4,
    sideDirection: 1.0,
    oppositeDirection: 1.8,
  };
  config.fightPhysicsConfig = new FightPhysicsConfigAdapter(config);
  return config;
}
function makeFakeFish({ weightKg = 1, staticPowerKg = 1, speedMultiplier = 0.35, waterMultiplier = 1.0 } = {}) {
  return {
    getBehavior: () => ({
      name: "swim",
      powerRatio: 1,
      speedRatio: 0,
      moveX: 1,
    }),
    getPhysicsConfig: () => ({
      forceProfile: {
        basePower: staticPowerKg,
        minPowerRatio: 0.25,
      },
      movementProfile: {
        maxSpeedMetersPerSec: 0,
        agility: 1,
      },
      resistanceProfile: {
        speedForceMultiplier: speedMultiplier,
        waterResistanceMultiplier: waterMultiplier,
      },
      retrieveProfile: {
        passiveBodyResistanceMultiplier: 1,
        activeAwayMultiplier: 1,
        waterDragMultiplier: 1,
      },
      behaviorProfile: { behaviors: {} },
    }),
    getWeight: () => weightKg,
    getStaticPowerKg: () => staticPowerKg,
    getCurrentStaticPowerKg: () => staticPowerKg,
    getInitialPower: () => staticPowerKg,
    getMaxSpeedPxPerSec: () => 0,
    getBaseSpeedPxPerSec: () => 0,
    getLastDashDebugData: () => ({}),
  };
}
function calculateFishForce({ config, fishVelocity }) {
  const system = new FishForceSystem({ fish: makeFakeFish(), config });
  return system.calculate({
    dtMs: 16.666,
    fishPosition: new Vector2(0, 0),
    fishVelocity,
    rodTipPosition: new Vector2(0, 100),
    fishCondition: { currentStamina: 100, currentExhaustion: 100, maxPoints: 100 },
    dragRatio: 1,
    input: { isPulling: false, pointerDown: false },
    rod: null,
    reel: null,
    playerMaxLoadKg: 2,
    env: {},
    buffs: null,
  });
}

assert(!!PHYSICS_FORMULA_MAP.fishMotionLoad, "formula map contains fish motion load block");
assert(!!PHYSICS_FORMULA_MAP.pullWaterDrag, "formula map contains pull water drag block");
assert(
  PHYSICS_FORMULA_MAP.pullWaterDrag.outputs.includes("fishRetrieveSpeedMps"),
  "formula map documents retrieve speed output",
);

const sideLoad = calculateFishForce({
  config: makeFormulaConfig({ dynamicLoadEnabled: true }),
  fishVelocity: new Vector2(50, 0),
});
approx(sideLoad.debug.relativeSpeedMps, 1, 0.0001, "relative fish speed is converted from px/s to m/s");
approx(sideLoad.debug.directionResistanceMultiplier, 1, 0.0001, "side motion uses side direction multiplier");
approx(sideLoad.dynamicFishForceKg, 0.77, 0.0001, "fish motion load golden formula before direction amplification");

const oppositeLoad = calculateFishForce({
  config: makeFormulaConfig({ dynamicLoadEnabled: true }),
  fishVelocity: new Vector2(0, -50),
});
approx(oppositeLoad.debug.directionResistanceMultiplier, 1.8, 0.0001, "away motion uses opposite direction multiplier");
approx(oppositeLoad.dynamicFishForceKg, 1.386, 0.0001, "fish motion load applies direction multiplier");

const disabledLoad = calculateFishForce({
  config: makeFormulaConfig({ dynamicLoadEnabled: false }),
  fishVelocity: new Vector2(0, -50),
});
approx(disabledLoad.dynamicFishForceKg, 0, 0.0001, "disabled dynamic motion load forces dynamicFishForceKg to zero");
assert(disabledLoad.debug.dynamicLoadEnabled === false, "disabled dynamic motion load is visible in debug");

const retrieveModel = new FishPullResistanceModel({
  tautBodyResistanceKgPerKg: 0,
  activeAwayForceMultiplier: 0,
  referencePullSpeedMetersPerSecond: 1,
  waterDragKgPerKgAtReferenceSpeed: 0.85,
  playerPressureTransferReferenceWeightKg: 0.5,
  minPlayerPressureTransferRatio: 0.05,
  blockedPlayerPressureTransferRatio: 1,
});
const retrieve = retrieveModel.calculate({
  dtSec: 1,
  holdRatio: 1,
  playerPullPressureKg: 0.85,
  fishWeightKg: 4,
  totalFishForceKg: 0,
  awayFromPlayerRatio: 0,
  fishConfig: {
    retrieveProfile: {
      passiveBodyResistanceMultiplier: 1,
      activeAwayMultiplier: 1,
      waterDragMultiplier: 1,
      referencePullSpeedMultiplier: 1,
    },
  },
  lineDistanceMeters: 10,
  landingDistanceMeters: 1,
  movementBlocked: false,
  lineTaut: true,
});
approx(retrieve.waterDragCapacityKg, 3.4, 0.0001, "retrieve drag capacity scales by fish weight and global drag");
approx(retrieve.retrieveSpeedMetersPerSecond, 0.5, 0.0001, "retrieve speed uses sqrt(surplus / waterDragCapacity)");
approx(retrieve.waterDragKg, 0.85, 0.0001, "water drag at half reference speed follows speed squared");

const doubledDrag = retrieveModel.calculate({
  dtSec: 1,
  holdRatio: 1,
  playerPullPressureKg: 0.85,
  fishWeightKg: 4,
  totalFishForceKg: 0,
  awayFromPlayerRatio: 0,
  fishConfig: {
    retrieveProfile: { waterDragMultiplier: 2 },
  },
  lineDistanceMeters: 10,
  landingDistanceMeters: 1,
  movementBlocked: false,
  lineTaut: true,
});
approx(doubledDrag.waterDragCapacityKg, 6.8, 0.0001, "species waterDragMultiplier scales retrieve drag capacity");
approx(doubledDrag.retrieveSpeedMetersPerSecond, Math.sqrt(0.85 / 6.8), 0.0001, "species waterDragMultiplier slows retrieve speed through capacity");


const pipelineFrame = new FightPhysicsPipeline().startFrame();
for (const stepName of FightPhysicsPipeline.STEPS) {
  pipelineFrame.run(stepName, () => null);
}
assert(
  pipelineFrame.toDebugData().length === FightPhysicsPipeline.STEPS.length,
  "fight physics pipeline records every explicit frame step",
);
assert(
  pipelineFrame.toDebugData()[0].step === "read_runtime_config" &&
    pipelineFrame.toDebugData().at(-1).step === "write_debug_snapshot",
  "fight physics pipeline preserves documented step order",
);

const tension = new TensionSystem().calculate({
  fishForceKg: 3,
  rodPullForceKg: 0,
  dragLimitKg: 2,
  hardLineLimit: false,
  lineHasReserve: true,
  dragLocked: false,
});
approx(tension.rawTensionKg, 3, 0.0001, "tension raw value keeps full retrieve line tension");
approx(tension.tensionKg, 2, 0.0001, "unlocked drag clamps final tension to drag limit when line has reserve");
assert(tension.shouldSlipDrag, "tension reports slipping drag when clamped");

console.log("physics-formula-golden-check passed:");
for (const message of checks) console.log("- " + message);
`, context);
