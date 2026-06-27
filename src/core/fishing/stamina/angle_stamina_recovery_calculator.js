// Deprecated compatibility calculator. New stamina uses
// StaminaAngleRegenMultiplierCalculator to scale passive recovery.
class AngleStaminaRecoveryCalculator {
  calculate({
    lineAngleDeg = 0,
    dtSec = 0,
    config = {},
  } = {}) {
    const enabled = config.enabled !== false;
    const angleDeg = this.#positive(lineAngleDeg);
    const safeAngleDeg = this.#positive(config.safeAngleDeg, 15);
    const maxRecoveryAngleDeg = Math.max(
      safeAngleDeg + 0.000001,
      this.#positive(config.maxRecoveryAngleDeg, 75),
    );
    const middleMaxRecoveryRatio = this.#clamp01(
      config.middleMaxRecoveryRatio ?? 0.5,
    );
    const regenPerSecondBase = enabled
      ? this.#positive(config.regenPerSecond, 40)
      : 0;
    const curvePower = Math.max(0.001, this.#positive(config.curvePower, 1));
    const dt = this.#positive(dtSec);
    const middleProgress = this.#middleProgress({
      angleDeg,
      safeAngleDeg,
      maxRecoveryAngleDeg,
      curvePower,
    });
    const angleRecoveryRatio = this.#recoveryRatio({
      angleDeg,
      safeAngleDeg,
      maxRecoveryAngleDeg,
      middleProgress,
      middleMaxRecoveryRatio,
    });
    const angleRegenPerSecond = regenPerSecondBase * angleRecoveryRatio;
    const angleStaminaRegen = angleRegenPerSecond * dt;

    return Object.freeze({
      enabled,
      lineAngleDeg: angleDeg,
      safeAngleDeg,
      maxRecoveryAngleDeg,
      middleMaxRecoveryRatio,
      middleProgress,
      angleRecoveryRatio,
      angleRegenPerSecond,
      angleStaminaRegen,
      curvePower,
    });
  }

  #middleProgress({
    angleDeg,
    safeAngleDeg,
    maxRecoveryAngleDeg,
    curvePower,
  }) {
    if (angleDeg <= safeAngleDeg || angleDeg >= maxRecoveryAngleDeg) {
      return 0;
    }
    const raw =
      (angleDeg - safeAngleDeg) /
      Math.max(0.000001, maxRecoveryAngleDeg - safeAngleDeg);
    return Math.pow(this.#clamp01(raw), curvePower);
  }

  #recoveryRatio({
    angleDeg,
    safeAngleDeg,
    maxRecoveryAngleDeg,
    middleProgress,
    middleMaxRecoveryRatio,
  }) {
    if (angleDeg <= safeAngleDeg) return 0;
    if (angleDeg >= maxRecoveryAngleDeg) return 1;
    return this.#clamp01(middleProgress * middleMaxRecoveryRatio);
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
  window.AngleStaminaRecoveryCalculator = AngleStaminaRecoveryCalculator;
}
