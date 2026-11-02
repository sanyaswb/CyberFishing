import { ActiveEnduranceDrainCalculator } from "./active_endurance_drain_calculator.js";
import { PassiveEnduranceDrainCalculator } from "./passive_endurance_drain_calculator.js";
import { StaminaPhaseMachine } from "./stamina_phase_machine.js";
import { clampUnitFinite, nonNegativeOr } from "../../../../engine/math/number_normalization.js";

export class StaminaBalanceFrame {
  #phaseMachine;
  #activeEnduranceDrainCalculator;
  #passiveEnduranceDrainCalculator;
  #elapsedMs = 0;

  constructor({
    phaseMachine = new StaminaPhaseMachine(),
    activeEnduranceDrainCalculator = new ActiveEnduranceDrainCalculator(),
    passiveEnduranceDrainCalculator = new PassiveEnduranceDrainCalculator(),
  } = {}) {
    this.#phaseMachine = phaseMachine;
    this.#activeEnduranceDrainCalculator = activeEnduranceDrainCalculator;
    this.#passiveEnduranceDrainCalculator = passiveEnduranceDrainCalculator;
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
    rawStaminaInputActive = false,
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
    const dt = nonNegativeOr(dtSec);
    const resolvedNowMs = this.#resolveNowMs({ nowMs, dtSec: dt });
    const mechanics = config || {};
    const resolvedPhase = this.#normalizePhase(phase);
    const physicalAppliedRodHoldKg = nonNegativeOr(appliedRodHoldKg);
    const physicalAppliedReelHoldKg = nonNegativeOr(appliedReelHoldKg);
    const physicalAppliedControlKg = nonNegativeOr(appliedControlKg);
    const controlExhausted = playerPressureControlExhausted === true;
    const frameMaxStamina = nonNegativeOr(maxStamina, 1);
    const frameCurrentStamina =
      currentStamina === null || currentStamina === undefined
        ? frameMaxStamina
        : nonNegativeOr(currentStamina, frameMaxStamina);
    const staminaModel = this.#phaseMachine.createFrame({
      phase: resolvedPhase,
      currentStamina: frameCurrentStamina,
      maxStamina: frameMaxStamina,
      rodHoldKg: physicalAppliedRodHoldKg,
      reelHoldKg: physicalAppliedReelHoldKg,
      controlKg: physicalAppliedControlKg,
      controlExhausted,
      fishLateralContext,
      controlDirectionX,
      rawStaminaInputActive,
      fishStaminaResistanceKg,
      playerFatigueProgress,
      lineAngleDeg,
      dtSec: dt,
      config: mechanics,
    });
    const activeEnduranceRatio =
      staminaModel.pressureActive && !controlExhausted
        ? staminaModel.drainMultiplier
        : 0;
    const activeEndurance = this.#activeEnduranceDrainCalculator.calculate({
      activePressureRatio: activeEnduranceRatio,
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
        weakestTackleLimitKg,
        dtSec: dt,
        config: mechanics.enduranceDrain?.passive || {},
      });
    const totalEnduranceDrain =
      activeEndurance.activeEnduranceDrain +
      passiveEndurance.passiveEnduranceDrain;
    const totalEnduranceDrainPerSecond =
      activeEndurance.activeEnduranceDrainPerSecond +
      passiveEndurance.passiveEnduranceDrainPerSecond;
    const enduranceTotalDrainRatio = clampUnitFinite(
      activeEndurance.activeEnduranceDrainRatio +
        passiveEndurance.passiveEnduranceDrainRatio,
    );
    const frameMaxEndurance = nonNegativeOr(maxEndurance);
    const frameCurrentExhaustion =
      currentExhaustion === null || currentExhaustion === undefined
        ? frameMaxEndurance
        : nonNegativeOr(currentExhaustion, frameMaxEndurance);
    const frameEnduranceProgress = frameMaxEndurance > 0
      ? clampUnitFinite(1 - frameCurrentExhaustion / frameMaxEndurance)
      : 0;
    const netStaminaChange = staminaModel.staminaDelta;
    const netStaminaPerSecond = dt > 0 ? netStaminaChange / dt : 0;
    const rawAppliedPlayerPressureKg =
      physicalAppliedRodHoldKg +
      physicalAppliedReelHoldKg +
      physicalAppliedControlKg;

    return Object.freeze({
      source: "stamina_balance_frame",
      staminaModelSource: "simplified_stamina_model",
      staminaModelMode: "simplified",
      phase: resolvedPhase,
      staminaPhase: resolvedPhase,
      framePhase: resolvedPhase,
      nextPhase: staminaModel.nextPhase,
      staminaMode: staminaModel.staminaMode,
      staminaTransitionReason: staminaModel.transitionReason,
      staminaRecoveryFromExhaustionActive:
        staminaModel.staminaRecoveryFromExhaustionActive,
      rawStaminaInputActive: staminaModel.rawStaminaInputActive,
      staminaNoInputElapsedMs: staminaModel.staminaNoInputElapsedMs,
      staminaNoInputTimeoutMs: staminaModel.staminaNoInputTimeoutMs,
      staminaNoInputRecoveryReady: staminaModel.staminaNoInputRecoveryReady,
      staminaRecoveryTrigger: staminaModel.staminaRecoveryTrigger,
      staminaPhaseReturnThreshold: staminaModel.phaseReturnThreshold,
      staminaBefore: staminaModel.staminaBefore,
      staminaAfter: staminaModel.staminaAfter,
      staminaDelta: staminaModel.staminaDelta,
      frameCurrentExhaustion,
      frameMaxEndurance,
      frameEnduranceProgress,
      playerIsPulling: !!playerIsPulling,
      playerPowerIsPulling: !!playerIsPulling,
      fishTensionKg: nonNegativeOr(fishTensionKg),
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
      weakestTackleLimitKg: nonNegativeOr(weakestTackleLimitKg),
      lineAngleDeg: staminaModel.lineAngleDeg ?? nonNegativeOr(lineAngleDeg),
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

      lateralStaminaWeight: staminaModel.controlDrainMultiplier,
      rawAppliedPlayerPressureKg,
      availablePlayerPressureKg: Math.max(
        0,
        nonNegativeOr(weakestTackleLimitKg) - nonNegativeOr(fishTensionKg),
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
      passiveEnduranceDrain: passiveEndurance.passiveEnduranceDrain,
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
        lineAngleDeg: staminaModel.lineAngleDeg ?? nonNegativeOr(lineAngleDeg),
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
    this.#elapsedMs += nonNegativeOr(dtSec) * 1000;
    return this.#elapsedMs;
  }

  #normalizePhase(value) {
    const text = String(value || "stamina").trim().toLowerCase();
    return text === "exhaustion" ? "exhaustion" : "stamina";
  }
}
