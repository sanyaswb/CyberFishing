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
  "src/config/databases/item_db.js",
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
  "src/app/utils.js",
  "src/core/casting_distance.js",
  "src/core/fishing/landing_policy.js",
  "src/core/fishing/simple_fight_force_calculator.js",
  "src/core/fishing/landing_lift_tension_calculator.js",
  "src/core/fishing/line_tension_calculator.js",
  "src/core/fishing/rod_pull_state.js",
  "src/core/fishing/rod_stroke_state.js",
  "src/core/fishing/rod_pull_calculator.js",
  "src/core/fishing/fish_retrieve_result.js",
  "src/core/fishing/slack_calculator.js",
  "src/entities/tackle.js",
  "src/entities/fish.js",
  "src/app/rules.js",
  "src/input/pull_input_mapper.js",
  "src/systems/drag_system.js",
  "src/systems/line_system.js",
  "src/systems/player_force_system.js",
  "src/systems/fish_force_system.js",
  "src/systems/fish_retrieve_system.js",
  "src/systems/reel_system.js",
  "src/systems/rod_pull_system.js",
  "src/systems/tension_system.js",
  "src/systems/tackle_stress_system.js",
  "src/systems/fight_physics_pipeline.js",
  "src/systems/fight_physics_system.js",
  "src/systems/stamina_system.js",
  "src/app/fishing.js",
];

const context = vm.createContext({
  console,
  Math,
  Number,
  Object,
  JSON,
  Date,
  window: { innerWidth: 1280, innerHeight: 720 },
});

for (const file of FILES) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), context, {
    filename: file,
  });
}

vm.runInContext(`
const checks = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
  checks.push(message);
}

function assertApprox(value, expected, tolerance, message) {
  const actual = Number(value);
  if (!Number.isFinite(actual) || Math.abs(actual - expected) > tolerance) {
    throw new Error(message + " (expected " + expected + ", got " + value + ")");
  }
  checks.push(message);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function hydrate(group, id, overrides = {}) {
  const source = ITEM_DB[group]?.[id];
  if (!source) throw new Error("Missing item " + group + "." + id);
  return {
    ...clone(source),
    ...(source.engineStats ? clone(source.engineStats) : {}),
    ...overrides,
    id: source.id,
    itemId: source.id,
    instanceId: overrides.instanceId || "test_" + id,
  };
}

function createConfig() {
  const config = clone(CONFIG);
  config.debug = config.debug || {};
  config.debug.godMode = {
    ...(config.debug.godMode || {}),
    enabled: false,
    noLineBreak: false,
    noRodBreak: false,
    noFishStaminaLoss: false,
    noEquipmentLoss: false,
  };
  config.fightPhysicsConfig = new FightPhysicsConfigAdapter(config);
  return config;
}

function createRng() {
  return {
    next: () => 0.42,
    range: (min, max) => min + (max - min) * 0.42,
    int: (min, max) => Math.floor(min + (max - min + 1) * 0.42),
    chance: (probability) => Number(probability) >= 0.42,
  };
}

function createDevFlags() {
  return { isEnabled: () => false };
}

function createTestBuild({
  lineMaxLoadKg = 3,
  rodMaxLoadKg = 3,
  reelMaxLoadKg = 3,
  hookMaxLoadKg = 3,
  reelHasDrag = true,
} = {}) {
  return {
    rod: hydrate("rods", "rod_test_feeder", {
      instanceId: "cycle_rod",
      maxLoadKg: rodMaxLoadKg,
      holdTensionRatio: 1.0,
    }),
    reel: hydrate("reels", "reel_test", {
      instanceId: "cycle_reel",
      maxLoadKg: reelMaxLoadKg,
      dragMaxKg: reelMaxLoadKg,
      hasDrag: reelHasDrag,
      retrieveSpeedMetersPerSec: 1.2,
    }),
    line: hydrate("lines", "line_test_25m", {
      instanceId: "cycle_line",
      lengthMeters: 25,
      maxLoadKg: lineMaxLoadKg,
    }),
    sinker: hydrate("baits", "feeder_spring_basic", {
      instanceId: "cycle_feeder",
    }),
    hooks: [
      hydrate("hooks", "hook_basic", {
        instanceId: "cycle_hook",
        maxLoadKg: hookMaxLoadKg,
      }),
    ],
    baits: [
      hydrate("baits", "bread", {
        instanceId: "cycle_bait",
      }),
    ],
  };
}

function createFish({ weightKg, basePower = 0.5, baseSpeed = 1, forceMultiplier = 0.7, speedMultiplier = 1 }) {
  const template = clone(FISH_DB.find((fish) => fish.id === "crucian_stalker") || FISH_DB[0]);
  template.level = 1;
  template.weight = weightKg;
  template.maxLevel = template.weightConfig?.maxLevel || 6;
  template.levelAverageWeightKg = weightKg;
  template.physics.forceProfile.basePower = basePower;
  template.physics.movementProfile.baseSpeed = baseSpeed;
  for (const behavior of Object.values(template.physics.behaviorProfile.behaviors)) {
    behavior.forceMultiplier = forceMultiplier;
    behavior.speedMultiplier = speedMultiplier;
    behavior.minTime = 100000;
    behavior.maxTime = 100000;
    behavior.weight = behavior === template.physics.behaviorProfile.behaviors.swim ? 100 : 0;
  }
  return template;
}

function createCast({ config, equipment, distanceMeters }) {
  const rng = createRng();
  const equipmentRules = new EquipmentRules(new CastDistanceCalculator(config));
  const baitRules = new BaitRules();
  const rodVirtualPos = { x: 500, y: 700 };
  const bounds = { left: 0, right: 1000, top: 0, bottom: 800 };
  const castService = new CastService({
    config,
    rng,
    clock: { now: 1000 },
    equipmentRules,
    baitRules,
    getRodVirtualPos: () => rodVirtualPos,
    getDynamicBounds: () => bounds,
  });
  const result = castService.cast(
    rodVirtualPos.x,
    rodVirtualPos.y - distanceMeters * 50,
    2,
    {
      equipment,
      rodVirtualPos,
      currentHookDepth: 1,
    },
  );
  assert(result.success, "cast succeeds with equipped test build and bait");
  assert(result.floatEntity, "cast creates runtime float/tackle entity");
  return { ...result, rodVirtualPos, bounds };
}

function runFightScenario({
  name,
  equipment,
  fishData,
  startDistanceMeters,
  frames = 240,
  checkWater = () => true,
  closeDrag = false,
}) {
  const config = createConfig();
  const rng = createRng();
  const cast = createCast({ config, equipment, distanceMeters: startDistanceMeters });
  const fight = new FightService({
    config,
    rng,
    devFlags: createDevFlags(),
  });
  fight.startFight(fishData, equipment);

  let transition = null;
  let peakLineStress = 0;
  let peakTotalTension = 0;
  let sawHold = false;
  let sawPlayerTension = false;
  let sawFishTension = false;
  let sawMovement = false;
  let sawBlockedMovement = false;
  let lastDebug = null;

  for (let frame = 0; frame < frames; frame++) {
    const result = fight.updateFight(1000 / 30, {
      floatEntity: cast.floatEntity,
      bounds: cast.bounds,
      input: {
        isPulling: true,
        retrieve: false,
        pointerDown: false,
        dragIncrease: closeDrag,
        pullDirection: { x: 0, y: 1 },
      },
      env: {},
      net: null,
      fishData,
      projectorScale: 1,
      catchLineOffsetPx: 5,
      getRodVirtualPos: () => cast.rodVirtualPos,
      checkWater,
    });

    lastDebug = fight.getDebugData({
      floatEntity: cast.floatEntity,
      boundaries: cast.bounds,
      rodPos: cast.rodVirtualPos,
      screenOffset: 0,
      equipment,
    });
    peakLineStress = Math.max(peakLineStress, Number(lastDebug.lineStressRatio) || 0);
    peakTotalTension = Math.max(peakTotalTension, Number(lastDebug.totalTensionKg) || 0);
    sawHold ||= (Number(lastDebug.activeRodPullForceKg) || 0) > 0;
    sawPlayerTension ||= (Number(lastDebug.playerHoldTensionKg) || 0) > 0;
    sawFishTension ||= (Number(lastDebug.fishTensionKg) || 0) > 0;
    sawMovement ||= (Number(lastDebug.fishRetrieveAppliedMoveMeters) || 0) > 0;
    sawBlockedMovement ||= lastDebug.fishRetrieveMovementBlocked === true;

    if (result.transition) {
      transition = result.transition;
      break;
    }
  }

  assert(sawHold, name + ": rod hold produces force");
  assert(sawPlayerTension, name + ": hold contributes player tension");
  assert(sawFishTension, name + ": fish contributes fish tension");

  return {
    name,
    transition,
    peakLineStress,
    peakTotalTension,
    sawMovement,
    sawBlockedMovement,
    lastDebug,
  };
}

const victory = runFightScenario({
  name: "victory",
  equipment: createTestBuild({
    rodMaxLoadKg: 20,
    reelMaxLoadKg: 20,
    lineMaxLoadKg: 20,
    hookMaxLoadKg: 20,
  }),
  fishData: createFish({
    weightKg: 0.25,
    basePower: 0.5,
    baseSpeed: 0.8,
    forceMultiplier: 0.5,
    speedMultiplier: 0.8,
  }),
  startDistanceMeters: 1.8,
  frames: 240,
  closeDrag: true,
});
assert(
  victory.transition?.name === "victory",
  "easy fish reaches victory through full fight update cycle"
    + " (last distance "
    + Number(victory.lastDebug?.lineDistanceMeters || 0).toFixed(3)
    + "m, transition "
    + (victory.transition?.name || "none")
    + "/"
    + (victory.transition?.data?.reason || "no_reason")
    + ", lift="
    + Number(victory.lastDebug?.landingLiftHoldKg || 0).toFixed(3)
    + "/"
    + Number(victory.lastDebug?.landingLiftMaxKg || 0).toFixed(3)
    + ", liftActive="
    + victory.lastDebug?.landingLiftActive
    + ", liftInZone="
    + victory.lastDebug?.landingLiftInZone
    + ", totalTension="
    + Number(victory.lastDebug?.totalTensionKg || 0).toFixed(3)
    + ")",
);
assert(victory.sawMovement, "easy fish physically moves toward player during hold");
assert(victory.peakLineStress < 1, "easy fish stays under line break stress");

const breakCase = runFightScenario({
  name: "line_break",
  equipment: createTestBuild({
    rodMaxLoadKg: 3,
    reelMaxLoadKg: 3,
    lineMaxLoadKg: 0.8,
    hookMaxLoadKg: 3,
    reelHasDrag: false,
  }),
  fishData: createFish({
    weightKg: 0.2,
    basePower: 0.5,
    baseSpeed: 0,
    forceMultiplier: 1.0,
    speedMultiplier: 0,
  }),
  startDistanceMeters: 5,
  frames: 90,
  checkWater: () => false,
});
assert(
  breakCase.sawBlockedMovement,
  "blocked fish disables movable hold tension cap"
    + " (last blocked="
    + breakCase.lastDebug?.fishRetrieveMovementBlocked
    + ", desired="
    + Number(breakCase.lastDebug?.fishRetrieveDesiredMoveMeters || 0).toFixed(4)
    + ", applied="
    + Number(breakCase.lastDebug?.fishRetrieveAppliedMoveMeters || 0).toFixed(4)
    + ", transition="
    + (breakCase.transition?.name || "none")
    + "/"
    + (breakCase.transition?.data?.reason || "no_reason")
    + ")",
);
assert(breakCase.peakTotalTension >= 0.8, "blocked/overloaded scenario exceeds line load");
assert(breakCase.transition?.name === "failed", "overloaded scenario fails");
assert(breakCase.transition?.data?.reason === "line", "overloaded scenario breaks the line");

console.log("game-cycle-check passed:");
console.log("- victory peak line stress: " + (victory.peakLineStress * 100).toFixed(1) + "%");
console.log("- victory peak total tension: " + victory.peakTotalTension.toFixed(3) + " kg");
console.log("- line break peak line stress: " + (breakCase.peakLineStress * 100).toFixed(1) + "%");
console.log("- line break reason: " + breakCase.transition.data.reason);
for (const message of checks) console.log("- " + message);
`, context, { filename: "utils/game-cycle-check.js#scenario" });
