class HookedFishProfileSynchronizer {
  #fishRarityResolver;
  #fishVisualVariantResolver;

  constructor({ fishRarityResolver, fishVisualVariantResolver }) {
    if (!fishRarityResolver || typeof fishRarityResolver.resolve !== "function") {
      throw new TypeError(
        "HookedFishProfileSynchronizer requires fishRarityResolver",
      );
    }
    if (
      !fishVisualVariantResolver ||
      typeof fishVisualVariantResolver.resolveImagePath !== "function"
    ) {
      throw new TypeError(
        "HookedFishProfileSynchronizer requires fishVisualVariantResolver",
      );
    }
    this.#fishRarityResolver = fishRarityResolver;
    this.#fishVisualVariantResolver = fishVisualVariantResolver;
  }

  synchronize({ fish, template, changedKey }) {
    if (!fish || !template) return null;
    const ranges = template.weightConfig?.levelWeightRanges;
    if (!Array.isArray(ranges) || ranges.length === 0) return null;

    let range = null;
    let profile = null;
    if (changedKey === "weight") {
      profile = this.#fishRarityResolver.resolve({
        weightKg: fish.weight,
        weightConfig: template.weightConfig,
        depthConfig: template.depthConfig,
        baseAnomaly: fish.anomaly,
      });
      range = this.#findLevelRange(ranges, profile.level);
    } else if (changedKey === "level" || changedKey === "hasAnomaly") {
      range = this.#findLevelRange(ranges, fish.level);
      if (!range) return null;
      if (changedKey === "hasAnomaly") {
        fish.anomaly = fish.hasAnomaly
          ? template.anomalyVariant?.anomalyId || "none"
          : "none";
      }
      profile = this.#fishRarityResolver.resolveForLevel({
        level: range.level,
        weightKg: fish.weight,
        weightConfig: template.weightConfig,
        depthConfig: template.depthConfig,
        baseAnomaly: fish.anomaly,
      });
    } else {
      return null;
    }
    if (!profile || !range) return null;

    fish.level = profile.level;
    fish.maxLevel = profile.maxLevel;
    fish.hasAnomaly = profile.hasAnomaly;
    fish.isUnique = profile.isUnique;
    fish.anomaly = profile.anomaly;
    fish.rarity = profile.rarity;
    fish.imagePath = this.#fishVisualVariantResolver.resolveImagePath({
      visual: template.visual,
      fishId: template.id,
      level: profile.level,
      isUnique: profile.isUnique,
      anomaly: profile.anomaly,
    });
    return { range, profile };
  }

  #findLevelRange(ranges, level) {
    const targetLevel = Math.max(1, Math.round(Number(level) || 1));
    return (
      ranges.find(
        (range) => Number(range?.level) === Number(targetLevel),
      ) || null
    );
  }
}
