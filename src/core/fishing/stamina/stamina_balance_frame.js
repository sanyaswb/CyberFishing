class StaminaBalanceFrame {
  #activeDrainCalculator;
  #angleRecoveryCalculator;
  #passiveDrainCalculator;

  constructor({
    activeDrainCalculator = new ActiveStaminaDrainCalculator(),
    angleRecoveryCalculator = new AngleStaminaRecoveryCalculator(),
    passiveDrainCalculator = typeof PassiveStaminaDrainCalculator !== "undefined"
      ? new PassiveStaminaDrainCalculator()
      : null,
  } = {}) {
    this.#activeDrainCalculator = activeDrainCalculator;
    this.#angleRecoveryCalculator = angleRecoveryCalculator;
    this.#passiveDrainCalculator = passiveDrainCalculator;
  }

  create({
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
    const passiveDrain = this.#passiveDrainCalculator?.calculate?.({
      fishWonRadialForceKg,
      dragBlockedForceKg,
      lineTaut,
      lineTautRatio,
      fishBehaviorName,
      weakestTackleLimitKg: activeDrain.weakestTackleLimitKg,
      shouldSlipDrag,
      hardLineLimit,
      dtSec,
      config: mechanics.passiveDrain || {},
    }) || this.#disabledPassiveDrain();
    const allowRegenWhilePulling =
      mechanics.angleRecovery?.allowStaminaRegenWhilePulling === true;
    const totalStaminaDrain =
      activeDrain.activeStaminaDrain + passiveDrain.passiveStaminaDrain;
    const totalStaminaDrainPerSecond =
      activeDrain.activeDrainPerSecond + passiveDrain.passiveDrainPerSecond;
    const rawNetStaminaChange =
      angleRecovery.angleStaminaRegen - totalStaminaDrain;
    const regenBlockedByPull =
      !!playerIsPulling &&
      !allowRegenWhilePulling &&
      rawNetStaminaChange > 0;
    const netStaminaChange = regenBlockedByPull ? 0 : rawNetStaminaChange;
    const dt = this.#positive(dtSec);
    const netStaminaPerSecond =
      dt > 0 ? netStaminaChange / dt : 0;
    const passiveDrainEnabled = passiveDrain.enabled === true;

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
      passiveDrainRatio: passiveDrain.passiveDrainRatio,
      curvedPassiveDrainRatio: passiveDrain.curvedPassiveDrainRatio,
      passiveDrainPerSecond: passiveDrain.passiveDrainPerSecond,
      passiveStaminaDrain: passiveDrain.passiveStaminaDrain,
      fishWonRadialForceKg: passiveDrain.fishWonRadialForceKg,
      dragBlockedForceKg: passiveDrain.dragBlockedForceKg,
      passiveResistanceRatio: passiveDrain.resistanceRatio,
      passiveFishEffortRatio: passiveDrain.fishEffortRatio,
      lineTaut: passiveDrain.lineTaut,
      lineTautRatio: passiveDrain.lineTautRatio,
      rawLineTautRatio: passiveDrain.rawLineTautRatio,
      fishBehaviorName: passiveDrain.fishBehaviorName,
      passiveBehaviorMultiplier: passiveDrain.behaviorMultiplier,
      shouldSlipDrag: passiveDrain.shouldSlipDrag,
      hardLineLimit: passiveDrain.hardLineLimit,
      totalStaminaDrain,
      totalStaminaDrainPerSecond,
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
      passiveDrain,
      angleRecovery,
      angleStressRatio: angleRecovery.angleRecoveryRatio,
      staminaPressureRatio: activeDrain.activeDrainRatio,
    });
  }

  #disabledPassiveDrain() {
    return Object.freeze({
      enabled: false,
      fishWonRadialForceKg: 0,
      dragBlockedForceKg: 0,
      weakestTackleLimitKg: 0,
      lineTaut: false,
      rawLineTautRatio: 0,
      lineTautRatio: 0,
      lineTautThresholdRatio: 0,
      fishBehaviorName: "unknown",
      behaviorMultiplier: 0,
      fishEffortRatio: 0,
      resistanceRatio: 0,
      shouldSlipDrag: false,
      hardLineLimit: false,
      slippingDragMultiplier: 1,
      hardLimitMultiplier: 1,
      rawPassiveDrainRatio: 0,
      passiveDrainRatio: 0,
      curvedPassiveDrainRatio: 0,
      passiveDrainPerSecond: 0,
      passiveStaminaDrain: 0,
      curvePower: 1,
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
