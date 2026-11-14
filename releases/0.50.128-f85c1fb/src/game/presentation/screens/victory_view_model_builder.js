// The victory window's reading of a caught fish (spec 161): name, level, weight, trophy and anomaly states, rarity, the
// display image and the species' weight scale. Built once when the window opens, never per frame.
const UNKNOWN_RARITY = Object.freeze({ isResolved: false, halfSteps: 0, maxHalfSteps: 0, unitsPerStar: 2, isMaximum: false });

export class VictoryViewModelBuilder {
  #themeResolver;
  #resolveFishImage;
  #species;

  // themeResolver: VictoryThemeResolver; resolveFishImage(fish): the display image (the preloader's source, spec 100
  // D4); species: the fish database (FISH_DB) for the weight scale (D4).
  constructor({ themeResolver, resolveFishImage, species }) {
    if (typeof themeResolver?.resolve !== "function") throw new TypeError("VictoryViewModelBuilder requires themeResolver");
    if (typeof resolveFishImage !== "function") throw new TypeError("VictoryViewModelBuilder requires resolveFishImage");
    if (!Array.isArray(species)) throw new TypeError("VictoryViewModelBuilder requires species");
    this.#themeResolver = themeResolver;
    this.#resolveFishImage = resolveFishImage;
    this.#species = new Map(species.map((entry) => [entry.id, entry]));
  }

  build(fish = {}) {
    const level = Number(fish.level) || 1;
    const weightKg = Math.max(0, Number(fish.weight ?? fish.weightKg) || 0);
    const anomaly = String(fish.anomaly || "none");
    const rarity = fish.rarity && Number.isFinite(Number(fish.rarity.halfSteps)) ? fish.rarity : UNKNOWN_RARITY;
    const theme = this.#themeResolver.resolve({ level, maxLevel: fish.maxLevel, isUnique: fish.isUnique === true }, 0);
    const extraStats = Array.isArray(fish.victoryStats) ? fish.victoryStats : [];
    const species = this.#species.get(fish.id);
    return {
      name: String(fish.name || "Unknown fish"),
      level,
      weightKg,
      isTrophy: fish.isTrophy === true,
      anomaly,
      hasAnomaly: anomaly !== "none",
      isUnique: fish.isUnique === true,
      rarity,
      imagePath: this.#resolveFishImage(fish),
      color: Array.isArray(theme?.color) ? theme.color : [255, 255, 255],
      // TK-231: the panel is tinted like an inventory card of that quality (semi-transparent), the glow only animates
      // for a unique (legendary) fish.
      backgroundAlpha: Number.isFinite(theme?.background?.alpha) ? theme.background.alpha : 0.35,
      animated: theme?.isAnimated === true,
      // TK-224/231: the size system of the keepnet card (level of maxLevel) also sizes the fish here.
      artSize: species?.visual?.artSizeByLevel === true ? { step: level, of: Number(species.weightConfig?.maxLevel) } : null,
      scale: this.#scale(species, weightKg),
      extraStats: extraStats.map((stat) => String(stat?.label || stat?.value || "")).filter(Boolean),
    };
  }

  // The species' weight range (its level ranges, else its depth range), the current weight inside it and where the
  // trophy weight starts (null without one). Null when the species has no usable range.
  #scale(species, weightKg) {
    const ranges = species?.weightConfig?.levelWeightRanges;
    const hasRanges = Array.isArray(ranges) && ranges.length > 0;
    const minKg = Number(hasRanges ? ranges[0].min : species?.depthConfig?.minWeightAtMinDepth);
    const maxKg = Number(hasRanges ? ranges[ranges.length - 1].max : species?.depthConfig?.maxWeightAtMaxDepth);
    if (!Number.isFinite(minKg) || !Number.isFinite(maxKg) || maxKg <= minKg) return null;
    const trophy = Number(species.trophyWeightKg ?? species.trophyWeight);
    return {
      minKg,
      maxKg,
      weightKg: Math.min(maxKg, Math.max(minKg, weightKg)),
      trophyKg: Number.isFinite(trophy) && trophy > minKg && trophy < maxKg ? trophy : null,
    };
  }
}
