class StaminaAngleRegenMultiplierCalculator {
  calculate({ lineAngleDeg = 0, config = {} } = {}) {
    const enabled = config.enabled !== false;
    const angleDeg = this.#positive(lineAngleDeg);
    const centerAngleDeg = Math.max(
      0.000001,
      this.#positive(config.centerAngleDeg, 15),
    );
    const badAngleDeg = Math.max(
      centerAngleDeg + 0.000001,
      this.#positive(config.badAngleDeg, 75),
    );
    const extremeAngleDeg = Math.max(
      badAngleDeg + 0.000001,
      this.#positive(config.extremeAngleDeg, 90),
    );
    const minCenterMultiplier = this.#positive(
      config.minCenterMultiplier,
      0.3,
    );
    const badAngleMultiplier = this.#positive(
      config.badAngleMultiplier,
      1.5,
    );
    const extremeAngleMultiplier = this.#positive(
      config.extremeAngleMultiplier,
      2.0,
    );
    const multiplier = enabled
      ? this.#multiplier({
          angleDeg,
          centerAngleDeg,
          badAngleDeg,
          extremeAngleDeg,
          minCenterMultiplier,
          badAngleMultiplier,
          extremeAngleMultiplier,
        })
      : 1;

    return Object.freeze({
      enabled,
      lineAngleDeg: angleDeg,
      centerAngleDeg,
      minCenterMultiplier,
      badAngleDeg,
      badAngleMultiplier,
      extremeAngleDeg,
      extremeAngleMultiplier,
      angleRegenMultiplier: multiplier,
    });
  }

  #multiplier({
    angleDeg,
    centerAngleDeg,
    badAngleDeg,
    extremeAngleDeg,
    minCenterMultiplier,
    badAngleMultiplier,
    extremeAngleMultiplier,
  }) {
    if (angleDeg <= centerAngleDeg) {
      const progress = this.#clamp01(angleDeg / centerAngleDeg);
      return (
        minCenterMultiplier + progress * (1 - minCenterMultiplier)
      );
    }

    if (angleDeg <= badAngleDeg) {
      const progress = this.#clamp01(
        (angleDeg - centerAngleDeg) / (badAngleDeg - centerAngleDeg),
      );
      return 1 + progress * (badAngleMultiplier - 1);
    }

    if (angleDeg <= extremeAngleDeg) {
      const progress = this.#clamp01(
        (angleDeg - badAngleDeg) / (extremeAngleDeg - badAngleDeg),
      );
      return (
        badAngleMultiplier +
        progress * (extremeAngleMultiplier - badAngleMultiplier)
      );
    }

    return extremeAngleMultiplier;
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
  window.StaminaAngleRegenMultiplierCalculator =
    StaminaAngleRegenMultiplierCalculator;
}
