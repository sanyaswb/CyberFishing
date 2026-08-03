class FixedCatchFishFactory {
  #fishRarityResolver;
  #fishVisualVariantResolver;

  constructor({ fishRarityResolver, fishVisualVariantResolver }) {
    if (!fishRarityResolver || typeof fishRarityResolver.resolve !== "function") {
      throw new TypeError("FixedCatchFishFactory requires fishRarityResolver");
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
    this.#fishVisualVariantResolver = fishVisualVariantResolver;
  }

  create({
    template,
    weightKg,
    biteSequence,
    nameSuffix = " (TEST)",
    hasAnomaly = false,
  }) {
    if (!template || typeof template !== "object") {
      throw new TypeError("FixedCatchFishFactory requires fish template");
    }
    const weightConfig = template.weightConfig || {};
    const profile = this.#fishRarityResolver.resolve({
      weightKg,
      weightConfig,
      depthConfig: template.depthConfig,
      baseAnomaly: hasAnomaly
        ? template.anomalyVariant?.anomalyId
        : template.anomaly,
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
