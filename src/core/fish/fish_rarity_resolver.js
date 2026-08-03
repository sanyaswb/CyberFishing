class FishRarityResolver {
  #weightBandsPerLevel;
  #maxHalfSteps;
  #unitsPerStar;
  #maxStars;
  #weightUnitsPerKg;
  #noneAnomalyIds;

  constructor(config = {}) {
    const scale = config.scale || config;
    const fishConfig = config.fish || config;
    this.#weightBandsPerLevel = Math.max(
      1,
      Math.round(
        Number(scale.fishWeightBands ?? scale.weightBandsPerLevel) || 7,
      ),
    );
    this.#maxHalfSteps = Math.max(
      1,
      Math.round(Number(scale.maxUnits ?? scale.maxHalfSteps) || 12),
    );
    this.#unitsPerStar = Math.max(
      1,
      Math.round(Number(scale.unitsPerStar) || 2),
    );
    this.#maxStars = this.#maxHalfSteps / this.#unitsPerStar;
    this.#weightUnitsPerKg = Math.max(
      1,
      Math.round(Number(scale.weightUnitsPerKg) || 1000),
    );
    this.#noneAnomalyIds = new Set(
      (Array.isArray(fishConfig.noneAnomalyIds)
        ? fishConfig.noneAnomalyIds
        : ["", "none"]
      ).map((value) => String(value || "").trim().toLowerCase()),
    );
  }

  resolve({
    weightKg,
    weightConfig = null,
    depthConfig = null,
    baseAnomaly = "none",
  } = {}) {
    const level = this.resolveLevel({
      weightKg,
      weightConfig,
      depthConfig,
    });
    return this.resolveForLevel({
      level,
      weightKg,
      weightConfig,
      depthConfig,
      baseAnomaly,
    });
  }

  resolveForLevel({
    level,
    weightKg,
    weightConfig = null,
    depthConfig = null,
    baseAnomaly = "none",
  } = {}) {
    const maxLevel = this.#resolveMaxLevel(weightConfig);
    const normalizedLevel = Math.min(
      maxLevel,
      Math.max(1, Math.round(Number(level) || 1)),
    );
    const rarityValues = this.#calculateRarity({
      level: normalizedLevel,
      weightKg,
      weightConfig,
      depthConfig,
    });
    const anomaly = this.#normalizeAnomalyId(baseAnomaly);
    const hasAnomaly = !this.#noneAnomalyIds.has(anomaly);
    const isUnique = hasAnomaly;
    const rarity = Object.freeze({
      ...rarityValues,
      isRarest: isUnique,
    });

    return Object.freeze({
      level: normalizedLevel,
      maxLevel,
      hasAnomaly,
      isUnique,
      anomaly,
      rarity,
    });
  }

  resolveLevel({ weightKg, weightConfig = null, depthConfig = null } = {}) {
    const weightUnit = this.#toWeightUnit(weightKg);
    const ranges = this.#normalizeRanges(weightConfig?.levelWeightRanges);
    if (ranges.length > 0) {
      if (!Number.isFinite(weightUnit)) return ranges[0].level;
      if (weightUnit <= ranges[0].minUnit) return ranges[0].level;

      for (let index = 0; index < ranges.length; index += 1) {
        const current = ranges[index];
        if (weightUnit >= current.minUnit && weightUnit <= current.maxUnit) {
          return current.level;
        }

        const next = ranges[index + 1];
        if (!next || weightUnit >= next.minUnit) continue;

        const lowerDistance = Math.max(0, weightUnit - current.maxUnit);
        const upperDistance = Math.max(0, next.minUnit - weightUnit);
        return upperDistance <= lowerDistance ? next.level : current.level;
      }

      return ranges[ranges.length - 1].level;
    }

    return this.#resolveDerivedLevel(weightKg, weightConfig, depthConfig);
  }

  resolveRarity({
    level,
    weightKg,
    weightConfig = null,
    depthConfig = null,
    baseAnomaly = "none",
  } = {}) {
    return this.resolveForLevel({
      level,
      weightKg,
      weightConfig,
      depthConfig,
      baseAnomaly,
    }).rarity;
  }

  #calculateRarity({
    level,
    weightKg,
    weightConfig = null,
    depthConfig = null,
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
    const isMaximum = halfSteps === this.#maxHalfSteps;

    return {
      isResolved: true,
      halfSteps,
      stars: Math.min(
        this.#maxStars,
        halfSteps / this.#unitsPerStar,
      ),
      maxHalfSteps: this.#maxHalfSteps,
      maxStars: this.#maxStars,
      unitsPerStar: this.#unitsPerStar,
      weightBand: bandIndex + 1,
      weightBandCount: this.#weightBandsPerLevel,
      levelMinWeightKg: range?.min ?? null,
      levelMaxWeightKg: range?.max ?? null,
      isMaximum,
    };
  }

  #resolveDerivedLevel(weightKg, weightConfig, depthConfig) {
    const maxLevel = this.#resolveMaxLevel(weightConfig);
    const weight = Number(weightKg);
    const globalMin = Number(depthConfig?.minWeightAtMinDepth);
    const globalMax = Number(depthConfig?.maxWeightAtMaxDepth);
    if (
      !Number.isFinite(weight) ||
      !Number.isFinite(globalMin) ||
      !Number.isFinite(globalMax) ||
      globalMin === globalMax
    ) {
      return 1;
    }

    const low = Math.min(globalMin, globalMax);
    const high = Math.max(globalMin, globalMax);
    const ratio = Math.max(0, Math.min(1, (weight - low) / (high - low)));
    return Math.max(1, Math.min(maxLevel, Math.round(ratio * maxLevel)));
  }

  #resolveMaxLevel(weightConfig) {
    const configured = Number(weightConfig?.maxLevel);
    if (Number.isFinite(configured)) return Math.max(1, Math.round(configured));

    const ranges = this.#normalizeRanges(weightConfig?.levelWeightRanges);
    return ranges.reduce((max, range) => Math.max(max, range.level), 1);
  }

  #resolveWeightBandIndex(weightKg, range) {
    const weightUnit = this.#toWeightUnit(weightKg);
    if (!range || !Number.isFinite(weightUnit)) return 0;

    const minUnit = this.#toWeightUnit(range.min);
    const maxUnit = this.#toWeightUnit(range.max);
    const clampedWeightUnit = Math.max(
      minUnit,
      Math.min(maxUnit, weightUnit),
    );
    const inclusiveUnits = maxUnit - minUnit + 1;
    if (!(inclusiveUnits > 0)) return 0;
    const bandWidth = Math.max(
      1,
      Math.ceil(inclusiveUnits / this.#weightBandsPerLevel),
    );
    return Math.min(
      this.#weightBandsPerLevel - 1,
      Math.floor((clampedWeightUnit - minUnit) / bandWidth),
    );
  }

  #resolveLevelRange(level, weightConfig, depthConfig) {
    const configuredRange = this.#normalizeRanges(
      weightConfig?.levelWeightRanges,
    ).find((range) => range.level === level);
    if (configuredRange) {
      return { min: configuredRange.min, max: configuredRange.max };
    }

    const globalMin = Number(depthConfig?.minWeightAtMinDepth);
    const globalMax = Number(depthConfig?.maxWeightAtMaxDepth);
    if (!Number.isFinite(globalMin) || !Number.isFinite(globalMax)) return null;

    const low = Math.min(globalMin, globalMax);
    const high = Math.max(globalMin, globalMax);
    const span = high - low;
    const maxLevel = this.#resolveMaxLevel(weightConfig);
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

  #normalizeRanges(ranges) {
    if (!Array.isArray(ranges)) return [];
    const normalized = [];
    for (const range of ranges) {
      const level = Number(range?.level);
      const min = Number(range?.min);
      const max = Number(range?.max);
      if (
        !Number.isFinite(level) ||
        !Number.isFinite(min) ||
        !Number.isFinite(max)
      ) {
        continue;
      }
      const low = Math.min(min, max);
      const high = Math.max(min, max);
      normalized.push({
        level: Math.max(1, Math.round(level)),
        min: low,
        max: high,
        minUnit: this.#toWeightUnit(low),
        maxUnit: this.#toWeightUnit(high),
      });
    }
    normalized.sort((left, right) => left.minUnit - right.minUnit);
    return normalized;
  }

  #toWeightUnit(weightKg) {
    const weight = Number(weightKg);
    if (!Number.isFinite(weight)) return NaN;
    return Math.floor(weight * this.#weightUnitsPerKg + 0.5 + 1e-9);
  }

  #normalizeAnomalyId(value) {
    const normalized = String(value || "none").trim().toLowerCase();
    return normalized || "none";
  }
}
