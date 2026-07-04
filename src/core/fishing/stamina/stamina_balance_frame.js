class StaminaBalanceFrame {
  #activeStaminaDrainCalculator;
  #passiveStaminaRegenCalculator;
  #activeEnduranceDrainCalculator;
  #passiveEnduranceDrainCalculator;
  #phaseMachine;
  #elapsedMs = 0;

  constructor({
    activeStaminaDrainCalculator = new ActiveStaminaDrainCalculator(),
    passiveStaminaRegenCalculator = new PassiveStaminaRegenCalculator(),
    activeEnduranceDrainCalculator = new ActiveEnduranceDrainCalculator(),
    passiveEnduranceDrainCalculator = new PassiveEnduranceDrainCalculator(),
    phaseMachine = typeof StaminaPhaseMachine !== "undefined"
      ? new StaminaPhaseMachine()
      : null,
  } = {}) {
    this.#activeStaminaDrainCalculator = activeStaminaDrainCalculator;
    this.#passiveStaminaRegenCalculator = passiveStaminaRegenCalculator;
    this.#activeEnduranceDrainCalculator = activeEnduranceDrainCalculator;
    this.#passiveEnduranceDrainCalculator = passiveEnduranceDrainCalculator;
    this.#phaseMachine = phaseMachine;
  }

  create({
    phase = "stamina",
    playerIsPulling = false,
    fishTensionKg = 0,
    appliedRodHoldKg = 0,
    appliedReelHoldKg = 0,
    appliedControlKg = 0,
    playerPressureControlExhausted = false,
    playerFatigueProgress = 0,
    weakestTackleLimitKg = 0,
    currentStamina = null,
    maxStamina = null,
    lineAngleDeg = 0,
    fishLateralContext = {},
    controlDirectionX = 0,
    fishStaminaResistanceKg = 0,
    isLineFullyExtended = false,
    fishWonRadialForceKg = 0,
    dragBlockedForceKg = 0,
    lineTaut = false,
    lineTautRatio = null,
    fishBehaviorName = "unknown",
    shouldSlipDrag = false,
    hardLineLimit = false,
    currentExhaustion = null,
    maxEndurance = null,
    dtSec = 0,
    nowMs = null,
    config = {},
  } = {}) {
    const mechanics = config || {};
    const dt = this.#positive(dtSec);
    const resolvedNowMs = this.#resolveNowMs({ nowMs, dtSec: dt });
    const resolvedPhase = this.#normalizePhase(phase);
    if (
      mechanics.simplifiedModel?.enabled === true &&
      this.#phaseMachine
    ) {
      return this.#createSimplified({
        phase: resolvedPhase,
        playerIsPulling,
        fishTensionKg,
        appliedRodHoldKg,
        appliedReelHoldKg,
        appliedControlKg,
        playerPressureControlExhausted,
        playerFatigueProgress,
        weakestTackleLimitKg,
        currentStamina,
        maxStamina,
        lineAngleDeg,
        fishLateralContext,
        controlDirectionX,
        fishStaminaResistanceKg,
        isLineFullyExtended,
        fishWonRadialForceKg,
        dragBlockedForceKg,
        lineTaut,
        lineTautRatio,
        fishBehaviorName,
        shouldSlipDrag,
        hardLineLimit,
        currentExhaustion,
        maxEndurance,
        dtSec: dt,
        nowMs: resolvedNowMs,
        mechanics,
      });
    }
    const controlExhausted = playerPressureControlExhausted === true;
    const physicalAppliedRodHoldKg = this.#positive(appliedRodHoldKg);
    const physicalAppliedControlKg = this.#positive(appliedControlKg);
    const controlRodHoldKg = controlExhausted
      ? 0
      : physicalAppliedRodHoldKg;
    const controlAppliedKg = controlExhausted
      ? 0
      : physicalAppliedControlKg;
    const activeDrain = this.#activeStaminaDrainCalculator.calculate({
      appliedRodHoldKg: controlRodHoldKg,
      appliedControlKg: controlAppliedKg,
      fishTensionKg,
      weakestTackleLimitKg,
      dtSec: dt,
      config: mechanics.activeDrain || {},
    });
    const passiveRegen = this.#passiveStaminaRegenCalculator.calculate({
      usedPlayerPressureKg: activeDrain.usedPlayerPressureKg,
      lineAngleDeg,
      dtSec: dt,
      nowMs: resolvedNowMs,
      config: mechanics.passiveRegen || {},
    });
    const activeEndurance = this.#activeEnduranceDrainCalculator.calculate({
      activePressureRatio: activeDrain.activeDrainRatio,
      dtSec: dt,
      config: mechanics.enduranceDrain?.active || {},
    });
    const passiveEndurance =
      this.#passiveEnduranceDrainCalculator.calculate({
        fishWonRadialForceKg,
        dragBlockedForceKg,
        lineTaut,
        lineTautRatio,
        fishBehaviorName,
        weakestTackleLimitKg: activeDrain.weakestTackleLimitKg,
        dtSec: dt,
        config:
          mechanics.enduranceDrain?.passive ||
          mechanics.passiveDrain ||
          {},
      });
    const netStaminaChange =
      passiveRegen.passiveStaminaRegen -
      activeDrain.activeStaminaDrain;
    const netStaminaPerSecond =
      dt > 0 ? netStaminaChange / dt : 0;
    const totalEnduranceDrain =
      activeEndurance.activeEnduranceDrain +
      passiveEndurance.passiveEnduranceDrain;
    const totalEnduranceDrainPerSecond =
      activeEndurance.activeEnduranceDrainPerSecond +
      passiveEndurance.passiveEnduranceDrainPerSecond;
    const enduranceTotalDrainRatio = this.#clamp01(
      activeEndurance.activeEnduranceDrainRatio +
        passiveEndurance.passiveEnduranceDrainRatio,
    );
    const frameMaxEndurance = this.#positive(maxEndurance);
    const frameCurrentExhaustion =
      currentExhaustion === null || currentExhaustion === undefined
        ? frameMaxEndurance
        : this.#positive(currentExhaustion, frameMaxEndurance);
    const frameEnduranceProgress = frameMaxEndurance > 0
      ? this.#clamp01(1 - frameCurrentExhaustion / frameMaxEndurance)
      : 0;

    return Object.freeze({
      source: "stamina_balance_frame",
      phase: resolvedPhase,
      staminaPhase: resolvedPhase,
      framePhase: resolvedPhase,
      frameCurrentExhaustion,
      frameMaxEndurance,
      frameEnduranceProgress,
      playerIsPulling: !!playerIsPulling,
      playerPowerIsPulling: !!playerIsPulling,
      fishTensionKg: activeDrain.fishTensionKg,
      appliedRodHoldKg: activeDrain.appliedRodHoldKg,
      appliedControlKg: activeDrain.appliedControlKg,
      controlRodHoldKg: activeDrain.appliedRodHoldKg,
      controlAppliedRodHoldKg: activeDrain.appliedRodHoldKg,
      controlAppliedControlKg: activeDrain.appliedControlKg,
      physicalAppliedRodHoldKg,
      physicalAppliedControlKg,
      physicalAppliedPlayerPressureKg:
        physicalAppliedRodHoldKg + physicalAppliedControlKg,
      playerPressureControlExhausted: controlExhausted,
      budgetedRodHoldKg: activeDrain.budgetedRodHoldKg,
      budgetedControlKg: activeDrain.budgetedControlKg,
      weakestTackleLimitKg: activeDrain.weakestTackleLimitKg,
      lineAngleDeg: passiveRegen.lineAngleDeg,
      isLineFullyExtended: !!isLineFullyExtended,
      fishWonRadialForceKg: passiveEndurance.fishWonRadialForceKg,
      dragBlockedForceKg: passiveEndurance.dragBlockedForceKg,
      lineTaut: passiveEndurance.lineTaut,
      lineTautRatio: passiveEndurance.lineTautRatio,
      rawLineTautRatio: passiveEndurance.rawLineTautRatio,
      fishBehaviorName: passiveEndurance.fishBehaviorName,
      shouldSlipDrag: !!shouldSlipDrag,
      hardLineLimit: !!hardLineLimit,
      dtSec: dt,
      nowMs: resolvedNowMs,

      lateralStaminaWeight: activeDrain.lateralStaminaWeight,
      rawAppliedPlayerPressureKg: activeDrain.rawAppliedPlayerPressureKg,
      availablePlayerPressureKg: activeDrain.availablePlayerPressureKg,
      usedPlayerPressureKg: activeDrain.usedPlayerPressureKg,
      activeDrainRatio: activeDrain.activeDrainRatio,
      curvedActiveDrainRatio: activeDrain.curvedActiveDrainRatio,
      activeDrainPerSecond: activeDrain.activeDrainPerSecond,
      activeStaminaDrain: activeDrain.activeStaminaDrain,
      passiveStaminaRegen: passiveRegen.passiveStaminaRegen,
      passiveStaminaRegenPerSecond: passiveRegen.passiveRegenPerSecond,
      staminaPassiveRegenPerSecond: passiveRegen.passiveRegenPerSecond,
      angleRegenMultiplier: passiveRegen.angleRegenMultiplier,
      staminaAngleRegenMultiplier: passiveRegen.angleRegenMultiplier,
      regenDelayActive: passiveRegen.regenDelayActive,
      staminaRegenDelayActive: passiveRegen.regenDelayActive,
      staminaPressureThresholdKg: passiveRegen.pressureThresholdKg,
      staminaPressureActive: passiveRegen.pressureActive,
      netStaminaChange,
      netStaminaPerSecond,
      rawNetStaminaChange: netStaminaChange,

      activeEnduranceDrainRatio:
        activeEndurance.activeEnduranceDrainRatio,
      enduranceActiveDrainRatio:
        activeEndurance.activeEnduranceDrainRatio,
      activeEnduranceDrainPerSecond:
        activeEndurance.activeEnduranceDrainPerSecond,
      activeEnduranceDrain: activeEndurance.activeEnduranceDrain,
      passiveEnduranceDrainRatio:
        passiveEndurance.passiveEnduranceDrainRatio,
      endurancePassiveDrainRatio:
        passiveEndurance.passiveEnduranceDrainRatio,
      passiveEnduranceDrainPerSecond:
        passiveEndurance.passiveEnduranceDrainPerSecond,
      passiveEnduranceDrain:
        passiveEndurance.passiveEnduranceDrain,
      totalEnduranceDrain,
      totalEnduranceDrainPerSecond,
      enduranceTotalDrain: totalEnduranceDrain,
      enduranceTotalDrainPerSecond: totalEnduranceDrainPerSecond,
      enduranceTotalDrainRatio,
      enduranceFishEffortRatio: passiveEndurance.fishEffortRatio,
      enduranceResistanceRatio: passiveEndurance.resistanceRatio,
      enduranceLineTautRatio: passiveEndurance.lineTautRatio,
      enduranceBehaviorName: passiveEndurance.fishBehaviorName,
      enduranceBehaviorMultiplier: passiveEndurance.behaviorMultiplier,

      passiveDrainEnabled: false,
      passiveDrainRatio: 0,
      passiveDrainPerSecond: 0,
      passiveStaminaDrain: 0,
      totalStaminaDrain: activeDrain.activeStaminaDrain,
      totalStaminaDrainPerSecond: activeDrain.activeDrainPerSecond,
      angleRecoveryRatio: 0,
      angleRegenPerSecond: passiveRegen.passiveRegenPerSecond,
      angleStaminaRegen: passiveRegen.passiveStaminaRegen,
      allowStaminaRegenWhilePulling:
        passiveRegen.allowWhilePressuring === true,
      regenBlockedByPull: passiveRegen.blockedByPressure,

      budgetOverflowWarning: activeDrain.budgetOverflow,
      budgetOverflow: activeDrain.budgetOverflow,
      budgetScale: activeDrain.budgetScale,
      activeDrain,
      passiveRegen,
      activeEndurance,
      passiveEndurance,
      angleMultiplier: passiveRegen.angleMultiplier,
      angleStressRatio: 0,
      staminaPressureRatio: activeDrain.activeDrainRatio,
    });
  }

  #createSimplified({
    phase,
    playerIsPulling,
    fishTensionKg,
    appliedRodHoldKg,
    appliedReelHoldKg,
    appliedControlKg,
    playerPressureControlExhausted,
    playerFatigueProgress,
    weakestTackleLimitKg,
    currentStamina,
    maxStamina,
    lineAngleDeg,
    fishLateralContext,
    controlDirectionX,
    fishStaminaResistanceKg,
    isLineFullyExtended,
    fishWonRadialForceKg,
    dragBlockedForceKg,
    lineTaut,
    lineTautRatio,
    fishBehaviorName,
    shouldSlipDrag,
    hardLineLimit,
    currentExhaustion,
    maxEndurance,
    dtSec,
    nowMs,
    mechanics,
  }) {
    const physicalAppliedRodHoldKg = this.#positive(appliedRodHoldKg);
    const physicalAppliedReelHoldKg = this.#positive(appliedReelHoldKg);
    const physicalAppliedControlKg = this.#positive(appliedControlKg);
    const controlExhausted = playerPressureControlExhausted === true;
    const frameMaxStamina = this.#positive(maxStamina, 1);
    const frameCurrentStamina =
      currentStamina === null || currentStamina === undefined
        ? frameMaxStamina
        : this.#positive(currentStamina, frameMaxStamina);
    const staminaModel = this.#phaseMachine.createFrame({
      phase,
      currentStamina: frameCurrentStamina,
      maxStamina: frameMaxStamina,
      rodHoldKg: physicalAppliedRodHoldKg,
      reelHoldKg: physicalAppliedReelHoldKg,
      controlKg: physicalAppliedControlKg,
      controlExhausted,
      fishLateralContext,
      controlDirectionX,
      fishStaminaResistanceKg,
      playerFatigueProgress,
      lineAngleDeg,
      dtSec,
      config: mechanics,
    });
    const activeEnduranceRatio =
      staminaModel.pressureActive && !controlExhausted
        ? staminaModel.drainMultiplier
        : 0;
    const activeEndurance = this.#activeEnduranceDrainCalculator.calculate({
      activePressureRatio: activeEnduranceRatio,
      dtSec,
      config: mechanics.enduranceDrain?.active || {},
    });
    const passiveEndurance =
      this.#passiveEnduranceDrainCalculator.calculate({
        fishWonRadialForceKg,
        dragBlockedForceKg,
        lineTaut,
        lineTautRatio,
        fishBehaviorName,
        weakestTackleLimitKg,
        dtSec,
        config:
          mechanics.enduranceDrain?.passive ||
          mechanics.passiveDrain ||
          {},
      });
    const totalEnduranceDrain =
      activeEndurance.activeEnduranceDrain +
      passiveEndurance.passiveEnduranceDrain;
    const totalEnduranceDrainPerSecond =
      activeEndurance.activeEnduranceDrainPerSecond +
      passiveEndurance.passiveEnduranceDrainPerSecond;
    const enduranceTotalDrainRatio = this.#clamp01(
      activeEndurance.activeEnduranceDrainRatio +
        passiveEndurance.passiveEnduranceDrainRatio,
    );
    const frameMaxEndurance = this.#positive(maxEndurance);
    const frameCurrentExhaustion =
      currentExhaustion === null || currentExhaustion === undefined
        ? frameMaxEndurance
        : this.#positive(currentExhaustion, frameMaxEndurance);
    const frameEnduranceProgress = frameMaxEndurance > 0
      ? this.#clamp01(1 - frameCurrentExhaustion / frameMaxEndurance)
      : 0;
    const netStaminaChange = staminaModel.staminaDelta;
    const netStaminaPerSecond = dtSec > 0 ? netStaminaChange / dtSec : 0;
    const rawAppliedPlayerPressureKg =
      physicalAppliedRodHoldKg +
      physicalAppliedReelHoldKg +
      physicalAppliedControlKg;

    return Object.freeze({
      source: "stamina_balance_frame",
      staminaModelSource: "simplified_stamina_model",
      staminaModelMode: "simplified",
      phase,
      staminaPhase: phase,
      framePhase: phase,
      nextPhase: staminaModel.nextPhase,
      staminaMode: staminaModel.staminaMode,
      staminaTransitionReason: staminaModel.transitionReason,
      staminaRecoveryFromExhaustionActive:
        staminaModel.staminaRecoveryFromExhaustionActive,
      staminaPhaseReturnThreshold: staminaModel.phaseReturnThreshold,
      staminaBefore: staminaModel.staminaBefore,
      staminaAfter: staminaModel.staminaAfter,
      staminaDelta: staminaModel.staminaDelta,
      frameCurrentExhaustion,
      frameMaxEndurance,
      frameEnduranceProgress,
      playerIsPulling: !!playerIsPulling,
      playerPowerIsPulling: !!playerIsPulling,
      fishTensionKg: this.#positive(fishTensionKg),
      appliedRodHoldKg: physicalAppliedRodHoldKg,
      appliedReelHoldKg: physicalAppliedReelHoldKg,
      appliedControlKg: physicalAppliedControlKg,
      controlRodHoldKg: controlExhausted ? 0 : physicalAppliedRodHoldKg,
      controlAppliedRodHoldKg: controlExhausted ? 0 : physicalAppliedRodHoldKg,
      controlAppliedReelHoldKg: controlExhausted ? 0 : physicalAppliedReelHoldKg,
      controlAppliedControlKg: controlExhausted ? 0 : physicalAppliedControlKg,
      physicalAppliedRodHoldKg,
      physicalAppliedReelHoldKg,
      physicalAppliedControlKg,
      physicalAppliedPlayerPressureKg: rawAppliedPlayerPressureKg,
      playerPressureControlExhausted: controlExhausted,
      budgetedRodHoldKg: physicalAppliedRodHoldKg,
      budgetedReelHoldKg: physicalAppliedReelHoldKg,
      budgetedControlKg: physicalAppliedControlKg,
      weakestTackleLimitKg: this.#positive(weakestTackleLimitKg),
      lineAngleDeg: staminaModel.lineAngleDeg ?? this.#positive(lineAngleDeg),
      isLineFullyExtended: !!isLineFullyExtended,
      fishWonRadialForceKg: passiveEndurance.fishWonRadialForceKg,
      dragBlockedForceKg: passiveEndurance.dragBlockedForceKg,
      lineTaut: passiveEndurance.lineTaut,
      lineTautRatio: passiveEndurance.lineTautRatio,
      rawLineTautRatio: passiveEndurance.rawLineTautRatio,
      fishBehaviorName: passiveEndurance.fishBehaviorName,
      shouldSlipDrag: !!shouldSlipDrag,
      hardLineLimit: !!hardLineLimit,
      dtSec,
      nowMs,

      playerStaminaPressureKg: staminaModel.playerStaminaPressureKg,
      fishStaminaResistanceKg: staminaModel.fishStaminaResistanceKg,
      playerAdvantageRatio: staminaModel.playerAdvantageRatio,
      clampedAdvantageRatio: staminaModel.clampedAdvantageRatio,
      staminaDrainMultiplier: staminaModel.drainMultiplier,
      lateralEdgeRatio: staminaModel.lateralEdgeRatio,
      holdStaminaDrainMultiplier: staminaModel.holdDrainMultiplier,
      controlStaminaDrainMultiplier: staminaModel.controlDrainMultiplier,
      controlCenteringFactor: staminaModel.controlCenteringFactor,
      controlDirectionState: staminaModel.controlDirectionState,
      rodHoldStaminaPressureKg: staminaModel.rodHoldStaminaPressureKg,
      reelHoldStaminaPressureKg: staminaModel.reelHoldStaminaPressureKg,
      controlStaminaPressureKg: staminaModel.controlStaminaPressureKg,
      fatigueRegenMultiplier: staminaModel.fatigueRegenMultiplier,
      playerFatigueProgress: staminaModel.playerFatigueProgress,
      playerFatigueFull: staminaModel.playerFatigueFull,

      lateralStaminaWeight: staminaModel.controlStaminaDrainMultiplier,
      rawAppliedPlayerPressureKg,
      availablePlayerPressureKg: Math.max(
        0,
        this.#positive(weakestTackleLimitKg) - this.#positive(fishTensionKg),
      ),
      usedPlayerPressureKg: staminaModel.playerStaminaPressureKg,
      activeDrainRatio: staminaModel.playerAdvantageRatio,
      curvedActiveDrainRatio: staminaModel.clampedAdvantageRatio,
      activeDrainPerSecond: staminaModel.drainPerSecond,
      activeStaminaDrain: staminaModel.staminaDrain,
      passiveStaminaRegen: staminaModel.staminaRegen,
      passiveStaminaRegenPerSecond: staminaModel.regenPerSecond,
      staminaPassiveRegenPerSecond: staminaModel.regenPerSecond,
      angleRegenMultiplier: staminaModel.angleRegenMultiplier,
      staminaAngleRegenMultiplier: staminaModel.angleRegenMultiplier,
      regenDelayActive: false,
      staminaRegenDelayActive: false,
      staminaPressureThresholdKg: staminaModel.pressureThresholdKg,
      staminaPressureActive: staminaModel.pressureActive,
      netStaminaChange,
      netStaminaPerSecond,
      rawNetStaminaChange: netStaminaChange,

      activeEnduranceDrainRatio:
        activeEndurance.activeEnduranceDrainRatio,
      enduranceActiveDrainRatio:
        activeEndurance.activeEnduranceDrainRatio,
      activeEnduranceDrainPerSecond:
        activeEndurance.activeEnduranceDrainPerSecond,
      activeEnduranceDrain: activeEndurance.activeEnduranceDrain,
      passiveEnduranceDrainRatio:
        passiveEndurance.passiveEnduranceDrainRatio,
      endurancePassiveDrainRatio:
        passiveEndurance.passiveEnduranceDrainRatio,
      passiveEnduranceDrainPerSecond:
        passiveEndurance.passiveEnduranceDrainPerSecond,
      passiveEnduranceDrain:
        passiveEndurance.passiveEnduranceDrain,
      totalEnduranceDrain,
      totalEnduranceDrainPerSecond,
      enduranceTotalDrain: totalEnduranceDrain,
      enduranceTotalDrainPerSecond: totalEnduranceDrainPerSecond,
      enduranceTotalDrainRatio,
      enduranceFishEffortRatio: passiveEndurance.fishEffortRatio,
      enduranceResistanceRatio: passiveEndurance.resistanceRatio,
      enduranceLineTautRatio: passiveEndurance.lineTautRatio,
      enduranceBehaviorName: passiveEndurance.fishBehaviorName,
      enduranceBehaviorMultiplier: passiveEndurance.behaviorMultiplier,

      passiveDrainEnabled: false,
      passiveDrainRatio: 0,
      passiveDrainPerSecond: 0,
      passiveStaminaDrain: 0,
      totalStaminaDrain: staminaModel.staminaDrain,
      totalStaminaDrainPerSecond: staminaModel.drainPerSecond,
      angleRecoveryRatio: 0,
      angleRegenPerSecond: staminaModel.regenPerSecond,
      angleStaminaRegen: staminaModel.staminaRegen,
      allowStaminaRegenWhilePulling: false,
      regenBlockedByPull: false,

      budgetOverflowWarning: false,
      budgetOverflow: false,
      budgetScale: 1,
      activeDrain: staminaModel,
      passiveRegen: staminaModel,
      activeEndurance,
      passiveEndurance,
      angleMultiplier: {
        lineAngleDeg: staminaModel.lineAngleDeg ?? this.#positive(lineAngleDeg),
        angleRegenMultiplier: staminaModel.angleRegenMultiplier,
      },
      angleStressRatio: 0,
      staminaPressureRatio: staminaModel.playerAdvantageRatio,
    });
  }

  #resolveNowMs({ nowMs, dtSec }) {
    const explicit = Number(nowMs);
    if (Number.isFinite(explicit) && explicit >= 0) {
      this.#elapsedMs = explicit;
      return explicit;
    }
    this.#elapsedMs += this.#positive(dtSec) * 1000;
    return this.#elapsedMs;
  }

  #normalizePhase(value) {
    const text = String(value || "stamina").trim().toLowerCase();
    return text === "exhaustion" ? "exhaustion" : "stamina";
  }

  #positive(value, fallback = 0) {
    const number = Number(value);
    if (Number.isFinite(number) && number >= 0) return number;
    const safeFallback = Number(fallback);
    return Number.isFinite(safeFallback) && safeFallback >= 0
      ? safeFallback
      : 0;
  }

  #clamp01(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.max(0, Math.min(1, number));
  }
}

if (typeof window !== "undefined") {
  window.StaminaBalanceFrame = StaminaBalanceFrame;
}
