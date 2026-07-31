class FishRarityCalculator {
  #weightBandsPerLevel;
  #maxHalfSteps;
  #maxStars;
  #weightUnitsPerKg;
  #noneAnomalyIds;

  constructor(config = {}) {
    this.#weightBandsPerLevel = Math.max(
      1,
      Math.round(Number(config.weightBandsPerLevel) || 7),
    );
    this.#maxHalfSteps = Math.max(
      1,
      Math.round(Number(config.maxHalfSteps) || 12),
    );
    this.#maxStars = Math.max(
      1,
      Math.round(Number(config.maxStars) || 6),
    );
    this.#weightUnitsPerKg = Math.max(
      1,
      Math.round(Number(config.weightUnitsPerKg) || 1000),
    );
    this.#noneAnomalyIds = new Set(
      (Array.isArray(config.noneAnomalyIds)
        ? config.noneAnomalyIds
        : ["", "none"]
      ).map((value) => String(value || "").trim().toLowerCase()),
    );
  }

  calculate({
    level,
    weightKg,
    weightConfig = null,
    depthConfig = null,
    isUnique = false,
    anomaly = "none",
  } = {}) {
    const normalizedLevel = Math.max(1, Math.round(Number(level) || 1));
    const range = this.#resolveLevelRange(
      normalizedLevel,
      weightConfig,
      depthConfig,
    );
    const bandIndex = this.#resolveWeightBandIndex(weightKg, range);
    const halfSteps = Math.max(
      1,
      Math.min(this.#maxHalfSteps, normalizedLevel + bandIndex),
    );
    const anomalyId = String(anomaly || "none").trim().toLowerCase();
    const hasAnomaly = isUnique === true || !this.#noneAnomalyIds.has(anomalyId);
    const isCrown = halfSteps === this.#maxHalfSteps;

    return Object.freeze({
      halfSteps,
      stars: Math.min(this.#maxStars, halfSteps / 2),
      maxHalfSteps: this.#maxHalfSteps,
      maxStars: this.#maxStars,
      weightBand: bandIndex + 1,
      weightBandCount: this.#weightBandsPerLevel,
      levelMinWeightKg: range?.min ?? null,
      levelMaxWeightKg: range?.max ?? null,
      isCrown,
      isRarest: isCrown && hasAnomaly,
    });
  }

  #resolveWeightBandIndex(weightKg, range) {
    const weight = Number(weightKg);
    if (!range || !Number.isFinite(weight)) return 0;

    const minUnit = Math.round(range.min * this.#weightUnitsPerKg);
    const maxUnit = Math.round(range.max * this.#weightUnitsPerKg);
    const weightUnit = Math.max(
      minUnit,
      Math.min(maxUnit, Math.round(weight * this.#weightUnitsPerKg)),
    );
    const inclusiveUnits = maxUnit - minUnit + 1;
    if (!(inclusiveUnits > 0)) return 0;
    const bandWidth = Math.max(
      1,
      Math.ceil(inclusiveUnits / this.#weightBandsPerLevel),
    );
    return Math.min(
      this.#weightBandsPerLevel - 1,
      Math.floor((weightUnit - minUnit) / bandWidth),
    );
  }

  #resolveLevelRange(level, weightConfig, depthConfig) {
    const configuredRange = this.#findConfiguredRange(
      level,
      weightConfig?.levelWeightRanges,
    );
    if (configuredRange) return configuredRange;

    const globalMin = Number(depthConfig?.minWeightAtMinDepth);
    const globalMax = Number(depthConfig?.maxWeightAtMaxDepth);
    if (!Number.isFinite(globalMin) || !Number.isFinite(globalMax)) return null;

    const low = Math.min(globalMin, globalMax);
    const high = Math.max(globalMin, globalMax);
    const span = high - low;
    const maxLevel = Math.max(
      1,
      Math.round(Number(weightConfig?.maxLevel) || level),
    );
    const clampedLevel = Math.min(maxLevel, level);
    const lowerRatio =
      clampedLevel === 1 ? 0 : (clampedLevel - 0.5) / maxLevel;
    const upperRatio =
      clampedLevel === maxLevel ? 1 : (clampedLevel + 0.5) / maxLevel;

    return {
      min: low + span * lowerRatio,
      max: low + span * upperRatio,
    };
  }

  #findConfiguredRange(level, ranges) {
    if (!Array.isArray(ranges)) return null;
    const match = ranges.find(
      (range) => Number(range?.level) === Number(level),
    );
    const rangeMin = Number(match?.min);
    const rangeMax = Number(match?.max);
    if (!Number.isFinite(rangeMin) || !Number.isFinite(rangeMax)) return null;

    return {
      min: Math.min(rangeMin, rangeMax),
      max: Math.max(rangeMin, rangeMax),
    };
  }
}
