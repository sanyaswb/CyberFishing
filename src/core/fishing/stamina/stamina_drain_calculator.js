class StaminaDrainCalculator {
  calculate({
    playerStaminaPressureKg = 0,
    fishStaminaResistanceKg = 0,
    pressureThresholdKg = 0.01,
    baseDrainPerSecond = 100,
    dtSec = 0,
    config = {},
  } = {}) {
    const enabled = config.enabled !== false;
    const pressure = this.#positive(playerStaminaPressureKg);
    const resistance = this.#positive(fishStaminaResistanceKg);
    const threshold = this.#positive(pressureThresholdKg, 0.01);
    const shouldDrain = enabled && pressure > threshold;
    const advantageConfig = config.advantageDrain || {};
    const denominator = Math.max(0.000001, pressure + resistance);
    const playerAdvantageRatio = pressure / denominator;
    const minAdvantageRatio = this.#clamp01(
      advantageConfig.minAdvantageRatio ?? 0.1,
    );
    const maxAdvantageRatio = Math.max(
      minAdvantageRatio + 0.000001,
      this.#clamp01(advantageConfig.maxAdvantageRatio ?? 0.9),
    );
    const clampedAdvantageRatio = Math.max(
      minAdvantageRatio,
      Math.min(maxAdvantageRatio, playerAdvantageRatio),
    );
    const normalizedRatio =
      (clampedAdvantageRatio - minAdvantageRatio) /
      (maxAdvantageRatio - minAdvantageRatio);
    const minDrainMultiplier = this.#positive(
      advantageConfig.minDrainMultiplier,
      0.25,
    );
    const maxDrainMultiplier = Math.max(
      minDrainMultiplier,
      this.#positive(advantageConfig.maxDrainMultiplier, 1),
    );
    const curvePower = Math.max(
      0.001,
      this.#positive(advantageConfig.curvePower, 1),
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
      ? this.#positive(baseDrainPerSecond, 100) * drainMultiplier
      : 0;
    const staminaDrain = drainPerSecond * this.#positive(dtSec);

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
  window.StaminaDrainCalculator = StaminaDrainCalculator;
}
