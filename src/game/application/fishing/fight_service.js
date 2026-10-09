import { CatchResolutionService } from "./catch_resolution_service.js";
import { FightSessionFactory } from "./fight_session_factory.js";
import { FishingForceService } from "./fishing_force_service.js";

export class FightService {
  #config;
  #physicsConfig;
  #rng;
  #devFlags;
  #upDirection = { x: 0, y: 1 };
  #forces = { pX: 0, pY: 0, fX: 0, fY: 0 };
  #forceService;
  #catchResolver;
  #fishingSystem = null;
  #fish = null;
  #fishForceSystem = null;
  #lineSystem = null;
  #lineInstanceId = null;
  #isActive = false;
  #dragSystem = null;
  #pullInputMapper = null;
  #rodPullSystem = null;
  #rodControlSystem = null;
  #reelSystem = null;
  #tensionSystem = null;
  #fightPhysicsSystem = null;
  #tensionMeter = null;
  #fishCondition = null;
  #staminaController = null;
  #rod = null;
  #reel = null;
  #hook = null;
  #fightSessionOptions = {};

  #fightSessionFactory;

  constructor({
    config,
    rng,
    devFlags = null,
    fightSessionFactory = null,
    forceService = null,
    catchResolver = null,
  }) {
    this.#config = config;
    this.#physicsConfig = config?.fightPhysicsConfig;
    this.#rng = rng;
    this.#devFlags = devFlags;
    this.#fightSessionFactory =
      fightSessionFactory || new FightSessionFactory({ config, rng, devFlags });
    this.#forceService = forceService || new FishingForceService(config);
    this.#catchResolver = catchResolver || new CatchResolutionService();
  }

  startFight(fishData, equipment, options = {}) {
    this.#fightSessionOptions = {
      selectedDepthMeters: options?.selectedDepthMeters ?? null,
    };
    const session = this.#fightSessionFactory.create(
      fishData,
      equipment,
      this.#fightSessionOptions,
    );
    this.#rod = session.rod;
    this.#reel = session.reel;
    this.#hook = session.hook;
    this.#fish = session.fish;
    this.#fishForceSystem = session.fishForceSystem;
    this.#lineSystem = session.lineSystem;
    this.#lineInstanceId = equipment?.line?.instanceId || null;
    this.#isActive = true;
    this.#dragSystem = session.dragSystem;
    this.#pullInputMapper = session.pullInputMapper;
    this.#rodPullSystem = session.rodPullSystem;
    this.#rodControlSystem = session.rodControlSystem;
    this.#reelSystem = session.reelSystem;
    this.#tensionSystem = session.tensionSystem;
    this.#fightPhysicsSystem = session.fightPhysicsSystem;
    this.#fightPhysicsSystem?.resetPlayerPullMotion?.();
    this.#tensionMeter = session.tensionMeter;
    this.#fishingSystem = this.#createDebugFishingAdapter();
    this.#fishCondition = session.fishCondition;
    this.#staminaController = session.staminaController;
    this.#catchResolver.reset?.();
  }

  syncEquipment(equipment) {
    if (!this.#tensionMeter || !this.#staminaController)
      return;
    const next = this.#fightSessionFactory.createEquipment(
      equipment,
      this.#fightSessionOptions,
    );
    this.#rod = next.rod;
    this.#reel = next.reel;
    this.#hook = next.hook;
    this.#lineSystem = next.lineSystem;
    this.#lineInstanceId = equipment?.line?.instanceId || null;
    this.#dragSystem?.updateEquipment(this.#reel);
    this.#pullInputMapper?.reset?.();
    this.#rodPullSystem?.reset?.();
    this.#rodControlSystem?.reset?.();
    this.#fightPhysicsSystem?.resetPlayerPullMotion?.();
    this.#tensionMeter.updateEquipment({
      rod: this.#rod,
      reel: this.#reel,
      lineSystem: this.#lineSystem,
      hook: this.#hook,
      leader: equipment.leader,
    });
    this.#fishingSystem = this.#createDebugFishingAdapter();
  }

  syncFishRuntime(fishData) {
    if (!this.#fish || !fishData) return;
    this.#fish.updateRuntimeStats?.({
      level: fishData.level,
      weight: fishData.weight,
      physics: fishData.physics,
    });
    this.#fishingSystem = this.#createDebugFishingAdapter();
  }

  /** @returns {FightUpdateResult} */
  updateFight(dt, context) {
    if (this.#tensionMeter.isBroken()) {
      return {
        transition: {
          name: "failed",
          data: {
            reason: this.#tensionMeter.getBreakReason(),
            failure: this.#tensionMeter.getBreakInfo?.(),
          },
        },
      };
    }
    this.#syncGodModeStamina();
    const { fishData } = context;
    const forceData = this.#forceService.applyForces(dt, {
      ...context,
      rod: this.#rod,
      reel: this.#reel,
      fishForceSystem: this.#fishForceSystem,
      lineSystem: this.#lineSystem,
      dragSystem: this.#dragSystem,
      pullInputMapper: this.#pullInputMapper,
      rodPullSystem: this.#rodPullSystem,
      rodControlSystem: this.#rodControlSystem,
      reelSystem: this.#reelSystem,
      tensionSystem: this.#tensionSystem,
      stressSystem: this.#tensionMeter,
      fightPhysicsSystem: this.#fightPhysicsSystem,
      fishCondition: this.#fishCondition,
    });
    this.#forces = forceData.forces;
    const fightDebug = this.#tensionMeter.getFightFrame();
    const staminaFrame = forceData.fightFrame?.stamina || {};
    if (this.#isFishStaminaLocked()) {
      this.#syncGodModeStamina();
    } else {
      this.#staminaController.evaluate({
        staminaFrame,
        dt,
      });
    }
    const resolution = this.#catchResolver.resolveAutoCatch({
      fishData,
      lineDistanceMeters: forceData.fightFrame?.landing?.lineDistanceMeters,
      shoreLandingDistanceMeters:
        forceData.fightFrame?.landing?.shoreLandingDistanceMeters,
      maxTackleLoadKg: this.#tensionMeter.getEffectiveMaxTackleLoadKg?.(),
      dtMs: dt,
      rng: this.#rng,
      config: this.#config,
      rod: this.#rod,
      reel: this.#reel,
      landingFrame: forceData.fightFrame?.landing,
      fightDebug,
    });
    if (resolution.transition) return { transition: resolution.transition };
    return {};
  }

  #syncGodModeStamina() {
    if (!this.#isFishStaminaLocked()) return;
    this.#staminaController?.restoreFullStamina?.();
  }

  #isFishStaminaLocked() {
    return this.#devFlags?.isEnabled?.("noFishStaminaLoss") === true;
  }

  handlePlayerInput(input, equipment) {
    // DragControlService now reads pointerStart / pointerCurrent every frame in
    // FightPhysicsOrchestrator.step(), using the same drag-to-fill model as cast power.
    // Do not consume swipeDeltaY here, otherwise it becomes a one-shot 10% step again.
    return {
      consumedSwipe: false,
    };
  }

  handleNetAttempt(net, rng, fishData) {
    return this.#catchResolver.resolveNetAttempt(
      net,
      this.#fish?.getWeight?.() || 0,
      rng,
      fishData,
    );
  }

  #createDebugFishingAdapter() {
    return {
      calculatePlayerForce: () => ({
        x: 0,
        y: this.#tensionMeter?.getEffectiveMaxTackleLoadKg?.() || 0,
      }),
      getCurrentState: () =>
        this.#tensionMeter?.getDiagnostics?.().fishState || "idle",
      getFishBasePower: () =>
        this.#tensionMeter?.getDiagnostics?.().fishBasePower || 0,
      getFishInitialPower: () =>
        this.#tensionMeter?.getDiagnostics?.().fishInitialPower || 0,
      getPullMultiplier: () =>
        this.#tensionMeter?.getDiagnostics?.().pullMult || 0,
      getMoveMultiplier: () =>
        this.#tensionMeter?.getDiagnostics?.().moveMult || 0,
      getDebuffState: () => this.#fish?.getDebuffState?.() || null,
      getMasteryMultiplier: () => this.#fish?.getMasteryMultiplier?.() || 1.0,
    };
  }

  /**
   * Pure data context — no Game/facade dependency.
   * @param {{ floatEntity: object, boundaries: object, rodPos: Vector2, screenOffset: number, equipment: object }} ctx
   */
  getDiagnostics({ floatEntity, boundaries, rodPos, screenOffset, equipment }) {
    const fs = this.#fishingSystem;
    const sc = this.#staminaController;
    const floatPos = floatEntity.getPosition();
    const bounds = boundaries;

    const maxP = this.#fishingSystem.calculatePlayerForce(
      this.#upDirection,
      floatPos.x,
      floatPos.y,
      rodPos,
      screenOffset,
      this.#getDebugPhysicsConfig(),
      bounds,
    );
    const xRange = this.#physicsConfig?.getDistanceXMultiplier?.() || [1.0, 1.0];
    const boundsHeight = Math.max(1, bounds.bottom - bounds.top);
    const distRatio = Math.max(
      0,
      Math.min(1.0, (floatPos.y - bounds.top) / boundsHeight),
    );
    const depthScaleX = xRange[0] + distRatio * (xRange[1] - xRange[0]);
    const steerP =
      (this.#tensionMeter?.getEffectiveMaxTackleLoadKg?.() || 0) *
      (
        this.#physicsConfig?.getPlayerSteeringMultiplier?.() ??
        1.5
      ) *
      depthScaleX;
    return {
      playerForceY: Math.abs(this.#forces.pY || 0),
      playerForceX: Math.abs(this.#forces.pX || 0),
      fishForceY: Math.abs(this.#forces.fY || 0),
      fishForceX: Math.abs(this.#forces.fX || 0),
      playerMaxPowerY: Math.abs(maxP.y || 0),
      playerMaxPowerX: steerP,
      fishState: fs?.getCurrentState?.() || "idle",
      fishBasePower: fs?.getFishBasePower?.() || 0,
      fishInitialPower: fs?.getFishInitialPower?.() || 0,
      tension: this.#tensionMeter?.getTension?.() || 0,
      lineBreakProgress: this.#tensionMeter?.getLineBreakProgress?.() || 0,
      ...(this.#tensionMeter?.getDiagnostics?.() || {}),
      fishConditionPhase: this.#fishCondition?.phase || "n/a",
      fishConditionMaxStamina: this.#fishCondition?.maxStamina || 0,
      fishConditionMaxEndurance: this.#fishCondition?.maxEndurance || 0,
      fishConditionMaxPoints: this.#fishCondition?.maxPoints || 0,
      currentStamina: this.#fishCondition?.currentStamina || 0,
      currentExhaustion: this.#fishCondition?.currentExhaustion || 0,
      pullMult: fs?.getPullMultiplier?.() || 0,
      moveMult: fs?.getMoveMultiplier?.() || 0,
      debuffState: fs?.getDebuffState?.() || null,
      masteryCurrentMult: fs?.getMasteryMultiplier?.() || 1.0,
      masteryTimerMs: sc?.getMasteryTimer?.() || 0,
      isMasteryActive: sc?.isMasteryActive?.() || false,
      exhaustionDurationMs: sc?.getExhaustionDurationMs?.() || 1000,
    };
  }

  getHoldUiState() {
    return null;
  }

  get tensionMeter() {
    return this.#tensionMeter;
  }

  #getDebugPhysicsConfig() {
    return this.#physicsConfig?.getLineSystemConfig?.() || {};
  }

  get fishCondition() {
    return this.#fishCondition;
  }

  getLineCapacityState() {
    if (!this.#isActive || !this.#lineInstanceId) return null;
    const state = this.#lineSystem?.getState?.();
    if (!state) return null;
    return Object.freeze({
      lineInstanceId: this.#lineInstanceId,
      hasReel: !!state.hasReel,
      totalMeters: Math.max(0, Number(state.totalLineMeters) || 0),
      releasedMeters: Math.max(0, Number(state.releasedMeters) || 0),
      remainingMeters: Math.max(0, Number(state.remainingMeters) || 0),
    });
  }

  endFight() {
    this.#fightPhysicsSystem?.resetPlayerPullMotion?.();
    this.#isActive = false;
    this.#lineInstanceId = null;
  }
}
