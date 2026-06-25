class StaminaBalanceFrame {
  #activeDrainCalculator;
  #angleRecoveryCalculator;

  constructor({
    activeDrainCalculator = new ActiveStaminaDrainCalculator(),
    angleRecoveryCalculator = new AngleStaminaRecoveryCalculator(),
  } = {}) {
    this.#activeDrainCalculator = activeDrainCalculator;
    this.#angleRecoveryCalculator = angleRecoveryCalculator;
  }

  create({
    playerIsPulling = false,
    fishTensionKg = 0,
    appliedRodHoldKg = 0,
    appliedControlKg = 0,
    weakestTackleLimitKg = 0,
    lineAngleDeg = 0,
    isLineFullyExtended = false,
    dtSec = 0,
    config = {},
  } = {}) {
    const mechanics = config || {};
    const activeDrain = this.#activeDrainCalculator.calculate({
      appliedRodHoldKg,
      appliedControlKg,
      fishTensionKg,
      weakestTackleLimitKg,
      dtSec,
      config: mechanics.activeDrain || {},
    });
    const angleRecovery = this.#angleRecoveryCalculator.calculate({
      lineAngleDeg,
      dtSec,
      config: mechanics.angleRecovery || {},
    });
    const allowRegenWhilePulling =
      mechanics.angleRecovery?.allowStaminaRegenWhilePulling === true;
    const rawNetStaminaChange =
      angleRecovery.angleStaminaRegen - activeDrain.activeStaminaDrain;
    const regenBlockedByPull =
      !!playerIsPulling &&
      !allowRegenWhilePulling &&
      rawNetStaminaChange > 0;
    const netStaminaChange = regenBlockedByPull ? 0 : rawNetStaminaChange;
    const dt = this.#positive(dtSec);
    const netStaminaPerSecond =
      dt > 0 ? netStaminaChange / dt : 0;
    const passiveDrainEnabled = mechanics.passiveDrain?.enabled === true;

    return Object.freeze({
      source: "stamina_balance_frame",
      playerIsPulling: !!playerIsPulling,
      playerPowerIsPulling: !!playerIsPulling,
      fishTensionKg: activeDrain.fishTensionKg,
      appliedRodHoldKg: activeDrain.appliedRodHoldKg,
      appliedControlKg: activeDrain.appliedControlKg,
      budgetedRodHoldKg: activeDrain.budgetedRodHoldKg,
      budgetedControlKg: activeDrain.budgetedControlKg,
      weakestTackleLimitKg: activeDrain.weakestTackleLimitKg,
      lineAngleDeg: angleRecovery.lineAngleDeg,
      isLineFullyExtended: !!isLineFullyExtended,
      dtSec: dt,
      lateralStaminaWeight: activeDrain.lateralStaminaWeight,
      rawAppliedPlayerPressureKg: activeDrain.rawAppliedPlayerPressureKg,
      availablePlayerPressureKg: activeDrain.availablePlayerPressureKg,
      usedPlayerPressureKg: activeDrain.usedPlayerPressureKg,
      activeDrainRatio: activeDrain.activeDrainRatio,
      curvedActiveDrainRatio: activeDrain.curvedActiveDrainRatio,
      activeDrainPerSecond: activeDrain.activeDrainPerSecond,
      activeStaminaDrain: activeDrain.activeStaminaDrain,
      angleRecoveryRatio: angleRecovery.angleRecoveryRatio,
      angleRegenPerSecond: angleRecovery.angleRegenPerSecond,
      angleStaminaRegen: angleRecovery.angleStaminaRegen,
      rawNetStaminaChange,
      netStaminaChange,
      netStaminaPerSecond,
      allowStaminaRegenWhilePulling: allowRegenWhilePulling,
      regenBlockedByPull,
      passiveDrainEnabled,
      budgetOverflowWarning: activeDrain.budgetOverflow,
      budgetOverflow: activeDrain.budgetOverflow,
      budgetScale: activeDrain.budgetScale,
      activeDrain,
      angleRecovery,
      angleStressRatio: angleRecovery.angleRecoveryRatio,
      staminaPressureRatio: activeDrain.activeDrainRatio,
    });
  }

  #positive(value, fallback = 0) {
    const number = Number(value);
    if (Number.isFinite(number) && number >= 0) return number;
    const safeFallback = Number(fallback);
    return Number.isFinite(safeFallback) && safeFallback >= 0
      ? safeFallback
      : 0;
  }
}

if (typeof window !== "undefined") {
  window.StaminaBalanceFrame = StaminaBalanceFrame;
}
