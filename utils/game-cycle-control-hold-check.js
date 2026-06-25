const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const FILES = [
  "src/core/input/fight_input_action_composer.js",
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
  "src/core/line/line_spool_state.js",
  "src/core/fishing/landing_policy.js",
  "src/core/fishing/simple_fight_force_calculator.js",
  "src/core/fishing/hold_opposition_resolver.js",
  "src/core/fishing/fish_direction_intent_sampler.js",
  "src/core/fishing/fish_fight_direction_resolver.js",
  "src/core/fishing/drag_force_calculator.js",
  "src/core/fishing/landing_lift_tension_calculator.js",
  "src/core/fishing/landing_lift_readiness_policy.js",
  "src/core/fishing/line_tension_calculator.js",
  "src/core/fishing/line_constraint_state_resolver.js",
  "src/core/fishing/line_constrained_fish_motion_resolver.js",
  "src/core/fishing/line_radial_movement_splitter.js",
  "src/core/fishing/rod_control_movement_projector.js",
  "src/core/fishing/pole_fight_sector_geometry.js",
  "src/core/fishing/pole_fight_sector_constraint.js",
  "src/core/fishing/pole_fight_sector_angle_constraint.js",
  "src/core/fishing/tackle_failure_selector.js",
  "src/core/fishing/tackle_stress_accumulator.js",
  "src/core/fishing/rod_pull_state.js",
  "src/core/fishing/rod_stroke_state.js",
  "src/core/fishing/reel_hold_load_policy.js",
  "src/core/fishing/rod_stroke_tracker.js",
  "src/core/fishing/rod_stroke_distance_tracker.js",
  "src/core/fishing/player_force_budget_allocator.js",
  "src/core/fishing/reel_auto_recovery_calculator.js",
  "src/core/fishing/reel_hold_recovery_system.js",
  "src/core/fishing/reel_recovery_fish_slowdown_policy.js",
  "src/core/fishing/rod_pull_calculator.js",
  "src/core/fishing/fish_retrieve_result.js",
  "src/core/fishing/slack_calculator.js",
  "src/core/fishing/reel_retrieve_speed_calculator.js",
  "src/entities/tackle.js",
  "src/entities/fish.js",
  "src/app/rules.js",
  "src/input/pull_input_mapper.js",
  "src/systems/drag_system.js",
  "src/systems/line_system.js",
  "src/systems/player_force_system.js",
  "src/systems/fish_force_system.js",
  "src/systems/fish_retrieve_system.js",
  "src/systems/player_pull_motion_smoother.js",
  "src/systems/reel_system.js",
  "src/systems/rod_pull_system.js",
  "src/core/fishing/rod_control_tension_mode_resolver.js",
  "src/systems/rod_lateral_control_system.js",
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

function createTestBuild() {
  return {
    rod: hydrate("rods", "rod_test_feeder", {
      instanceId: "stage1_rod",
      maxLoadKg: 20,
      holdTensionRatio: 1.0,
    }),
    reel: hydrate("reels", "reel_test", {
      instanceId: "stage1_reel",
      maxLoadKg: 20,
      dragMaxKg: 20,
      hasDrag: true,
      retrieveSpeedMetersPerSec: 1.2,
    }),
    line: hydrate("lines", "line_test_1", {
      instanceId: "stage1_line",
      lengthMeters: 25,
      maxLoadKg: 20,
    }),
    sinker: hydrate("baits", "feeder_spring_basic", {
      instanceId: "stage1_feeder",
    }),
    hooks: [hydrate("hooks", "hook_basic", { instanceId: "stage1_hook", maxLoadKg: 20 })],
    baits: [hydrate("baits", "bread", { instanceId: "stage1_bait" })],
  };
}

function createPoleBuild() {
  return {
    rod: hydrate("rods", "rod_test_float", {
      instanceId: "pole_transition_rod",
      maxLoadKg: 1,
      holdTensionRatio: 1.0,
    }),
    reel: null,
    line: hydrate("lines", "line_test_1", {
      instanceId: "pole_transition_line",
      lengthMeters: 6,
      maxLoadKg: 1,
    }),
    sinker: hydrate("sinkers", "sinker_light", {
      instanceId: "pole_transition_sinker",
    }),
    hooks: [hydrate("hooks", "hook_basic", {
      instanceId: "pole_transition_hook",
      maxLoadKg: 1,
    })],
    baits: [hydrate("baits", "bread", {
      instanceId: "pole_transition_bait",
    })],
  };
}

function createFish() {
  const template = clone(FISH_DB.find((fish) => fish.id === "crucian_stalker") || FISH_DB[0]);
  template.level = 1;
  template.weight = 0.05;
  template.maxLevel = template.weightConfig?.maxLevel || 6;
  template.levelAverageWeightKg = 0.05;
  template.physics.forceProfile.basePower = 0.5;
  template.physics.movementProfile.baseSpeed = 0.8;
  for (const behavior of Object.values(template.physics.behaviorProfile.behaviors)) {
    behavior.forceMultiplier = 0.5;
    behavior.speedMultiplier = 0.8;
    behavior.minTime = 100000;
    behavior.maxTime = 100000;
    behavior.weight = behavior === template.physics.behaviorProfile.behaviors.swim ? 100 : 0;
  }
  return template;
}

function createStationaryFish() {
  const template = createFish();
  template.physics.forceProfile.basePower = 0;
  template.physics.movementProfile.baseSpeed = 0;
  for (const behavior of Object.values(template.physics.behaviorProfile.behaviors)) {
    behavior.forceMultiplier = 0;
    behavior.speedMultiplier = 0;
  }
  return template;
}

function createCast({ config, equipment, distanceMeters }) {
  const rng = createRng();
  const equipmentRules = new EquipmentRules(new CastDistanceCalculator(config));
  const baitRules = new BaitRules();
  const bounds = { left: 0, right: 1000, top: 0, bottom: 800 };
  const rodVirtualPos = { x: 500, y: bounds.bottom };
  const castService = new CastService({
    config,
    rng,
    clock: { now: 1000 },
    equipmentRules,
    baitRules,
    getRodVirtualPos: () => rodVirtualPos,
    getDynamicBounds: () => bounds,
  });
  const result = castService.cast(rodVirtualPos.x + 120, rodVirtualPos.y - distanceMeters * 50, 2, {
    equipment,
    rodVirtualPos,
    currentHookDepth: 1,
  });
  assert(result.success, "cast succeeds for hold+control cycle");
  return { ...result, rodVirtualPos, bounds };
}

const config = createConfig();
const rng = createRng();
const equipment = createTestBuild();
const fishData = createFish();
const cast = createCast({ config, equipment, distanceMeters: 1.8 });
const fight = new FightService({ config, rng, devFlags: createDevFlags() });
fight.startFight(fishData, equipment);

let transition = null;
let sawHold = false;
let sawControl = false;
let sawMovement = false;
let sawDistanceStrokeGain = false;
let sawComposedKeyboardHold = false;
let lastDebug = null;

for (let frame = 0; frame < 240; frame++) {
  const result = fight.updateFight(1000 / 30, {
    floatEntity: cast.floatEntity,
    bounds: cast.bounds,
    input: {
      isPulling: false,
      pointerDown: false,
      keys: { Space: true, KeyA: true },
      dragIncrease: true,
      retrieve: false,
      pullDirection: { x: 0, y: 1 },
    },
    env: {},
    net: null,
    fishData,
    getRodVirtualPos: () => cast.rodVirtualPos,
    checkWater: () => true,
  });

  lastDebug = fight.getDebugData({
    floatEntity: cast.floatEntity,
    boundaries: cast.bounds,
    rodPos: cast.rodVirtualPos,
    screenOffset: 0,
    equipment,
  });
  sawHold ||= (Number(lastDebug.activeRodPullForceKg) || 0) > 0;
  sawControl ||= lastDebug.rodControlActive === true;
  sawMovement ||= (Number(lastDebug.fishRetrieveAppliedMoveMeters) || 0) > 0;
  sawDistanceStrokeGain ||=
    (Number(lastDebug.strokeDistanceGainedMeters) || 0) > 0 ||
    (Number(lastDebug.playerFrameStrokeDistanceGainedMeters) || 0) > 0;
  sawComposedKeyboardHold ||= lastDebug.rodPullActive === true;

  if (result.transition) {
    transition = result.transition;
    break;
  }
}

assert(sawComposedKeyboardHold, "Space is composed into Fight Rod Hold");
assert(sawHold, "composed Fight Rod Hold produces pull force");
assert(sawControl, "Space + A composes Rod Control during hold");
assert(sawMovement, "hold + control cycle still moves fish toward player");
assert(sawDistanceStrokeGain, "hold + control cycle records distance-based rod stroke gain");
assert(
  transition?.name === "victory",
  "0.05 kg fish reaches victory with keyboard hold + lateral control"
    + " (transition " + (transition?.name || "none")
    + "/" + (transition?.data?.reason || "no_reason")
    + ", distance " + Number(lastDebug?.lineDistanceMeters || 0).toFixed(3)
    + "m, hold=" + lastDebug?.rodPullActive
    + ", control=" + lastDebug?.rodControlActive
    + ")"
);

const openDragConfig = createConfig();
const openDragEquipment = createTestBuild();
const openDragFishData = createFish();
const openDragCast = createCast({
  config: openDragConfig,
  equipment: openDragEquipment,
  distanceMeters: 1.8,
});
const openDragFight = new FightService({
  config: openDragConfig,
  rng: createRng(),
  devFlags: createDevFlags(),
});
openDragFight.startFight(openDragFishData, openDragEquipment);

let openDragDebug = null;
let openDragSawComposedHold = false;
let openDragSawComposedControl = false;
let openDragMaxHoldForceKg = 0;
let openDragMaxControlForceKg = 0;
let openDragMaxAppliedMoveMeters = 0;

for (let frame = 0; frame < 30; frame++) {
  openDragFight.updateFight(1000 / 30, {
    floatEntity: openDragCast.floatEntity,
    bounds: openDragCast.bounds,
    input: {
      isPulling: false,
      pointerDown: false,
      keys: { Space: true, KeyA: true },
      dragIncrease: false,
      dragDecrease: false,
      retrieve: false,
      pullDirection: { x: 0, y: 1 },
    },
    env: {},
    net: null,
    fishData: openDragFishData,
    getRodVirtualPos: () => openDragCast.rodVirtualPos,
    checkWater: () => true,
  });

  openDragDebug = openDragFight.getDebugData({
    floatEntity: openDragCast.floatEntity,
    boundaries: openDragCast.bounds,
    rodPos: openDragCast.rodVirtualPos,
    screenOffset: 0,
    equipment: openDragEquipment,
  });
  openDragSawComposedHold ||= openDragDebug.rodPullActive === true;
  openDragSawComposedControl ||= openDragDebug.rodControlActive === true;
  openDragMaxHoldForceKg = Math.max(
    openDragMaxHoldForceKg,
    Number(openDragDebug.activeRodPullForceKg) || 0,
  );
  openDragMaxControlForceKg = Math.max(
    openDragMaxControlForceKg,
    Number(openDragDebug.rodControlForceKg) || 0,
  );
  openDragMaxAppliedMoveMeters = Math.max(
    openDragMaxAppliedMoveMeters,
    Number(openDragDebug.fishRetrieveAppliedMoveMeters) || 0,
  );
}

assert(openDragSawComposedHold, "open-drag cycle still composes Fight Rod Hold input");
assert(openDragSawComposedControl, "open-drag cycle still composes Rod Control input");
assert(
  Math.abs(Number(openDragDebug?.dragRatio) || 0) <= 0.000001,
  "open-drag cycle keeps reel drag at 0%",
);
assert(
  openDragMaxHoldForceKg <= 0.000001,
  "0% drag transfers no external Rod Hold force",
);
assert(
  openDragMaxControlForceKg <= 0.000001,
  "0% drag transfers no external Rod Control force",
);
assert(
  openDragMaxAppliedMoveMeters <= 0.000001,
  "0% drag produces no player retrieve movement",
);

const poleConfig = createConfig();
const poleSectorConfig = poleConfig.fightPhysicsConfig.getPoleFightSectorConfig();
const poleSectorMaxAngleDeg = poleSectorConfig.maxAngleFromCenterDeg;
const poleEquipment = createPoleBuild();
const poleFishData = createStationaryFish();
const poleCast = createCast({
  config: poleConfig,
  equipment: poleEquipment,
  distanceMeters: 5.5,
});
const poleFight = new FightService({
  config: poleConfig,
  rng: createRng(),
  devFlags: createDevFlags(),
});
poleFight.startFight(poleFishData, poleEquipment);

let poleControlMoved = false;
let poleControlActivatedHold = false;
let poleControlMaxStrokeRatio = 0;
let poleControlDebug = null;

for (let frame = 0; frame < 90; frame++) {
  poleFight.updateFight(1000 / 30, {
    floatEntity: poleCast.floatEntity,
    bounds: poleCast.bounds,
    input: {
      isPulling: false,
      pointerDown: true,
      pointerDelta: { x: -110, y: 0 },
      keys: {},
      dragIncrease: false,
      dragDecrease: false,
      retrieve: false,
      pullDirection: { x: 0, y: 1 },
    },
    env: {},
    net: null,
    fishData: poleFishData,
    getRodVirtualPos: () => poleCast.rodVirtualPos,
    checkWater: () => true,
  });

  poleControlDebug = poleFight.getDebugData({
    floatEntity: poleCast.floatEntity,
    boundaries: poleCast.bounds,
    rodPos: poleCast.rodVirtualPos,
    screenOffset: 0,
    equipment: poleEquipment,
  });
  poleControlMoved ||= (Number(poleControlDebug.rodControlMoveMeters) || 0) > 0;
  poleControlActivatedHold ||= poleControlDebug.rodPullActive === true;
  poleControlMaxStrokeRatio = Math.max(
    poleControlMaxStrokeRatio,
    Number(poleControlDebug.rodStrokeRatio) || 0,
  );

  if (poleControlDebug.rodControlAligned === true) break;
}

assert(poleControlMoved, "6m pole pointer Control moves the fish laterally");
assert(
  !poleControlActivatedHold,
  "6m pole pointer Control does not activate Rod Hold",
);
assert(
  poleControlMaxStrokeRatio <= 0.000001,
  "6m pole pointer Control does not consume Rod Hold stroke",
);

poleFight.updateFight(1000 / 30, {
  floatEntity: poleCast.floatEntity,
  bounds: poleCast.bounds,
  input: {
    isPulling: false,
    pointerDown: false,
    pointerDelta: { x: 0, y: 0 },
    keys: {},
    dragIncrease: false,
    dragDecrease: false,
    retrieve: false,
    pullDirection: { x: 0, y: 1 },
  },
  env: {},
  net: null,
  fishData: poleFishData,
  getRodVirtualPos: () => poleCast.rodVirtualPos,
  checkWater: () => true,
});

const poleDistanceBeforeHold = Number(
  poleFight.getDebugData({
    floatEntity: poleCast.floatEntity,
    boundaries: poleCast.bounds,
    rodPos: poleCast.rodVirtualPos,
    screenOffset: 0,
    equipment: poleEquipment,
  }).lineDistanceMeters,
) || 0;
let poleHoldActive = false;
let poleHoldMoved = false;
let poleHoldDebug = null;

for (let frame = 0; frame < 90; frame++) {
  poleFight.updateFight(1000 / 30, {
    floatEntity: poleCast.floatEntity,
    bounds: poleCast.bounds,
    input: {
      isPulling: false,
      pointerDown: true,
      pointerDelta: { x: 0, y: 0 },
      keys: {},
      dragIncrease: false,
      dragDecrease: false,
      retrieve: false,
      pullDirection: { x: 0, y: 1 },
    },
    env: {},
    net: null,
    fishData: poleFishData,
    getRodVirtualPos: () => poleCast.rodVirtualPos,
    checkWater: () => true,
  });

  poleHoldDebug = poleFight.getDebugData({
    floatEntity: poleCast.floatEntity,
    boundaries: poleCast.bounds,
    rodPos: poleCast.rodVirtualPos,
    screenOffset: 0,
    equipment: poleEquipment,
  });
  poleHoldActive ||= poleHoldDebug.rodPullActive === true;
  poleHoldMoved ||= (Number(poleHoldDebug.fishRetrieveAppliedMoveMeters) || 0) > 0;
}

assert(poleHoldActive, "new pole pointer gesture activates Rod Hold after Control release");
assert(poleHoldMoved, "6m pole Rod Hold applies retrieve movement after Control");
assert(
  (Number(poleHoldDebug?.lineDistanceMeters) || 0) < poleDistanceBeforeHold,
  "6m pole Rod Hold reduces fish distance after Control",
);
assert(
  poleHoldDebug?.poleFightSectorActive === true,
  "6m pole cycle uses the shared pole fight sector constraint",
);
assert(
  Math.abs(
    (Number(poleHoldDebug?.poleFightSectorMaxAngleDeg) || 0) -
      poleSectorMaxAngleDeg,
  ) <= 0.000001,
  "6m pole cycle exposes the configured sector angle",
);
assert(
  Math.abs(
    (Number(poleHoldDebug?.poleFightSectorLimitRadiusMeters) || 0) - 6,
  ) <= 0.000001,
  "6m pole cycle exposes the real 6m sector radius",
);
assert(
  Math.abs(Number(poleHoldDebug?.poleFightSectorAngleDeg) || 0) <=
    poleSectorMaxAngleDeg + 0.0001,
  "6m pole fish remains inside the configured angular sector",
);
assert(
  (Number(poleHoldDebug?.lineDistanceMeters) || 0) <= 6.0001,
  "6m pole fish remains inside the physical line radius",
);

console.log("game-cycle-control-hold-check passed:");
for (const message of checks) console.log("- " + message);
`, context, { filename: "utils/game-cycle-control-hold-check.js#scenario" });
