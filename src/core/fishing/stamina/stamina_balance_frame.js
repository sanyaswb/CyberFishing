class StaminaBalanceFrame {
  #activeStaminaDrainCalculator;
  #passiveStaminaRegenCalculator;
  #activeEnduranceDrainCalculator;
  #passiveEnduranceDrainCalculator;
  #elapsedMs = 0;

  constructor({
    activeStaminaDrainCalculator = new ActiveStaminaDrainCalculator(),
    passiveStaminaRegenCalculator = new PassiveStaminaRegenCalculator(),
    activeEnduranceDrainCalculator = new ActiveEnduranceDrainCalculator(),
    passiveEnduranceDrainCalculator = new PassiveEnduranceDrainCalculator(),
  } = {}) {
    this.#activeStaminaDrainCalculator = activeStaminaDrainCalculator;
    this.#passiveStaminaRegenCalculator = passiveStaminaRegenCalculator;
    this.#activeEnduranceDrainCalculator = activeEnduranceDrainCalculator;
    this.#passiveEnduranceDrainCalculator = passiveEnduranceDrainCalculator;
  }

  create({
    phase = "stamina",
    playerIsPulling = false,
    fishTensionKg = 0,
    appliedRodHoldKg = 0,
    appliedControlKg = 0,
    weakestTackleLimitKg = 0,
    lineAngleDeg = 0,
    isLineFullyExtended = false,
    fishWonRadialForceKg = 0,
    dragBlockedForceKg = 0,
    lineTaut = false,
    lineTautRatio = null,
    fishBehaviorName = "unknown",
    shouldSlipDrag = false,
    hardLineLimit = false,
    dtSec = 0,
    nowMs = null,
    config = {},
  } = {}) {
    const mechanics = config || {};
    const dt = this.#positive(dtSec);
    const resolvedNowMs = this.#resolveNowMs({ nowMs, dtSec: dt });
    const resolvedPhase = this.#normalizePhase(phase);
    const activeDrain = this.#activeStaminaDrainCalculator.calculate({
      appliedRodHoldKg,
      appliedControlKg,
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

    return Object.freeze({
      source: "stamina_balance_frame",
      phase: resolvedPhase,
      staminaPhase: resolvedPhase,
      playerIsPulling: !!playerIsPulling,
      playerPowerIsPulling: !!playerIsPulling,
      fishTensionKg: activeDrain.fishTensionKg,
      appliedRodHoldKg: activeDrain.appliedRodHoldKg,
      appliedControlKg: activeDrain.appliedControlKg,
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
