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
  "src/core/fishing/player_pressure/player_pressure_gain_resolver.js",
  "src/core/fishing/player_pressure/player_tension_build_rate_resolver.js",
  "src/core/fishing/player_pressure/player_pressure_fatigue_source_resolver.js",
  "src/core/fishing/player_pressure/player_pressure_fatigue_state.js",
  "src/core/fishing/player_pressure/player_pressure_fatigue_calculator.js",
  "src/core/fishing/stamina/active_endurance_drain_calculator.js",
  "src/core/fishing/stamina/passive_endurance_drain_calculator.js",
  "src/core/fishing/stamina/stamina_lateral_position_resolver.js",
  "src/core/fishing/stamina/stamina_pressure_resolver.js",
  "src/core/fishing/stamina/stamina_drain_calculator.js",
  "src/core/fishing/stamina/stamina_regen_calculator.js",
  "src/core/fishing/stamina/stamina_transition_resolver.js",
  "src/core/fishing/stamina/stamina_phase_machine.js",
  "src/core/fishing/stamina/stamina_balance_frame.js",
  "src/core/fishing/endurance/endurance_movement_debuff_calculator.js",
  "src/core/fishing/reel_auto_recovery_calculator.js",
  "src/core/fishing/reel_hold_recovery_system.js",
  "src/core/fishing/reel_recovery_fish_slowdown_policy.js",
  "src/core/fishing/rod_pull_calculator.js",
  "src/core/fishing/fish_retrieve_result.js",
  "src/core/fishing/recoverable_line_calculator.js",
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
  "src/services/weakest_tackle_limit_resolver.js",
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
    line: hydrate("lines", "line_test_1", {
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

function runSimplifiedStaminaChecks() {
  const mechanics = clone(CONFIG.stamina.mechanics);
  const machine = new StaminaPhaseMachine();

  const centerHold = machine.createFrame({
    phase: "stamina",
    currentStamina: 100,
    maxStamina: 100,
    rodHoldKg: 0.5,
    controlKg: 0,
    fishStaminaResistanceKg: 0.5,
    fishLateralContext: { fishLateralOffsetPx: 0, maxAllowedLateralOffsetPx: 100 },
    dtSec: 1,
    config: mechanics,
  });
  assert(centerHold.staminaModelMode === "simplified", "simplified stamina model is active");
  assert(centerHold.staminaMode === "drain", "simplified stamina drains under effective pressure");
  assert(centerHold.staminaDrain > 0 && centerHold.staminaRegen === 0, "stamina frame never drains and regens simultaneously");
  assertApprox(centerHold.holdDrainMultiplier, 1, 0.000001, "center fish gives full hold stamina multiplier");
  assertApprox(centerHold.controlDrainMultiplier, 0.1, 0.000001, "center fish gives low control stamina multiplier");

  const edgeControl = machine.createFrame({
    phase: "stamina",
    currentStamina: 100,
    maxStamina: 100,
    rodHoldKg: 0,
    controlKg: 0.5,
    controlDirectionX: -1,
    fishStaminaResistanceKg: 0.5,
    fishLateralContext: { fishLateralOffsetPx: 100, maxAllowedLateralOffsetPx: 100 },
    dtSec: 1,
    config: mechanics,
  });
  assertApprox(edgeControl.holdDrainMultiplier, 0.1, 0.000001, "edge fish gives low hold stamina multiplier");
  assertApprox(edgeControl.controlDrainMultiplier, 1, 0.000001, "edge fish gives full control stamina multiplier");
  assert(edgeControl.controlDirectionState === "centering", "control toward center is marked centering");

  const wrongControl = machine.createFrame({
    phase: "stamina",
    currentStamina: 100,
    maxStamina: 100,
    controlKg: 0.5,
    controlDirectionX: 1,
    fishStaminaResistanceKg: 0.5,
    fishLateralContext: { fishLateralOffsetPx: 100, maxAllowedLateralOffsetPx: 100 },
    dtSec: 1,
    config: mechanics,
  });
  assert(wrongControl.controlDirectionState === "wrong", "control away from center is marked wrong");
  assert(wrongControl.controlStaminaPressureKg < edgeControl.controlStaminaPressureKg, "wrong control has lower stamina pressure than centering control");

  const noPressureStamina = machine.createFrame({
    phase: "stamina",
    currentStamina: 50,
    maxStamina: 100,
    fishStaminaResistanceKg: 0.5,
    dtSec: 1,
    config: mechanics,
  });
  assert(noPressureStamina.staminaMode === "regen", "phase 1 release pressure immediately regens stamina");

  const releaseInExhaustion = machine.createFrame({
    phase: "exhaustion",
    currentStamina: 0,
    maxStamina: 100,
    fishStaminaResistanceKg: 0.5,
    playerFatigueProgress: 0,
    dtSec: 1,
    config: mechanics,
  });
  assert(releaseInExhaustion.staminaMode === "idle", "phase 2 release pressure does not regen stamina");
  assert(releaseInExhaustion.nextPhase === "exhaustion", "phase 2 release pressure does not return to stamina");
  assert(releaseInExhaustion.staminaNoInputElapsedMs < releaseInExhaustion.staminaNoInputTimeoutMs, "phase 2 no input below timeout does not recover");

  const inactivityMachine = new StaminaPhaseMachine();
  let inactivityFrame = null;
  for (let i = 0; i < 5; i += 1) {
    inactivityFrame = inactivityMachine.createFrame({
      phase: "exhaustion",
      currentStamina: 0,
      maxStamina: 100,
      rawStaminaInputActive: false,
      fishStaminaResistanceKg: 0.5,
      playerFatigueProgress: 0,
      dtSec: 1,
      config: mechanics,
    });
  }
  assert(inactivityFrame.staminaNoInputRecoveryReady === true, "phase 2 no input timeout becomes recovery-ready");
  assert(inactivityFrame.staminaRecoveryTrigger === "no_input_timeout", "phase 2 no input timeout is recovery trigger");
  assert(inactivityFrame.staminaMode === "regen", "phase 2 no input timeout starts stamina recovery");

  const activeInputFrame = inactivityMachine.createFrame({
    phase: "exhaustion",
    currentStamina: 0,
    maxStamina: 100,
    rawStaminaInputActive: true,
    controlExhausted: true,
    controlKg: 0.5,
    fishStaminaResistanceKg: 0.5,
    playerFatigueProgress: 0,
    dtSec: 1,
    config: mechanics,
  });
  assert(activeInputFrame.staminaNoInputElapsedMs === 0, "raw input active resets no-input timer");
  assert(activeInputFrame.staminaRecoveryTrigger === "control_exhausted", "control exhausted holding input is not inactivity trigger");

  const fatigueRecovery = machine.createFrame({
    phase: "exhaustion",
    currentStamina: 0,
    maxStamina: 100,
    fishStaminaResistanceKg: 0.5,
    playerFatigueProgress: 1,
    dtSec: 1,
    config: mechanics,
  });
  assert(fatigueRecovery.staminaMode === "regen", "phase 2 full fatigue starts stamina recovery");
  assert(fatigueRecovery.nextPhase === "stamina", "phase 2 returns only after stamina recovers past threshold");
}

runSimplifiedStaminaChecks();

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

function runTouchHoldControlBuildCheck() {
  const config = createConfig();
  const composer = new FightInputActionComposer();
  const earlyTouch = composer.compose(
    {
      pointerDown: true,
      pointerHoldActive: false,
      pointerDelta: { x: 120, y: 0 },
      keys: {},
    },
    {
      keys: config.input.keys,
      rodControlInput: config.physics.fight.rodControl.input,
    },
  );
  assert(earlyTouch.hold.active === false, "raw touch before hold threshold does not start Rod Hold");
  assert(earlyTouch.lateralControl.active === true, "raw touch can start Rod Control before hold threshold");

  const composed = composer.compose(
    {
      pointerDown: true,
      pointerHoldActive: true,
      pointerDelta: { x: 120, y: 0 },
      keys: {},
    },
    {
      keys: config.input.keys,
      rodControlInput: config.physics.fight.rodControl.input,
    },
  );
  assert(composed.hold.active === true, "touch lateral control keeps pointer Rod Hold active");
  assert(composed.lateralControl.active === true, "touch lateral control activates Rod Control");

  const equipment = createTestBuild({
    rodMaxLoadKg: 3,
    reelMaxLoadKg: 3,
    lineMaxLoadKg: 3,
    hookMaxLoadKg: 3,
  });
  const fishData = createFish({
    weightKg: 0.25,
    basePower: 0.5,
    baseSpeed: 0.1,
    forceMultiplier: 0.5,
    speedMultiplier: 0.1,
  });
  const rng = createRng();
  const cast = createCast({ config, equipment, distanceMeters: 2.0 });
  const fight = new FightService({
    config,
    rng,
    devFlags: createDevFlags(),
  });
  fight.startFight(fishData, equipment);
  fight.updateFight(1000 / 30, {
    floatEntity: cast.floatEntity,
    bounds: cast.bounds,
    input: {
      pointerDown: true,
      pointerHoldActive: true,
      pointerDelta: { x: 120, y: 0 },
      keys: {},
      retrieve: false,
      dragIncrease: true,
      pullDirection: { x: 0, y: 1 },
    },
    env: {},
    net: null,
    fishData,
    getRodVirtualPos: () => cast.rodVirtualPos,
    checkWater: () => true,
  });
  const debug = fight.getDebugData({
    floatEntity: cast.floatEntity,
    boundaries: cast.bounds,
    rodPos: cast.rodVirtualPos,
    screenOffset: 0,
    equipment,
  });

  assert(debug.playerForceBudgetReason === "hold_and_control", "touch hold + control resolves shared force-budget mode");
  assert(debug.tensionBuildMode === "hold_and_control", "touch hold + control resolves tensionBuildMode");
  assertApprox(debug.tensionBuildRateMultiplier, 1.5, 0.000001, "hold + control uses x1.5 TENSION build rate");
  assert(debug.tensionBuildHoldActive === true, "tension build sees active hold channel");
  assert(debug.tensionBuildControlActive === true, "tension build sees active control channel");
  assert(debug.rodHoldEffectiveChargePerSecond > debug.rodHoldBaseChargePerSecond, "hold + control speeds up Rod Hold charge");
  assert(debug.rodControlEffectiveBuildPerSecond > debug.rodControlBaseBuildPerSecond, "hold + control speeds up Rod Control build");
  assertApprox(debug.playerForceCombinedCeilingMultiplier, 1, 0.000001, "build rate does not increase tension ceiling multiplier");
  assert(debug.totalTensionKg <= debug.playerForceCombinedTensionCeilingKg + 0.000001, "build rate does not bypass final tension ceiling");
}

runTouchHoldControlBuildCheck();

function runRodPullConfigSourceCheck() {
  const legacyOnly = new RodPullCalculator({
    enabled: true,
    distanceMultiplierByRodLength: 10,
    strokeChargePerSecond: 100,
    chargePerSecond: 100,
    minStrokeMeters: 0.001,
  });
  assertApprox(
    legacyOnly.calculateMaxDistance({ rodLengthMeters: 2 }),
    1,
    0.000001,
    "legacy distanceMultiplierByRodLength no longer controls rod stroke capacity",
  );
  const legacyChargeFrame = legacyOnly.calculateNextState({
    dtSec: 0.1,
    input: { pullHeld: true },
    previousState: {},
    rodLengthMeters: 2,
    maxTackleLoadKg: 5,
    rodLimitKg: 5,
    fishTensionKg: 0,
    dragLimitKg: 5,
    dragLocked: true,
    hardLineLimit: false,
    lineHasReserve: true,
    fishDistanceMeters: 5,
  });
  assertApprox(
    legacyChargeFrame.ratio,
    0.1 / 0.35,
    0.000001,
    "legacy strokeChargePerSecond and chargePerSecond no longer control rod hold charge",
  );

  const currentConfig = new RodPullCalculator({
    enabled: true,
    capacityByRodLengthRatio: 0.25,
    chargeTimeSeconds: 1,
    minStrokeMeters: 0.001,
  });
  assertApprox(
    currentConfig.calculateMaxDistance({ rodLengthMeters: 2 }),
    0.5,
    0.000001,
    "rodStroke.capacityByRodLengthRatio controls rod stroke capacity",
  );
  const currentChargeFrame = currentConfig.calculateNextState({
    dtSec: 0.25,
    input: { pullHeld: true },
    previousState: {},
    rodLengthMeters: 2,
    maxTackleLoadKg: 5,
    rodLimitKg: 5,
    fishTensionKg: 0,
    dragLimitKg: 5,
    dragLocked: true,
    hardLineLimit: false,
    lineHasReserve: true,
    fishDistanceMeters: 5,
  });
  assertApprox(
    currentChargeFrame.ratio,
    0.25,
    0.000001,
    "rodHold.chargeTimeSeconds controls rod hold charge",
  );

  const adapterConfig = createConfig();
  adapterConfig.physics.fight.rodHold.distanceMultiplierByRodLength = 10;
  const rodPullConfig = adapterConfig.fightPhysicsConfig.getRodPullConfig();
  assertApprox(
    rodPullConfig.capacityByRodLengthRatio,
    adapterConfig.physics.fight.rodStroke.capacityByRodLengthRatio,
    0.000001,
    "rod pull adapter sources capacity from physics.fight.rodStroke only",
  );
  assert(
    !Object.prototype.hasOwnProperty.call(rodPullConfig, "distanceMultiplierByRodLength"),
    "rod pull adapter no longer exports distanceMultiplierByRodLength",
  );
  assert(
    !Object.prototype.hasOwnProperty.call(rodPullConfig, "strokeChargePerSecond"),
    "rod pull adapter no longer exports strokeChargePerSecond",
  );
}

runRodPullConfigSourceCheck();

function runRodStrokeDistanceSourceCheck() {
  const system = new RodPullSystem({
    enabled: true,
    capacityByRodLengthRatio: 1,
    chargeTimeSeconds: 1,
    minStrokeMeters: 0.001,
    tensionCeilingMultiplier: 1,
  });
  const rod = {
    lengthMeters: 1,
    getEffectiveMaxLoadKg: () => 5,
    getHoldTensionRatio: () => 1,
  };
  const common = {
    dtSec: 1 / 60,
    inputState: { pullHeld: true },
    rod,
    fishForceKg: 0,
    fishTensionKg: 0,
    rodLimitKg: 5,
    playerForceBudget: null,
    dragLimitKg: 5,
    maxTackleLoadKg: 5,
    dragLocked: true,
    hardLineLimit: false,
    lineHasReserve: true,
    fishDistanceMeters: 5,
  };

  system.update({
    ...common,
    distanceLostBeforePullMeters: 0,
  });
  system.recordDistanceMovement({
    gainedMeters: 0.8,
    reason: "test_seed_distance",
  });
  assertApprox(system.getState().rodStrokeWonMeters, 0.8, 0.000001, "rod stroke test seeds won distance");

  const legacyYFrame = system.update({
    ...common,
    distanceLostBeforePullMeters: 0,
    yLostBeforePullMeters: 0.5,
  });
  assertApprox(legacyYFrame.rodStrokeWonMeters, 0.8, 0.000001, "legacy Y loss no longer reduces rod stroke");
  assertApprox(legacyYFrame.strokeDistanceLostMeters, 0, 0.000001, "legacy Y loss is ignored by distance-based stroke loss");

  const distanceFrame = system.update({
    ...common,
    distanceLostBeforePullMeters: 0.3,
    yLostBeforePullMeters: 0,
  });
  assertApprox(distanceFrame.rodStrokeWonMeters, 0.5, 0.000001, "distance loss remains the rod stroke loss source");
  assertApprox(distanceFrame.strokeDistanceLostMeters, 0.3, 0.000001, "distance loss diagnostics still report stroke loss");
}

runRodStrokeDistanceSourceCheck();

function runReelHoldStrokeGateCheck() {
  const system = new ReelHoldRecoverySystem();
  const common = {
    dtMs: 16.666,
    config: {
      enabled: true,
      requireRodStrokeFull: true,
      delayMs: 0,
      strokeRatio: 1,
      strokeToleranceMeters: 0.001,
    },
    hasReel: true,
    playerHoldActive: true,
    rodPullActive: true,
    rawTensionKg: 0.2,
    dragLimitKg: 3,
    dragLocked: false,
    shouldSlipDrag: false,
    reelMaxLoadKg: 3,
    retrieveSpeedMetersPerSecond: 1.2,
    lineRecoverableMeters: 0.5,
  };

  const earlyFrame = system.update({
    ...common,
    strokeRatio: 0.73,
    strokeCapacityMeters: 1,
    strokeUnrecoveredMeters: 0.73,
    rodPullBlockedReason: "max_distance_reached",
  });
  assert(earlyFrame.active === false, "reel hold ignores max_distance_reached until rod stroke is full");
  assert(earlyFrame.blockedReason === "stroke_not_full", "reel hold reports stroke_not_full below required rod stroke ratio");

  const fullMetersFrame = system.update({
    ...common,
    strokeRatio: 0.99,
    strokeCapacityMeters: 1,
    strokeUnrecoveredMeters: 1,
  });
  assert(fullMetersFrame.active === false, "reel hold ignores full stroke meters when rod stroke ratio is below required ratio");
  assert(fullMetersFrame.blockedReason === "stroke_not_full", "reel hold full-stroke gate uses rod stroke ratio as source of truth");

  const toleranceFrame = system.update({
    ...common,
    strokeRatio: 0.9995,
  });
  assert(toleranceFrame.active === true, "reel hold allows tiny stroke ratio tolerance for float precision");
  assertApprox(toleranceFrame.strokeRatioTolerance, 0.001, 0.000001, "reel hold diagnostics expose stroke ratio tolerance");
  assertApprox(toleranceFrame.inputStrokeRatio, 0.9995, 0.000001, "reel hold diagnostics expose input stroke ratio");

  const fullFrame = system.update({
    ...common,
    strokeRatio: 1,
    strokeCapacityMeters: 1,
    strokeUnrecoveredMeters: 1,
  });
  assert(fullFrame.active === true, "reel hold can activate after full rod stroke");
  assert(fullFrame.enabled === true, "reel hold diagnostics expose config gate");
  assert(fullFrame.hasReel === true, "reel hold diagnostics expose reel gate");
  assert(fullFrame.playerHoldActive === true, "reel hold diagnostics expose player hold gate");
  assertApprox(fullFrame.requiredStrokeRatio, 1, 0.000001, "reel hold diagnostics expose required stroke ratio");
  assert(fullFrame.strokeFull === true, "reel hold diagnostics expose stroke gate");
  assert(fullFrame.tensionBelowDragLimit === true, "reel hold diagnostics expose drag limit gate");
  assert(fullFrame.tensionBelowMaxLoad === true, "reel hold diagnostics expose reel max load gate");
  assert(fullFrame.dragCanHold === true, "reel hold diagnostics expose combined drag hold gate");
  assertApprox(fullFrame.retrieveSpeedMetersPerSecond, 1.2, 0.000001, "reel hold diagnostics expose retrieve speed");

  const noLineFrame = system.update({
    ...common,
    strokeRatio: 1,
    lineRecoverableMeters: 0,
  });
  assert(noLineFrame.active === true, "reel hold remains engaged without recoverable line");
  assert(noLineFrame.engaged === true, "reel hold engagement is separate from line recovery");
  assert(noLineFrame.recoveringLine === false, "reel hold does not recover line when no line credit exists");
  assert(noLineFrame.blockedReason === "ready", "missing recoverable line does not block reel hold engagement");
  assert(noLineFrame.lineRecoveryBlockedReason === "no_recoverable_line", "missing recoverable line is reported as line recovery block only");
}

runReelHoldStrokeGateCheck();

function runReelHoldConfigSourceCheck() {
  const config = createConfig();
  config.physics.fight.reelHold = {
    enabled: true,
    requireRodStrokeFull: true,
    delayMs: 0,
    strokeRatio: 1,
    strokeToleranceMeters: 0.001,
  };
  config.physics.tackle.reel.holdRecoverAfterFullStrokeMs = false;
  config.physics.tackle.reel.holdRecoverStrokeRatio = 0.25;
  config.physics.tackle.reel.holdRecoverStrokeToleranceMeters = 0.25;

  const reelHold = new FightPhysicsConfigAdapter(config).getReelHoldConfig();
  assert(reelHold.enabled === true, "reel hold enabled is sourced from physics.fight.reelHold");
  assertApprox(reelHold.delayMs, 0, 0.000001, "legacy tackle reel hold delay no longer overrides reel hold config");
  assertApprox(reelHold.strokeRatio, 1, 0.000001, "legacy tackle reel hold ratio no longer overrides reel hold config");
  assertApprox(reelHold.strokeRatioTolerance, 0.001, 0.000001, "reel hold ratio tolerance defaults to a small precision guard");
  assertApprox(reelHold.strokeToleranceMeters, 0.001, 0.000001, "legacy tackle reel hold tolerance no longer overrides reel hold config");
}

runReelHoldConfigSourceCheck();

function runRodStrokeRecoverySourceCheck() {
  const reelSystem = new ReelSystem({ autoRecoverLineCredit: true });
  const lineState = {
    releasedMeters: 2,
    distanceMeters: 1,
  };
  const lineSystem = {
    getState: () => lineState,
    recoverReleasedLine: () => {
      throw new Error("rod stroke recovery must not recover line without strokeWonMeters");
    },
  };
  const reel = {
    hasReel: () => true,
    getEffectiveMaxLoadKg: () => 5,
    getRetrieveSpeedMetersPerSec: () => 1,
  };

  const noWonStroke = reelSystem.recoverRodStrokeCredit({
    dtSec: 1,
    lineSystem,
    reel,
    tensionKg: 0,
    playerHoldActive: false,
    strokeWonMeters: undefined,
    rodStrokeUnrecoveredMeters: 1,
    fishDistanceMeters: 1,
  });
  assert(noWonStroke.active === false, "rod stroke recovery does not use rodStrokeUnrecoveredMeters as fallback credit");
  assert(noWonStroke.blockedReason === "no_stroke_credit", "rod stroke recovery requires explicit rodStrokeWonMeters");

  const calculator = new ReelAutoRecoveryCalculator();
  const loadLimited = calculator.calculate({
    hasReel: true,
    playerHoldActive: false,
    strokeWonMeters: 2,
    totalTensionKg: 2,
    reelMaxLoadKg: 4,
    retrieveSpeedMetersPerSec: 1,
    releasedLineMeters: 4,
    fishDistanceMeters: 1,
    dtSec: 1,
  });
  assertApprox(loadLimited.recoverSpeedMetersPerSec, 1, 0.000001, "auto recovery speed is not reduced by tension below reel load");
  assertApprox(loadLimited.recoveredMeters, 1, 0.000001, "auto recovery recovers at reel retrieve speed when load gate passes");

  const desyncedLine = calculator.calculate({
    hasReel: true,
    playerHoldActive: false,
    strokeWonMeters: 1,
    totalTensionKg: 0,
    reelMaxLoadKg: 4,
    retrieveSpeedMetersPerSec: 1,
    releasedLineMeters: 1,
    fishDistanceMeters: 1,
    dtSec: 1,
  });
  assert(desyncedLine.active === false, "auto recovery does not recover line when line system has no recoverable meters");
  assert(desyncedLine.blockedReason === "stroke_line_desync", "rod stroke credit without recoverable line is reported as stroke_line_desync");
}

runRodStrokeRecoverySourceCheck();

function runReelHoldPostStrokeOrderCheck() {
  const config = createConfig();
  const equipment = createTestBuild({
    rodMaxLoadKg: 20,
    reelMaxLoadKg: 20,
    lineMaxLoadKg: 20,
    hookMaxLoadKg: 20,
  });
  const fishData = createFish({
    weightKg: 0.25,
    basePower: 0.5,
    baseSpeed: 0.8,
    forceMultiplier: 0.5,
    speedMultiplier: 0.8,
  });
  const cast = createCast({ config, equipment, distanceMeters: 5.8 });
  const fight = new FightService({
    config,
    rng: createRng(),
    devFlags: createDevFlags(),
  });
  fight.startFight(fishData, equipment);

  let fullStrokeDebug = null;
  let movingReelHoldDebug = null;
  for (let frame = 0; frame < 160; frame++) {
    const result = fight.updateFight(1000 / 30, {
      floatEntity: cast.floatEntity,
      bounds: cast.bounds,
      input: {
        isPulling: true,
        retrieve: false,
        pointerDown: false,
        dragIncrease: true,
        pullDirection: { x: 0, y: 1 },
      },
      env: {},
      net: null,
      fishData,
      getRodVirtualPos: () => cast.rodVirtualPos,
      checkWater: () => true,
    });
    const debug = fight.getDebugData({
      floatEntity: cast.floatEntity,
      boundaries: cast.bounds,
      rodPos: cast.rodVirtualPos,
      screenOffset: 0,
      equipment,
    });
    if (
      Number(debug.finalRodStrokeRatio ?? debug.rodStrokeRatio) >= 0.999 &&
      debug.reelHoldPlayerHoldActive === true &&
      debug.rodPullActive === true
    ) {
      fullStrokeDebug ||= debug;
    }
    if (Number(debug.reelHoldMoveMeters) > 0.000001) {
      movingReelHoldDebug = debug;
      break;
    }
    if (result.transition) break;
  }

  assert(fullStrokeDebug, "post-stroke reel hold check reaches full rod stroke");
  assert(
    fullStrokeDebug.holdReelRecoverBlockedReason !== "stroke_not_full",
    "reel hold uses post-stroke rod state after rodHold movement is recorded",
  );
  assert(
    Number(fullStrokeDebug.holdReelRecoverInputStrokeRatio) >=
      Number(fullStrokeDebug.reelHoldRequiredStrokeRatio) -
        Number(fullStrokeDebug.holdReelRecoverStrokeRatioTolerance),
    "reel hold input stroke ratio is the post-record stroke ratio",
  );
  assert(movingReelHoldDebug, "reel hold movement debug captures a moving reel hold frame");
  assert(
    Number(movingReelHoldDebug.reelHoldAppliedDtSec) > 0,
    "reel hold applied speed uses real frame dt",
  );
  assertApprox(
    movingReelHoldDebug.reelHoldAppliedSpeedMps,
    Number(movingReelHoldDebug.reelHoldMoveMeters) /
      Number(movingReelHoldDebug.reelHoldAppliedDtSec),
    0.000001,
    "reel hold applied speed matches reel hold move divided by frame dt",
  );
}

runReelHoldPostStrokeOrderCheck();

function runFightScenario({
  name,
  equipment,
  fishData,
  startDistanceMeters,
  frames = 240,
  checkWater = () => true,
  closeDrag = false,
  requireHold = true,
  requirePlayerTension = true,
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
  let transitionFrame = null;

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
      transitionFrame = frame;
      break;
    }
  }

  if (requireHold) {
    assert(sawHold, name + ": rod hold produces force");
  }
  if (requirePlayerTension) {
    assert(sawPlayerTension, name + ": hold contributes player tension");
  }
  assert(
    sawFishTension || peakTotalTension > 0,
    name + ": fight produces blocked-force or player-hold tension",
  );

  return {
    name,
    transition,
    peakLineStress,
    peakTotalTension,
    sawMovement,
    sawBlockedMovement,
    lastDebug,
    transitionFrame,
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

const lightLanding = runFightScenario({
  name: "light_landing_lift",
  equipment: createTestBuild({
    rodMaxLoadKg: 1,
    reelMaxLoadKg: 1,
    lineMaxLoadKg: 1,
    hookMaxLoadKg: 1,
  }),
  fishData: createFish({
    weightKg: 0.1,
    basePower: 0.5,
    baseSpeed: 0,
    forceMultiplier: 0,
    speedMultiplier: 0,
  }),
  startDistanceMeters: 0.8,
  frames: 240,
  closeDrag: true,
  requirePlayerTension: false,
});
const heavyLanding = runFightScenario({
  name: "heavy_landing_lift",
  equipment: createTestBuild({
    rodMaxLoadKg: 1,
    reelMaxLoadKg: 1,
    lineMaxLoadKg: 1,
    hookMaxLoadKg: 1,
  }),
  fishData: createFish({
    weightKg: 0.9,
    basePower: 0.5,
    baseSpeed: 0,
    forceMultiplier: 0,
    speedMultiplier: 0,
  }),
  startDistanceMeters: 0.8,
  frames: 240,
  closeDrag: true,
  requirePlayerTension: false,
});
assert(
  lightLanding.transition?.name === "victory",
  "light fish reaches victory through landing lift",
);
assert(
  heavyLanding.transition?.name === "victory",
  "near-limit fish can still reach victory through landing lift",
);
assert(
  lightLanding.transitionFrame < heavyLanding.transitionFrame,
  "near-limit fish takes longer to land than light fish",
);

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
    weightKg: 1,
    basePower: 3,
    baseSpeed: 0,
    forceMultiplier: 1.0,
    speedMultiplier: 0,
  }),
  startDistanceMeters: 5,
  frames: 90,
  checkWater: () => false,
  requireHold: false,
  requirePlayerTension: false,
});
assert(
  breakCase.peakTotalTension >= 0.8,
  "fish-pressure overload scenario exceeds line load"
    + " (peak="
    + Number(breakCase.peakTotalTension || 0).toFixed(4)
    + ", transition="
    + (breakCase.transition?.name || "none")
    + "/"
    + (breakCase.transition?.data?.reason || "no_reason")
    + ")",
);
assert(breakCase.transition?.name === "failed", "fish-pressure overload scenario fails");
assert(breakCase.transition?.data?.reason === "line", "fish-pressure overload scenario breaks the line");

console.log("game-cycle-check passed:");
console.log("- victory peak line stress: " + (victory.peakLineStress * 100).toFixed(1) + "%");
console.log("- victory peak total tension: " + victory.peakTotalTension.toFixed(3) + " kg");
console.log("- line break peak line stress: " + (breakCase.peakLineStress * 100).toFixed(1) + "%");
console.log("- line break reason: " + breakCase.transition.data.reason);
for (const message of checks) console.log("- " + message);
`, context, { filename: "utils/game-cycle-check.js#scenario" });
