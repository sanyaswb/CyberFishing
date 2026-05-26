const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const FILES = [
  "src/config/project_version.js",
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
  "src/systems/tension_system.js",
];

class CliArgs {
  constructor(argv) {
    this.values = new Map();
    for (const arg of argv) {
      if (!arg.startsWith("--")) continue;
      const [rawKey, ...rawValueParts] = arg.slice(2).split("=");
      const key = rawKey.trim();
      const value = rawValueParts.length ? rawValueParts.join("=") : "true";
      this.values.set(key, value);
    }
  }

  string(key, fallback) {
    return this.values.has(key) ? String(this.values.get(key)) : fallback;
  }

  number(key, fallback) {
    const value = Number(this.values.get(key));
    return Number.isFinite(value) ? value : fallback;
  }

  boolean(key, fallback = false) {
    if (!this.values.has(key)) return fallback;
    const value = String(this.values.get(key)).toLowerCase();
    return value !== "false" && value !== "0" && value !== "no";
  }
}

function loadContext() {
  const context = vm.createContext({
    console,
    Math,
    Number,
    Object,
    setTimeout,
    clearTimeout,
    window: { innerWidth: 1280, innerHeight: 720 },
  });
  for (const file of FILES) {
    const source = fs.readFileSync(path.join(ROOT, file), "utf8");
    vm.runInContext(source, context, { filename: file });
  }
  return context;
}

function runSimulation(args) {
  const context = loadContext();
  context.__SIM_ARGS__ = Object.fromEntries(args.values.entries());

  return vm.runInContext(`
(function simulate() {
  function numberArg(key, fallback) {
    const value = Number(__SIM_ARGS__[key]);
    return Number.isFinite(value) ? value : fallback;
  }
  function stringArg(key, fallback) {
    return Object.prototype.hasOwnProperty.call(__SIM_ARGS__, key)
      ? String(__SIM_ARGS__[key])
      : fallback;
  }
  function boolArg(key, fallback) {
    if (!Object.prototype.hasOwnProperty.call(__SIM_ARGS__, key)) return fallback;
    const value = String(__SIM_ARGS__[key]).toLowerCase();
    return value !== "false" && value !== "0" && value !== "no";
  }
  function clamp01(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
  }
  function averageRange(range, fallback) {
    if (!range || !Number.isFinite(Number(range.min)) || !Number.isFinite(Number(range.max))) {
      return fallback;
    }
    return (Number(range.min) + Number(range.max)) / 2;
  }
  function selectWeightRange(fish, level) {
    const ranges = fish.weightConfig?.levelWeightRanges || [];
    return ranges.find((range) => Number(range.level) === level) || ranges[0] || null;
  }

  const fishId = stringArg("fish", "perch_radioactive");
  const fish = FISH_DB.find((entry) => entry.id === fishId) || FISH_DB[0];
  if (!fish) throw new Error("FISH_DB is empty");

  const level = Math.max(1, Math.round(numberArg("level", 1)));
  const weightRange = selectWeightRange(fish, level);
  const weightKg = Math.max(0.001, numberArg("weightKg", averageRange(weightRange, 0.6)));
  const levelBasePower = Number.isFinite(Number(weightRange?.basePower))
    ? Number(weightRange.basePower)
    : 1;
  const fishPhysics = FishPhysicsProfile.toRuntimeConfig(fish.physics, { levelBasePower });
  const behaviorName = stringArg("behavior", "swim");
  const behavior = fishPhysics.behaviorProfile?.behaviors?.[behaviorName] ||
    fishPhysics.behaviorProfile?.behaviors?.swim ||
    { powerRatio: 1, speedRatio: 1 };

  const durationSec = Math.max(0.1, numberArg("durationSec", 60));
  const dtSec = Math.max(0.016, numberArg("dtSec", 0.1));
  const lineMaxLoadKg = Math.max(0.001, numberArg("lineMaxLoadKg", 2));
  const dragLimitKg = Math.max(0, numberArg("dragLimitKg", lineMaxLoadKg * 0.7));
  const playerPullPressureKg = Math.max(0, numberArg("playerPullPressureKg", lineMaxLoadKg * 0.45));
  const startDistanceMeters = Math.max(0, numberArg("startDistanceMeters", 10));
  const landingDistanceMeters = Math.max(0, numberArg("landingDistanceMeters", 1));
  const awayFromPlayerRatio = clamp01(numberArg("awayFromPlayerRatio", 1));
  const holdRatio = clamp01(numberArg("holdRatio", 1));
  const exhaustionDrainPerSecond = Math.max(0, numberArg("exhaustionDrainPerSecond", 0.012));
  const breakThresholdRatio = Math.max(0.001, numberArg("breakThresholdRatio", 1));
  const hardLineLimit = boolArg("hardLineLimit", false);

  const adapter = CONFIG.fightPhysicsConfig || new FightPhysicsConfigAdapter(CONFIG);
  const direction = adapter.getDirectionMultiplierConfig();
  const directionMultiplier = numberArg("directionMultiplier", direction.oppositeDirection);
  const relativeSpeedMps = Math.max(
    0,
    numberArg(
      "relativeSpeedMps",
      (Number(behavior.speedRatio) || 0) *
        (Number(fishPhysics.movementProfile?.maxSpeedMetersPerSec) || 0),
    ),
  );
  const staticFishForceKg =
    weightKg *
    Math.max(0, Number(fishPhysics.forceProfile?.basePower) || 0) *
    Math.max(0, Number(fishPhysics.forceProfile?.levelBasePower) || 1);
  const dynamicFishForceKg = adapter.isFishMotionDynamicLoadEnabled()
    ? weightKg *
      relativeSpeedMps *
      Math.max(0, Number(fishPhysics.resistanceProfile?.speedForceMultiplier) || 0) *
      Math.max(0, Number(fishPhysics.resistanceProfile?.waterResistanceMultiplier) || 0) *
      adapter.getFishMotionSpeedLoadKgPerKgPerMps() *
      directionMultiplier
    : 0;

  const minPowerRatio = Math.max(0, Number(fishPhysics.forceProfile?.minPowerRatio) || 0);
  const behaviorPowerRatio = Math.max(0, Number(behavior.powerRatio) || 0);
  const retrieveModel = new FishPullResistanceModel(adapter);
  const tensionSystem = new TensionSystem();

  let distanceMeters = startDistanceMeters;
  let exhaustionRatio = 1;
  let timeSec = 0;
  let landedAtSec = null;
  let maxTensionKg = 0;
  let tensionSumKg = 0;
  let retrieveSpeedSum = 0;
  let samples = 0;
  let breakRiskSamples = 0;
  let maxRetrieveSpeedMetersPerSecond = 0;
  let lastRetrieveResult = null;
  let lastTensionResult = null;

  while (timeSec < durationSec) {
    const exhaustionPowerMultiplier = 0.25 + exhaustionRatio * 0.75;
    const totalFishForceKg = Math.max(
      staticFishForceKg * minPowerRatio,
      (staticFishForceKg * behaviorPowerRatio + dynamicFishForceKg) * exhaustionPowerMultiplier,
    );
    const movementBlocked = distanceMeters <= landingDistanceMeters;
    const retrieve = retrieveModel.calculate({
      dtSec,
      holdRatio,
      playerPullPressureKg,
      fishWeightKg: weightKg,
      totalFishForceKg,
      awayFromPlayerRatio,
      fishConfig: fishPhysics,
      fishCondition: {
        maxPoints: 1,
        currentExhaustion: exhaustionRatio,
        currentStamina: exhaustionRatio,
        phase: exhaustionRatio <= 0.001 ? "exhaustion" : "stamina",
      },
      lineDistanceMeters: distanceMeters,
      landingDistanceMeters,
      movementBlocked,
      actualSlackMeters: 0,
      lineTaut: true,
    });
    const appliedMoveMeters = Math.min(distanceMeters, retrieve.desiredMoveMeters);
    distanceMeters = Math.max(0, distanceMeters - appliedMoveMeters);

    const tension = tensionSystem.calculate({
      fishForceKg: retrieve.activeAwayForceKg,
      rodPullForceKg: retrieve.passiveRetrieveTensionKg,
      dragLimitKg,
      hardLineLimit,
      lineHasReserve: distanceMeters > landingDistanceMeters,
      dragLocked: false,
    });

    maxTensionKg = Math.max(maxTensionKg, tension.tensionKg);
    tensionSumKg += tension.tensionKg;
    retrieveSpeedSum += retrieve.retrieveSpeedMetersPerSecond;
    maxRetrieveSpeedMetersPerSecond = Math.max(
      maxRetrieveSpeedMetersPerSecond,
      retrieve.retrieveSpeedMetersPerSecond,
    );
    if (tension.rawTensionKg >= lineMaxLoadKg * breakThresholdRatio) breakRiskSamples += 1;
    samples += 1;

    const loadRatio = clamp01(tension.rawTensionKg / lineMaxLoadKg);
    exhaustionRatio = Math.max(0, exhaustionRatio - loadRatio * exhaustionDrainPerSecond * dtSec);

    lastRetrieveResult = retrieve;
    lastTensionResult = tension;

    if (landedAtSec === null && distanceMeters <= landingDistanceMeters) {
      landedAtSec = timeSec;
      if (boolArg("stopOnLanding", true)) break;
    }

    timeSec += dtSec;
  }

  const averageTensionKg = samples > 0 ? tensionSumKg / samples : 0;
  const averageRetrieveSpeedMetersPerSecond = samples > 0 ? retrieveSpeedSum / samples : 0;
  const lineBreakRiskRatio = samples > 0 ? breakRiskSamples / samples : 0;

  return {
    version: PROJECT_VERSION_CONFIG?.label || "unknown",
    scenario: {
      fishId: fish.id,
      fishName: fish.name,
      behavior: behaviorName,
      level,
      weightKg,
      durationSec,
      dtSec,
      lineMaxLoadKg,
      dragLimitKg,
      playerPullPressureKg,
      startDistanceMeters,
      landingDistanceMeters,
      awayFromPlayerRatio,
    },
    forceBreakdown: {
      staticFishForceKg,
      dynamicFishForceKg,
      totalInitialFishForceKg: staticFishForceKg * behaviorPowerRatio + dynamicFishForceKg,
      relativeSpeedMps,
      directionMultiplier,
    },
    result: {
      landed: landedAtSec !== null,
      landedAtSec,
      finalDistanceMeters: distanceMeters,
      maxTensionKg,
      averageTensionKg,
      lineBreakRiskRatio,
      averageRetrieveSpeedMetersPerSecond,
      maxRetrieveSpeedMetersPerSecond,
      finalExhaustionRatio: exhaustionRatio,
      samples,
    },
    lastFrame: lastRetrieveResult
      ? {
          fishOppositionKg: lastRetrieveResult.fishOppositionKg,
          surplusForceKg: lastRetrieveResult.surplusForceKg,
          waterDragCapacityKg: lastRetrieveResult.waterDragCapacityKg,
          retrieveSpeedMetersPerSecond: lastRetrieveResult.retrieveSpeedMetersPerSecond,
          tensionKg: lastTensionResult?.tensionKg ?? 0,
          rawTensionKg: lastTensionResult?.rawTensionKg ?? 0,
          shouldSlipDrag: !!lastTensionResult?.shouldSlipDrag,
        }
      : null,
  };
})()
`, context);
}

function printTextReport(report) {
  console.log(`CyberFishing ${report.version} balance simulation`);
  console.log("Scenario:");
  console.log(`- fish: ${report.scenario.fishName} (${report.scenario.fishId})`);
  console.log(`- weight: ${report.scenario.weightKg.toFixed(3)} kg, behavior: ${report.scenario.behavior}`);
  console.log(`- line: ${report.scenario.lineMaxLoadKg.toFixed(3)} kg, drag limit: ${report.scenario.dragLimitKg.toFixed(3)} kg`);
  console.log(`- player pressure: ${report.scenario.playerPullPressureKg.toFixed(3)} kg`);
  console.log("Force breakdown:");
  console.log(`- static fish force: ${report.forceBreakdown.staticFishForceKg.toFixed(3)} kg`);
  console.log(`- dynamic fish force: ${report.forceBreakdown.dynamicFishForceKg.toFixed(3)} kg`);
  console.log(`- relative speed: ${report.forceBreakdown.relativeSpeedMps.toFixed(3)} m/s`);
  console.log("Result:");
  console.log(`- landed: ${report.result.landed ? `yes at ${report.result.landedAtSec.toFixed(2)}s` : "no"}`);
  console.log(`- final distance: ${report.result.finalDistanceMeters.toFixed(3)} m`);
  console.log(`- max tension: ${report.result.maxTensionKg.toFixed(3)} kg`);
  console.log(`- avg tension: ${report.result.averageTensionKg.toFixed(3)} kg`);
  console.log(`- line break risk samples: ${(report.result.lineBreakRiskRatio * 100).toFixed(1)}%`);
  console.log(`- avg retrieve speed: ${report.result.averageRetrieveSpeedMetersPerSecond.toFixed(3)} m/s`);
  console.log(`- final exhaustion: ${(report.result.finalExhaustionRatio * 100).toFixed(1)}%`);
  if (report.lastFrame) {
    console.log("Last frame:");
    console.log(`- fish opposition: ${report.lastFrame.fishOppositionKg.toFixed(3)} kg`);
    console.log(`- surplus pull: ${report.lastFrame.surplusForceKg.toFixed(3)} kg`);
    console.log(`- water drag capacity: ${report.lastFrame.waterDragCapacityKg.toFixed(3)} kg`);
    console.log(`- raw tension: ${report.lastFrame.rawTensionKg.toFixed(3)} kg`);
  }
}

const args = new CliArgs(process.argv.slice(2));
const report = runSimulation(args);
if (args.boolean("json", false)) {
  console.log(JSON.stringify(report, null, 2));
} else {
  printTextReport(report);
}
