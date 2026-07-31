class RarityConfigValidator {
  #errors = [];

  validate({ rarityConfig, fishDb = [] } = {}) {
    this.#errors = [];
    this.#validateScale(rarityConfig?.scale);
    this.#validateVisual(rarityConfig?.visual);
    this.#validateFishSettings(rarityConfig?.fish);
    this.#validateFishProfiles(rarityConfig, fishDb);
    return this.#errors.slice();
  }

  #validateScale(scale) {
    const path = "CONFIG.rarity.scale";
    if (!scale || typeof scale !== "object") {
      this.#error(path, "missing rarity scale");
      return;
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
        "must be divisible by unitsPerStar",
      );
    }
  }

  #validateVisual(visual) {
    const path = "CONFIG.rarity.visual";
    if (!visual || typeof visual !== "object") {
      this.#error(path, "missing rarity visual config");
      return;
    }
    const preMaximum = Number(visual.preMaximumPosition);
    if (!Number.isFinite(preMaximum) || preMaximum < 0 || preMaximum >= 1) {
      this.#error(
        `${path}.preMaximumPosition`,
        "expected a finite value in the [0, 1) interval",
      );
    }

    const stops = visual.colorStops;
    if (!Array.isArray(stops) || stops.length < 2) {
      this.#error(`${path}.colorStops`, "requires at least two color stops");
      return;
    }
    let previousPosition = -Infinity;
    stops.forEach((stop, index) => {
      const stopPath = `${path}.colorStops[${index}]`;
      if (!String(stop?.id || "").trim()) {
        this.#error(`${stopPath}.id`, "expected non-empty id");
      }
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

  #validateFishProfiles(rarityConfig, fishDb) {
    const maxUnits = Number(rarityConfig?.scale?.maxUnits);
    const weightUnitsPerKg = Number(
      rarityConfig?.scale?.weightUnitsPerKg,
    );
    for (const fish of Array.isArray(fishDb) ? fishDb : []) {
      const fishPath = `FISH_DB.${fish?.id || "<missing-id>"}`;
      if (
        Object.prototype.hasOwnProperty.call(Object(fish?.visual), "uniqueLevel") ||
        Object.prototype.hasOwnProperty.call(Object(fish?.visual), "uniqueAnomaly")
      ) {
        this.#error(
          `${fishPath}.visual`,
          "unique rules belong to rarityProfile, not visual config",
        );
      }
      if (
        Object.prototype.hasOwnProperty.call(
          Object(fish?.visual),
          "uniqueImagePath",
        ) &&
        !String(fish.visual.uniqueImagePath || "").trim()
      ) {
        this.#error(
          `${fishPath}.visual.uniqueImagePath`,
          "expected non-empty asset path when configured",
        );
      }
      this.#validateFishProfile(
        fishPath,
        fish?.rarityProfile,
        maxUnits,
        rarityConfig?.fish?.noneAnomalyIds,
      );
      this.#validateWeightRanges(
        fishPath,
        fish?.weightConfig,
        weightUnitsPerKg,
      );
    }
  }

  #validateFishProfile(
    fishPath,
    profile,
    maxUnits,
    noneAnomalyIds,
  ) {
    if (profile === undefined || profile === null) return;
    const path = `${fishPath}.rarityProfile`;
    if (typeof profile !== "object") {
      this.#error(path, "expected object");
      return;
    }
    const threshold = this.#requirePositiveInteger(
      `${path}.uniqueAtHalfSteps`,
      profile.uniqueAtHalfSteps,
    );
    if (
      Number.isFinite(threshold) &&
      Number.isFinite(maxUnits) &&
      threshold !== maxUnits
    ) {
      this.#error(
        `${path}.uniqueAtHalfSteps`,
        "unique fish must require the maximum rarity score",
      );
    }
    const anomaly = String(profile.uniqueAnomalyId || "")
      .trim()
      .toLowerCase();
    const noneIds = new Set(
      (Array.isArray(noneAnomalyIds) ? noneAnomalyIds : ["", "none"]).map(
        (value) => String(value || "").trim().toLowerCase(),
      ),
    );
    if (!anomaly || noneIds.has(anomaly)) {
      this.#error(
        `${path}.uniqueAnomalyId`,
        "expected a non-empty anomaly id eligible for unique rarity",
      );
    }
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
