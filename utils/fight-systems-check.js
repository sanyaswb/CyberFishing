const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const FILES = [
  "src/core/core.js",
  "src/core/casting_distance.js",
  "src/core/fishing/landing_policy.js",
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
  "src/core/fishing/fish_pull_resistance_model.js",
  "src/entities/tackle.js",
  "src/entities/fish.js",
  "src/render/renderer.js",
  "src/systems/drag_system.js",
  "src/systems/line_system.js",
  "src/systems/player_force_system.js",
  "src/systems/fish_force_system.js",
  "src/systems/tackle_stress_system.js",
  "src/systems/stamina_system.js",
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
  assert(Math.abs(value - expected) <= tolerance, message + " (" + value + ")");
}

const physicsAdapter = CONFIG.fightPhysicsConfig;
const physicsConfig = physicsAdapter.getLineSystemConfig();
const dragConfig = physicsAdapter.getReelDragConfig();
const castDistanceCalculator = new CastDistanceCalculator(CONFIG);
const samplePoleEquipment = {
  rod: { type: "pole", lengthMeters: 2, hasReel: false },
  reel: null,
  line: { lengthMeters: 13, maxLoadKg: 2 },
};
const sampleBologneseEquipment = {
  rod: { type: "float", lengthMeters: 4, hasReel: true },
  reel: { basePower: 1, lineCapacityMeters: 20 },
  line: { lengthMeters: 13, maxLoadKg: 2 },
};

const forbiddenFlatFishPhysicsKeys = [
  "basePower",
  "baseStamina",
  "maxSpeedMetersPerSec",
  "speedForceMultiplier",
  "waterResistanceMultiplier",
  "minPowerRatio",
  "agility",
  "bounceCooldownMs",
  "dirChangeMinMs",
  "dirChangeMaxMs",
  "lastDashTrigger",
  "behaviors",
  "pullResistance",
];
for (const fish of FISH_DB) {
  const physics = fish.physics || {};
  assert(!!physics.forceProfile, fish.id + " uses forceProfile");
  assert(!!physics.staminaProfile, fish.id + " uses staminaProfile");
  assert(!!physics.movementProfile, fish.id + " uses movementProfile");
  assert(!!physics.resistanceProfile, fish.id + " uses resistanceProfile");
  assert(!!physics.retrieveProfile, fish.id + " uses retrieveProfile");
  assert(!!physics.behaviorProfile?.behaviors, fish.id + " uses behaviorProfile.behaviors");
  for (const key of forbiddenFlatFishPhysicsKeys) {
    assert(!(key in physics), fish.id + " does not keep flat physics." + key);
  }
}
approx(
  castDistanceCalculator.getMaxCastDistancePx(samplePoleEquipment, 0),
  650,
  0.001,
  "pole cast distance uses equipped line length",
);
approx(
  castDistanceCalculator.getMaxCastDistancePx(sampleBologneseEquipment, 0),
  650,
  0.001,
  "reel cast distance uses equipped line length",
);
approx(
  castDistanceCalculator.getMaxCastDistancePx(
    {
      rod: { type: "spinning", lengthMeters: 2, hasReel: true },
      reel: {
        basePower: 1,
        lineCapacityMeters: 20,
        line: { lengthMeters: 99 },
        engineStats: { line: { lengthMeters: 99 } },
      },
      line: null,
    },
    0,
  ),
  0,
  0.001,
  "reel legacy line is ignored without equipped line item",
);
approx(
  castDistanceCalculator.getEffectiveCastDistancePx(sampleBologneseEquipment, 0.5),
  325,
  0.001,
  "cast power coefficient scales final distance",
);
approx(
  castDistanceCalculator.getBuildCastPowerCoefficient({
    rod: { lengthMeters: 2 },
    reel: { bearingCount: 3, basePower: 1, lineCapacityMeters: 20 },
    line: { lengthMeters: 13 },
  }),
  0.5,
  0.001,
  "build cast power uses rod length and reel bearings",
);
approx(
  castDistanceCalculator.getEffectiveCastDistancePx(
    {
      rod: { lengthMeters: 2 },
      reel: { bearingCount: 4, basePower: 1, lineCapacityMeters: 20 },
      line: { lengthMeters: 13 },
    },
    null,
  ),
  390,
  0.001,
  "better reel bearing increases effective cast distance",
);
const strongRod = new Rod(1, 5, 0, "float_pole", Infinity, false, {
  lengthMeters: 2,
  maxLoadKg: 24,
  lineMaxLoadKg: 12,
  durability: 100,
  durabilityMaxLoadLossPerPercent: 0.001,
});
const noReel = new Reel(0, 0, { maxLoadKg: 0, lineCapacityMeters: 0 });
assert(!noReel.hasReel(), "sentinel reel has no reel behavior");

const noReelLine = new LineSystem({
  rod: strongRod,
  reel: noReel,
  config: physicsConfig,
  lineStats: { lengthMeters: 13, maxLoadKg: 12, durability: 100 },
});
approx(noReelLine.getState().totalLengthMeters, 13, 0.001, "pole line length uses equipped line");

const feederReserveLine = new LineSystem({
  rod: new Rod(1, 5, 0, "feeder", Infinity, true, {
    lengthMeters: 3.6,
    maxLoadKg: 24,
  }),
  reel: new Reel(1, 1, {
    maxLoadKg: 10,
    lineCapacityMeters: 20,
  }),
  config: physicsConfig,
  lineStats: { lengthMeters: 13, maxLoadKg: 12, durability: 100 },
});
approx(
  feederReserveLine.getState().baseReachMeters,
  3.6,
  0.001,
  "base rig length equals rod length",
);
approx(
  feederReserveLine.getState().maxRemainingMeters,
  9.4,
  0.001,
  "line reserve subtracts rod length from line length",
);

const poleReserveLine = new LineSystem({
  rod: new Rod(1, 5, 0, "pole", Infinity, false, {
    lengthMeters: 3.6,
    maxLoadKg: 24,
  }),
  reel: noReel,
  config: physicsConfig,
  lineStats: { lengthMeters: 7.2, maxLoadKg: 12, durability: 100 },
});
approx(
  castDistanceCalculator.getRodBaseReachMeters(
    { type: "pole", lengthMeters: 3.6, hasReel: false },
    false,
  ),
  3.6,
  0.001,
  "no-reel rod base rig length uses minimum pole line length",
);
approx(
  poleReserveLine.getState().releasedMeters,
  7.2,
  0.001,
  "no-reel rod uses fixed equipped line length",
);

const reel = new Reel(1, 1, {
  maxLoadKg: 10,
  lineCapacityMeters: 50,
  retrieveSpeedMetersPerSec: 0.8,
  dragChangeSpeedPerSec: 1.5,
});

const dragLimitedReel = new Reel(1, 1, {
  maxLoadKg: 10,
  lineCapacityMeters: 50,
  dragMinKg: 0,
  dragMaxKg: 2,
  hasDrag: true,
});
const dragLimitedPlayer = new PlayerForceSystem().calculate({
  fishPosition: { x: 0, y: -100 },
  rodTipPosition: { x: 0, y: 0 },
  input: { isPulling: true, pointerDown: true },
  rod: strongRod,
  reel: dragLimitedReel,
  buffs: null,
  physics: physicsConfig,
  physicsConfig: physicsAdapter,
  totalFishForceKg: 5,
  playerMaxLoadKg: 20,
  dragRatio: 1,
});
assert(dragLimitedPlayer.dragLocked === false, "max drag setting still leaves friction active");
approx(dragLimitedPlayer.effectiveDragLimitKg, 2, 0.001, "drag max limits effective pull regardless of line strength");
assert(dragLimitedPlayer.shouldSlipDrag, "drag slips above reel drag max even at 100% setting");
approx(dragLimitedPlayer.pullCapacityKg, 2, 0.001, "player pull capacity is clamped by active drag max");

const noDragReel = new Reel(1, 1, {
  maxLoadKg: 10,
  lineCapacityMeters: 50,
  hasDrag: false,
});
const noDragPlayer = new PlayerForceSystem().calculate({
  fishPosition: { x: 0, y: -100 },
  rodTipPosition: { x: 0, y: 0 },
  input: { isPulling: true, pointerDown: true },
  rod: strongRod,
  reel: noDragReel,
  buffs: null,
  physics: physicsConfig,
  physicsConfig: physicsAdapter,
  totalFishForceKg: 5,
  playerMaxLoadKg: 20,
  dragRatio: 0.5,
});
assert(noDragPlayer.dragLocked, "reel without drag behaves as locked direct tackle load");
approx(noDragPlayer.pullCapacityKg, 20, 0.001, "no-drag reel does not clamp pull by drag limit");

const pointerDrag = new DragSystem(dragConfig, reel);
pointerDrag.setValue(0.5);
pointerDrag.update({
  pointerDown: true,
  dragControlActive: false,
  pointerStart: { x: 0, y: 100 },
  pointerCurrent: { x: 0, y: 300 },
}, 0.016);
approx(pointerDrag.value, 0.5, 0.001, "pointer pull does not change drag without drag-control action");
pointerDrag.update({
  pointerDown: true,
  dragControlActive: true,
  pointerStart: { x: 0, y: 100 },
  pointerCurrent: { x: 0, y: 300 },
}, 0.016);
assert(pointerDrag.value > 0.5, "drag-control action changes drag from pointer gesture");

const reelLineStats = {
  lengthMeters: 50,
  maxLoadKg: 12,
  durability: 100,
  durabilityMaxLoadLossPerPercent: 0.001,
};
const freeLine = new LineSystem({
  rod: strongRod,
  reel,
  config: physicsConfig,
  lineStats: reelLineStats,
});
freeLine.updateDistance({ x: 50, y: 0 }, { x: 0, y: 0 });
freeLine.updateDistance({ x: 500, y: 0 }, { x: 0, y: 0 });
const freeLineRelease = freeLine.releaseForDistance(0);
assert(freeLineRelease.didSlip, "drag 0 reports reel slip");
assert(!freeLineRelease.hardLimitReached, "drag 0 with spare line does not report hard line limit");
assert(freeLine.getState().releasedMeters >= 9.99, "drag 0 releases line for fish distance");
assert(!freeLine.getState().isFullyExtended, "drag 0 keeps line from full extension while spare line remains");

const microConstraint = freeLine.constrainPosition(
  { x: freeLine.getState().releasedMeters * physicsConfig.pixelsPerMeter + 0.1, y: 0 },
  { x: 1, y: 0 },
  { x: 0, y: 0 },
);
assert(!microConstraint.constrained, "line constraint tolerance ignores sub-pixel drift");

const lockedLine = new LineSystem({
  rod: strongRod,
  reel,
  config: physicsConfig,
  lineStats: reelLineStats,
});
lockedLine.updateDistance({ x: 50, y: 0 }, { x: 0, y: 0 });
lockedLine.updateDistance({ x: 500, y: 0 }, { x: 0, y: 0 });
lockedLine.releaseForDistance(1);
assert(lockedLine.getState().releasedMeters < 6, "drag 100 keeps released line close to rod base reach");

const shortReel = new Reel(1, 1, {
  maxLoadKg: 10,
  lineCapacityMeters: 5,
});
const exhaustedLine = new LineSystem({
  rod: strongRod,
  reel: shortReel,
  config: physicsConfig,
  lineStats: { lengthMeters: 4, maxLoadKg: 12, durability: 100 },
});
exhaustedLine.updateDistance({ x: 50, y: 0 }, { x: 0, y: 0 });
exhaustedLine.updateDistance({ x: 550, y: 0 }, { x: 0, y: 0 });
const exhaustedRelease = exhaustedLine.releaseForDistance(0);
assert(exhaustedRelease.hardLimitReached, "exhausted reel line reports hard line limit");
assert(exhaustedLine.getState().isFullyExtended, "line is fully extended when spool line is exhausted");

const recoveryRod = new Rod(1, 5, 0, "feeder", Infinity, true, {
  lengthMeters: 2,
  maxLoadKg: 12,
});
const recoveryLine = new LineSystem({
  rod: recoveryRod,
  reel,
  config: physicsConfig,
  lineStats: { lengthMeters: 13, maxLoadKg: 12, durability: 100 },
});
recoveryLine.updateDistance({ x: 500, y: 0 }, { x: 0, y: 0 });
recoveryLine.releaseForDistance(0);
recoveryLine.updateDistance({ x: 400, y: 0 }, { x: 0, y: 0 });
const recoveredUnderLoad = recoveryLine.recoverSlack({
  hasReel: true,
  inputRecover: true,
  reel,
  tensionKg: 2,
  dtSec: 1,
});
assert(recoveredUnderLoad > 0, "reel recovers won line when load is below reel and line limit");
const blockedRecovery = recoveryLine.recoverSlack({
  hasReel: true,
  inputRecover: true,
  reel,
  tensionKg: 12,
  dtSec: 1,
});
approx(blockedRecovery, 0, 0.001, "reel cannot recover slack when load reaches tackle recovery limit");

const stress = new TackleStressSystem({
  rod: strongRod,
  reel,
  lineSystem: freeLine,
  rng: { next: () => 0.9 },
});
approx(stress.getEffectiveMaxTackleLoadKg(), 12, 0.001, "max tackle load ignores reel and uses weakest breakable part");
stress.updateTarget(25, 1, { kgSmoothPerSecond: 999, overloadGraceMs: 0 });
assert(stress.isBroken(), "overload break is deterministic");
const godLineStress = new TackleStressSystem({
  rod: strongRod,
  reel,
  lineSystem: freeLine,
  rng: { next: () => 0.9 },
  devFlags: { isEnabled: (flag) => flag === "noLineBreak" },
});
godLineStress.updateTarget(25, 1, { kgSmoothPerSecond: 999, overloadGraceMs: 0 });
assert(!godLineStress.isBroken(), "god mode noLineBreak prevents line failure");
assert(godLineStress.getDebugData().breakPrevented, "prevented line break is reported in debug data");
const exactLimitRod = new Rod(1, 5, 0, "float", Infinity, true, {
  lengthMeters: 2,
  maxLoadKg: 1,
});
const exactLimitLine = new LineSystem({
  rod: exactLimitRod,
  reel: noReel,
  config: physicsConfig,
  lineStats: { lengthMeters: 3, maxLoadKg: 1, durability: 100 },
});
const exactLimitStress = new TackleStressSystem({
  rod: exactLimitRod,
  lineSystem: exactLimitLine,
  config: {},
});
exactLimitStress.updateTarget(1, 1, { kgSmoothPerSecond: 999, overloadGraceMs: 0 });
assert(exactLimitStress.isBroken(), "100% tension is a deterministic failure threshold");

assert(stress.getBreakReason() === "line", "line breaks when line is the weakest breakable part");
assert(stress.getBreakInfo().lineLossMeters >= 0, "line break records lost line length");

const leaderStress = new TackleStressSystem({
  rod: strongRod,
  reel: noReel,
  lineSystem: noReelLine,
  leader: { maxLoadKg: 6, durability: 100 },
  rng: { next: () => 0.5 },
});
approx(leaderStress.getEffectiveMaxTackleLoadKg(), 6, 0.001, "leader lowers breakable tackle load");
leaderStress.updateTarget(30, 1, { kgSmoothPerSecond: 999, overloadGraceMs: 0 });
assert(leaderStress.getBreakReason() === "leader", "leader breaks when it is weaker than main line");

const weakRodStress = new TackleStressSystem({
  rod: new Rod(1, 5, 0, "float", Infinity, true, {
    lengthMeters: 3.6,
    maxLoadKg: 6,
    durability: 100,
  }),
  reel: new Reel(1, 1, { maxLoadKg: 4, lineCapacityMeters: 50, dragMaxKg: 4 }),
  lineSystem: {
    getEffectiveLineMaxLoadKg() { return 20; },
    calculateBreakLossMeters() { return 0; },
  },
  rng: { next: () => 0.5 },
});
assert(weakRodStress.getBreakTargetReason() === "rod", "UI break target predicts rod when rod is weakest breakable part");
weakRodStress.updateTarget(15, 1, { kgSmoothPerSecond: 999, overloadGraceMs: 0 });
assert(weakRodStress.getBreakReason() === "rod", "rod breaks when rod is weaker than 20kg line and reel is ignored as break target");
const godRodStress = new TackleStressSystem({
  rod: new Rod(1, 5, 0, "float", Infinity, true, {
    lengthMeters: 3.6,
    maxLoadKg: 6,
    durability: 100,
  }),
  reel: new Reel(1, 1, { maxLoadKg: 4, lineCapacityMeters: 50, dragMaxKg: 4 }),
  lineSystem: {
    getEffectiveLineMaxLoadKg() { return 20; },
    calculateBreakLossMeters() { return 0; },
  },
  rng: { next: () => 0.5 },
  devFlags: { isEnabled: (flag) => flag === "noRodBreak" },
});
godRodStress.updateTarget(15, 1, { kgSmoothPerSecond: 999, overloadGraceMs: 0 });
assert(!godRodStress.isBroken(), "god mode noRodBreak prevents rod failure");

const fish = new Fish(1, 2, {
  ...CONFIG.spawns.fishes[0].physics,
  basePower: 1,
  levelBasePower: 1,
  minPowerRatio: 0.25,
  agility: 1,
  maxSpeedMetersPerSec: 2,
  behaviors: {
    swim: { powerRatio: 1, speedRatio: 1, minTime: 1000, maxTime: 1000, weight: 1 },
  },
}, { next: () => 0.5, range: (a, b) => (a + b) / 2 });
const fishForce = new FishForceSystem({ fish, config: CONFIG });
const forceData = fishForce.calculate({
  dtMs: 16.666,
  fishPosition: { x: 100, y: -100 },
  fishVelocity: { x: 0, y: 0 },
  rodTipPosition: { x: 0, y: 0 },
  fishCondition: { maxPoints: 100, currentStamina: 0 },
  dragRatio: 0,
  input: { isPulling: true, retrieve: false, pointerDown: true },
  rod: strongRod,
  reel: noReel,
  buffs: null,
});
assert(forceData.debug.fishSpeedPxPerSec > 0, "stamina 0 keeps minimum fish activity speed");
assert(forceData.totalFishForceKg > 0, "stamina 0 keeps static fish force");
assert(forceData.player.anglePenalty < 1, "large rod angle applies penalty");

const speedRatioFish = new Fish(1, 1, {
  basePower: 1,
  levelBasePower: 1,
  maxSpeedMetersPerSec: 1,
  agility: 99,
  behaviors: {
    swim: { powerRatio: 0, speedRatio: 2, minTime: 1000, maxTime: 1000, weight: 1 },
  },
}, { next: () => 0, range: (a, b) => b });
const speedRatioForce = new FishForceSystem({ fish: speedRatioFish, config: CONFIG });
const speedRatioData = speedRatioForce.calculate({
  dtMs: 1000,
  fishPosition: { x: 0, y: -100 },
  fishVelocity: { x: 0, y: 0 },
  rodTipPosition: { x: 0, y: 0 },
  fishCondition: { maxPoints: 100, currentStamina: 100, currentExhaustion: 100 },
  dragRatio: 0,
  input: { isPulling: false, retrieve: false, pointerDown: false },
  rod: strongRod,
  reel: noReel,
  buffs: null,
});
assert(speedRatioData.debug.moveMult > 1.9, "fish speedRatio can exceed 1 as a speed multiplier");
assert(speedRatioData.debug.fishSpeedPxPerSec > physicsAdapter.getPixelsPerMeter() * 1.9, "speedRatio 2 doubles species max speed");

const profiledFish = new Fish(1, 2, {
  forceProfile: { basePower: 2, levelBasePower: 3, minPowerRatio: 0.2 },
  movementProfile: { maxSpeedMetersPerSec: 1, minStaminaActivityMultiplier: 0.5 },
  resistanceProfile: { speedForceMultiplier: 2, waterResistanceMultiplier: 3 },
  behaviors: {
    swim: { powerRatio: 0, speedRatio: 1, minTime: 1000, maxTime: 1000, weight: 1 },
  },
}, { next: () => 0.5, range: (a, b) => (a + b) / 2 });
approx(profiledFish.getStaticPowerKg(), 12, 0.001, "FishPhysicsProfile reads structured force profile");
const profiledForce = new FishForceSystem({ fish: profiledFish, config: CONFIG });
const profiledData = profiledForce.calculate({
  dtMs: 1000,
  fishPosition: { x: 0, y: -100 },
  fishVelocity: { x: 0, y: -physicsAdapter.getPixelsPerMeter() },
  rodTipPosition: { x: 0, y: 0 },
  fishCondition: { maxPoints: 100, currentStamina: 100, currentExhaustion: 100 },
  dragRatio: 0,
  input: { isPulling: false, retrieve: false, pointerDown: false },
  rod: strongRod,
  reel: noReel,
  buffs: null,
});
approx(
  profiledFish.getMaxSpeedPxPerSec(physicsAdapter.getPixelsPerMeter()),
  physicsAdapter.getPixelsPerMeter(),
  0.001,
  "FishPhysicsProfile reads structured movement profile",
);
assert(
  profiledData.debug.dynamicFishForceKg > 40,
  "FishForceSystem reads structured resistance profile for dynamic force",
);

const zeroSpeedFish = new Fish(1, 1, {
  basePower: 1,
  levelBasePower: 1,
  maxSpeedMetersPerSec: 0,
  behaviors: {
    swim: { powerRatio: 1, speedRatio: 1, minTime: 1000, maxTime: 1000, weight: 1 },
  },
}, { next: () => 0.5, range: (a, b) => (a + b) / 2 });
const zeroSpeedForce = new FishForceSystem({ fish: zeroSpeedFish, config: CONFIG });
const zeroSpeedData = zeroSpeedForce.calculate({
  dtMs: 1000,
  fishPosition: { x: 0, y: -100 },
  fishVelocity: { x: 0, y: 0 },
  rodTipPosition: { x: 0, y: 0 },
  fishCondition: { maxPoints: 100, currentStamina: 100, currentExhaustion: 100 },
  dragRatio: 0,
  input: { isPulling: false, retrieve: false, pointerDown: false },
  rod: strongRod,
  reel: noReel,
  buffs: null,
});
approx(zeroSpeedData.debug.fishSpeedPxPerSec, 0, 0.001, "fish maxSpeedMetersPerSec 0 disables fish self movement");
approx(zeroSpeedData.targetVelocity.length(), 0, 0.001, "fish maxSpeedMetersPerSec 0 keeps target velocity at zero");

const lastDashFish = new Fish(1, 0.5, {
  basePower: 1,
  levelBasePower: 1,
  maxSpeedMetersPerSec: 1,
  lastDashTrigger: {
    enabled: true,
    targetState: "lastDash",
    chance: 1,
    checkIntervalMs: 1,
    catchZoneMultiplier: 1.1,
    stayUntilLeaveZone: false,
  },
  behaviors: {
    swim: { powerRatio: 1, speedRatio: 1, minTime: 1000, maxTime: 1000, weight: 1 },
    lastDash: { enabled: true, powerRatio: 2, speedRatio: 2, minTime: 1000, maxTime: 1000, weight: 0 },
  },
}, { next: () => 0, range: (a) => a });
lastDashFish.evaluateLastDashTrigger({
  dtMs: 1000,
  lineDistanceMeters: 1.05,
  landingDistanceMeters: 1,
});
assert(lastDashFish.getBehavior(16).name === "lastDash", "lastDash can override regular fish behavior inside trigger zone");

const heldLastDashFish = new Fish(1, 0.5, {
  basePower: 1,
  levelBasePower: 1,
  maxSpeedMetersPerSec: 1,
  lastDashTrigger: {
    enabled: true,
    targetState: "lastDash",
    chance: 1,
    checkIntervalMs: 1,
    catchZoneMultiplier: 1.1,
    stayUntilLeaveZone: true,
  },
  behaviors: {
    swim: { powerRatio: 1, speedRatio: 1, minTime: 1000, maxTime: 1000, weight: 1 },
    lastDash: { enabled: true, powerRatio: 2, speedRatio: 2, minTime: 1, maxTime: 1, weight: 0 },
  },
}, { next: () => 0, range: (a) => a });
heldLastDashFish.evaluateLastDashTrigger({
  dtMs: 1000,
  lineDistanceMeters: 1.05,
  landingDistanceMeters: 1,
});
assert(heldLastDashFish.getBehavior(1000).name === "lastDash", "lastDash can stay active while fish remains in trigger zone");
heldLastDashFish.evaluateLastDashTrigger({
  dtMs: 16,
  lineDistanceMeters: 2,
  landingDistanceMeters: 1,
});
assert(heldLastDashFish.getBehavior(16).name !== "lastDash", "held lastDash releases after fish leaves trigger zone");

const renderCalls = [];
const fakeCtx = {
  save() { renderCalls.push({ type: "save" }); },
  restore() { renderCalls.push({ type: "restore" }); },
  beginPath() { renderCalls.push({ type: "beginPath" }); },
  arc(x, y, radius) { renderCalls.push({ type: "arc", x, y, radius }); },
  fill() { renderCalls.push({ type: "fill", style: this.fillStyle }); },
  stroke() { renderCalls.push({ type: "stroke", style: this.strokeStyle }); },
  fillRect(x, y, width, height) { renderCalls.push({ type: "fillRect", x, y, width, height }); },
  strokeRect(x, y, width, height) { renderCalls.push({ type: "strokeRect", x, y, width, height }); },
  moveTo(x, y) { renderCalls.push({ type: "moveTo", x, y }); },
  lineTo(x, y) { renderCalls.push({ type: "lineTo", x, y }); },
  ellipse(x, y, radiusX, radiusY) { renderCalls.push({ type: "ellipse", x, y, radiusX, radiusY }); },
  rect(x, y, width, height) { renderCalls.push({ type: "rect", x, y, width, height }); },
  clip() { renderCalls.push({ type: "clip" }); },
  setLineDash(value) { renderCalls.push({ type: "setLineDash", value }); },
};
const zoneRenderer = new Renderer({
  width: 800,
  height: 600,
  getContext() { return fakeCtx; },
});
const fakeProjector = {
  getScale() { return 1; },
  getPerspective() { return { scale: 1, squashY: 0.5 }; },
  virtualToScreen(x, y, out = null) {
    return out ? out.set(x, y) : { x, y };
  },
  screenToVirtual(x, y, out = null) {
    return out ? out.set(x, y) : { x, y };
  },
};
zoneRenderer.drawCatchZone(
  fakeProjector,
  null,
  500,
  {
    debugVisuals: true,
    showCatchZone: true,
    showLastDashZone: true,
    showNetZone: false,
    catchLineOffsetPx: 5,
    cellSize: 50,
    map: {
      test: {
        zones: {
          castable: [{ x: 0, y: 8, w: 16, h: 4 }],
        },
      },
    },
  },
  {
    color: "rgba(0, 150, 255, 0.3)",
    strokeColor: "rgba(0, 200, 255, 0.8)",
    lastDashFillColor: "rgba(170, 80, 255, 0.12)",
    lastDashStrokeColor: "rgba(190, 90, 255, 0.9)",
    lastDashDash: [9, 7],
  },
  {
    rodVirtualX: 400,
    rodVirtualY: 500,
    landingDistanceMeters: 1,
    lastDashTriggerDistanceMeters: 1.1,
    pixelsPerMeter: 50,
  },
);
const zoneEllipses = renderCalls.filter((call) => call.type === "ellipse");
assert(zoneEllipses.length === 2, "catch and lastDash zones render from actual line-distance radii");
approx(zoneEllipses[0].radiusX, 55, 0.001, "lastDash zone uses trigger distance radius");
approx(zoneEllipses[0].radiusY, 55, 0.001, "lastDash zone vertical radius matches actual catch distance");
approx(zoneEllipses[1].radiusX, 50, 0.001, "catch zone uses landing distance radius");
approx(zoneEllipses[1].radiusY, 50, 0.001, "catch zone vertical radius matches actual catch distance");
assert(
  renderCalls.some((call) => call.type === "setLineDash" && call.value?.[0] === 9),
  "lastDash zone renders with dashed boundary",
);
assert(renderCalls.some((call) => call.type === "clip"), "distance zones are clipped to castable zone");

const hookedFloat = new FloatEntity(100, 100, {
  type: "day",
  quality: 1,
  friction: 1,
  waterFriction: 0,
  currentCompensation: [0, 0],
}, 8, { next: () => 0.5 });
hookedFloat.hook();
hookedFloat.update(
  { left: 0, right: 500, top: 0, bottom: 500 },
  50,
  { current: { speedPxPerSec: 20, direction: { x: 1, y: 0 } } },
  () => true,
);
approx(hookedFloat.getPosition().x, 101, 0.001, "hooked float drifts with current in playing state");
approx(hookedFloat.getPosition().y, 100, 0.001, "current drift does not require fish self movement");

const staminaFish = new Fish(1, 0.5, {
  basePower: 1,
  levelBasePower: 1,
  baseStamina: 100,
  behaviors: {
    swim: { powerRatio: 1, speedRatio: 1, minTime: 1000, maxTime: 1000, weight: 1 },
  },
}, { next: () => 0.5, range: (a, b) => (a + b) / 2 });
const staminaCondition = new FishCondition(1, 0.5, CONFIG.stamina.fish, {
  basePower: 1,
  levelBasePower: 1,
  baseStamina: 100,
});
approx(staminaCondition.maxPoints, 600, 0.001, "fish stamina scales from base stamina plus weight grams times level");
const staminaLevelCondition = new FishCondition(3, 1.2, CONFIG.stamina.fish, {
  basePower: 100,
  levelBasePower: 100,
  baseStamina: 500,
});
approx(staminaLevelCondition.maxPoints, 4100, 0.001, "fish stamina ignores force basePower and levelBasePower");
const staminaBossCondition = new FishCondition(6, 3.8, CONFIG.stamina.fish, {
  baseStamina: 500,
  staminaBossMultiplier: 2,
}, {
  maxLevel: 6,
  levelAverageWeightKg: 4.25,
});
approx(staminaBossCondition.maxPoints, 46600, 0.001, "last-level fish below level average applies boss stamina multiplier");
const staminaController = new StaminaController(
  staminaCondition,
  staminaFish,
  1,
  CONFIG.stamina.mechanics,
);
staminaController.evaluate({
  tension: 0,
  playerPowerIsPulling: true,
  dt: 1000,
  staminaPressureRatio: 1,
  isLineFullyExtended: true,
});
assert(staminaCondition.currentStamina < staminaCondition.maxPoints, "stamina controller can drain fish stamina");
staminaController.restoreFullStamina();
approx(staminaCondition.currentStamina, staminaCondition.maxPoints, 0.001, "god stamina lock restores stamina to 100%");
approx(staminaCondition.currentExhaustion, staminaCondition.maxPoints, 0.001, "god stamina lock restores exhaustion reserve to 100%");
assert(staminaCondition.phase === "stamina", "god stamina lock keeps fish in stamina phase");

console.log("Fight systems check passed:");
for (const message of checks) console.log("- " + message);
`, context);
