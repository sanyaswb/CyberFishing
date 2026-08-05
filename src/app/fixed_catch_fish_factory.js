class FixedCatchFishFactory {
  #fishRarityResolver;
  #fishAnomalyVariantResolver;
  #fishVisualVariantResolver;

  constructor({
    fishRarityResolver,
    fishAnomalyVariantResolver,
    fishVisualVariantResolver,
  }) {
    if (!fishRarityResolver || typeof fishRarityResolver.resolve !== "function") {
      throw new TypeError("FixedCatchFishFactory requires fishRarityResolver");
    }
    if (
      !fishAnomalyVariantResolver ||
      typeof fishAnomalyVariantResolver.resolve !== "function"
    ) {
      throw new TypeError(
        "FixedCatchFishFactory requires fishAnomalyVariantResolver",
      );
    }
    if (
      !fishVisualVariantResolver ||
      typeof fishVisualVariantResolver.resolveImagePath !== "function"
    ) {
      throw new TypeError(
        "FixedCatchFishFactory requires fishVisualVariantResolver",
      );
    }
    this.#fishRarityResolver = fishRarityResolver;
    this.#fishAnomalyVariantResolver = fishAnomalyVariantResolver;
    this.#fishVisualVariantResolver = fishVisualVariantResolver;
  }

  create({
    template,
    weightKg,
    biteSequence,
    nameSuffix = " (TEST)",
    anomalyChanceOverride = null,
    locationId = "",
  }) {
    if (!template || typeof template !== "object") {
      throw new TypeError("FixedCatchFishFactory requires fish template");
    }
    const weightConfig = template.weightConfig || {};
    const anomalyId = this.#resolveAnomalyId({
      template,
      anomalyChanceOverride,
      locationId,
    });
    const profile = this.#fishRarityResolver.resolve({
      weightKg,
      weightConfig,
      depthConfig: template.depthConfig,
      baseAnomaly: anomalyId,
    });
    const levelRange = this.#findLevelRange(weightConfig, profile.level);
    const levelBasePower = Number.isFinite(Number(levelRange?.basePower))
      ? Number(levelRange.basePower)
      : 1;
    const trophyWeight = template.trophyWeightKg ?? template.trophyWeight;

    return {
      id: template.id,
      name: `${template.name}${nameSuffix}`,
      physics: {
        ...(template.physics || {}),
        levelBasePower,
      },
      level: profile.level,
      maxLevel: profile.maxLevel,
      levelAverageWeightKg: this.#resolveLevelAverageWeightKg(levelRange),
      weight: Number(weightKg) || 0,
      biteSequence,
      imagePath: this.#fishVisualVariantResolver.resolveImagePath({
        visual: template.visual,
        fishId: template.id,
        level: profile.level,
        isUnique: profile.isUnique,
        anomaly: profile.anomaly,
      }),
      isUnique: profile.isUnique,
      hasAnomaly: profile.hasAnomaly,
      isTrophy:
        trophyWeight !== undefined && trophyWeight !== null
          ? Number(weightKg) >= Number(trophyWeight)
          : false,
      anomaly: profile.anomaly,
      rarity: profile.rarity,
    };
  }

  #resolveAnomalyId({
    template,
    anomalyChanceOverride,
    locationId,
  }) {
    if (
      anomalyChanceOverride === null ||
      anomalyChanceOverride === undefined
    ) {
      return template.anomaly;
    }
    return this.#fishAnomalyVariantResolver.resolve({
      config: template.anomalyVariant,
      locationId,
      roll: 0,
      chanceOverride: anomalyChanceOverride,
    }).anomalyId;
  }

  #findLevelRange(weightConfig, level) {
    const ranges = weightConfig?.levelWeightRanges;
    return Array.isArray(ranges)
      ? ranges.find((range) => Number(range?.level) === Number(level)) || null
      : null;
  }

  #resolveLevelAverageWeightKg(range) {
    const rangeMin = Number(range?.min);
    const rangeMax = Number(range?.max);
    if (!Number.isFinite(rangeMin) || !Number.isFinite(rangeMax)) return null;
    return (Math.min(rangeMin, rangeMax) + Math.max(rangeMin, rangeMax)) / 2;
  }
}
