class ItemProgressionConfigValidator {
  static #strategies = new Set([
    "numeric_stat",
    "derived_stat",
    "target_range",
    "composite",
  ]);
  static #directions = new Set([
    "higher_is_better",
    "lower_is_better",
  ]);

  #errors = [];
  #effectiveStatsResolver = new EffectiveItemStatsResolver();

  validate({ progressionConfig, itemDb = {} } = {}) {
    this.#errors = [];
    const groups = progressionConfig?.groups;
    if (!groups || typeof groups !== "object") {
      this.#error("ITEM_PROGRESSION_CONFIG.groups", "missing groups config");
      return this.#errors.slice();
    }
    this.#validateProgressionLevelScale(
      progressionConfig.progressionLevelScale,
    );
    this.#validateGroups(progressionConfig, itemDb);
    this.#validateItems(groups, itemDb);
    return this.#errors.slice();
  }

  assertValid(input = {}) {
    const issues = this.validate(input);
    if (issues.length === 0) return true;
    const details = issues
      .map((issue) => `- ${issue.path}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid item progression configuration:\n${details}`);
  }

  #validateGroups(config, itemDb) {
    const groupEntries = Object.entries(config.groups || {});
    const minSections = Number(config.qualityLimits?.minSections ?? 2);
    const maxSections = Number(config.qualityLimits?.maxSections ?? 12);
    for (const [groupId, group] of groupEntries) {
      const path = `ITEM_PROGRESSION_CONFIG.groups.${groupId}`;
      if (!groupId.trim()) this.#error(path, "group id must not be empty");
      if (!group || typeof group !== "object") {
        this.#error(path, "expected group object");
        continue;
      }
      this.#validateRating(`${path}.rating`, group.rating);
      this.#validateQuality(
        `${path}.quality`,
        group.quality,
        minSections,
        maxSections,
      );
      this.#validateCapacity(`${path}.capacity`, group.capacity);
      this.#validateCatalogRange(groupId, group.rating, itemDb, path);
    }
  }

  #validateRating(path, rating) {
    if (!rating || typeof rating !== "object") {
      this.#error(path, "missing rating config");
      return;
    }
    if (!ItemProgressionConfigValidator.#strategies.has(rating.strategyId)) {
      this.#error(`${path}.strategyId`, "unsupported strategy");
    }
    if (Object.prototype.hasOwnProperty.call(rating, "maxLevel")) {
      this.#error(
        `${path}.maxLevel`,
        "level scale must be configured globally",
      );
    }
    this.#rejectVisualKeys(path, rating);

    if (rating.strategyId === "numeric_stat") {
      this.#requirePath(`${path}.statPath`, rating.statPath);
      this.#validateDirection(`${path}.direction`, rating.direction);
      this.#validateBaseline(`${path}.baseline`, rating.baseline);
      return;
    }
    if (rating.strategyId === "derived_stat") {
      this.#validateDerived(path, rating);
      this.#validateDirection(`${path}.direction`, rating.direction);
      this.#validateBaseline(`${path}.baseline`, rating.baseline);
      return;
    }
    if (rating.strategyId === "target_range") {
      this.#requirePath(`${path}.statPath`, rating.statPath);
      this.#validateTargetRange(`${path}.targetRange`, rating.targetRange);
      return;
    }
    if (rating.strategyId === "composite") {
      this.#validateComposite(path, rating.components);
    }
  }

  #validateDerived(path, rating) {
    if (rating.formulaId === "ratio") {
      this.#requirePath(`${path}.numeratorPath`, rating.numeratorPath);
      this.#requirePath(`${path}.denominatorPath`, rating.denominatorPath);
      return;
    }
    if (rating.formulaId === "upgrade_level_stat") {
      this.#requirePath(`${path}.tablePath`, rating.tablePath);
      this.#requirePath(
        `${path}.upgradeLevelPath`,
        rating.upgradeLevelPath,
      );
      this.#requirePath(`${path}.statKey`, rating.statKey);
      return;
    }
    this.#error(`${path}.formulaId`, "unsupported derived formula");
  }

  #validateComposite(path, components) {
    if (!Array.isArray(components) || components.length === 0) {
      this.#error(`${path}.components`, "expected non-empty component list");
      return;
    }
    let weightSum = 0;
    components.forEach((component, index) => {
      const componentPath = `${path}.components[${index}]`;
      const strategyId = component.strategyId || "numeric_stat";
      if (!ItemProgressionConfigValidator.#strategies.has(strategyId)) {
        this.#error(`${componentPath}.strategyId`, "unsupported strategy");
      }
      if (strategyId === "composite") {
        this.#error(`${componentPath}.strategyId`, "nested composite is not supported");
      } else if (strategyId === "derived_stat") {
        this.#validateDerived(componentPath, component);
      } else {
        this.#requirePath(`${componentPath}.statPath`, component.statPath);
      }
      if (strategyId === "target_range") {
        this.#validateTargetRange(
          `${componentPath}.targetRange`,
          component.targetRange,
        );
      } else {
        this.#validateDirection(
          `${componentPath}.direction`,
          component.direction,
        );
        this.#validateBaseline(
          `${componentPath}.baseline`,
          component.baseline,
        );
      }
      const weight = Number(component.weight);
      if (!Number.isFinite(weight) || weight <= 0) {
        this.#error(`${componentPath}.weight`, "expected positive weight");
      } else {
        weightSum += weight;
      }
    });
    if (Math.abs(weightSum - 1) > 1e-9) {
      this.#error(`${path}.components`, "component weights must sum to 1");
    }
  }

  #validateTargetRange(path, target) {
    const values = [
      target?.falloffMinimum,
      target?.minimum,
      target?.maximum,
      target?.falloffMaximum,
    ].map(Number);
    if (!values.every(Number.isFinite)) {
      this.#error(path, "target range values must be finite numbers");
      return;
    }
    if (!(values[0] < values[1] && values[1] <= values[2] && values[2] < values[3])) {
      this.#error(
        path,
        "expected falloffMinimum < minimum <= maximum < falloffMaximum",
      );
    }
  }

  #validateBaseline(path, baseline) {
    if (!baseline || typeof baseline !== "object") {
      this.#error(path, "missing baseline");
      return;
    }
    if (baseline.mode === "fixed") {
      this.#validateRange(path, baseline.minimum, baseline.maximum);
      return;
    }
    if (baseline.mode !== "catalog") {
      this.#error(`${path}.mode`, "expected fixed or catalog");
      return;
    }
    if (baseline.fallback) {
      this.#validateRange(
        `${path}.fallback`,
        baseline.fallback.minimum,
        baseline.fallback.maximum,
      );
    }
  }

  #validateRange(path, minimum, maximum) {
    const min = Number(minimum);
    const max = Number(maximum);
    if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) {
      this.#error(path, "expected finite minimum < maximum");
    }
  }

  #validateQuality(path, quality, minSections, maxSections) {
    if (!quality || typeof quality !== "object") {
      this.#error(path, "missing quality config");
      return;
    }
    this.#requirePath(`${path}.statPath`, quality.statPath);
    if (!Number.isFinite(Number(quality.min))) {
      this.#error(`${path}.min`, "expected finite number");
    }
    if (
      !Number.isInteger(quality.maxSections) ||
      quality.maxSections < minSections ||
      quality.maxSections > maxSections ||
      Number(quality.min) >= quality.maxSections
    ) {
      this.#error(
        `${path}.maxSections`,
        `expected integer in [${minSections}, ${maxSections}] above min`,
      );
    }
  }

  #validateCapacity(path, capacity) {
    if (capacity === undefined) return;
    if (!capacity || typeof capacity !== "object") {
      this.#error(path, "expected capacity config object");
      return;
    }
    if (capacity.strategyId !== "line_capacity") {
      this.#error(`${path}.strategyId`, "unsupported capacity strategy");
    }
    this.#requirePath(`${path}.statPath`, capacity.statPath);
    this.#rejectVisualKeys(path, capacity);
  }

  #validateItems(groups, itemDb) {
    for (const [categoryId, category] of Object.entries(itemDb || {})) {
      if (!category || typeof category !== "object") continue;
      for (const [itemId, item] of Object.entries(category)) {
        const effectiveItem = this.#withEffectiveStats(item);
        const path = `ITEM_DB.${categoryId}.${itemId}`;
        const technical =
          categoryId === "builds" ||
          item?.itemType === "build_box" ||
          item?.itemType === "build_template";
        if (!Object.prototype.hasOwnProperty.call(item || {}, "progressionProfile")) {
          this.#error(`${path}.progressionProfile`, "missing explicit progression profile");
          continue;
        }
        if (technical) {
          if (item.progressionProfile !== null) {
            this.#error(`${path}.progressionProfile`, "technical item must use null");
          }
          continue;
        }
        const groupId = item.progressionProfile?.groupId;
        const group = groups[groupId];
        if (!group) {
          this.#error(
            `${path}.progressionProfile.groupId`,
            `unknown group: ${String(groupId || "")}`,
          );
          continue;
        }
        this.#validateItemMetric(path, effectiveItem, group.rating);
        if (group.capacity) {
          const capacityValue = this.#readPath(
            effectiveItem,
            group.capacity.statPath,
          );
          if (!Number.isFinite(Number(capacityValue))) {
            this.#error(
              `${path}.${group.capacity.statPath}`,
              `numeric capacity is required by group ${groupId}`,
            );
          }
        }
        const qualityValue = this.#readPath(
          effectiveItem,
          group.quality?.statPath,
        );
        if (!Number.isFinite(Number(qualityValue))) {
          this.#error(
            `${path}.${group.quality?.statPath}`,
            `numeric quality is required by group ${groupId}`,
          );
        } else if (
          Number(qualityValue) < Number(group.quality.min) ||
          Number(qualityValue) > Number(group.quality.maxSections)
        ) {
          this.#error(
            `${path}.${group.quality.statPath}`,
            "quality value is outside group bounds",
          );
        }
      }
    }
  }

  #validateItemMetric(path, item, rating) {
    if (rating.strategyId === "composite") {
      for (const component of rating.components || []) {
        this.#validateItemMetric(path, item, {
          ...component,
          strategyId: component.strategyId || "numeric_stat",
        });
      }
      return;
    }
    const metric = this.#readMetric(item, rating);
    if (!Number.isFinite(metric)) {
      const metricPath =
        rating.statPath || rating.numeratorPath || rating.tablePath;
      this.#error(
        `${path}.${metricPath || "effectiveStats"}`,
        `${metricPath || rating.formulaId} is required and must be numeric`,
      );
    }
  }

  #validateCatalogRange(groupId, rating, itemDb, groupPath) {
    if (rating?.baseline?.mode !== "catalog") return;
    const values = [];
    for (const category of Object.values(itemDb || {})) {
      for (const item of Object.values(category || {})) {
        if (item?.progressionProfile?.groupId !== groupId) continue;
        const value = this.#readMetric(this.#withEffectiveStats(item), rating);
        if (Number.isFinite(value)) values.push(value);
      }
    }
    if (new Set(values).size < 2 && !rating.baseline.fallback) {
      this.#error(
        `${groupPath}.rating.baseline`,
        "catalog requires two distinct values or a fixed fallback",
      );
    }
  }

  #readMetric(item, rating) {
    if (!rating) return NaN;
    if (
      rating.strategyId === "numeric_stat" ||
      rating.strategyId === "target_range"
    ) {
      return Number(this.#readPath(item, rating.statPath));
    }
    if (
      rating.strategyId === "derived_stat" &&
      rating.formulaId === "ratio"
    ) {
      const numerator = Number(this.#readPath(item, rating.numeratorPath));
      const denominator = Number(
        this.#readPath(item, rating.denominatorPath),
      );
      return denominator === 0 ? NaN : numerator / denominator;
    }
    if (
      rating.strategyId === "derived_stat" &&
      rating.formulaId === "upgrade_level_stat"
    ) {
      const table = this.#readPath(item, rating.tablePath);
      const upgradeLevel = this.#readPath(item, rating.upgradeLevelPath);
      return Number(table?.[upgradeLevel]?.[rating.statKey]);
    }
    return rating.strategyId === "composite" ? 0 : NaN;
  }

  #readPath(source, path) {
    let current = source;
    for (const part of String(path || "").split(".")) {
      if (!part) continue;
      if (!current || typeof current !== "object") return undefined;
      current = current[part];
    }
    return current;
  }

  #withEffectiveStats(item) {
    if (!item || item.effectiveStats) return item;
    return {
      ...item,
      effectiveStats: this.#effectiveStatsResolver.resolve({
        definition: item,
      }),
    };
  }

  #validateDirection(path, direction) {
    if (!ItemProgressionConfigValidator.#directions.has(direction)) {
      this.#error(path, "expected higher_is_better or lower_is_better");
    }
  }

  #validateProgressionLevelScale(scale) {
    if (scale?.source !== "rating.normalized") {
      this.#error(
        "ITEM_PROGRESSION_CONFIG.progressionLevelScale.source",
        "expected rating.normalized",
      );
    }
    if (scale?.distribution !== "equal_segments") {
      this.#error(
        "ITEM_PROGRESSION_CONFIG.progressionLevelScale.distribution",
        "expected equal_segments",
      );
    }
    if (!Number.isInteger(scale?.minimum) || scale.minimum < 1) {
      this.#error(
        "ITEM_PROGRESSION_CONFIG.progressionLevelScale.minimum",
        "expected integer >= 1",
      );
    }
    if (!Number.isInteger(scale?.segments) || scale.segments < 1) {
      this.#error(
        "ITEM_PROGRESSION_CONFIG.progressionLevelScale.segments",
        "expected integer >= 1",
      );
    }
  }

  #requirePath(path, value) {
    if (!String(value || "").trim()) this.#error(path, "expected non-empty path");
  }

  #rejectVisualKeys(path, value) {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (/(?:color|rgb|gradient)/i.test(key)) {
        this.#error(`${path}.${key}`, "progression config must not own colors");
      }
      this.#rejectVisualKeys(`${path}.${key}`, child);
    }
  }

  #error(path, message) {
    this.#errors.push(Object.freeze({ path, message }));
  }
}
