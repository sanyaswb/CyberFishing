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
  "src/core/fishing/player_pressure/player_pressure_gain_resolver.js",
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
  window: { innerWidth: 1280, innerHeight: 720 },
});

for (const file of FILES) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), context, {
    filename: file,
  });
}

vm.runInContext(`
class FishRadialSpeedDeltaScenario {
  constructor({
    fishWeightKg = 0.8,
    dragRatio = 0,
    startDistanceMeters = 10,
    behaviorWarmupFrames = 360,
    frames = 90,
    dtMs = 1000 / 30,
  } = {}) {
    this.fishWeightKg = fishWeightKg;
    this.dragRatio = dragRatio;
    this.startDistanceMeters = startDistanceMeters;
    this.behaviorWarmupFrames = behaviorWarmupFrames;
    this.frames = frames;
    this.dtMs = dtMs;
  }
}

class DeterministicRng {
  next() {
    return 0.5;
  }

  range(min, max) {
    return min + (max - min) * this.next();
  }

  int(min, max) {
    return Math.floor(min + (max - min + 1) * this.next());
  }

  chance(probability) {
    return Number(probability) >= this.next();
  }
}

class FishRadialSpeedDeltaRuntimeFactory {
  createConfig() {
    const config = this.#clone(CONFIG);
    config.debug = config.debug || {};
    config.debug.godMode = {
      ...(config.debug.godMode || {}),
      enabled: false,
      noLineBreak: true,
      noRodBreak: true,
      noFishStaminaLoss: false,
      noEquipmentLoss: false,
    };
    config.fightPhysicsConfig = new FightPhysicsConfigAdapter(config);
    return config;
  }

  createEquipment() {
    return {
      rod: this.#hydrate("rods", "rod_test_feeder"),
      reel: this.#hydrate("reels", "reel_test"),
      line: this.#hydrate("lines", "line_test_1"),
      sinker: this.#hydrate("baits", "feeder_spring_basic"),
      hooks: [this.#hydrate("hooks", "hook_basic")],
      baits: [this.#hydrate("baits", "bread")],
    };
  }

  createFish(weightKg) {
    const fish = this.#clone(
      FISH_DB.find((candidate) => candidate.id === "crucian_stalker") ||
        FISH_DB[0],
    );
    fish.level = 1;
    fish.weight = weightKg;
    fish.maxLevel = fish.weightConfig?.maxLevel || 6;
    fish.levelAverageWeightKg = weightKg;
    this.#normalizeFishPhysicsForStableSpeed(fish);
    return fish;
  }

  #normalizeFishPhysicsForStableSpeed(fish) {
    fish.physics = fish.physics || {};
    fish.physics.movementProfile = fish.physics.movementProfile || {};
    fish.physics.behaviorProfile = fish.physics.behaviorProfile || {};
    fish.physics.behaviorProfile.behaviors =
      fish.physics.behaviorProfile.behaviors || {};

    fish.physics.movementProfile.dirChangeMinMs = 100000;
    fish.physics.movementProfile.dirChangeMaxMs = 100000;
    fish.physics.movementProfile.lastDashTrigger = {
      ...(fish.physics.movementProfile.lastDashTrigger || {}),
      enabled: false,
    };

    for (const behavior of Object.values(fish.physics.behaviorProfile.behaviors)) {
      behavior.forceMultiplier = 1.0;
      behavior.speedMultiplier = 1.0;
      behavior.minTime = 100000;
      behavior.maxTime = 100000;
      behavior.weight = 1;
      behavior.dirChangeMinMs = 100000;
      behavior.dirChangeMaxMs = 100000;
      if (behavior.enabled !== undefined) behavior.enabled = false;
    }

    const swim = fish.physics.behaviorProfile.behaviors.swim;
    if (swim) {
      swim.weight = 100;
      swim.enabled = true;
    }
  }

  createCast({ config, equipment, distanceMeters }) {
    const rodVirtualPos = { x: 500, y: 700 };
    const bounds = { left: 0, right: 1000, top: -900, bottom: 800 };
    const castService = new CastService({
      config,
      rng: new DeterministicRng(),
      clock: { now: 1000 },
      equipmentRules: new EquipmentRules(new CastDistanceCalculator(config)),
      baitRules: new BaitRules(),
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
    if (!result.success || !result.floatEntity) {
      throw new Error("Fish speed delta scenario failed to cast test feeder build.");
    }
    result.floatEntity.hook?.();
    result.floatEntity.setVelocity?.(0, 0);
    return { ...result, rodVirtualPos, bounds };
  }

  #hydrate(group, id, overrides = {}) {
    const source = ITEM_DB[group]?.[id];
    if (!source) throw new Error("Missing item " + group + "." + id);
    return {
      ...this.#clone(source),
      ...(source.engineStats ? this.#clone(source.engineStats) : {}),
      ...overrides,
      id: source.id,
      itemId: source.id,
      instanceId: overrides.instanceId || "speed_delta_" + id,
    };
  }

  #clone(value) {
    return JSON.parse(JSON.stringify(value));
  }
}

class FishRadialSpeedDeltaProbe {
  constructor(scenario) {
    this.scenario = scenario;
    this.factory = new FishRadialSpeedDeltaRuntimeFactory();
  }

  run() {
    const config = this.factory.createConfig();
    const equipment = this.factory.createEquipment();
    const fishData = this.factory.createFish(this.scenario.fishWeightKg);
    const cast = this.factory.createCast({
      config,
      equipment,
      distanceMeters: this.scenario.startDistanceMeters,
    });
    const fight = new FightService({
      config,
      rng: new DeterministicRng(),
      devFlags: { isEnabled: (name) => name === "noLineBreak" || name === "noRodBreak" },
    });
    fight.startFight(fishData, equipment);

    const samples = [];
    const sampleFrames = new Set([1, 2, 3, 5, 10, 15, 30, 60, 90]);
    const dtSec = this.scenario.dtMs / 1000;
    const checkWater = () => ({ depth: 8 });
    const initialPosition = this.#copyPosition(cast.floatEntity.getPosition());

    this.#warmupBehavior({
      fight,
      cast,
      fishData,
      equipment,
      checkWater,
    });
    cast.floatEntity.setPosition?.(initialPosition.x, initialPosition.y);
    cast.floatEntity.setVelocity?.(0, 0);

    for (let frame = 1; frame <= this.scenario.frames; frame++) {
      const before = this.#copyPosition(cast.floatEntity.getPosition());
      fight.updateFight(this.scenario.dtMs, {
        floatEntity: cast.floatEntity,
        bounds: cast.bounds,
        input: {
          isPulling: false,
          retrieve: false,
          pointerDown: false,
          dragControlActive: false,
        },
        env: {},
        checkWater,
        getRodVirtualPos: () => cast.rodVirtualPos,
        fishData,
        net: null,
      });
      const after = this.#copyPosition(cast.floatEntity.getPosition());
      const velocity = cast.floatEntity.getVelocity?.() || { x: 0, y: 0 };
      const debug = fight.getDebugData({
        floatEntity: cast.floatEntity,
        boundaries: cast.bounds,
        rodPos: cast.rodVirtualPos,
        screenOffset: 0,
        equipment,
      });

      if (sampleFrames.has(frame) || frame === this.scenario.frames) {
        samples.push(this.#createSample({
          frame,
          before,
          after,
          floatEntity: cast.floatEntity,
          velocity,
          debug,
          fishData,
          config,
          dtSec,
        }));
      }
    }

    const last = samples[samples.length - 1];
    const summary = this.#createSummary({ scenario: this.scenario, config, fishData, last });
    console.log("[FishRadialSpeedDelta] assumptions");
    console.log(summary.assumptions);
    console.log("[FishRadialSpeedDelta] speed and factor samples");
    console.table(samples);
    console.log("[FishRadialSpeedDelta] final comparison");
    console.log(summary.comparison);
    console.log("[FishRadialSpeedDelta] interpretation");
    console.log(summary.interpretation);
    this.#assertAuthoritativeFightMovement(summary);
  }

  #warmupBehavior({ fight, cast, fishData, checkWater }) {
    for (let frame = 0; frame < this.scenario.behaviorWarmupFrames; frame++) {
      fight.updateFight(this.scenario.dtMs, {
        floatEntity: cast.floatEntity,
        bounds: cast.bounds,
        input: {
          isPulling: false,
          retrieve: false,
          pointerDown: false,
          dragControlActive: false,
        },
        env: {},
        checkWater,
        getRodVirtualPos: () => cast.rodVirtualPos,
        fishData,
        net: null,
      });
    }
  }

  #createSample({ frame, before, after, floatEntity, velocity, debug, fishData, config, dtSec }) {
    const dx = after.x - before.x;
    const dy = after.y - before.y;
    const actualPxPerSec = Math.hypot(dx, dy) / Math.max(0.000001, dtSec);
    const modelPxPerSec = Number(
      debug.simpleFightSpeedPxPerSec ?? debug.fishSpeedPxPerSec,
    ) || 0;
    const overlayFishPxPerSec = Number(debug.fishSpeedPxPerSec) || 0;
    const velocityPxPerSec = Math.hypot(
      Number(velocity.x) || 0,
      Number(velocity.y) || 0,
    );
    const stateConfig =
      fishData.physics?.behaviorProfile?.behaviors?.[debug.fishState] || {};
    const movementProfile = fishData.physics?.movementProfile || {};
    const agility = Number(stateConfig.agility ?? movementProfile.agility ?? 1);
    const approach =
      1 - Math.exp(-Math.max(0.1, Math.max(0, agility) * 3) * dtSec);
    const currentDamping =
      typeof floatEntity?._getVelocityDamping === "function"
        ? floatEntity._getVelocityDamping(dtSec)
        : this.#calculateVelocityDamping({
            velocityDamping: floatEntity?._velocityDamping ?? 0.85,
            dtSec,
          });
    const fightMovementDampingApplied = !!debug.fightMovementDampingApplied;
    const ratio = actualPxPerSec > 0 ? modelPxPerSec / actualPxPerSec : 0;

    return {
      frame,
      state: debug.fishState,
      actualPxPerSec: this.#round(actualPxPerSec, 3),
      overlayModelPxPerSec: this.#round(modelPxPerSec, 3),
      overlayFishPxPerSec: this.#round(overlayFishPxPerSec, 3),
      modelToActualRatio: this.#round(ratio, 2),
      velocityPxPerSec: this.#round(velocityPxPerSec, 3),
      dx: this.#round(dx, 3),
      dy: this.#round(dy, 3),
      fishWeightKg: this.#round(debug.fishWeightKg, 3),
      fishBasePower: this.#round(debug.fishBasePower, 3),
      fishBaseSpeed: this.#round(debug.fishBaseSpeed, 3),
      stateForceMultiplier: this.#round(debug.pullMult, 3),
      stateSpeedMultiplier: this.#round(debug.moveMult, 3),
      direction: debug.fishDirectionState,
      directionMultiplier: this.#round(debug.directionResistanceMultiplier, 3),
      passiveKg: this.#round(debug.fishPassiveKg, 4),
      activeKg: this.#round(debug.fishActiveKg, 4),
      oppositionKg: this.#round(debug.fishOppositionKg, 4),
      dragRatio: this.#round(debug.dragRatio, 3),
      fishWonRadialForceKg: this.#round(
        debug.fishWonRadialForceKg ?? debug.fishWonYForceKg,
        4,
      ),
      dragBlockedForceKg: this.#round(debug.dragBlockedForceKg, 4),
      radialEscapeForceKg: this.#round(
        debug.radialEscapeForceKg ?? debug.excessYForceKg,
        4,
      ),
      finalRadialSpeedPxPerSec: this.#round(
        debug.finalRadialSpeedPxPerSec,
        3,
      ),
      agility: this.#round(agility, 3),
      stateTransitionApproachPerFrame: this.#round(approach, 4),
      genericVelocityDampingPerFrame: this.#round(currentDamping, 4),
      fightMovementDampingApplied,
      fightMovementTargetPxPerSec: this.#round(debug.fightMovementTargetSpeedPxPerSec, 3),
      fightMovementActualPxPerSec: this.#round(debug.fightMovementActualSpeedPxPerSec, 3),
      lineReleasedThisFrameM: this.#round(debug.lineReleasedThisFrameMeters, 4),
      lineConstrained: !!debug.lineConstrained,
      lineDistanceM: this.#round(debug.lineDistanceMeters, 3),
    };
  }

  #createSummary({ scenario, config, fishData, last }) {
    const pixelsPerMeter = config.fightPhysicsConfig.getPixelsPerMeter?.() || 50;
    const water = config.fightPhysicsConfig.getWaterConfig?.() || {};
    return {
      assumptions: {
        fishId: fishData.id,
        fishWeightKg: scenario.fishWeightKg,
        dragRatio: scenario.dragRatio,
        input: "free movement: no rod hold, no reel retrieve",
        equipment: "rod_test_feeder + reel_test + line_test_1 + hook_basic + bread",
        startDistanceMeters: scenario.startDistanceMeters,
        behaviorWarmupFrames: scenario.behaviorWarmupFrames,
        pixelsPerMeter,
        waterMotionResistance: water.motionResistance,
        waterSpeedMultiplier: water.speedMultiplier,
        tautBodyResistancePerKg: water.tautBodyResistancePerKg,
        behaviorNormalization:
          "all behavior force/speed multipliers = 1.0; long state/dir timers; lastDash disabled",
      },
      comparison: {
        finalFrame: last.frame,
        actualPxPerSec: last.actualPxPerSec,
        overlayModelPxPerSec: last.overlayModelPxPerSec,
        overlayFishPxPerSec: last.overlayFishPxPerSec,
        modelToActualRatio: last.modelToActualRatio,
      },
      interpretation: [
        "overlayModelPxPerSec is the authoritative simplified fight model speed",
        "actualPxPerSec should match overlayModelPxPerSec when drag is 0 and line is unconstrained",
        "agility is still reported as state transition smoothing only; it must not damp stable fight movement",
        "generic WaterEntity damping is still reported for diagnostics but must not apply to hooked fight movement",
        "drag effect is reported in radial terms; Y fields are accepted only as compatibility aliases",
        "lineReleasedThisFrameM and lineConstrained show whether line release/constraint changed real movement",
      ],
    };
  }

  #assertAuthoritativeFightMovement(summary) {
    const comparison = summary.comparison;
    const actual = Number(comparison.actualPxPerSec) || 0;
    const model = Number(comparison.overlayModelPxPerSec) || 0;
    const ratio = model > 0 ? actual / model : 1;

    if (summary.assumptions.dragRatio !== 0) return;

    if (Math.abs(1 - ratio) > 0.03) {
      throw new Error(
        "Expected actual fish speed to match simplified model speed at drag 0. " +
          "actual=" + actual +
          ", model=" + model +
          ", ratio=" + ratio.toFixed(3),
      );
    }
  }

  #copyPosition(position) {
    return {
      x: Number(position?.x) || 0,
      y: Number(position?.y) || 0,
    };
  }

  #calculateVelocityDamping({ velocityDamping, dtSec }) {
    const dampingPerSecond =
      -Math.log(Math.max(0.001, Math.min(0.999, velocityDamping))) * 60;
    return Math.exp(-Math.max(0, dampingPerSecond) * Math.max(0, dtSec));
  }

  #round(value, digits = 3) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Number(number.toFixed(digits));
  }
}

new FishRadialSpeedDeltaProbe(new FishRadialSpeedDeltaScenario()).run();
`, context, {
  filename: "utils/diagnostics/fish-radial-speed-delta.js.vm",
});
