const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..", "..");
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
  "src/core/fishing/tackle_failure_selector.js",
  "src/core/fishing/tackle_stress_accumulator.js",
  "src/core/fishing/rod_pull_state.js",
  "src/core/fishing/rod_stroke_state.js",
  "src/core/fishing/reel_hold_load_policy.js",
  "src/core/fishing/rod_stroke_tracker.js",
  "src/core/fishing/rod_stroke_distance_tracker.js",
  "src/core/fishing/player_force_budget_allocator.js",
  "src/core/fishing/player_pressure/player_pressure_fatigue_state.js",
  "src/core/fishing/player_pressure/player_pressure_fatigue_calculator.js",
  "src/core/fishing/stamina/active_stamina_drain_calculator.js",
  "src/core/fishing/stamina/angle_stamina_recovery_calculator.js",
  "src/core/fishing/stamina/stamina_angle_regen_multiplier_calculator.js",
  "src/core/fishing/stamina/passive_stamina_regen_calculator.js",
  "src/core/fishing/stamina/active_endurance_drain_calculator.js",
  "src/core/fishing/stamina/passive_endurance_drain_calculator.js",
  "src/core/fishing/stamina/passive_stamina_drain_calculator.js",
  "src/core/fishing/stamina/stamina_balance_frame.js",
  "src/core/fishing/endurance/endurance_movement_debuff_calculator.js",
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
  "src/services/weakest_tackle_limit_resolver.js",
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
  window: {
    document: {},
    innerWidth: 1280,
    innerHeight: 720,
    DEBUG_MODULES: { catchResolution: true },
  },
});

for (const file of FILES) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), context, {
    filename: file,
  });
}

vm.runInContext(`
function assert(condition, message) {
  if (!condition) throw new Error(message);
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
    instanceId: overrides.instanceId || "debug_" + id,
  };
}

function createConfig() {
  const config = clone(CONFIG);
  config.debug = config.debug || {};
  config.debug.consoleModules = {
    ...(config.debug.consoleModules || {}),
    catchResolution: true,
  };
  config.debug.godMode = {
    ...(config.debug.godMode || {}),
    enabled: false,
    fixedBiteChanceEnabled: true,
    fixedBiteChancePercent: 100,
    biteSequenceMode: "guaranteed",
    noLineBreak: false,
    noRodBreak: true,
    noFishStaminaLoss: false,
    noEquipmentLoss: false,
  };
  config.fightPhysicsConfig = new FightPhysicsConfigAdapter(config);
  window.DEBUG_MODULES = { catchResolution: true };
  return config;
}

function createRng() {
  return {
    next: () => 0.01,
    range: (min, max) => min + (max - min) * 0.01,
    int: (min, max) => Math.floor(min + (max - min + 1) * 0.01),
    chance: (probability) => Number(probability) >= 0.01,
  };
}

function createEquipment() {
  return {
    rod: hydrate("rods", "rod_test_feeder"),
    reel: hydrate("reels", "reel_test"),
    line: hydrate("lines", "line_test_1"),
    sinker: hydrate("baits", "feeder_spring_basic"),
    hooks: [hydrate("hooks", "hook_basic", { maxLoadKg: 1 })],
    baits: [hydrate("baits", "bread")],
  };
}

function createFish(weightKg) {
  const template = clone(
    FISH_DB.find((fish) => fish.id === "crucian_stalker") || FISH_DB[0],
  );
  template.level = 1;
  template.weight = weightKg;
  template.maxLevel = template.weightConfig?.maxLevel || 6;
  template.levelAverageWeightKg = weightKg;
  template.physics.forceProfile.basePower = 0.5;
  template.physics.movementProfile.baseSpeed = 0;
  for (const behavior of Object.values(template.physics.behaviorProfile.behaviors)) {
    behavior.forceMultiplier = 0;
    behavior.speedMultiplier = 0;
    behavior.minTime = 100000;
    behavior.maxTime = 100000;
    behavior.weight = 0;
  }
  if (template.physics.behaviorProfile.behaviors.swim) {
    template.physics.behaviorProfile.behaviors.swim.weight = 100;
  }
  if (template.physics.behaviorProfile.lastDashTrigger) {
    template.physics.behaviorProfile.lastDashTrigger.enabled = false;
  }
  return template;
}

function createCast({ config, equipment, distanceMeters }) {
  const equipmentRules = new EquipmentRules(new CastDistanceCalculator(config));
  const baitRules = new BaitRules();
  const bounds = { left: 0, right: 1000, top: -800, bottom: 800 };
  const rodVirtualPos = { x: 500, y: bounds.bottom };
  const castService = new CastService({
    config,
    rng: createRng(),
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
  assert(result.success, "max-power feeder cast failed");
  assert(result.floatEntity, "cast did not create float entity");
  return { ...result, rodVirtualPos, bounds };
}

function calculateExpected({ config, fishData }) {
  const water = config.fightPhysicsConfig.getWaterConfig();
  const tension = config.fightPhysicsConfig.getFightTensionConfig();
  const lift = config.fightPhysicsConfig.getLandingLiftConfig();
  const fishBasePower = Number(fishData.physics.forceProfile.basePower) || 1;
  const fishPassiveKg =
    fishData.weight * water.tautBodyResistancePerKg * fishBasePower;
  const behaviors = fishData.physics.behaviorProfile.behaviors;
  const maxStateForceMultiplier = Math.max(
    ...Object.values(behaviors).map((state) => Number(state.forceMultiplier) || 0),
  );
  const directionMultiplier =
    config.fightPhysicsConfig.getDirectionForceConfig().awayMultiplier;
  const maxWaterFishTensionKg =
    fishPassiveKg + fishPassiveKg * maxStateForceMultiplier * directionMultiplier;
  const maxMovablePlayerTensionKg =
    maxWaterFishTensionKg * tension.movableHoldTensionCapRatio;
  const maxWaterTotalTensionKg =
    maxWaterFishTensionKg + maxMovablePlayerTensionKg;
  const landingLiftMaxKg = fishData.weight * lift.liftWeightTensionRatio;
  const rodLimitKg = Number(ITEM_DB.rods.rod_test_feeder.engineStats.maxLoadKg) || 0;

  return {
    fishPassiveKg,
    maxStateForceMultiplier,
    directionMultiplier,
    maxWaterFishTensionKg,
    maxMovablePlayerTensionKg,
    maxWaterTotalTensionKg,
    landingLiftMaxKg,
    expectedMovableMaxTargetTensionKg: Math.max(
      maxWaterTotalTensionKg,
      landingLiftMaxKg,
    ),
    expectedHardLineMaxTargetTensionKg: rodLimitKg,
    expectedScenarioMaxTargetTensionKg: Math.max(
      maxWaterTotalTensionKg,
      landingLiftMaxKg,
    ),
  };
}

function runScenario() {
  const config = createConfig();
  const equipment = createEquipment();
  const fishData = createFish(0.05);
  const castDistanceMeters = 1.8;
  const cast = createCast({
    config,
    equipment,
    distanceMeters: castDistanceMeters,
  });
  const fight = new FightService({
    config,
    rng: createRng(),
    devFlags: { isEnabled: (name) => name === "noRodBreak" },
  });
  fight.startFight(fishData, equipment);

  let transition = null;
  let lastDebug = null;
  let peak = {
    tensionKg: 0,
    targetTensionKg: 0,
    totalTensionKg: 0,
    rawTensionKg: 0,
    lineStressRatio: 0,
    rodHoldKg: 0,
  };

  const dragPrechargeFrames = 120;
  for (let frame = 0; frame < 3600; frame++) {
    const pumpFrame = frame - dragPrechargeFrames;
    const holdActive =
      frame >= dragPrechargeFrames &&
      (pumpFrame % 60) < 24;
    const result = fight.updateFight(1000 / 30, {
      floatEntity: cast.floatEntity,
      bounds: cast.bounds,
      input: {
        isPulling: holdActive,
        retrieve: false,
        pointerDown: false,
        dragIncrease: frame < dragPrechargeFrames,
        dragDecrease: false,
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
    peak.tensionKg = Math.max(peak.tensionKg, Number(lastDebug.tensionKg) || 0);
    peak.targetTensionKg = Math.max(
      peak.targetTensionKg,
      Number(lastDebug.targetTensionKg) || 0,
    );
    peak.totalTensionKg = Math.max(
      peak.totalTensionKg,
      Number(lastDebug.totalTensionKg) || 0,
    );
    peak.rawTensionKg = Math.max(
      peak.rawTensionKg,
      Number(lastDebug.rawTensionKg) || 0,
    );
    peak.lineStressRatio = Math.max(
      peak.lineStressRatio,
      Number(lastDebug.lineStressRatio) || 0,
    );
    peak.rodHoldKg = Math.max(
      peak.rodHoldKg,
      Number(lastDebug.activeRodPullForceKg) || 0,
    );

    if (result.transition) {
      transition = result.transition;
      break;
    }
  }

  const expected = calculateExpected({ config, fishData });
  const summary = {
    transition: transition?.name || "none",
    transitionReason: transition?.data?.reason || "none",
    fishWeightKg: fishData.weight,
    castDistanceMeters,
    dragPrechargeFrames,
    rodId: equipment.rod.id,
    reelId: equipment.reel.id,
    lineId: equipment.line.id,
    feederRigId: equipment.sinker.id,
    hookId: equipment.hooks[0].id,
    baitId: equipment.baits[0].id,
    dragRatioAtEnd: Number(lastDebug?.dragRatio) || 0,
    expected,
    peak,
    final: {
      lineDistanceMeters: Number(lastDebug?.lineDistanceMeters) || 0,
      shoreLandingDistanceMeters:
        Number(lastDebug?.shoreLandingDistanceMeters) || 0,
      tensionKg: Number(lastDebug?.tensionKg) || 0,
      targetTensionKg: Number(lastDebug?.targetTensionKg) || 0,
      totalTensionKg: Number(lastDebug?.totalTensionKg) || 0,
      rawTensionKg: Number(lastDebug?.rawTensionKg) || 0,
      fishTensionKg: Number(lastDebug?.fishTensionKg) || 0,
      playerHoldTensionKg: Number(lastDebug?.playerHoldTensionKg) || 0,
      rodHoldKg: Number(lastDebug?.activeRodPullForceKg) || 0,
      rodHoldMaxKg: Number(lastDebug?.rodHoldMaxKg) || 0,
      effectiveRodHoldKg: Number(lastDebug?.effectiveRodHoldKg) || 0,
      holdReelRecoverEligible: !!lastDebug?.holdReelRecoverEligible,
      holdReelRecoverActive: !!lastDebug?.holdReelRecoverActive,
      holdReelRecoverDelayMs: Number(lastDebug?.holdReelRecoverDelayMs) || 0,
      holdReelRecoverBlockedReason:
        lastDebug?.holdReelRecoverBlockedReason || "n/a",
      landingLiftHoldKg: Number(lastDebug?.landingLiftHoldKg) || 0,
      landingLiftMaxKg: Number(lastDebug?.landingLiftMaxKg) || 0,
      landingLiftWaterTensionKg:
        Number(lastDebug?.landingLiftWaterTensionKg) || 0,
      landingLiftProgressRatio:
        Number(lastDebug?.landingLiftProgressRatio) || 0,
      landingLiftTackleLoadProgressRatio:
        Number(lastDebug?.landingLiftTackleLoadProgressRatio) || 0,
      landingLiftSlowdownRatio:
        Number(lastDebug?.landingLiftSlowdownRatio) || 0,
      landingLiftSpeedRatio:
        Number(lastDebug?.landingLiftSpeedRatio) || 0,
      landingLiftGainKgPerSecond:
        Number(lastDebug?.landingLiftGainKgPerSecond) || 0,
      lineStressRatio: Number(lastDebug?.lineStressRatio) || 0,
      rodStressRatio: Number(lastDebug?.rodStressRatio) || 0,
    },
  };

  console.log("[CatchDebugScenario] summary");
  console.table(summary.final);
  console.log(JSON.stringify(summary, null, 2));
  assert(summary.transition !== "failed" || summary.transitionReason !== "rod", "noRodBreak should prevent rod failure");
  assert(summary.dragRatioAtEnd >= 0.999, "drag did not reach max before hold");
  assert(
    Math.abs(summary.peak.totalTensionKg - expected.expectedScenarioMaxTargetTensionKg) < 0.001,
    "peak total tension differs from expected movable/landing max",
  );
  assert(
    summary.final.shoreLandingDistanceMeters <= 1.001,
    "pump/recover scenario should bring fish into shore landing range",
  );
  assert(
    summary.transition === "victory",
    "0.05 kg fish must complete the landing transition",
  );
}

runScenario();
`, context, {
  filename: "utils/diagnostics/catch-resolution-debug.js#scenario",
});
