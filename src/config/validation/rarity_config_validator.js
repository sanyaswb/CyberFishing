class RarityConfigValidator {
  #errors = [];

  validate({ rarityConfig, fishDb = [], itemDb = {}, mapDb = {} } = {}) {
    this.#errors = [];
    this.#validateScale(rarityConfig?.scale);
    this.#validateVisual(rarityConfig?.visual);
    this.#validateFishSettings(rarityConfig?.fish);
    this.#validateFishEntries(rarityConfig, fishDb, mapDb);
    this.#validateItemEntries(itemDb);
    return this.#errors.slice();
  }

  assertValid(input = {}) {
    const issues = this.validate(input);
    if (issues.length === 0) return true;
    const details = issues
      .map((issue) => `- ${issue.path}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid rarity configuration:\n${details}`);
  }

  #validateScale(scale) {
    const path = "CONFIG.rarity.scale";
    if (!scale || typeof scale !== "object") {
      this.#error(path, "missing rarity scale");
      return;
    }
    if (!Object.isFrozen(scale)) {
      this.#error(
        path,
        "rarity scale must be immutable; restart is required for scale changes",
      );
    }
    const maxUnits = this.#requirePositiveInteger(
      `${path}.maxUnits`,
      scale.maxUnits,
    );
    const unitsPerStar = this.#requirePositiveInteger(
      `${path}.unitsPerStar`,
      scale.unitsPerStar,
    );
    this.#requirePositiveInteger(
      `${path}.fishWeightBands`,
      scale.fishWeightBands,
    );
    this.#requirePositiveInteger(
      `${path}.weightUnitsPerKg`,
      scale.weightUnitsPerKg,
    );
    if (
      Number.isFinite(maxUnits) &&
      Number.isFinite(unitsPerStar) &&
      maxUnits % unitsPerStar !== 0
    ) {
      this.#error(
        `${path}.maxUnits`,
        "maxHalfSteps/maxUnits must equal maxStars * unitsPerStar",
      );
    }
  }

  #validateVisual(visual) {
    const path = "CONFIG.rarity.visual";
    if (!visual || typeof visual !== "object") {
      this.#error(path, "missing rarity visual config");
      return;
    }
    const stops = visual.colorStops;
    if (!Array.isArray(stops) || stops.length < 2) {
      this.#error(`${path}.colorStops`, "requires at least two color stops");
      return;
    }
    let previousPosition = -Infinity;
    const stopIds = new Set();
    stops.forEach((stop, index) => {
      const stopPath = `${path}.colorStops[${index}]`;
      const stopId = String(stop?.id || "").trim();
      if (!stopId) {
        this.#error(`${stopPath}.id`, "expected non-empty id");
      } else if (stopIds.has(stopId)) {
        this.#error(`${stopPath}.id`, "duplicate color stop id");
      }
      stopIds.add(stopId);
      const position = Number(stop?.position);
      if (!Number.isFinite(position) || position < 0 || position > 1) {
        this.#error(`${stopPath}.position`, "expected value in [0, 1]");
      } else if (position <= previousPosition) {
        this.#error(
          `${stopPath}.position`,
          "color stop positions must be strictly increasing",
        );
      }
      previousPosition = position;
      this.#validateRgb(`${stopPath}.color`, stop?.color);
    });
    if (Number(stops[0]?.position) !== 0) {
      this.#error(`${path}.colorStops[0].position`, "first stop must be 0");
    }
    if (Number(stops[stops.length - 1]?.position) !== 1) {
      this.#error(
        `${path}.colorStops[${stops.length - 1}].position`,
        "last stop must be 1",
      );
    }
    const requiredIds = [
      "common",
      "uncommon",
      "rare",
      "epic",
      "legendary",
      "unique",
    ];
    for (const requiredId of requiredIds) {
      if (!stopIds.has(requiredId)) {
        this.#error(
          `${path}.colorStops`,
          `missing required color stop: ${requiredId}`,
        );
      }
    }
    if (String(stops[stops.length - 1]?.id || "") !== "unique") {
      this.#error(
        `${path}.colorStops[${stops.length - 1}].id`,
        "unique must be the final color stop",
      );
    }
    this.#validateVisualEffects(path, visual);
  }

  #validateItemEntries(itemDb) {
    if (typeof ItemRarityConfigValidator === "undefined") {
      this.#error(
        "ITEM_DB",
        "ItemRarityConfigValidator is not loaded",
      );
      return;
    }
    const issues = new ItemRarityConfigValidator().validate({ itemDb });
    for (const issue of issues) this.#error(issue.path, issue.message);
  }

  #validateVisualEffects(path, visual) {
    const frame = visual.frame;
    if (!frame || typeof frame !== "object") {
      this.#error(`${path}.frame`, "missing ordinary rarity frame config");
    } else {
      this.#requireNonNegativeNumber(`${path}.frame.borderWidth`, frame.borderWidth);
      this.#requireRatio(`${path}.frame.backgroundAlpha`, frame.backgroundAlpha);
      this.#requireNonNegativeNumber(`${path}.frame.panelGlow`, frame.panelGlow);
      this.#requireRatio(`${path}.frame.panelGlowAlpha`, frame.panelGlowAlpha);
      this.#requireRatio(`${path}.frame.strokeAlpha`, frame.strokeAlpha);
    }

    const uniqueEffects = visual.uniqueEffects;
    if (!uniqueEffects || typeof uniqueEffects !== "object") {
      this.#error(`${path}.uniqueEffects`, "missing unique fish effect config");
      return;
    }
    for (const field of [
      "pulseDurationMs",
      "frameDashSpeedPxPerSecond",
      "borderWidthMin",
      "borderWidthMax",
      "panelGlowMin",
      "panelGlowMax",
      "imageGlowMin",
      "imageGlowMax",
    ]) {
      this.#requireNonNegativeNumber(
        `${path}.uniqueEffects.${field}`,
        uniqueEffects[field],
      );
    }
    for (const field of [
      "panelGlowAlpha",
      "imageGlowAlpha",
      "backgroundAlphaMin",
      "backgroundAlphaMax",
      "strokeAlpha",
    ]) {
      this.#requireRatio(
        `${path}.uniqueEffects.${field}`,
        uniqueEffects[field],
      );
    }
    this.#requireMinMax(
      `${path}.uniqueEffects.borderWidthMin`,
      uniqueEffects.borderWidthMin,
      `${path}.uniqueEffects.borderWidthMax`,
      uniqueEffects.borderWidthMax,
    );
    this.#requireMinMax(
      `${path}.uniqueEffects.panelGlowMin`,
      uniqueEffects.panelGlowMin,
      `${path}.uniqueEffects.panelGlowMax`,
      uniqueEffects.panelGlowMax,
    );
    this.#requireMinMax(
      `${path}.uniqueEffects.imageGlowMin`,
      uniqueEffects.imageGlowMin,
      `${path}.uniqueEffects.imageGlowMax`,
      uniqueEffects.imageGlowMax,
    );
    this.#requireMinMax(
      `${path}.uniqueEffects.backgroundAlphaMin`,
      uniqueEffects.backgroundAlphaMin,
      `${path}.uniqueEffects.backgroundAlphaMax`,
      uniqueEffects.backgroundAlphaMax,
    );
    if (
      !Array.isArray(uniqueEffects.frameDash) ||
      uniqueEffects.frameDash.length === 0
    ) {
      this.#error(
        `${path}.uniqueEffects.frameDash`,
        "expected non-empty dash array",
      );
    } else {
      uniqueEffects.frameDash.forEach((value, index) =>
        this.#requireNonNegativeNumber(
          `${path}.uniqueEffects.frameDash[${index}]`,
          value,
        ),
      );
    }
  }

  #validateFishSettings(fishSettings) {
    const path = "CONFIG.rarity.fish.noneAnomalyIds";
    const values = fishSettings?.noneAnomalyIds;
    if (!Array.isArray(values) || values.length === 0) {
      this.#error(path, "requires at least one non-anomaly id");
      return;
    }
    const normalized = values.map((value) =>
      String(value || "").trim().toLowerCase(),
    );
    if (!normalized.includes("none")) {
      this.#error(path, 'must include the canonical "none" id');
    }
  }

  #validateFishEntries(rarityConfig, fishDb, mapDb) {
    const maxUnits = Number(rarityConfig?.scale?.maxUnits);
    const fishWeightBands = Number(
      rarityConfig?.scale?.fishWeightBands,
    );
    const weightUnitsPerKg = Number(
      rarityConfig?.scale?.weightUnitsPerKg,
    );
    for (const fish of Array.isArray(fishDb) ? fishDb : []) {
      const fishPath = `FISH_DB.${fish?.id || "<missing-id>"}`;
      const uniqueImagePattern = fish?.visual?.uniqueImagePattern;
      if (fish?.anomalyVariant && uniqueImagePattern === undefined) {
        this.#error(
          `${fishPath}.visual.uniqueImagePattern`,
          "anomaly variant requires a level-specific unique image pattern",
        );
      }
      if (uniqueImagePattern !== undefined) {
        const pattern = String(uniqueImagePattern || "").trim();
        if (!pattern) {
          this.#error(
            `${fishPath}.visual.uniqueImagePattern`,
            "expected non-empty asset pattern when configured",
          );
        } else if (!pattern.includes("{level}")) {
          this.#error(
            `${fishPath}.visual.uniqueImagePattern`,
            'expected a "{level}" placeholder',
          );
        }
      }
      this.#validateRarityReachability(
        fishPath,
        maxUnits,
        fishWeightBands,
        fish?.weightConfig?.maxLevel,
      );
      if (fish?.anomalyVariant !== undefined) {
        this.#validateAnomalyVariant(
          fishPath,
          fish.anomalyVariant,
          rarityConfig?.fish?.noneAnomalyIds,
          mapDb,
        );
      }
      this.#validateWeightRanges(
        fishPath,
        fish?.weightConfig,
        weightUnitsPerKg,
      );
    }
  }

  #validateRarityReachability(
    fishPath,
    maxUnits,
    fishWeightBands,
    maxLevel,
  ) {
    const maxReachableUnits = Number(maxLevel) + Number(fishWeightBands) - 1;
    if (
      Number.isFinite(maxReachableUnits) &&
      Number.isFinite(maxUnits) &&
      maxReachableUnits > maxUnits
    ) {
      this.#error(
        `${fishPath}.weightConfig.maxLevel`,
        `maximum rarity would clamp ${maxReachableUnits - maxUnits + 1} upper bands to ${maxUnits}`,
      );
    }
  }

  #validateAnomalyVariant(
    fishPath,
    anomalyVariant,
    noneAnomalyIds,
    mapDb,
  ) {
    const path = `${fishPath}.anomalyVariant`;
    if (!anomalyVariant || typeof anomalyVariant !== "object") {
      this.#error(path, "missing anomaly variant config");
      return;
    }
    if (
      anomalyVariant.enabled !== undefined &&
      typeof anomalyVariant.enabled !== "boolean"
    ) {
      this.#error(`${path}.enabled`, "expected boolean");
    }
    const chance = Number(anomalyVariant.chance);
    if (!Number.isFinite(chance) || chance <= 0 || chance > 1) {
      this.#error(`${path}.chance`, "expected probability in the (0, 1] interval");
    }
    const anomaly = String(anomalyVariant.anomalyId || "")
      .trim()
      .toLowerCase();
    const noneIds = new Set(
      (Array.isArray(noneAnomalyIds) ? noneAnomalyIds : ["", "none"]).map(
        (value) => String(value || "").trim().toLowerCase(),
      ),
    );
    if (!anomaly || noneIds.has(anomaly)) {
      this.#error(
        `${path}.anomalyId`,
        "expected a non-empty anomaly id eligible for unique rarity",
      );
    }
    const locationIds = anomalyVariant.locationIds;
    if (!Array.isArray(locationIds) || locationIds.length === 0) {
      this.#error(`${path}.locationIds`, "requires at least one location id");
      return;
    }
    const knownLocations = new Set(Object.keys(mapDb || {}));
    const seenLocations = new Set();
    locationIds.forEach((locationId, index) => {
      const locationPath = `${path}.locationIds[${index}]`;
      const normalized = String(locationId || "").trim();
      if (!normalized) {
        this.#error(locationPath, "expected non-empty location id");
      } else if (seenLocations.has(normalized)) {
        this.#error(locationPath, "duplicate location id");
      } else if (knownLocations.size > 0 && !knownLocations.has(normalized)) {
        this.#error(locationPath, `unknown location id: ${normalized}`);
      }
      seenLocations.add(normalized);
    });
  }

  #validateWeightRanges(fishPath, weightConfig, weightUnitsPerKg) {
    const ranges = weightConfig?.levelWeightRanges;
    const maxLevelPath = `${fishPath}.weightConfig.maxLevel`;
    const maxLevel = Number(weightConfig?.maxLevel);
    if (!Number.isInteger(maxLevel) || maxLevel <= 0) {
      this.#error(maxLevelPath, "expected positive integer");
    }
    if (!Array.isArray(ranges) || ranges.length === 0) return;
    let previousMaxUnit = null;
    ranges.forEach((range, index) => {
      const path = `${fishPath}.weightConfig.levelWeightRanges[${index}]`;
      const level = Number(range?.level);
      if (!Number.isInteger(level) || level !== index + 1) {
        this.#error(`${path}.level`, "levels must be sequential from 1");
      }
      const minUnit = this.#toWeightUnit(range?.min, weightUnitsPerKg);
      const maxUnit = this.#toWeightUnit(range?.max, weightUnitsPerKg);
      if (!Number.isFinite(minUnit) || !Number.isFinite(maxUnit)) return;
      if (maxUnit < minUnit) {
        this.#error(path, "maximum weight must not be below minimum weight");
      }
      if (previousMaxUnit !== null) {
        if (minUnit <= previousMaxUnit) {
          this.#error(path, "weight ranges overlap after gram normalization");
        } else if (minUnit !== previousMaxUnit + 1) {
          this.#error(path, "weight ranges contain a gap after gram normalization");
        }
      }
      previousMaxUnit = maxUnit;
    });
    if (
      Number.isInteger(maxLevel) &&
      Number(ranges[ranges.length - 1]?.level) !== maxLevel
    ) {
      this.#error(
        maxLevelPath,
        "must match the last configured weight-range level",
      );
    }
  }

  #validateRgb(path, color) {
    if (!Array.isArray(color) || color.length !== 3) {
      this.#error(path, "expected [red, green, blue]");
      return;
    }
    color.forEach((channel, index) => {
      const value = Number(channel);
      if (!Number.isFinite(value) || value < 0 || value > 255) {
        this.#error(`${path}[${index}]`, "expected channel in [0, 255]");
      }
    });
  }

  #requirePositiveInteger(path, value) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      this.#error(path, "expected positive integer");
      return NaN;
    }
    return parsed;
  }

  #requireNonNegativeNumber(path, value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      this.#error(path, "expected finite number >= 0");
      return NaN;
    }
    return parsed;
  }

  #requireRatio(path, value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
      this.#error(path, "expected value in [0, 1]");
      return NaN;
    }
    return parsed;
  }

  #requireMinMax(minPath, minValue, maxPath, maxValue) {
    const min = Number(minValue);
    const max = Number(maxValue);
    if (Number.isFinite(min) && Number.isFinite(max) && min > max) {
      this.#error(`${minPath} / ${maxPath}`, "minimum must not exceed maximum");
    }
  }

  #toWeightUnit(weightKg, unitsPerKg) {
    const weight = Number(weightKg);
    const units = Number(unitsPerKg);
    if (!Number.isFinite(weight) || !Number.isFinite(units)) return NaN;
    return Math.floor(weight * units + 0.5 + 1e-9);
  }

  #error(path, message) {
    this.#errors.push({ path, message });
  }
}
