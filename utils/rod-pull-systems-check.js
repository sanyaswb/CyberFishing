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
  "src/core/fishing/fish_retrieve_physics_settings.js",
  "src/core/fishing/fish_motion_load_calculator.js",
  "src/core/fishing/fish_retrieve_resistance_calculator.js",
  "src/core/fishing/pull_water_drag_calculator.js",
  "src/core/fishing/player_pressure_transfer_calculator.js",
  "src/core/fishing/line_tension_calculator.js",
  "src/core/fishing/fish_pull_resistance_model.js",
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
  setTimeout: (handler) => {
    const id = nextTimeoutId++;
    scheduledTimeouts.set(id, handler);
    return id;
  },
  clearTimeout: (id) => {
    scheduledTimeouts.delete(id);
  },
  __flushTimeouts: () => {
    const handlers = Array.from(scheduledTimeouts.values());
    scheduledTimeouts.clear();
    for (const handler of handlers) handler();
  },
  window: {},
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
  assert(Math.abs(value - expected) <= tolerance, message + " (" + value + ")");
}

const physicsAdapter = CONFIG.fightPhysicsConfig;
const pixelsPerMeter = physicsAdapter.getPixelsPerMeter();
const rodPullConfig = physicsAdapter.getRodPullConfig();
const poleIdleRetrieveConfig = physicsAdapter.getPoleIdleRetrieveConfig();
const fishRetrieveConfig = physicsAdapter.getFishRetrieveConfig();
const reelConfig = physicsAdapter.getReelConfig();

const gameConfig = rodPullConfig;
const config = { ...rodPullConfig, distanceMultiplierByRodLength: 1 };
const calculator = new RodPullCalculator(config);
const gameCalculator = new RodPullCalculator(gameConfig);
const controlledPullLimit2Kg =
  2.0 * Math.min(1, rodPullConfig.controlledPullLimitRatio ?? 0.85);
const unlockedDragPullLimit2Kg = Math.min(1.9, controlledPullLimit2Kg);
const retrievePolicyResolver = new IdleRetrievePolicyResolver();
const poleIdleParams = retrievePolicyResolver.resolve({
  rod: { hasReel: false },
  reel: null,
}).getRetrieveParams({ config: CONFIG });
approx(
  poleIdleParams.targetSpeedPxPerSec,
  poleIdleRetrieveConfig.speedMetersPerSecond * pixelsPerMeter,
  0.001,
  "pole idle retrieve uses dedicated meters-per-second policy",
);
approx(
  poleIdleParams.waterFrictionMultiplier,
  poleIdleRetrieveConfig.waterFrictionMultiplier,
  0.001,
  "pole idle retrieve uses dedicated friction policy",
);

approx(
  gameCalculator.calculateAvailableDistance({ rodLengthMeters: 3.6, slackMeters: 0 }),
  1.8,
  0.001,
  "game rod stroke multiplier halves available pull distance",
);
approx(
  gameCalculator.calculateAvailableDistance({
    rodLengthMeters: 3.6,
    slackMeters: 1.8,
    fishDistanceMeters: 1.8,
  }),
  1.8,
  0.001,
  "fish inside real rod stroke remains reachable despite base line pump credit",
);
approx(
  calculator.calculateAvailableDistance({ rodLengthMeters: 3.6, slackMeters: 0 }),
  3.6,
  0.001,
  "rod 3.6m + pump credit 0m => available pull 3.6m",
);
approx(
  calculator.calculateAvailableDistance({ rodLengthMeters: 3.6, slackMeters: 2 }),
  3.6,
  0.001,
  "rod 3.6m + pump credit 2m still allows a full fresh pull",
);
approx(
  calculator.calculateAvailableDistance({ rodLengthMeters: 3.6, slackMeters: 4 }),
  3.6,
  0.001,
  "rod 3.6m + pump credit 4m still allows a full fresh pull",
);
approx(
  calculator.calculateAvailableDistance({
    rodLengthMeters: 3.6,
    slackMeters: 4,
    fishDistanceMeters: 0.2,
  }),
  3.6,
  0.001,
  "near-bank fish also gets a full fresh pull when pump credit exists",
);

const forceLimit = calculator.calculateForceLimit({
  fishForceKg: 1.1,
  dragLimitKg: 1.9,
  maxTackleLoadKg: 2.0,
  dragLocked: false,
});
approx(
  forceLimit.availableExtraForceKg,
  unlockedDragPullLimit2Kg,
  0.001,
  "available extra force is clamped by unlocked reel drag limit",
);

const fishRetrieveModel = new FishPullResistanceModel(fishRetrieveConfig);
const fishRetrieveSystem = new FishRetrieveSystem(fishRetrieveConfig);
const bodyResistanceFromConfig = fishRetrieveSystem.calculate({
  dtSec: 1,
  rodPullResult: { active: true, ratio: 1 },
  forceData: {
    fishWeightKg: 0.1,
    fishPhysicsConfig: {},
    staticFishForceKg: 5,
    totalFishForceKg: 0,
    awayFromPlayerRatio: 0,
  },
});
approx(
  bodyResistanceFromConfig.bodyResistanceKg,
  0.1 * fishRetrieveConfig.tautBodyResistanceKgPerKg,
  0.001,
  "taut body resistance comes from fishRetrieve config, not staticFishForceKg",
);

const nestedRetrieveSettings = FishRetrievePhysicsSettings.from({
  passiveBodyResistance: { tautBodyResistanceKgPerKg: 0.33 },
  waterDragWhilePulling: {
    referencePullSpeedMetersPerSecond: 1.5,
    dragKgPerKgAtReferenceSpeed: 2.25,
  },
  playerPressureTransfer: { referenceWeightKg: 0.75 },
}).toLegacyConfig();
approx(
  nestedRetrieveSettings.tautBodyResistanceKgPerKg,
  0.33,
  0.001,
  "FishRetrievePhysicsSettings maps grouped passive body resistance to legacy contract",
);
approx(
  nestedRetrieveSettings.waterDragKgPerKgAtReferenceSpeed,
  2.25,
  0.001,
  "FishRetrievePhysicsSettings maps grouped water drag to legacy contract",
);
approx(
  nestedRetrieveSettings.playerPressureTransferReferenceWeightKg,
  0.75,
  0.001,
  "FishRetrievePhysicsSettings maps grouped pressure transfer to legacy contract",
);

const liveRetrieveConfig = { ...fishRetrieveConfig };
const liveRetrieveSystem = new FishRetrieveSystem({
  getFishRetrieveConfig: () => liveRetrieveConfig,
});
const fastLiveRetrieve = liveRetrieveSystem.calculate({
  dtSec: 1,
  rodPullResult: { active: true, ratio: 1, forceKg: 0.85 },
  forceData: {
    fishWeightKg: 0.5,
    totalFishForceKg: 0,
    awayFromPlayerRatio: 0,
    fishPhysicsConfig: {},
  },
});
liveRetrieveConfig.waterDragKgPerKgAtReferenceSpeed *= 4;
const slowLiveRetrieve = liveRetrieveSystem.calculate({
  dtSec: 1,
  rodPullResult: { active: true, ratio: 1, forceKg: 0.85 },
  forceData: {
    fishWeightKg: 0.5,
    totalFishForceKg: 0,
    awayFromPlayerRatio: 0,
    fishPhysicsConfig: {},
  },
});
assert(
  slowLiveRetrieve.actualFishPullSpeedMetersPerSecond <
    fastLiveRetrieve.actualFishPullSpeedMetersPerSecond,
  "FishRetrieveSystem reads retrieve config live instead of snapshotting constructor values",
);

const smallStaticFish = fishRetrieveModel.calculate({
  dtSec: 1,
  holdRatio: 1,
  playerPullPressureKg: 0.85,
  fishWeightKg: 0.1,
  totalFishForceKg: 0,
  awayFromPlayerRatio: 0,
});
assert(smallStaticFish.lineTensionKg < 0.35, "100g fish full hold stays well below 1kg tension");
assert(smallStaticFish.actualFishPullSpeedMetersPerSecond > 0, "100g fish full hold moves toward player");

const mediumStaticFish = fishRetrieveModel.calculate({
  dtSec: 1,
  holdRatio: 1,
  playerPullPressureKg: 0.85,
  fishWeightKg: 0.5,
  totalFishForceKg: 0,
  awayFromPlayerRatio: 0,
});
assert(mediumStaticFish.lineTensionKg > 0.45, "500g fish full hold reaches moderate tension");
assert(mediumStaticFish.lineTensionKg < 0.8, "500g fish full hold stays below danger-zone at starter balance");
assert(
  mediumStaticFish.actualFishPullSpeedMetersPerSecond < smallStaticFish.actualFishPullSpeedMetersPerSecond,
  "heavier fish moves slower at the same pull pressure",
);

const largeStaticFish = fishRetrieveModel.calculate({
  dtSec: 1,
  holdRatio: 1,
  playerPullPressureKg: 0.85,
  fishWeightKg: 1.0,
  totalFishForceKg: 0,
  awayFromPlayerRatio: 0,
});
assert(largeStaticFish.lineTensionKg > mediumStaticFish.lineTensionKg, "larger fish transfers more player pressure into tension");

const slowPullFish = fishRetrieveModel.calculate({
  dtSec: 1,
  holdRatio: 0.3,
  playerPullPressureKg: 0.25,
  fishWeightKg: 0.5,
  totalFishForceKg: 0,
  awayFromPlayerRatio: 0,
});
assert(
  mediumStaticFish.actualFishPullSpeedMetersPerSecond > slowPullFish.actualFishPullSpeedMetersPerSecond,
  "increased pull pressure raises retrieve speed",
);

const highDragFish = new FishPullResistanceModel({
  ...fishRetrieveConfig,
  waterDragKgPerKgAtReferenceSpeed: fishRetrieveConfig.waterDragKgPerKgAtReferenceSpeed * 2,
}).calculate({
  dtSec: 1,
  holdRatio: 1,
  playerPullPressureKg: 0.85,
  fishWeightKg: 0.5,
  totalFishForceKg: 0,
  awayFromPlayerRatio: 0,
});
assert(
  highDragFish.actualFishPullSpeedMetersPerSecond < mediumStaticFish.actualFishPullSpeedMetersPerSecond,
  "increased waterDragKgPerKgAtReferenceSpeed lowers speed at the same pull pressure",
);

const profileDragFish = fishRetrieveModel.calculate({
  dtSec: 1,
  holdRatio: 1,
  playerPullPressureKg: 0.85,
  fishWeightKg: 0.5,
  totalFishForceKg: 0,
  awayFromPlayerRatio: 0,
  fishConfig: { retrieveProfile: { waterDragMultiplier: 2 } },
});
assert(
  profileDragFish.actualFishPullSpeedMetersPerSecond <
    mediumStaticFish.actualFishPullSpeedMetersPerSecond,
  "fish retrieveProfile.waterDragMultiplier is accepted as the structured species override",
);

const activeAwayFish = fishRetrieveModel.calculate({
  dtSec: 1,
  holdRatio: 1,
  playerPullPressureKg: 0.85,
  fishWeightKg: 0.2,
  totalFishForceKg: 0.1,
  awayFromPlayerRatio: 1,
});
approx(
  activeAwayFish.activeAwayForceKg,
  0.1,
  0.001,
  "fish swimming away adds full active force to tension",
);

const sideFish = fishRetrieveModel.calculate({
  dtSec: 1,
  holdRatio: 1,
  playerPullPressureKg: 0.85,
  fishWeightKg: 0.2,
  totalFishForceKg: 0.4,
  awayFromPlayerRatio: 0.5,
});
approx(sideFish.activeAwayForceKg, 0.2, 0.001, "sideways fish adds partial active force");

const towardFish = fishRetrieveModel.calculate({
  dtSec: 1,
  holdRatio: 1,
  playerPullPressureKg: 0.85,
  fishWeightKg: 0.2,
  totalFishForceKg: 0.4,
  awayFromPlayerRatio: 0,
});
approx(towardFish.activeAwayForceKg, 0, 0.001, "fish moving toward player adds no active away force");

const dominatedFish = fishRetrieveModel.calculate({
  dtSec: 1,
  holdRatio: 1,
  playerPullPressureKg: 0.85,
  fishWeightKg: 0.2,
  totalFishForceKg: 1.0,
  awayFromPlayerRatio: 1,
});
approx(
  dominatedFish.actualFishPullSpeedMetersPerSecond,
  0,
  0.001,
  "activeAwayForce greater than player pull pressure stops player retrieve",
);
approx(
  dominatedFish.waterDragKg,
  0,
  0.001,
  "water drag uses actual fish retrieve speed, not pull intent",
);
approx(
  dominatedFish.accelerationLoadKg,
  0,
  0.001,
  "acceleration load uses actual fish retrieve acceleration",
);
assert(
  activeAwayFish.actualFishPullSpeedMetersPerSecond > 0,
  "activeAwayForce below player pull pressure still lets fish move toward player",
);
assert(
  dominatedFish.lineTensionKg > activeAwayFish.lineTensionKg,
  "dash-sized active force is immediately visible in tension",
);

const exhaustedLandingFish = fishRetrieveModel.calculate({
  dtSec: 1,
  holdRatio: 1,
  playerPullPressureKg: 0.85,
  fishWeightKg: 0.5,
  totalFishForceKg: 1.0,
  awayFromPlayerRatio: 1,
  lineDistanceMeters: 0,
  landingDistanceMeters: 1,
  fishCondition: {
    phase: "exhaustion",
    maxPoints: 100,
    currentExhaustion: 0,
  },
});
approx(
  exhaustedLandingFish.bodyResistanceKg,
  0.5,
  0.001,
  "fully exhausted fish in landing zone loads real body weight",
);
approx(
  exhaustedLandingFish.activeAwayForceKg,
  0,
  0.001,
  "fully exhausted fish in landing zone disables active state force",
);
approx(
  exhaustedLandingFish.waterDragKg,
  0,
  0.001,
  "landing zone disables water drag load",
);
assert(
  exhaustedLandingFish.lineTensionKg <= 0.501,
  "fully exhausted landing tension comes from lifted fish weight only",
);

const freshLandingFish = fishRetrieveModel.calculate({
  dtSec: 1,
  holdRatio: 1,
  playerPullPressureKg: 0.85,
  fishWeightKg: 0.5,
  totalFishForceKg: 0.2,
  awayFromPlayerRatio: 1,
  lineDistanceMeters: 0,
  landingDistanceMeters: 1,
  fishCondition: {
    phase: "stamina",
    maxPoints: 100,
    currentExhaustion: 100,
  },
});
approx(
  freshLandingFish.waterDragKg,
  0,
  0.001,
  "non-exhausted fish in landing zone still removes water drag",
);
approx(
  freshLandingFish.activeAwayForceKg,
  0.2,
  0.001,
  "non-exhausted fish in landing zone keeps active state force",
);

const guaranteedBreakStress = new TackleStressSystem({
  rod: { getEffectiveMaxLoadKg: () => 1 },
  reel: { hasReel: () => false },
  lineSystem: {
    getEffectiveLineMaxLoadKg: () => 1,
    calculateBreakLossMeters: () => 0,
  },
  config: CONFIG,
  rng: { next: () => 0 },
});
guaranteedBreakStress.updateTarget(1, 0.016, {
  ...CONFIG.tension,
  overloadGraceMs: 0,
});
assert(guaranteedBreakStress.isBroken(), "100% tension guarantees tackle failure");

const dragBlocked = calculator.calculateNextState({
  dtSec: 1,
  input: { pullHeld: true },
  previousState: new RodPullState(),
  rodLengthMeters: 3.6,
  slackMeters: 0,
  fishForceKg: 2.2,
  dragLimitKg: 1.9,
  maxTackleLoadKg: 2.0,
  dragLocked: false,
});
assert(dragBlocked.blockedReason !== "drag_slipping", "rod pull calculator no longer blocks on drag slipping");
assert(dragBlocked.ratio > 0, "rod pull calculator still charges player demand before tension system resolves drag slip");
approx(
  dragBlocked.forceKg,
  unlockedDragPullLimit2Kg,
  0.001,
  "unlocked reel drag clamps rod pull pressure before fish retrieve",
);

const zeroDragPull = calculator.calculateNextState({
  dtSec: 1,
  input: { pullHeld: true },
  previousState: new RodPullState(),
  rodLengthMeters: 3.6,
  slackMeters: 0,
  fishForceKg: 0.5,
  dragLimitKg: 0,
  maxTackleLoadKg: 2.0,
  dragLocked: false,
  lineHasReserve: true,
});
approx(
  zeroDragPull.forceKg,
  0,
  0.001,
  "drag 0 with spare reel line creates no player pull pressure",
);
assert(!zeroDragPull.canMoveFish, "drag 0 with spare reel line cannot pull fish toward player");


const noReelFullHold = calculator.calculateNextState({
  dtSec: 10,
  input: { pullHeld: true },
  previousState: new RodPullState(),
  rodLengthMeters: 3.6,
  slackMeters: 0,
  fishForceKg: 0,
  dragLimitKg: 0,
  maxTackleLoadKg: 2.0,
  dragLocked: true,
});
approx(
  noReelFullHold.forceKg,
  controlledPullLimit2Kg,
  0.001,
  "full hold is capped below break load by controlled pull limit",
);

const noReelPull = calculator.calculateNextState({
  dtSec: 1,
  input: { pullHeld: true },
  previousState: new RodPullState(),
  rodLengthMeters: 3.6,
  slackMeters: 0,
  fishForceKg: 1.1,
  dragLimitKg: 2.0,
  maxTackleLoadKg: 2.0,
  dragLocked: true,
});
assert(noReelPull.blockedReason !== "drag_slipping", "no-reel tackle does not drag-slip");
assert(noReelPull.forceKg > 0, "no-reel tackle can rod-pull without reel drag");

const pullState = calculator.calculateNextState({
  dtSec: 10,
  input: { pullHeld: true },
  previousState: new RodPullState(),
  rodLengthMeters: 3.6,
  slackMeters: 0,
  fishForceKg: 1.1,
  dragLimitKg: 1.9,
  maxTackleLoadKg: 2.0,
  dragLocked: false,
});
approx(pullState.forceKg, unlockedDragPullLimit2Kg, 0.001, "pull force reaches unlocked reel drag limit");
approx(pullState.totalTensionKg, pullState.forceKg, 0.001, "rod pull totalTensionKg is legacy demand-only read-model");
assert(pullState.blockedReason === "max_distance_reached", "rod pull reaches stroke limit; drag slip is resolved by tension system");

const lightFishPull = calculator.calculateNextState({
  dtSec: 1,
  input: { pullHeld: true },
  previousState: new RodPullState(),
  rodLengthMeters: 3.6,
  slackMeters: 0,
  fishForceKg: 0.1,
  dragLimitKg: 1.9,
  maxTackleLoadKg: 2.0,
  dragLocked: false,
});
const heavyFishPull = calculator.calculateNextState({
  dtSec: 1,
  input: { pullHeld: true },
  previousState: new RodPullState(),
  rodLengthMeters: 3.6,
  slackMeters: 0,
  fishForceKg: 1.6,
  dragLimitKg: 1.9,
  maxTackleLoadKg: 2.0,
  dragLocked: false,
});
approx(
  lightFishPull.chargeSpeedMultiplier,
  heavyFishPull.chargeSpeedMultiplier,
  0.001,
  "rod pull charge speed no longer depends on legacy fish force",
);

const tensionSystem = new TensionSystem();
const strokeOnlyTension = tensionSystem.calculate({
  fishForceKg: 1.1,
  rodPullForceKg: 0,
  dragLimitKg: 1.9,
  hardLineLimit: false,
  lineHasReserve: true,
  dragLocked: false,
});
approx(
  strokeOnlyTension.tensionKg,
  1.1,
  0.001,
  "line tension ignores unrecovered rod stroke without active pull force",
);
const slackTension = tensionSystem.calculate({
  fishForceKg: 2.2,
  rodPullForceKg: 0,
  dragLimitKg: 1.9,
  hardLineLimit: false,
  lineHasReserve: false,
  dragLocked: false,
  slackMeters: 3.6,
});
approx(
  slackTension.tensionKg,
  2.2,
  0.001,
  "released rod stroke keeps fish load while slack exists",
);
const limitedTension = tensionSystem.calculate({
  fishForceKg: 1.1,
  rodPullForceKg: 0.8,
  dragLimitKg: 1.9,
  hardLineLimit: false,
  lineHasReserve: true,
  dragLocked: false,
});
approx(limitedTension.tensionKg, 1.9, 0.001, "tension equals fish plus rod pull at drag limit");

const hardLimitTension = tensionSystem.calculate({
  fishForceKg: 2.2,
  rodPullForceKg: 0.5,
  dragLimitKg: 1.9,
  hardLineLimit: true,
  lineHasReserve: false,
  dragLocked: false,
});
approx(hardLimitTension.tensionKg, 2.7, 0.001, "hard line limit can exceed drag limit");

const hardLimitPull = calculator.calculateNextState({
  dtSec: 1,
  input: { pullHeld: true },
  previousState: new RodPullState(),
  rodLengthMeters: 3.6,
  slackMeters: 0,
  fishForceKg: 2.2,
  dragLimitKg: 0,
  maxTackleLoadKg: 2.0,
  dragLocked: false,
  hardLineLimit: true,
});
assert(hardLimitPull.ratio > 0, "hard line limit does not block rod pull charge");
assert(hardLimitPull.forceKg > 0, "hard line limit allows risky rod pull force");
assert(hardLimitPull.canMoveFish, "hard line limit still allows pulling fish toward rod");

const emptySpoolSlackPull = calculator.calculateNextState({
  dtSec: 1,
  input: { pullHeld: true },
  previousState: new RodPullState(),
  rodLengthMeters: 3.6,
  slackMeters: 0.5,
  fishForceKg: 2.2,
  dragLimitKg: 1.9,
  maxTackleLoadKg: 2.0,
  dragLocked: false,
  hardLineLimit: false,
  lineHasReserve: false,
});
assert(emptySpoolSlackPull.blockedReason !== "drag_slipping", "empty spool does not freeze rod pull as drag slipping");
assert(emptySpoolSlackPull.forceKg > 0, "empty spool allows risky rod pull force before hard line limit");
assert(emptySpoolSlackPull.canMoveFish, "empty spool still allows pulling fish toward rod");
assert(emptySpoolSlackPull.totalTensionKg > 0, "empty spool rod pull exposes demand-only legacy tension read-model");

const looseLineCalculator = new LooseLineCalculator();
approx(
  looseLineCalculator.calculateActualSlackMeters({
    releasedMeters: 3,
    fishDistanceMeters: 2,
    fishMovingTowardPlayer: false,
    playerPulling: false,
    reelRecovering: false,
  }),
  0,
  0.001,
  "actual loose line remains an explicit future placeholder until movement detection is wired",
);

const mapper = new PullInputMapper();
let inputState = mapper.update({ isPulling: true });
assert(inputState.pullStartedThisFrame, "pull mapper reports start");
inputState = mapper.update({ isPulling: false });
assert(inputState.pullReleasedThisFrame, "pull mapper reports release");

const pumpCreditSystem = new RodPullSystem(config);
const pumpCreditState = pumpCreditSystem.update({
  dtSec: 1,
  inputState: { pullHeld: true },
  rod: { getLengthMeters: () => 3.6 },
  pumpCreditMeters: 2,
  maxTackleLoadKg: 2,
  dragLocked: false,
});
approx(
  pumpCreditState.availableDistanceMeters,
  3.6,
  0.001,
  "RodPullSystem keeps full pull distance even when pumpCreditMeters exists",
);

const system = new RodPullSystem(config);
system.update({
  dtSec: 1,
  inputState: { pullHeld: true },
  rod: { getLengthMeters: () => 3.6 },
  slackMeters: 0,
  fishForceKg: 1.1,
  dragLimitKg: 1.9,
  maxTackleLoadKg: 2,
  dragLocked: false,
});
system.recordAppliedStroke({ movedMeters: 2.1 });
approx(
  system.getState().rodStrokeRatio,
  2.1 / 3.6,
  0.001,
  "2.1m rod stroke on 3.6m rod fills stroke bar to 58.4%",
);
const releasedState = system.update({
  dtSec: 0.016,
  inputState: { pullHeld: false, pullReleasedThisFrame: true },
  rod: { getLengthMeters: () => 3.6 },
  slackMeters: 1.8,
  fishForceKg: 1.1,
  dragLimitKg: 1.9,
  maxTackleLoadKg: 2,
  dragLocked: false,
});
assert(releasedState.forceKg === 0, "release removes active rod pull force immediately");
approx(
  releasedState.rodStrokeUnrecoveredMeters,
  2.1,
  0.001,
  "release does not reset unrecovered rod stroke",
);
const halfRecoveredState = system.recoverStroke({ recoveredMeters: 0.5 });
approx(
  halfRecoveredState.rodStrokeUnrecoveredMeters,
  1.6,
  0.001,
  "rod stroke bar falls by actual reel recovered meters",
);
approx(
  halfRecoveredState.rodStrokeUsedMeters,
  1.6,
  0.001,
  "recovered reel line frees the same amount of rod stroke movement budget",
);
system.recoverStroke({ recoveredMeters: 1.6 });
approx(system.getState().rodStrokeRatio, 0, 0.001, "rod stroke bar reaches 0 when reel recovers all pump credit");
approx(system.getState().rodStrokeUsedMeters, 0, 0.001, "full reel recovery clears hidden rod stroke movement budget");
system.recordAppliedStroke({ movedMeters: 3.6 });
system.syncStrokeToSlack({ slackMeters: 0.4 });
approx(
  system.getState().rodStrokeUnrecoveredMeters,
  0.4,
  0.001,
  "rod stroke bar cannot exceed actual pump credit",
);
approx(
  system.getState().rodStrokeUsedMeters,
  0.4,
  0.001,
  "pump-credit clamp also frees hidden rod stroke movement budget",
);
system.syncStrokeToSlack({ slackMeters: 0 });
approx(
  system.getState().rodStrokeRatio,
  0,
  0.001,
  "fish consuming slack clears unrecovered rod stroke",
);
approx(
  system.getState().rodStrokeUsedMeters,
  0,
  0.001,
  "fish consuming slack clears hidden rod stroke movement budget",
);

const interruptedRecoverySystem = new RodPullSystem(config);
interruptedRecoverySystem.update({
  dtSec: 1,
  inputState: { pullHeld: true },
  rod: { getLengthMeters: () => 3.6 },
  slackMeters: 0,
  fishForceKg: 1.1,
  dragLimitKg: 1.9,
  maxTackleLoadKg: 2,
  dragLocked: false,
});
interruptedRecoverySystem.recordAppliedStroke({ movedMeters: 1.8 });
interruptedRecoverySystem.update({
  dtSec: 0.016,
  inputState: { pullHeld: false, pullReleasedThisFrame: true },
  rod: { getLengthMeters: () => 3.6 },
  slackMeters: 1.8,
  fishForceKg: 1.1,
  dragLimitKg: 1.9,
  maxTackleLoadKg: 2,
  dragLocked: false,
});
const unrecoveredBeforeRestart = interruptedRecoverySystem.getState().rodStrokeUnrecoveredMeters;
const restartedPull = interruptedRecoverySystem.update({
  dtSec: 0.016,
  inputState: { pullHeld: true, pullStartedThisFrame: true },
  rod: { getLengthMeters: () => 3.6 },
  slackMeters: 1.8,
  fishForceKg: 1.1,
  dragLimitKg: 1.9,
  maxTackleLoadKg: 2,
  dragLocked: false,
});
assert(restartedPull.ratio < 0.02, "new hold starts active pull from fresh force ratio");
approx(
  restartedPull.rodStrokeUnrecoveredMeters,
  unrecoveredBeforeRestart,
  0.001,
  "new hold before recovery keeps the visible rod stroke position",
);

const lineMock = {
  recovered: 0,
  recoverSlack(args) {
    this.args = args;
    this.recovered = 1.25;
    return this.recovered;
  },
};
const reelSystem = new ReelSystem({ autoRecoverSlack: true });
const recovered = reelSystem.recoverSlack({
  dtSec: 1,
  lineSystem: lineMock,
  reel: { hasReel: () => true },
  tensionKg: 0.2,
  inputRecover: true,
});
approx(recovered, 1.25, 0.001, "reel system delegates pump-credit recovery only through line system");

approx(
  calculator.calculateAvailableDistance({ rodLengthMeters: 3.6, slackMeters: 2 }),
  3.6,
  0.001,
  "repeated hold before pump-credit recovery keeps full pull distance",
);

const fightPhysics = new FightPhysicsSystem(CONFIG);
const floatEntity = {
  position: new Vector2(100, 0),
  velocity: new Vector2(0, 0),
  getPosition() { return this.position; },
  getVelocity() { return this.velocity; },
  update() {},
};
const lineMockForFight = {
  releasedMeters: 2,
  distanceMeters: 2,
  remainingMeters: 8,
  updateDistance(position, rodTip) {
    this.distanceMeters = Math.hypot(position.x - rodTip.x, position.y - rodTip.y) / pixelsPerMeter;
    this.remainingMeters = Math.max(0, 10 - this.releasedMeters);
    return {
      releasedMeters: this.releasedMeters,
      remainingMeters: this.remainingMeters,
      maxRemainingMeters: 8,
      baseReachMeters: 2,
      totalLengthMeters: 10,
      distanceMeters: this.distanceMeters,
      slackMeters: Math.max(0, this.releasedMeters - this.distanceMeters),
      isFullyExtended: false,
      lineExtensionRatio: this.distanceMeters / Math.max(0.001, this.releasedMeters),
    };
  },
  releaseForDistance() {
    return {
      releasedMeters: 0,
      demandedMeters: 0,
      unsatisfiedMeters: 0,
      didSlip: false,
      hardLimitReached: false,
    };
  },
  constrainPosition() {
    return { constrained: false, correctionPx: 0, hardLimit: false };
  },
  recoverSlack() { return 0; },
  getEffectiveLineMaxLoadKg() { return 2; },
};
const stressMock = {
  target: 0,
  updateTarget(value) { this.target = value; },
  getTensionKg() { return this.target; },
  getEffectiveMaxTackleLoadKg() { return 2; },
  setDebugData(data) { this.debug = data; },
};
const fightResult = fightPhysics.step({
  dtMs: 1000,
  floatEntity,
  bounds: { left: -1000, right: 1000, top: -1000, bottom: 1000 },
  input: { isPulling: true, pointerDown: true, pullDirection: { x: 0, y: 1 } },
  env: {},
  checkWater: () => true,
  rodTipPosition: { x: 0, y: 0 },
  rod: { getLengthMeters: () => 3.6 },
  reel: { hasReel: () => true },
  fishForceSystem: {
    calculate() {
      return {
        behavior: { agility: 1 },
        targetVelocity: new Vector2(0, 0),
        fishWeightKg: 0.05,
        fishPhysicsConfig: {},
        staticFishForceKg: 0.005,
        dynamicFishForceKg: 0,
        totalFishForceKg: 0,
        player: {
          dragLimitKg: 1.9,
          forceKg: 2,
          effectivePullKg: 0,
          pullCapacityKg: 1.9,
          netPullKg: 0,
          dragHoldRatio: 1,
          canDragHoldFish: true,
          canWinDistance: true,
          shouldSlipDrag: false,
          staminaPressureRatio: 1,
          vector: new Vector2(0, 0),
          pullDir: new Vector2(-1, 0),
          isPulling: true,
        },
        debug: {},
      };
    },
  },
  lineSystem: lineMockForFight,
  dragSystem: { value: 0.95, update() {}, getDebugData() { return { dragRatio: 0.95, dragPercent: 95 }; } },
  pullInputMapper: new PullInputMapper(),
  rodPullSystem: new RodPullSystem(gameConfig),
  reelSystem: new ReelSystem({ autoRecoverSlack: true }),
  tensionSystem: new TensionSystem(),
  stressSystem: stressMock,
  fishCondition: {},
  buffs: null,
});
assert(fightResult.forces.pY > 0, "fight physics reports rod pull force");
assert(floatEntity.getPosition().x < 100, "fight physics moves fish toward rod only through rod pull delta");

const recoveredStrokeFloat = {
  position: new Vector2(200, 0),
  velocity: new Vector2(0, 0),
  getPosition() { return this.position; },
  getVelocity() { return this.velocity; },
  update() {},
};
const recoveredStrokeLine = {
  releasedMeters: 4,
  distanceMeters: 4,
  remainingMeters: 16,
  updateDistance(position, rodTip) {
    this.distanceMeters = Math.hypot(position.x - rodTip.x, position.y - rodTip.y) / pixelsPerMeter;
    this.remainingMeters = Math.max(0, 20 - this.releasedMeters);
    return {
      releasedMeters: this.releasedMeters,
      remainingMeters: this.remainingMeters,
      maxRemainingMeters: 16,
      baseReachMeters: 4,
      totalLengthMeters: 20,
      distanceMeters: this.distanceMeters,
      slackMeters: Math.max(0, this.releasedMeters - this.distanceMeters),
      isFullyExtended: false,
      lineExtensionRatio: this.distanceMeters / Math.max(0.001, this.releasedMeters),
      canReleaseLine: true,
      spoolEmpty: false,
    };
  },
  releaseForDistance() {
    return {
      releasedMeters: 0,
      demandedMeters: 0,
      satisfiedMeters: 0,
      unsatisfiedMeters: 0,
      didSlip: false,
      hardLimitReached: false,
      hasReserveAfterRelease: this.remainingMeters > 0.001,
    };
  },
  constrainPosition() {
    return { constrained: false, correctionPx: 0, hardLimit: false };
  },
  recoverSlack() { return 0; },
  getEffectiveLineMaxLoadKg() { return 1; },
};
const recoveredStrokeStress = {
  target: 0,
  updateTarget(value) { this.target = value; },
  getTensionKg() { return this.target; },
  getEffectiveMaxTackleLoadKg() { return 1; },
  setDebugData(data) { this.debug = data; },
};
const recoveredStrokeRodPullResult = {
  active: true,
  ratio: 1,
  holdRatio: 1,
  forceKg: 0.5,
  distanceMeters: 1.8,
  maxDistanceMeters: 1.8,
  availableDistanceMeters: 1.8,
  availableExtraForceKg: 0.5,
  deltaMeters: 0,
  canMoveFish: false,
  blockedReason: "max_distance_reached",
  rodStrokeRatio: 0,
  rodStrokeUsedMeters: 0,
  rodStrokeUnrecoveredMeters: 0,
  rodStrokeCapacityMeters: 1.8,
  lineHasReserve: true,
  canReleaseLine: true,
  spoolEmpty: false,
};
const recoveredStrokeRodPull = {
  update() {
    return recoveredStrokeRodPullResult;
  },
  recordAppliedStroke({ movedMeters }) {
    this.movedMeters = movedMeters;
  },
  recoverStroke() {},
  syncStrokeToPumpCredit() {},
  getState() {
    return recoveredStrokeRodPullResult;
  },
};
fightPhysics.step({
  dtMs: 1000,
  floatEntity: recoveredStrokeFloat,
  bounds: { left: -1000, right: 1000, top: -1000, bottom: 1000 },
  input: { isPulling: true, pointerDown: true, pullDirection: { x: 0, y: 1 } },
  env: {},
  checkWater: () => true,
  rodTipPosition: { x: 0, y: 0 },
  rod: { getLengthMeters: () => 3.6 },
  reel: { hasReel: () => true, hasDrag: () => true, getEffectiveMaxLoadKg: () => 1, getMaxLoadKg: () => 1 },
  fishForceSystem: {
    calculate() {
      return {
        behavior: { agility: 1 },
        targetVelocity: new Vector2(0, 0),
        fishWeightKg: 0.1,
        fishPhysicsConfig: {},
        staticFishForceKg: 0.015,
        dynamicFishForceKg: 0,
        totalFishForceKg: 0,
        awayFromPlayerRatio: 0,
        player: {
          dragLimitKg: 1,
          effectiveDragLimitKg: 1,
          dragLocked: false,
          forceKg: 1,
          effectivePullKg: 0,
          pullCapacityKg: 1,
          netPullKg: 0,
          dragHoldRatio: 1,
          canDragHoldFish: true,
          canWinDistance: true,
          shouldSlipDrag: false,
          staminaPressureRatio: 1,
          vector: new Vector2(0, 0),
          pullDir: new Vector2(-1, 0),
          isPulling: true,
        },
        debug: {},
      };
    },
  },
  lineSystem: recoveredStrokeLine,
  dragSystem: { value: 1, update() {}, getDebugData() { return { dragRatio: 1, dragPercent: 100 }; } },
  pullInputMapper: new PullInputMapper(),
  rodPullSystem: recoveredStrokeRodPull,
  reelSystem: new ReelSystem({ autoRecoverSlack: true }),
  tensionSystem: new TensionSystem(),
  stressSystem: recoveredStrokeStress,
  fishCondition: {},
  buffs: null,
});
assert(
  recoveredStrokeStress.debug.actualFishPullSpeedMps > 0,
  "max-distance demand does not block retrieve when recovered stroke budget is available",
);
assert(
  recoveredStrokeFloat.getPosition().x < 200,
  "recovered stroke budget lets hold move fish again without releasing hold",
);

const holdRecoverConfig = {
  ...CONFIG,
  physics: {
    ...CONFIG.physics,
    tackle: {
      ...CONFIG.physics.tackle,
      reel: {
        ...reelConfig,
        holdRecoverAfterFullStrokeMs: 100,
        holdRecoverStrokeRatio: 1,
      },
    },
  },
};
const holdRecoverFightPhysics = new FightPhysicsSystem(holdRecoverConfig);
const holdRecoverFloat = {
  position: new Vector2(150, 0),
  velocity: new Vector2(0, 0),
  getPosition() { return this.position; },
  getVelocity() { return this.velocity; },
  update() {},
};
const holdRecoverLine = {
  releasedMeters: 5,
  distanceMeters: 3,
  remainingMeters: 15,
  recoveredMeters: 0,
  updateDistance(position, rodTip) {
    this.distanceMeters = Math.hypot(position.x - rodTip.x, position.y - rodTip.y) / pixelsPerMeter;
    this.remainingMeters = Math.max(0, 20 - this.releasedMeters);
    return {
      releasedMeters: this.releasedMeters,
      remainingMeters: this.remainingMeters,
      maxRemainingMeters: 16,
      baseReachMeters: 4,
      totalLengthMeters: 20,
      distanceMeters: this.distanceMeters,
      slackMeters: Math.max(0, this.releasedMeters - this.distanceMeters),
      isFullyExtended: false,
      lineExtensionRatio: this.distanceMeters / Math.max(0.001, this.releasedMeters),
      canReleaseLine: true,
      spoolEmpty: false,
    };
  },
  releaseForDistance() {
    return {
      releasedMeters: 0,
      demandedMeters: 0,
      satisfiedMeters: 0,
      unsatisfiedMeters: 0,
      didSlip: false,
      hardLimitReached: false,
      hasReserveAfterRelease: this.remainingMeters > 0.001,
    };
  },
  constrainPosition() {
    return { constrained: false, correctionPx: 0, hardLimit: false };
  },
  recoverLineCredit({ hasReel, inputRecover, reel, tensionKg, dtSec }) {
    if (!hasReel || !inputRecover) return 0;
    const speed = Number(reel.getRetrieveSpeedMetersPerSec?.()) || 0;
    const limit = Math.min(
      Number(reel.getEffectiveMaxLoadKg?.()) || 1,
      Number(this.getEffectiveLineMaxLoadKg()) || 1,
    );
    const efficiency = Math.max(0, Math.min(1, 1 - (Number(tensionKg) || 0) / Math.max(0.001, limit)));
    const amount = speed * efficiency * Math.max(0, Number(dtSec) || 0);
    const nextReleased = Math.max(this.distanceMeters, 4, this.releasedMeters - amount);
    const recovered = Math.max(0, this.releasedMeters - nextReleased);
    this.releasedMeters = nextReleased;
    this.recoveredMeters = recovered;
    return recovered;
  },
  recoverSlack(args) {
    return this.recoverLineCredit(args || {});
  },
  getEffectiveLineMaxLoadKg() { return 1; },
};
const holdRecoverStress = {
  target: 0,
  updateTarget(value) { this.target = value; },
  getTensionKg() { return this.target; },
  getEffectiveMaxTackleLoadKg() { return 1; },
  setDebugData(data) { this.debug = data; },
};
const fullStrokeRodPullResult = {
  active: true,
  ratio: 1,
  holdRatio: 1,
  forceKg: 0.1,
  distanceMeters: 1,
  maxDistanceMeters: 1,
  availableDistanceMeters: 0,
  deltaMeters: 0,
  canMoveFish: false,
  blockedReason: "max_distance_reached",
  rodStrokeRatio: 1,
  rodStrokeUsedMeters: 1,
  rodStrokeUnrecoveredMeters: 1,
  rodStrokeCapacityMeters: 1,
  lineHasReserve: true,
  canReleaseLine: true,
  spoolEmpty: false,
};
const holdRecoverRodPull = {
  update() {
    return fullStrokeRodPullResult;
  },
  recordAppliedStroke() {},
  recoverStroke() {},
  syncStrokeToPumpCredit() {},
  getState() {
    return fullStrokeRodPullResult;
  },
};
const holdRecoverReel = {
  hasReel() { return true; },
  hasDrag() { return true; },
  getEffectiveMaxLoadKg() { return 1; },
  getMaxLoadKg() { return 1; },
  getRetrieveSpeedMetersPerSec() { return 1; },
};
const holdRecoverForceSystem = {
  calculate() {
    return {
      behavior: { agility: 1 },
      targetVelocity: new Vector2(0, 0),
      fishWeightKg: 0.1,
      fishPhysicsConfig: {},
      staticFishForceKg: 0.01,
      dynamicFishForceKg: 0,
      totalFishForceKg: 0,
      awayFromPlayerRatio: 0,
      player: {
        dragLimitKg: 0.95,
        effectiveDragLimitKg: 0.95,
        dragLocked: false,
        forceKg: 1,
        effectivePullKg: 0,
        pullCapacityKg: 0.95,
        netPullKg: 0,
        dragHoldRatio: 1,
        canDragHoldFish: true,
        canWinDistance: true,
        shouldSlipDrag: false,
        staminaPressureRatio: 1,
        vector: new Vector2(0, 0),
        pullDir: new Vector2(-1, 0),
        isPulling: true,
      },
      debug: {},
    };
  },
};
for (let i = 0; i < 3; i++) {
  holdRecoverFightPhysics.step({
    dtMs: 50,
    floatEntity: holdRecoverFloat,
    bounds: { left: -1000, right: 1000, top: -1000, bottom: 1000 },
    input: { isPulling: true, pointerDown: true, pullDirection: { x: 0, y: 1 } },
    env: {},
    checkWater: () => true,
    rodTipPosition: { x: 0, y: 0 },
    rod: { getLengthMeters: () => 4 },
    reel: holdRecoverReel,
    fishForceSystem: holdRecoverForceSystem,
    lineSystem: holdRecoverLine,
    dragSystem: { value: 0.95, update() {}, getDebugData() { return { dragRatio: 0.95, dragPercent: 95 }; } },
    pullInputMapper: new PullInputMapper(),
    rodPullSystem: holdRecoverRodPull,
    reelSystem: new ReelSystem({ autoRecoverSlack: true }),
    tensionSystem: new TensionSystem(),
    stressSystem: holdRecoverStress,
    fishCondition: {},
    buffs: null,
  });
}
assert(holdRecoverStress.debug.holdReelRecoverEligible, "full rod stroke hold can enable reel line recovery");
assert(holdRecoverStress.debug.holdReelRecoverActive, "full rod stroke hold starts reel recovery after configured delay");
assert(
  holdRecoverStress.debug.holdReelRecoverBlockedReason === "ready",
  "full rod stroke hold reports reel recovery as ready",
);
assert(holdRecoverStress.debug.lineRecoveredThisFrameMeters > 0, "hold recovery recovers line through reel system");
assert(holdRecoverLine.releasedMeters < 5, "hold recovery reduces released reel line");

const loadedHoldRecoverFightPhysics = new FightPhysicsSystem(holdRecoverConfig);
const loadedHoldRecoverFloat = {
  position: new Vector2(150, 0),
  velocity: new Vector2(0, 0),
  getPosition() { return this.position; },
  getVelocity() { return this.velocity; },
  update() {},
};
const loadedHoldRecoverLine = {
  releasedMeters: 3,
  distanceMeters: 3,
  remainingMeters: 0,
  recoveredMeters: 0,
  updateDistance(position, rodTip) {
    this.distanceMeters = Math.hypot(position.x - rodTip.x, position.y - rodTip.y) / pixelsPerMeter;
    this.remainingMeters = Math.max(0, 3 - this.releasedMeters);
    return {
      releasedMeters: this.releasedMeters,
      remainingMeters: this.remainingMeters,
      maxRemainingMeters: 2,
      baseReachMeters: 1,
      totalLengthMeters: 3,
      distanceMeters: this.distanceMeters,
      slackMeters: Math.max(0, this.releasedMeters - this.distanceMeters),
      recoverableLineMeters: Math.max(0, this.releasedMeters - this.distanceMeters),
      isFullyExtended:
        this.remainingMeters <= 0.001 &&
        this.distanceMeters >= this.releasedMeters * 0.995,
      lineExtensionRatio: this.distanceMeters / Math.max(0.001, this.releasedMeters),
      canReleaseLine: this.remainingMeters > 0.001,
      spoolEmpty: this.remainingMeters <= 0.001,
    };
  },
  releaseForDistance() {
    return {
      releasedMeters: 0,
      demandedMeters: 0,
      satisfiedMeters: 0,
      unsatisfiedMeters: 0,
      didSlip: false,
      hardLimitReached: false,
      hasReserveAfterRelease: false,
    };
  },
  constrainPosition() {
    return { constrained: false, correctionPx: 0, hardLimit: false };
  },
  recoverLineCredit({ hasReel, inputRecover, reel, tensionKg, dtSec, loadLimitKg }) {
    if (!hasReel || !inputRecover) return 0;
    const speed = Number(reel.getRetrieveSpeedMetersPerSec?.()) || 0;
    const limit = Number(loadLimitKg) || Number(reel.getEffectiveMaxLoadKg?.()) || 1;
    const efficiency = Math.max(0, Math.min(1, 1 - (Number(tensionKg) || 0) / Math.max(0.001, limit)));
    const amount = speed * efficiency * Math.max(0, Number(dtSec) || 0);
    const nextReleased = Math.max(this.distanceMeters, 1, this.releasedMeters - amount);
    const recovered = Math.max(0, this.releasedMeters - nextReleased);
    this.releasedMeters = nextReleased;
    this.recoveredMeters = recovered;
    return recovered;
  },
  recoverSlack(args) {
    return this.recoverLineCredit(args || {});
  },
  getEffectiveLineMaxLoadKg() { return 1; },
};
let loadedHoldRecoverStrokeRecovered = 0;
let loadedHoldRecoverSyncCalls = 0;
const loadedHoldRecoverRodPull = {
  update() {
    return {
      ...fullStrokeRodPullResult,
      forceKg: 0.6,
    };
  },
  recordAppliedStroke() {},
  recoverStroke({ recoveredMeters }) {
    loadedHoldRecoverStrokeRecovered += Math.max(0, Number(recoveredMeters) || 0);
  },
  syncStrokeToPumpCredit() {
    loadedHoldRecoverSyncCalls += 1;
  },
  getState() {
    return {
      ...fullStrokeRodPullResult,
      forceKg: 0.6,
    };
  },
};
const loadedHoldRecoverStress = {
  target: 0,
  updateTarget(value) { this.target = value; },
  getTensionKg() { return this.target; },
  getEffectiveMaxTackleLoadKg() { return 1; },
  setDebugData(data) { this.debug = data; },
};
for (let i = 0; i < 5; i++) {
  loadedHoldRecoverFightPhysics.step({
    dtMs: 50,
    floatEntity: loadedHoldRecoverFloat,
    bounds: { left: -1000, right: 1000, top: -1000, bottom: 1000 },
    input: { isPulling: true, pointerDown: true, pullDirection: { x: 0, y: 1 } },
    env: {},
    checkWater: () => true,
    rodTipPosition: { x: 0, y: 0 },
    rod: { getLengthMeters: () => 4 },
    reel: holdRecoverReel,
    fishForceSystem: holdRecoverForceSystem,
    lineSystem: loadedHoldRecoverLine,
    dragSystem: { value: 0.95, update() {}, getDebugData() { return { dragRatio: 0.95, dragPercent: 95 }; } },
    pullInputMapper: new PullInputMapper(),
    rodPullSystem: loadedHoldRecoverRodPull,
    reelSystem: new ReelSystem({ autoRecoverSlack: true }),
    tensionSystem: new TensionSystem(),
    stressSystem: loadedHoldRecoverStress,
    fishCondition: {},
    buffs: null,
  });
}
assert(
  loadedHoldRecoverStress.debug.holdReelRecoverActive,
  "loaded full-stroke hold keeps reel-assisted recovery active on a fully extended line",
);
assert(
  loadedHoldRecoverStress.debug.holdReelRecoverBlockedReason === "ready",
  "loaded full-stroke hold reports reel recovery as ready on a fully extended line",
);
assert(
  loadedHoldRecoverStress.debug.holdReelRecoverMoveMeters > 0,
  "hold recovery creates reel-assisted fish movement while the fully extended line is taut",
);
approx(
  loadedHoldRecoverStress.debug.rodStrokeRatio,
  1,
  0.001,
  "hold reel recovery keeps visible rod stroke full while holding",
);
assert(
  loadedHoldRecoverFloat.getPosition().x < 150,
  "hold recovery pulls taut fish toward the player after the delay",
);
assert(
  loadedHoldRecoverLine.releasedMeters < 3,
  "hold recovery winds line after moving taut fish",
);
approx(
  loadedHoldRecoverStrokeRecovered,
  0,
  0.001,
  "hold recovery does not clear visible rod stroke while the player keeps holding",
);
approx(
  loadedHoldRecoverSyncCalls,
  1,
  0.001,
  "hold recovery pauses pump-credit stroke sync after the delayed reel assist starts",
);

const lightLandingFloat = {
  position: new Vector2(150, 0),
  velocity: new Vector2(0, 0),
  getPosition() { return this.position; },
  getVelocity() { return this.velocity; },
  update() {},
};
const lightLandingLineMock = {
  releasedMeters: 3,
  distanceMeters: 3,
  remainingMeters: 0,
  updateDistance(position, rodTip) {
    this.distanceMeters = Math.hypot(position.x - rodTip.x, position.y - rodTip.y) / pixelsPerMeter;
    return {
      releasedMeters: this.releasedMeters,
      remainingMeters: 0,
      canReleaseLine: false,
      spoolEmpty: true,
      maxRemainingMeters: 0,
      baseReachMeters: 3,
      totalLengthMeters: 3,
      distanceMeters: this.distanceMeters,
      slackMeters: Math.max(0, this.releasedMeters - this.distanceMeters),
      isFullyExtended: false,
      lineExtensionRatio: this.distanceMeters / Math.max(0.001, this.releasedMeters),
    };
  },
  releaseForDistance() {
    return {
      releasedMeters: 0,
      demandedMeters: 0,
      unsatisfiedMeters: 0,
      didSlip: false,
      hardLimitReached: false,
    };
  },
  constrainPosition() {
    return { constrained: false, correctionPx: 0, hardLimit: false };
  },
  recoverSlack() { return 0; },
  getEffectiveLineMaxLoadKg() { return 2; },
};
const lightLandingStress = {
  target: 0,
  updateTarget(value) { this.target = value; },
  getTensionKg() { return this.target; },
  getEffectiveMaxTackleLoadKg() { return 2; },
  setDebugData(data) { this.debug = data; },
};
const lightLandingRodPull = new RodPullSystem(gameConfig);
const lightLandingInputMapper = new PullInputMapper();
for (let i = 0; i < 100; i++) {
  fightPhysics.step({
    dtMs: 50,
    floatEntity: lightLandingFloat,
    bounds: { left: -1000, right: 1000, top: -1000, bottom: 1000 },
    input: { isPulling: true, pointerDown: true, pullDirection: { x: 0, y: 1 } },
    env: {},
    checkWater: () => true,
    rodTipPosition: { x: 0, y: 0 },
    rod: { getLengthMeters: () => 2 },
    reel: { hasReel: () => false },
    fishForceSystem: {
      calculate() {
        return {
          behavior: { agility: 1 },
          targetVelocity: new Vector2(0, 0),
          fishWeightKg: 0.05,
          fishPhysicsConfig: {},
          staticFishForceKg: 0.03,
          dynamicFishForceKg: 0,
          totalFishForceKg: 0,
          awayFromPlayerRatio: 0,
          player: {
            dragLimitKg: 0,
            forceKg: 2,
            effectivePullKg: 0,
            pullCapacityKg: 2,
            netPullKg: 0,
            dragHoldRatio: 1,
            canDragHoldFish: true,
            canWinDistance: true,
            shouldSlipDrag: false,
            staminaPressureRatio: 1,
            vector: new Vector2(0, 0),
            pullDir: new Vector2(-1, 0),
            isPulling: true,
          },
          debug: {},
        };
      },
    },
    lineSystem: lightLandingLineMock,
    dragSystem: { value: 0, update() {}, getDebugData() { return { dragRatio: 0, dragPercent: 0 }; } },
    pullInputMapper: lightLandingInputMapper,
    rodPullSystem: lightLandingRodPull,
    reelSystem: new ReelSystem({ autoRecoverSlack: true }),
    tensionSystem: new TensionSystem(),
    stressSystem: lightLandingStress,
    fishCondition: {},
    buffs: null,
  });
}
const lightLandingDistanceMeters = lightLandingLineMock.updateDistance(lightLandingFloat.getPosition(), { x: 0, y: 0 }).distanceMeters;
assert(lightLandingStress.debug.fishRetrieveLineTensionKg < 2, "50g fish hold for 5s does not reach 100% of 2kg tackle");
assert(lightLandingDistanceMeters <= 2, "50g fish hold for 5s pulls fish into 2m landing zone (" + lightLandingDistanceMeters + "m)");

const noReelFloat = {
  position: new Vector2(100, 0),
  velocity: new Vector2(0, 0),
  getPosition() { return this.position; },
  getVelocity() { return this.velocity; },
  update() {},
};
const noReelLineMock = {
  releasedMeters: 2,
  distanceMeters: 2,
  remainingMeters: 0,
  updateDistance(position, rodTip) {
    this.distanceMeters = Math.hypot(position.x - rodTip.x, position.y - rodTip.y) / pixelsPerMeter;
    return {
      releasedMeters: this.releasedMeters,
      remainingMeters: 0,
      maxRemainingMeters: 0,
      baseReachMeters: 2,
      totalLengthMeters: 2,
      distanceMeters: this.distanceMeters,
      slackMeters: Math.max(0, this.releasedMeters - this.distanceMeters),
      isFullyExtended: false,
      lineExtensionRatio: this.distanceMeters / Math.max(0.001, this.releasedMeters),
    };
  },
  releaseForDistance() {
    return {
      releasedMeters: 0,
      demandedMeters: 0,
      unsatisfiedMeters: 0,
      didSlip: false,
      hardLimitReached: false,
    };
  },
  constrainPosition() {
    return { constrained: false, correctionPx: 0, hardLimit: false };
  },
  recoverSlack() { return 0; },
  getEffectiveLineMaxLoadKg() { return 2; },
};
const noReelStress = {
  target: 0,
  updateTarget(value) { this.target = value; },
  getTensionKg() { return this.target; },
  getEffectiveMaxTackleLoadKg() { return 2; },
  setDebugData(data) { this.debug = data; },
};
fightPhysics.step({
  dtMs: 1000,
  floatEntity: noReelFloat,
  bounds: { left: -1000, right: 1000, top: -1000, bottom: 1000 },
  input: { isPulling: true, pointerDown: true, pullDirection: { x: 0, y: 1 } },
  env: {},
  checkWater: () => true,
  rodTipPosition: { x: 0, y: 0 },
  rod: { getLengthMeters: () => 3.6 },
  reel: { hasReel: () => false },
  fishForceSystem: {
    calculate() {
      return {
        behavior: { agility: 1 },
        targetVelocity: new Vector2(0, 0),
        fishWeightKg: 0.05,
        fishPhysicsConfig: {},
        staticFishForceKg: 0.005,
        dynamicFishForceKg: 0,
        totalFishForceKg: 0,
        awayFromPlayerRatio: 0,
        player: {
          dragLimitKg: 0,
          forceKg: 2,
          effectivePullKg: 0,
          pullCapacityKg: 2,
          netPullKg: 0,
          dragHoldRatio: 1,
          canDragHoldFish: true,
          canWinDistance: true,
          shouldSlipDrag: false,
          staminaPressureRatio: 1,
          vector: new Vector2(0, 0),
          pullDir: new Vector2(-1, 0),
          isPulling: true,
        },
        debug: {},
      };
    },
  },
  lineSystem: noReelLineMock,
  dragSystem: { value: 0, update() {}, getDebugData() { return { dragRatio: 0, dragPercent: 0 }; } },
  pullInputMapper: new PullInputMapper(),
  rodPullSystem: new RodPullSystem(gameConfig),
  reelSystem: new ReelSystem({ autoRecoverSlack: true }),
  tensionSystem: new TensionSystem(),
  stressSystem: noReelStress,
  fishCondition: {},
  buffs: null,
});
assert(noReelStress.debug.dragLocked === true, "fight physics treats no-reel tackle as drag-locked");
approx(noReelStress.debug.dragLimitKg, 2, 0.001, "fight physics uses max tackle load as no-reel drag limit");
assert(noReelStress.debug.rodPullForceKg > 0, "fight physics allows no-reel rod pull");

const releaseHardLimitFloat = {
  position: new Vector2(100, 0),
  velocity: new Vector2(0, 0),
  getPosition() { return this.position; },
  getVelocity() { return this.velocity; },
  update() {},
};
const releaseHardLimitLineMock = {
  releasedMeters: 2,
  hard: false,
  updateDistance(position, rodTip) {
    const distanceMeters = Math.hypot(position.x - rodTip.x, position.y - rodTip.y) / pixelsPerMeter;
    return {
      releasedMeters: this.releasedMeters,
      remainingMeters: this.hard ? 0 : 1,
      maxRemainingMeters: 1,
      baseReachMeters: 1,
      totalLengthMeters: 2,
      distanceMeters,
      slackMeters: Math.max(0, this.releasedMeters - distanceMeters),
      isFullyExtended: this.hard,
      lineExtensionRatio: distanceMeters / Math.max(0.001, this.releasedMeters),
    };
  },
  releaseForDistance() {
    this.hard = true;
    return {
      releasedMeters: 0,
      demandedMeters: 1,
      unsatisfiedMeters: 1,
      didSlip: false,
      hardLimitReached: true,
    };
  },
  constrainPosition() {
    return { constrained: false, correctionPx: 0, hardLimit: false };
  },
  recoverSlack() { return 0; },
};
const releaseHardLimitStress = {
  target: 0,
  updateTarget(value) { this.target = value; },
  getTensionKg() { return this.target; },
  getEffectiveMaxTackleLoadKg() { return 2; },
  setDebugData(data) { this.debug = data; },
};
fightPhysics.step({
  dtMs: 1000,
  floatEntity: releaseHardLimitFloat,
  bounds: { left: -1000, right: 1000, top: -1000, bottom: 1000 },
  input: { isPulling: true, pointerDown: true, pullDirection: { x: 0, y: 1 } },
  env: {},
  checkWater: () => true,
  rodTipPosition: { x: 0, y: 0 },
  rod: { getLengthMeters: () => 3.6 },
  reel: { hasReel: () => true },
  fishForceSystem: {
    calculate() {
      return {
        behavior: { agility: 1 },
        targetVelocity: new Vector2(0, 0),
        fishWeightKg: 0.5,
        fishPhysicsConfig: {},
        totalFishForceKg: 2.2,
        awayFromPlayerRatio: 1,
        player: {
          dragLimitKg: 1.9,
          effectiveDragLimitKg: 1.9,
          forceKg: 2,
          effectivePullKg: 0,
          pullCapacityKg: 1.9,
          netPullKg: 0,
          dragLocked: false,
          dragHoldRatio: 0.86,
          canDragHoldFish: false,
          canWinDistance: false,
          shouldSlipDrag: true,
          staminaPressureRatio: 0.86,
          vector: new Vector2(0, 0),
          pullDir: new Vector2(-1, 0),
          isPulling: true,
        },
        debug: {},
      };
    },
  },
  lineSystem: releaseHardLimitLineMock,
  dragSystem: { value: 0.95, update() {}, getDebugData() { return { dragRatio: 0.95, dragPercent: 95 }; } },
  pullInputMapper: new PullInputMapper(),
  rodPullSystem: new RodPullSystem(gameConfig),
  reelSystem: new ReelSystem({ autoRecoverSlack: true }),
  tensionSystem: new TensionSystem(),
  stressSystem: releaseHardLimitStress,
  fishCondition: {},
  buffs: null,
});
assert(releaseHardLimitStress.debug.hardLineLimit, "release hard limit is visible in final debug");
assert(
  releaseHardLimitStress.target > 2.2,
  "release hard limit updates additive fish+player tension in the same frame",
);

const hardLimitFloat = {
  position: new Vector2(650, 0),
  velocity: new Vector2(0, 0),
  getPosition() { return this.position; },
  getVelocity() { return this.velocity; },
  update() {},
};
const hardLimitLineMock = {
  releasedMeters: 13,
  distanceMeters: 13,
  remainingMeters: 0,
  updateDistance(position, rodTip) {
    this.distanceMeters = Math.hypot(position.x - rodTip.x, position.y - rodTip.y) / pixelsPerMeter;
    return {
      releasedMeters: this.releasedMeters,
      remainingMeters: 0,
      maxRemainingMeters: 11,
      baseReachMeters: 2,
      totalLengthMeters: 13,
      distanceMeters: this.distanceMeters,
      slackMeters: Math.max(0, this.releasedMeters - this.distanceMeters),
      isFullyExtended: true,
      lineExtensionRatio: 1,
    };
  },
  releaseForDistance() {
    return {
      releasedMeters: 0,
      demandedMeters: 0,
      unsatisfiedMeters: 0,
      didSlip: false,
      hardLimitReached: false,
    };
  },
  constrainPosition() {
    return { constrained: false, correctionPx: 0, hardLimit: true };
  },
  recoverSlack() { return 0; },
  getEffectiveLineMaxLoadKg() { return 2; },
};
const hardLimitStress = {
  target: 0,
  updateTarget(value) { this.target = value; },
  getTensionKg() { return this.target; },
  getEffectiveMaxTackleLoadKg() { return 2; },
  setDebugData(data) { this.debug = data; },
};
fightPhysics.step({
  dtMs: 1000,
  floatEntity: hardLimitFloat,
  bounds: { left: -1000, right: 1000, top: -1000, bottom: 1000 },
  input: { isPulling: true, pointerDown: true, pullDirection: { x: 0, y: 1 } },
  env: {},
  checkWater: () => true,
  rodTipPosition: { x: 0, y: 0 },
  rod: { getLengthMeters: () => 3.6 },
  reel: { hasReel: () => true },
  fishForceSystem: {
    calculate() {
      return {
        behavior: { agility: 1 },
        targetVelocity: new Vector2(0, 0),
        fishWeightKg: 0.05,
        fishPhysicsConfig: {},
        staticFishForceKg: 0.005,
        dynamicFishForceKg: 0,
        totalFishForceKg: 0,
        awayFromPlayerRatio: 0,
        player: {
          dragLimitKg: 0,
          forceKg: 2,
          effectivePullKg: 0,
          pullCapacityKg: 0,
          netPullKg: 0,
          dragHoldRatio: 0,
          canDragHoldFish: false,
          canWinDistance: false,
          shouldSlipDrag: false,
          staminaPressureRatio: 0,
          vector: new Vector2(0, 0),
          pullDir: new Vector2(-1, 0),
          isPulling: true,
        },
        debug: {},
      };
    },
  },
  lineSystem: hardLimitLineMock,
  dragSystem: { value: 0, update() {}, getDebugData() { return { dragRatio: 0, dragPercent: 0 }; } },
  pullInputMapper: new PullInputMapper(),
  rodPullSystem: new RodPullSystem(gameConfig),
  reelSystem: new ReelSystem({ autoRecoverSlack: true }),
  tensionSystem: new TensionSystem(),
  stressSystem: hardLimitStress,
  fishCondition: {},
  buffs: null,
});
assert(hardLimitStress.debug.rodPullForceKg > 0, "full line extension keeps rod pull force active");
assert(hardLimitStress.debug.calculatedTensionKg > hardLimitStress.debug.dragLimitKg, "full line extension tension can exceed drag");
assert(
  !hardLimitStress.debug.fishRetrieveMovementBlocked,
  "full line extension does not block inward fish retrieve",
);
assert(
  hardLimitStress.debug.actualFishPullSpeedMps > 0,
  "full line extension still lets hold create inward retrieve speed",
);
assert(hardLimitFloat.getPosition().x < 650, "full line extension rod pull moves fish toward rod");

const emptySpoolSlackFloat = {
  position: new Vector2(600, 0),
  velocity: new Vector2(0, 0),
  getPosition() { return this.position; },
  getVelocity() { return this.velocity; },
  update() {},
};
const emptySpoolSlackLineMock = {
  releasedMeters: 13,
  distanceMeters: 12,
  updateDistance(position, rodTip) {
    this.distanceMeters = Math.hypot(position.x - rodTip.x, position.y - rodTip.y) / pixelsPerMeter;
    return {
      releasedMeters: this.releasedMeters,
      remainingMeters: 0,
      canReleaseLine: false,
      spoolEmpty: true,
      maxRemainingMeters: 11,
      baseReachMeters: 2,
      totalLengthMeters: 13,
      distanceMeters: this.distanceMeters,
      slackMeters: Math.max(0, this.releasedMeters - this.distanceMeters),
      isFullyExtended: false,
      lineExtensionRatio: this.distanceMeters / Math.max(0.001, this.releasedMeters),
    };
  },
  releaseForDistance() {
    return {
      releasedMeters: 0,
      demandedMeters: 0,
      unsatisfiedMeters: 0,
      didSlip: false,
      hardLimitReached: false,
    };
  },
  constrainPosition() {
    return { constrained: false, correctionPx: 0, hardLimit: false };
  },
  recoverSlack() { return 0; },
  getEffectiveLineMaxLoadKg() { return 2; },
};
const emptySpoolSlackStress = {
  target: 0,
  updateTarget(value) { this.target = value; },
  getTensionKg() { return this.target; },
  getEffectiveMaxTackleLoadKg() { return 2; },
  setDebugData(data) { this.debug = data; },
};
fightPhysics.step({
  dtMs: 1000,
  floatEntity: emptySpoolSlackFloat,
  bounds: { left: -1000, right: 1000, top: -1000, bottom: 1000 },
  input: { isPulling: true, pointerDown: true, pullDirection: { x: 0, y: 1 } },
  env: {},
  checkWater: () => true,
  rodTipPosition: { x: 0, y: 0 },
  rod: { getLengthMeters: () => 3.6 },
  reel: { hasReel: () => true },
  fishForceSystem: {
    calculate() {
      return {
        behavior: { agility: 1 },
        targetVelocity: new Vector2(0, 0),
        fishWeightKg: 0.05,
        fishPhysicsConfig: {},
        staticFishForceKg: 0.005,
        dynamicFishForceKg: 0,
        totalFishForceKg: 0,
        awayFromPlayerRatio: 0,
        player: {
          dragLimitKg: 1.9,
          effectiveDragLimitKg: 1.9,
          forceKg: 2,
          effectivePullKg: 0,
          pullCapacityKg: 1.9,
          netPullKg: 0,
          dragLocked: false,
          dragHoldRatio: 0.86,
          canDragHoldFish: false,
          canWinDistance: false,
          shouldSlipDrag: true,
          staminaPressureRatio: 0.86,
          vector: new Vector2(0, 0),
          pullDir: new Vector2(-1, 0),
          isPulling: true,
        },
        debug: {},
      };
    },
  },
  lineSystem: emptySpoolSlackLineMock,
  dragSystem: { value: 0.95, update() {}, getDebugData() { return { dragRatio: 0.95, dragPercent: 95 }; } },
  pullInputMapper: new PullInputMapper(),
  rodPullSystem: new RodPullSystem(gameConfig),
  reelSystem: new ReelSystem({ autoRecoverSlack: true }),
  tensionSystem: new TensionSystem(),
  stressSystem: emptySpoolSlackStress,
  fishCondition: {},
  buffs: null,
});
assert(emptySpoolSlackStress.debug.lineSpoolEmpty, "empty spool state is visible in fight debug");
assert(emptySpoolSlackStress.debug.rodPullForceKg > 0, "empty spool with slack keeps risky rod pull force active");
assert(emptySpoolSlackStress.debug.rodPullBlockedReason !== "drag_slipping", "empty spool with slack is not blocked as drag slipping");
assert(emptySpoolSlackStress.debug.calculatedTensionKg < emptySpoolSlackStress.debug.dragLimitKg, "empty spool with free light-fish movement does not inflate tension to drag limit");
assert(emptySpoolSlackFloat.getPosition().x < 600, "empty spool with slack rod pull moves fish toward rod");

const nearShoreFloat = {
  position: new Vector2(100, 0),
  velocity: new Vector2(0, 0),
  getPosition() { return this.position; },
  getVelocity() { return this.velocity; },
  update() {},
};
const nearShoreLineMock = {
  releasedMeters: 3,
  distanceMeters: 2,
  updateDistance(position, rodTip) {
    this.distanceMeters = Math.hypot(position.x - rodTip.x, position.y - rodTip.y) / pixelsPerMeter;
    return {
      releasedMeters: this.releasedMeters,
      remainingMeters: 0,
      canReleaseLine: false,
      spoolEmpty: true,
      maxRemainingMeters: 0,
      baseReachMeters: 3,
      totalLengthMeters: 3,
      distanceMeters: this.distanceMeters,
      slackMeters: Math.max(0, this.releasedMeters - this.distanceMeters),
      isFullyExtended: false,
      lineExtensionRatio: this.distanceMeters / Math.max(0.001, this.releasedMeters),
    };
  },
  releaseForDistance() {
    return {
      releasedMeters: 0,
      demandedMeters: 0,
      unsatisfiedMeters: 0,
      didSlip: false,
      hardLimitReached: false,
    };
  },
  constrainPosition() {
    return { constrained: false, correctionPx: 0, hardLimit: false };
  },
  recoverSlack() { return 0; },
  getEffectiveLineMaxLoadKg() { return 2; },
};
const nearShoreStress = {
  target: 0,
  updateTarget(value) { this.target = value; },
  getTensionKg() { return this.target; },
  getEffectiveMaxTackleLoadKg() { return 2; },
  setDebugData(data) { this.debug = data; },
};
fightPhysics.step({
  dtMs: 1000,
  floatEntity: nearShoreFloat,
  bounds: { left: -1000, right: 1000, top: -1000, bottom: 1000 },
  input: { isPulling: true, pointerDown: true, pullDirection: { x: 0, y: 1 } },
  env: {},
  checkWater: (x) => x >= 50,
  rodTipPosition: { x: 0, y: 0 },
  rod: { getLengthMeters: () => 3.6 },
  reel: { hasReel: () => false },
  fishForceSystem: {
    calculate() {
      return {
        behavior: { agility: 1 },
        targetVelocity: new Vector2(0, 0),
        fishWeightKg: 0.05,
        fishPhysicsConfig: {},
        staticFishForceKg: 0.005,
        dynamicFishForceKg: 0,
        totalFishForceKg: 0,
        awayFromPlayerRatio: 0,
        player: {
          dragLimitKg: 0,
          forceKg: 2,
          effectivePullKg: 0,
          pullCapacityKg: 2,
          netPullKg: 0,
          dragHoldRatio: 1,
          canDragHoldFish: true,
          canWinDistance: true,
          shouldSlipDrag: false,
          staminaPressureRatio: 1,
          vector: new Vector2(0, 0),
          pullDir: new Vector2(-1, 0),
          isPulling: true,
        },
        debug: {},
      };
    },
  },
  lineSystem: nearShoreLineMock,
  dragSystem: { value: 0, update() {}, getDebugData() { return { dragRatio: 0, dragPercent: 0 }; } },
  pullInputMapper: new PullInputMapper(),
  rodPullSystem: new RodPullSystem(gameConfig),
  reelSystem: new ReelSystem({ autoRecoverSlack: true }),
  tensionSystem: new TensionSystem(),
  stressSystem: nearShoreStress,
  fishCondition: {},
  buffs: null,
});
assert(nearShoreFloat.getPosition().x < 100, "near-shore rod pull still moves fish toward shore");
assert(nearShoreFloat.getPosition().x >= 50, "near-shore rod pull stays inside water");

const blockedWaterFloat = {
  position: new Vector2(100, 0),
  velocity: new Vector2(0, 0),
  getPosition() { return this.position; },
  getVelocity() { return this.velocity; },
  update() {},
};
const blockedWaterStress = {
  target: 0,
  updateTarget(value) { this.target = value; },
  getTensionKg() { return this.target; },
  getEffectiveMaxTackleLoadKg() { return 2; },
  setDebugData(data) { this.debug = data; },
};
fightPhysics.step({
  dtMs: 1000,
  floatEntity: blockedWaterFloat,
  bounds: { left: -1000, right: 1000, top: -1000, bottom: 1000 },
  input: { isPulling: true, pointerDown: true, pullDirection: { x: 0, y: 1 } },
  env: {},
  checkWater: () => false,
  rodTipPosition: { x: 0, y: 0 },
  rod: { getLengthMeters: () => 3.6 },
  reel: { hasReel: () => true },
  fishForceSystem: {
    calculate() {
      return {
        behavior: { agility: 1 },
        targetVelocity: new Vector2(0, 0),
        totalFishForceKg: 1.1,
        player: {
          dragLimitKg: 1.9,
          forceKg: 2,
          effectivePullKg: 0,
          pullCapacityKg: 1.9,
          netPullKg: 0,
          dragHoldRatio: 1,
          canDragHoldFish: true,
          canWinDistance: true,
          shouldSlipDrag: false,
          staminaPressureRatio: 1,
          vector: new Vector2(0, 0),
          pullDir: new Vector2(-1, 0),
          isPulling: true,
        },
        debug: {},
      };
    },
  },
  lineSystem: {
    ...lineMockForFight,
    releasedMeters: 2,
    recoverSlack() { return 0; },
  },
  dragSystem: { value: 0.95, update() {}, getDebugData() { return { dragRatio: 0.95, dragPercent: 95 }; } },
  pullInputMapper: new PullInputMapper(),
  rodPullSystem: new RodPullSystem(gameConfig),
  reelSystem: new ReelSystem({ autoRecoverSlack: true }),
  tensionSystem: new TensionSystem(),
  stressSystem: blockedWaterStress,
  fishCondition: {},
  buffs: null,
});
assert(blockedWaterFloat.getPosition().x === 100, "rod pull movement is blocked by checkWater");
approx(blockedWaterStress.debug.rodPullMoveMeters, 0, 0.001, "blocked rod pull reports zero applied movement");


class FakeEventTarget {
  constructor() {
    this.listeners = {};
  }

  addEventListener(type, handler) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(handler);
  }

  removeEventListener(type, handler) {
    if (!this.listeners[type]) return;
    this.listeners[type] = this.listeners[type].filter((item) => item !== handler);
  }

  dispatch(type, event = {}) {
    const handlers = this.listeners[type] || [];
    for (const handler of handlers) handler({ type, ...event });
  }
}

let fakeNowMs = 1000;
Date.now = () => fakeNowMs;
window.listeners = {};
window.addEventListener = function(type, handler) {
  if (!this.listeners[type]) this.listeners[type] = [];
  this.listeners[type].push(handler);
};
window.removeEventListener = function(type, handler) {
  if (!this.listeners[type]) return;
  this.listeners[type] = this.listeners[type].filter((item) => item !== handler);
};
window.dispatch = function(type, event = {}) {
  const handlers = this.listeners[type] || [];
  for (const handler of handlers) handler({ type, ...event });
};

const previousPullHoldMs = CONFIG.input.pullHoldMinMs;
CONFIG.input.pullHoldMinMs = 120;

const holdCanvas = new FakeEventTarget();
const holdInput = new InputManager(holdCanvas);
holdCanvas.dispatch("pointerdown", { clientX: 10, clientY: 20 });
assert(holdInput.getState().isPulling === false, "pointerdown starts pending, not pull");
fakeNowMs += 119;
assert(holdInput.getState().isPulling === false, "pointer pull stays pending before pullHoldMinMs");
fakeNowMs += 1;
const heldState = holdInput.getState();
assert(heldState.isPulling === true, "pointer pull starts after pullHoldMinMs");
assert(heldState.pointerAction === "pull", "pointer action becomes pull after hold threshold");
holdCanvas.dispatch("pointermove", { clientX: 12, clientY: 80 });
const heldSwipeState = holdInput.getState();
assert(heldSwipeState.isPulling === true, "swipe after active pull keeps hold active");
assert(heldSwipeState.pointerAction === "pull", "swipe after active pull does not become drag-control");
window.dispatch("pointerup", { clientX: 10, clientY: 20 });
assert(holdInput.getState().isPulling === false, "pointer pull releases on pointerup");
holdInput.dispose();

fakeNowMs += 1000;
const clickCanvas = new FakeEventTarget();
const clickInput = new InputManager(clickCanvas);
clickCanvas.dispatch("pointerdown", { clientX: 44, clientY: 55 });
fakeNowMs += 40;
window.dispatch("pointerup", { clientX: 44, clientY: 55 });
const clickState = clickInput.getState();
assert(clickState.isPulling === false, "short pointer click does not start pull");
assert(clickState.clickPos && clickState.clickPos.x === 44 && clickState.clickPos.y === 55, "short pending pointer creates clickPos");
clickInput.dispose();

fakeNowMs += 1000;
const previousLongPressMs = CONFIG.input.longPressMs;
const previousLongPressMoveTolerancePx = CONFIG.input.longPressMoveTolerancePx;
CONFIG.input.longPressMs = 200;
CONFIG.input.longPressMoveTolerancePx = 30;
const longPressCanvas = new FakeEventTarget();
const longPressInput = new InputManager(longPressCanvas);
longPressCanvas.dispatch("pointerdown", { clientX: 200, clientY: 220 });
fakeNowMs += 160;
longPressCanvas.dispatch("pointermove", { clientX: 210, clientY: 224 });
fakeNowMs += 40;
__flushTimeouts();
const longPressState = longPressInput.getState();
assert(longPressState.longPressPos, "long hold survives small pointer drift");
assert(longPressState.longPressPos.x === 210 && longPressState.longPressPos.y === 224, "long hold uses current pointer position");
window.dispatch("pointerup", { clientX: 210, clientY: 224 });
longPressInput.dispose();

fakeNowMs += 1000;
const dragCanvas = new FakeEventTarget();
const dragInput = new InputManager(dragCanvas);
dragCanvas.dispatch("pointerdown", { clientX: 100, clientY: 100 });
fakeNowMs += 20;
dragCanvas.dispatch("pointermove", { clientX: 102, clientY: 140 });
fakeNowMs += 200;
__flushTimeouts();
const dragState = dragInput.getState();
assert(dragState.dragControlActive === true, "vertical pointer gesture activates drag-control");
assert(dragState.pointerAction === "drag_control", "pointer action becomes drag_control");
assert(dragState.isPulling === false, "drag-control gesture does not become pull after hold threshold");
assert(dragState.longPressPos === null, "drag-control gesture cancels long hold aiming");
dragInput.dispose();

fakeNowMs += 1000;
const disabledDragCanvas = new FakeEventTarget();
const disabledDragInput = new InputManager(disabledDragCanvas);
disabledDragInput.setDragControlEnabled(false);
disabledDragCanvas.dispatch("pointerdown", { clientX: 100, clientY: 100 });
fakeNowMs += 20;
disabledDragCanvas.dispatch("pointermove", { clientX: 100, clientY: 160 });
const disabledDragState = disabledDragInput.getState();
assert(disabledDragState.dragControlActive === false, "disabled drag-control ignores vertical pointer gesture");
assert(disabledDragState.pointerAction !== "drag_control", "disabled drag-control never enters drag_control action");
disabledDragInput.dispose();

CONFIG.input.pullHoldMinMs = previousPullHoldMs;
CONFIG.input.longPressMs = previousLongPressMs;
CONFIG.input.longPressMoveTolerancePx = previousLongPressMoveTolerancePx;

console.log("Rod pull systems check passed:");
for (const message of checks) console.log("- " + message);
`, context);
