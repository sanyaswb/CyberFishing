class StaminaRegenCalculator {
  calculate({
    recoveryAllowed = false,
    playerFatigueProgress = 0,
    lineAngleDeg = 0,
    baseRegenPerSecond = 20,
    dtSec = 0,
    config = {},
  } = {}) {
    const enabled = config.enabled !== false;
    const shouldRegen = enabled && recoveryAllowed === true;
    const angleFrame = this.#angleMultiplier({
      lineAngleDeg,
      config: config.angleMultiplier || {},
    });
    const fatigueFrame = this.#fatigueMultiplier({
      playerFatigueProgress,
      config: config.fatigueMultiplier || {},
    });
    const regenPerSecond = shouldRegen
      ? this.#positive(baseRegenPerSecond, 20) *
        angleFrame.angleRegenMultiplier *
        fatigueFrame.fatigueRegenMultiplier
      : 0;
    const staminaRegen = regenPerSecond * this.#positive(dtSec);

    return Object.freeze({
      shouldRegen,
      regenPerSecond,
      staminaRegen,
      lineAngleDeg: angleFrame.lineAngleDeg,
      angleRegenMultiplier: angleFrame.angleRegenMultiplier,
      fatigueRegenMultiplier: fatigueFrame.fatigueRegenMultiplier,
      playerFatigueProgress: fatigueFrame.playerFatigueProgress,
    });
  }

  #angleMultiplier({ lineAngleDeg, config }) {
    const angle = this.#positive(lineAngleDeg);
    if (config.enabled === false) {
      return Object.freeze({
        lineAngleDeg: angle,
        angleRegenMultiplier: 1,
      });
    }
    const centerAngle = this.#positive(config.centerAngleDeg, 15);
    const sideAngle = Math.max(
      centerAngle,
      this.#positive(config.sideAngleDeg ?? config.badAngleDeg, 75),
    );
    const edgeAngle = Math.max(
      sideAngle,
      this.#positive(config.edgeAngleDeg ?? config.extremeAngleDeg, 90),
    );
    const centerMultiplier = this.#positive(
      config.centerMultiplier ?? config.minCenterMultiplier,
      1,
    );
    const sideMultiplier = this.#positive(
      config.sideMultiplier ?? config.badAngleMultiplier,
      1.5,
    );
    const edgeMultiplier = this.#positive(
      config.edgeMultiplier ?? config.extremeAngleMultiplier,
      2,
    );

    if (angle <= centerAngle) {
      return Object.freeze({
        lineAngleDeg: angle,
        angleRegenMultiplier: centerMultiplier,
      });
    }
    if (angle <= sideAngle) {
      return Object.freeze({
        lineAngleDeg: angle,
        angleRegenMultiplier: this.#lerp(
          centerMultiplier,
          sideMultiplier,
          (angle - centerAngle) / Math.max(0.000001, sideAngle - centerAngle),
        ),
      });
    }
    return Object.freeze({
      lineAngleDeg: angle,
      angleRegenMultiplier: this.#lerp(
        sideMultiplier,
        edgeMultiplier,
        (Math.min(angle, edgeAngle) - sideAngle) /
          Math.max(0.000001, edgeAngle - sideAngle),
      ),
    });
  }

  #fatigueMultiplier({ playerFatigueProgress, config }) {
    const progress = this.#clamp01(playerFatigueProgress);
    if (config.enabled === false) {
      return Object.freeze({
        playerFatigueProgress: progress,
        fatigueRegenMultiplier: 1,
      });
    }
    return Object.freeze({
      playerFatigueProgress: progress,
      fatigueRegenMultiplier:
        1 + progress * this.#positive(config.maxBonusMultiplier, 1),
    });
  }

  #lerp(a, b, t) {
    return a + (b - a) * this.#clamp01(t);
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
  window.StaminaRegenCalculator = StaminaRegenCalculator;
}
