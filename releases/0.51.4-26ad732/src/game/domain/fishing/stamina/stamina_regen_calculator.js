import { clampUnitFinite, nonNegativeOr } from "../../../../engine/math/number_normalization.js";

export class StaminaRegenCalculator {
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
      ? nonNegativeOr(baseRegenPerSecond, 20) *
        angleFrame.angleRegenMultiplier *
        fatigueFrame.fatigueRegenMultiplier
      : 0;
    const staminaRegen = regenPerSecond * nonNegativeOr(dtSec);

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
    const angle = nonNegativeOr(lineAngleDeg);
    if (config.enabled === false) {
      return Object.freeze({
        lineAngleDeg: angle,
        angleRegenMultiplier: 1,
      });
    }
    const centerAngle = nonNegativeOr(config.centerAngleDeg, 15);
    const sideAngle = Math.max(
      centerAngle,
      nonNegativeOr(config.sideAngleDeg ?? config.badAngleDeg, 75),
    );
    const edgeAngle = Math.max(
      sideAngle,
      nonNegativeOr(config.edgeAngleDeg ?? config.extremeAngleDeg, 90),
    );
    const centerMultiplier = nonNegativeOr(
      config.centerMultiplier ?? config.minCenterMultiplier,
      1,
    );
    const sideMultiplier = nonNegativeOr(
      config.sideMultiplier ?? config.badAngleMultiplier,
      1.5,
    );
    const edgeMultiplier = nonNegativeOr(
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
    const progress = clampUnitFinite(playerFatigueProgress);
    if (config.enabled === false) {
      return Object.freeze({
        playerFatigueProgress: progress,
        fatigueRegenMultiplier: 1,
      });
    }
    return Object.freeze({
      playerFatigueProgress: progress,
      fatigueRegenMultiplier:
        1 + progress * nonNegativeOr(config.maxBonusMultiplier, 1),
    });
  }

  #lerp(a, b, t) {
    return a + (b - a) * clampUnitFinite(t);
  }
}
