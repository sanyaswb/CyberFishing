class PassiveStaminaRegenCalculator {
  #angleMultiplierCalculator;
  #lastPressureTimeMs = null;

  constructor({
    angleMultiplierCalculator = new StaminaAngleRegenMultiplierCalculator(),
  } = {}) {
    this.#angleMultiplierCalculator = angleMultiplierCalculator;
  }

  calculate({
    usedPlayerPressureKg = 0,
    lineAngleDeg = 0,
    dtSec = 0,
    nowMs = 0,
    config = {},
  } = {}) {
    const enabled = config.enabled !== false;
    const pressureKg = this.#positive(usedPlayerPressureKg);
    const thresholdKg = this.#positive(config.pressureThresholdKg, 0.01);
    const isPressuring = pressureKg > thresholdKg;
    const regenPerSecondBase = enabled
      ? this.#positive(config.regenPerSecond, 20)
      : 0;
    const dt = this.#positive(dtSec);
    const angleMultiplierFrame = this.#angleMultiplierCalculator.calculate({
      lineAngleDeg,
      config: config.angleMultiplier || {},
    });
    const delayFrame = this.#delayFrame({
      isPressuring,
      nowMs,
      config: config.delay || {},
    });
    const allowWhilePressuring = config.allowWhilePressuring === true;
    const blockedByPressure = isPressuring && !allowWhilePressuring;
    const canRegen =
      enabled &&
      !blockedByPressure &&
      !delayFrame.regenDelayActive;
    const passiveRegenPerSecond = canRegen
      ? regenPerSecondBase * angleMultiplierFrame.angleRegenMultiplier
      : 0;
    const passiveStaminaRegen = passiveRegenPerSecond * dt;

    return Object.freeze({
      enabled,
      usedPlayerPressureKg: pressureKg,
      pressureThresholdKg: thresholdKg,
      pressureActive: isPressuring,
      allowWhilePressuring,
      blockedByPressure,
      regenDelayActive: delayFrame.regenDelayActive,
      delayEnabled: delayFrame.delayEnabled,
      delayAfterPressureMs: delayFrame.delayAfterPressureMs,
      lastPressureTimeMs: delayFrame.lastPressureTimeMs,
      nowMs: delayFrame.nowMs,
      lineAngleDeg: angleMultiplierFrame.lineAngleDeg,
      angleRegenMultiplier:
        angleMultiplierFrame.angleRegenMultiplier,
      angleMultiplier: angleMultiplierFrame,
      passiveRegenPerSecond,
      passiveStaminaRegen,
      dtSec: dt,
    });
  }

  #delayFrame({ isPressuring, nowMs, config }) {
    const delayEnabled = config.enabled === true;
    const delayAfterPressureMs = this.#positive(
      config.delayAfterPressureMs,
      500,
    );
    const resolvedNowMs = this.#positive(nowMs);

    if (isPressuring) {
      this.#lastPressureTimeMs = resolvedNowMs;
    }

    const lastPressureTimeMs = this.#lastPressureTimeMs;
    const regenDelayActive =
      delayEnabled &&
      lastPressureTimeMs !== null &&
      resolvedNowMs - lastPressureTimeMs < delayAfterPressureMs;

    return Object.freeze({
      delayEnabled,
      delayAfterPressureMs,
      nowMs: resolvedNowMs,
      lastPressureTimeMs,
      regenDelayActive,
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
  window.PassiveStaminaRegenCalculator = PassiveStaminaRegenCalculator;
}
