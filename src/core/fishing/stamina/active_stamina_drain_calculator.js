class ActiveStaminaDrainCalculator {
  calculate({
    appliedRodHoldKg = 0,
    appliedControlKg = 0,
    fishTensionKg = 0,
    weakestTackleLimitKg = 0,
    dtSec = 0,
    config = {},
  } = {}) {
    const enabled = config.enabled !== false;
    const rodHold = this.#positive(appliedRodHoldKg);
    const control = this.#positive(appliedControlKg);
    const fishTension = this.#positive(fishTensionKg);
    const weakestLimit = this.#positive(weakestTackleLimitKg);
    const lateralWeight = this.#positive(config.lateralStaminaWeight, 0.5);
    const drainPerSecondBase = enabled
      ? this.#positive(config.drainPerSecond, 100)
      : 0;
    const curvePower = Math.max(0.001, this.#positive(config.curvePower, 1));
    const dt = this.#positive(dtSec);
    const rawAppliedPlayerPressureKg = rodHold + control;
    const availablePlayerPressureKg = Math.max(
      0,
      weakestLimit - fishTension,
    );
    const budgetOverflow =
      weakestLimit > 0 &&
      rawAppliedPlayerPressureKg > availablePlayerPressureKg + 0.000001;
    const budgetScale =
      budgetOverflow && rawAppliedPlayerPressureKg > 0
        ? availablePlayerPressureKg / rawAppliedPlayerPressureKg
        : 1;
    const budgetedRodHoldKg = rodHold * budgetScale;
    const budgetedControlKg = control * budgetScale;
    const usedPlayerPressureKg =
      budgetedRodHoldKg + budgetedControlKg * lateralWeight;
    const activeDrainRatio =
      weakestLimit > 0
        ? this.#clamp01(usedPlayerPressureKg / weakestLimit)
        : 0;
    const curvedActiveDrainRatio = Math.pow(activeDrainRatio, curvePower);
    const activeDrainPerSecond =
      drainPerSecondBase * curvedActiveDrainRatio;
    const activeStaminaDrain = activeDrainPerSecond * dt;

    return Object.freeze({
      enabled,
      appliedRodHoldKg: rodHold,
      appliedControlKg: control,
      budgetedRodHoldKg,
      budgetedControlKg,
      rawAppliedPlayerPressureKg,
      availablePlayerPressureKg,
      budgetOverflow,
      budgetScale,
      fishTensionKg: fishTension,
      weakestTackleLimitKg: weakestLimit,
      lateralStaminaWeight: lateralWeight,
      usedPlayerPressureKg,
      activeDrainRatio,
      curvedActiveDrainRatio,
      activeDrainPerSecond,
      activeStaminaDrain,
      curvePower,
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

  #clamp01(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.max(0, Math.min(1, number));
  }
}

if (typeof window !== "undefined") {
  window.ActiveStaminaDrainCalculator = ActiveStaminaDrainCalculator;
}
