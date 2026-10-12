import { clampUnitFinite, nonNegativeOr } from "../../../../engine/math/number_normalization.js";

export class StaminaDrainCalculator {
  calculate({
    playerStaminaPressureKg = 0,
    fishStaminaResistanceKg = 0,
    pressureThresholdKg = 0.01,
    baseDrainPerSecond = 100,
    dtSec = 0,
    config = {},
  } = {}) {
    const enabled = config.enabled !== false;
    const pressure = nonNegativeOr(playerStaminaPressureKg);
    const resistance = nonNegativeOr(fishStaminaResistanceKg);
    const threshold = nonNegativeOr(pressureThresholdKg, 0.01);
    const shouldDrain = enabled && pressure > threshold;
    const advantageConfig = config.advantageDrain || {};
    const denominator = Math.max(0.000001, pressure + resistance);
    const playerAdvantageRatio = pressure / denominator;
    const minAdvantageRatio = clampUnitFinite(
      advantageConfig.minAdvantageRatio ?? 0.1,
    );
    const maxAdvantageRatio = Math.max(
      minAdvantageRatio + 0.000001,
      clampUnitFinite(advantageConfig.maxAdvantageRatio ?? 0.9),
    );
    const clampedAdvantageRatio = Math.max(
      minAdvantageRatio,
      Math.min(maxAdvantageRatio, playerAdvantageRatio),
    );
    const normalizedRatio =
      (clampedAdvantageRatio - minAdvantageRatio) /
      (maxAdvantageRatio - minAdvantageRatio);
    const minDrainMultiplier = nonNegativeOr(
      advantageConfig.minDrainMultiplier,
      0.25,
    );
    const maxDrainMultiplier = Math.max(
      minDrainMultiplier,
      nonNegativeOr(advantageConfig.maxDrainMultiplier, 1),
    );
    const curvePower = Math.max(
      0.001,
      nonNegativeOr(advantageConfig.curvePower, 1),
    );
    const drainMultiplier =
      shouldDrain && advantageConfig.enabled !== false
        ? minDrainMultiplier +
          Math.pow(normalizedRatio, curvePower) *
            (maxDrainMultiplier - minDrainMultiplier)
        : shouldDrain
          ? 1
          : 0;
    const drainPerSecond = shouldDrain
      ? nonNegativeOr(baseDrainPerSecond, 100) * drainMultiplier
      : 0;
    const staminaDrain = drainPerSecond * nonNegativeOr(dtSec);

    return Object.freeze({
      shouldDrain,
      drainPerSecond,
      staminaDrain,
      playerAdvantageRatio,
      clampedAdvantageRatio,
      normalizedRatio: shouldDrain ? normalizedRatio : 0,
      drainMultiplier,
      pressureThresholdKg: threshold,
      playerStaminaPressureKg: pressure,
      fishStaminaResistanceKg: resistance,
    });
  }
}
