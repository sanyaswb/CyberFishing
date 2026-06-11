const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..", "..");
const FILES = [
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
  "src/core/fishing/fish_fight_direction_resolver.js",
  "src/core/fishing/drag_force_calculator.js",
];

const context = vm.createContext({ console, Math, Number, Object, window: {} });
for (const file of FILES) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), context, { filename: file });
}

const result = vm.runInContext(`(function runSimulation() {
  const calculator = new SimpleFightForceCalculator();
  const physics = CONFIG.physics;
  const fish = FISH_DB.find((entry) => entry.id === "crucian_stalker") || FISH_DB[0];
  const behavior = fish.physics.behaviorProfile.behaviors.swim;
  const frames = [];
  let distanceMeters = 12;
  let rodHoldKg = 0;
  const dt = 1 / 30;

  for (let i = 0; i < 180; i++) {
    const fishWeightKg = 0.8;
    const fishBasePower = fish.physics.forceProfile.basePower;
    const fishBaseSpeed = fish.physics.movementProfile.baseSpeed;
    const directionMultiplier = physics.fight.directionForce.awayMultiplier;
    const rodLimitKg = 3;
    const holdTensionRatio = 0.5;
    const lineLimitKg = 2;
    const hookLimitKg = 2;
    const chargeTime = physics.fight.rodHold.chargeTimeSeconds;

    const preview = calculator.calculate({
      fishWeightKg,
      fishBasePower,
      fishBaseSpeed,
      fishStateForceMultiplier: behavior.forceMultiplier,
      fishStateSpeedMultiplier: behavior.speedMultiplier,
      directionMultiplier,
      tautBodyResistancePerKg: physics.water.tautBodyResistancePerKg,
      rodLimitKg,
      rodHoldKg,
      rodAngleMultiplier: 1,
      holdTensionRatio,
      movableHoldTensionCapRatio: physics.fight.tension.movableHoldTensionCapRatio,
      fishCanMoveTowardPlayer: true,
      waterMotionResistance: physics.water.motionResistance,
      waterSpeedMultiplier: physics.water.speedMultiplier,
    });

    const rodHoldMaxKg = preview.rodHoldMaxKg;
    rodHoldKg = Math.min(rodHoldMaxKg, rodHoldKg + (rodHoldMaxKg / chargeTime) * dt);

    const frame = calculator.calculate({
      fishWeightKg,
      fishBasePower,
      fishBaseSpeed,
      fishStateForceMultiplier: behavior.forceMultiplier,
      fishStateSpeedMultiplier: behavior.speedMultiplier,
      directionMultiplier,
      tautBodyResistancePerKg: physics.water.tautBodyResistancePerKg,
      rodLimitKg,
      rodHoldKg,
      rodAngleMultiplier: 1,
      holdTensionRatio,
      movableHoldTensionCapRatio: physics.fight.tension.movableHoldTensionCapRatio,
      fishCanMoveTowardPlayer: true,
      waterMotionResistance: physics.water.motionResistance,
      waterSpeedMultiplier: physics.water.speedMultiplier,
    });

    distanceMeters += (frame.direction === "away" ? 1 : -1) * frame.speedMps * dt;
    distanceMeters = Math.max(0, distanceMeters);
    frames.push({
      frame: i,
      distanceMeters,
      fishPassiveKg: frame.fishPassiveKg,
      fishActiveKg: frame.fishActiveKg,
      fishOppositionKg: frame.fishOppositionKg,
      rodHoldKg,
      playerHoldTensionKg: frame.playerHoldTensionKg,
      totalTensionKg: frame.totalTensionKg,
      lineStressRatio: frame.totalTensionKg / lineLimitKg,
      hookStressRatio: frame.totalTensionKg / hookLimitKg,
      speedMps: frame.speedMps,
      direction: frame.direction,
    });
  }

  const maxTension = Math.max(...frames.map((frame) => frame.totalTensionKg));
  const maxLineStress = Math.max(...frames.map((frame) => frame.lineStressRatio));
  const minDistance = Math.min(...frames.map((frame) => frame.distanceMeters));
  const last = frames.at(-1);
  return { maxTension, maxLineStress, minDistance, last };
})()`, context);

console.log("Simple fish-force diagnostic completed:");
console.log("- scope: SimpleFightForceCalculator only; not the full fight pipeline");
console.log(`- max tension: ${result.maxTension.toFixed(3)} kg`);
console.log(`- max line stress: ${(result.maxLineStress * 100).toFixed(1)}%`);
console.log(`- closest distance: ${result.minDistance.toFixed(2)} m`);
console.log("Last frame:");
console.log(`- fish opposition: ${result.last.fishOppositionKg.toFixed(3)} kg`);
console.log(`- rod hold: ${result.last.rodHoldKg.toFixed(3)} kg`);
console.log(`- player tension: ${result.last.playerHoldTensionKg.toFixed(3)} kg`);
console.log(`- total tension: ${result.last.totalTensionKg.toFixed(3)} kg`);
console.log(`- speed: ${result.last.speedMps.toFixed(3)} m/s (${result.last.direction})`);
