import { CastDistanceCalculator } from "../../domain/casting/cast_distance_calculator.js";
import { DragControlService } from "./drag_control_service.js";
import { FightPhysicsConfigAdapter } from "../../config/physics/fight_physics_config_adapter.js";
import { FightPhysicsOrchestrator } from "./fight_physics_orchestrator.js";
import { Fish } from "../../domain/fish/fish.js";
import { FishCondition } from "../../domain/fish/fish_condition.js";
import { FishForceSystem } from "../../domain/fishing/fish_force_system.js";
import { Hook } from "../../domain/tackle/hook.js";
import { Reel } from "../../domain/tackle/reel.js";
import { Rod } from "../../domain/tackle/rod.js";
import { LineSystem } from "../../domain/fishing/line_system.js";
import { PullInputMapper } from "../input/pull_input_mapper.js";
import { ReelService } from "./reel_service.js";
import { RodLateralControlSystem } from "../../domain/fishing/rod_lateral_control_system.js";
import { RodPullSystem } from "../../domain/fishing/rod_pull_system.js";
import { StaminaSystem } from "../../domain/fishing/stamina_system.js";
import { TackleStressSystem } from "../../domain/fishing/tackle_stress_system.js";
import { TensionService } from "./tension_service.js";

export class FightSessionFactory {
  // runtimeConfig is the live runtime config (CONFIG) whose adapter DEV overrides replace.
  // logger receives the fish's developer diagnostics (the platform ConsoleLogger in production).
  // stepClock is the platform high-resolution clock for the fight pipeline's diagnostic step durations.
  // fightDiagnostics builds the full DEV fight snapshot each step (Development composition and checks).
  constructor({ config, rng, castDistanceCalculator = null, devFlags = null, runtimeConfig = null, logger = null,
    stepClock = null, fightDiagnostics = false }) {
    this.config = config;
    this.fightDiagnostics = fightDiagnostics === true;
    this.stepClock = stepClock;
    this.runtimeConfig = runtimeConfig;
    this.logger = logger;
    this.rng = rng;
    this.devFlags = devFlags;
    this.physicsConfig =
      config?.fightPhysicsConfig ||
      new FightPhysicsConfigAdapter(config);
    this.castDistanceCalculator =
      castDistanceCalculator || new CastDistanceCalculator(config || {});
  }

  create(fishData, equipment, options = {}) {
    const { rod, reel, hook, lineSystem } = this.createEquipment(equipment, options);
    const fish = new Fish(
      fishData.level,
      fishData.weight,
      fishData.physics,
      this.rng,
      this.logger,
    );
    const dragSystem = new DragControlService(
      this.physicsConfig?.getReelDragConfig?.() || {},
      reel,
    );
    const fishForceSystem = new FishForceSystem({
      fish,
      config: this.config,
    });
    const pullInputMapper = new PullInputMapper();
    const rodPullSystem = new RodPullSystem(
      {
        ...(this.physicsConfig?.getRodPullConfig?.() || {}),
        rodHold: this.physicsConfig?.getRodHoldConfig?.() || {},
      },
    );
    const rodControlSystem = new RodLateralControlSystem();
    const reelSystem = new ReelService(
      this.physicsConfig?.getReelConfig?.() || {},
    );
    const tensionSystem = new TensionService();
    const tensionMeter = new TackleStressSystem({
      rod,
      reel,
      lineSystem,
      hook,
      leader: equipment.leader,
      config: this.physicsConfig?.getTensionConfig?.() || this.config.tension,
      rng: this.rng,
      devFlags: this.devFlags,
    });
    const fightPhysicsSystem = new FightPhysicsOrchestrator(this.config, {
      stepClock: this.stepClock,
      logger: this.logger,
      diagnosticsEnabled: this.fightDiagnostics,
    });
    const fishCondition = new FishCondition(
      fishData.level,
      fishData.weight,
      this.config.stamina.fish,
      fishData.physics,
      {
        maxLevel: fishData.maxLevel,
        levelAverageWeightKg: fishData.levelAverageWeightKg,
      },
    );
    const staminaController = new StaminaSystem(
      fishCondition,
      fish,
      this.config.stamina.mechanics,
    );
    return {
      rod,
      reel,
      hook,
      fish,
      lineSystem,
      dragSystem,
      fishForceSystem,
      pullInputMapper,
      rodPullSystem,
      rodControlSystem,
      reelSystem,
      tensionSystem,
      fightPhysicsSystem,
      tensionMeter,
      fishCondition,
      staminaController,
    };
  }

  createEquipment(equipment, options = {}) {
    const lineSystemConfig = this.#getLineSystemConfig();
    const castOptions = this.#getCastOptions(options);
    const activeLineStats = this.#resolveActiveLineStats(equipment, options);
    const rodStats = equipment.rod?.effectiveStats || {};
    const reelStats = equipment.reel?.effectiveStats || {};
    const rod = new Rod(
      rodStats.equipmentPowerLevel || 1,
      rodStats.basePower || 1.0,
      rodStats.compensation || 0,
      equipment.rod?.variant || "float",
      this.castDistanceCalculator.getMaxCastDistancePx(
        equipment,
        100,
        castOptions,
      ),
      rodStats.hasReel !== false,
      {
        lengthMeters: rodStats.lengthMeters,
        castPowerCoefficient: rodStats.castPowerCoefficient,
        maxLoadKg: rodStats.maxLoadKg,
        holdTensionRatio: rodStats.holdTensionRatio,
        durability: rodStats.durability,
        durabilityMaxLoadLossPerPercent:
          rodStats.durabilityMaxLoadLossPerPercent,
      },
    );
    const reel = equipment.reel
      ? new Reel(
          reelStats.equipmentPowerLevel || 1,
          reelStats.basePower || 1.0,
          {
            maxLoadKg: reelStats.maxLoadKg,
            lineCapacityMeters: reelStats.lineCapacityMeters,
            retrieveSpeedMetersPerSec: reelStats.retrieveSpeedMetersPerSec,
            bearingCount: reelStats.bearingCount,
            bearingRetrieveSpeedBonusMetersPerSec:
              this.physicsConfig?.getReelConfig?.()
                ?.bearingRetrieveSpeedBonusMetersPerSec,
            dragMinKg: reelStats.dragMinKg,
            dragMaxKg: reelStats.dragMaxKg,
            dragChangeSpeedPerSec: reelStats.dragChangeSpeedPerSec,
            hasDrag: reelStats.hasDrag,
            durability: reelStats.durability,
            durabilityMaxLoadLossPerPercent:
              reelStats.durabilityMaxLoadLossPerPercent,
            runtimeConfig: this.runtimeConfig,
          },
        )
      : new Reel(0, 0, { lineCapacityMeters: 0, runtimeConfig: this.runtimeConfig });
    const activeHook = equipment.hooks?.[0] || {};
    const hookStats = activeHook.effectiveStats || {};
    const hook = new Hook(hookStats);
    const lineSystem = new LineSystem({
      rod,
      reel,
      config: lineSystemConfig,
      lineStats: activeLineStats,
      castDistanceCalculator: this.castDistanceCalculator,
    });
    return { rod, reel, hook, lineSystem };
  }

  #getLineSystemConfig() {
    return this.physicsConfig?.getLineSystemConfig?.() || {};
  }

  #getCastOptions(options) {
    return {
      selectedDepthMeters: options?.selectedDepthMeters ?? null,
    };
  }

  #resolveActiveLineStats(equipment, options) {
    const line = equipment?.line;
    if (!line) return null;

    const budget = this.castDistanceCalculator.getFloatLineBudget(
      equipment,
      options?.selectedDepthMeters,
    );
    if (!budget?.applies) return line;

    const activeLengthMeters = budget.maxCastDistanceMeters;
    return {
      ...line,
      effectiveStats: Object.freeze({
        ...(line.effectiveStats || {}),
        lengthMeters: activeLengthMeters,
      }),
    };
  }
}
