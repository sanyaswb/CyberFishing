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

  validate({ progressionConfig, itemDb = {} } = {}) {
    this.#errors = [];
    const groups = progressionConfig?.groups;
    if (!groups || typeof groups !== "object") {
      this.#error("ITEM_PROGRESSION_CONFIG.groups", "missing groups config");
      return this.#errors.slice();
    }
    this.#validateLevelScale(progressionConfig.levelScale);
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
      this.#validatePower(`${path}.power`, group.power);
      this.#validateQuality(
        `${path}.quality`,
        group.quality,
        minSections,
        maxSections,
      );
      this.#validateCapacity(`${path}.capacity`, group.capacity);
      this.#validateCatalogRange(groupId, group.power, itemDb, path);
    }
  }

  #validatePower(path, power) {
    if (!power || typeof power !== "object") {
      this.#error(path, "missing power config");
      return;
    }
    if (!ItemProgressionConfigValidator.#strategies.has(power.strategyId)) {
      this.#error(`${path}.strategyId`, "unsupported strategy");
    }
    if (Object.prototype.hasOwnProperty.call(power, "maxLevel")) {
      this.#error(
        `${path}.maxLevel`,
        "level scale must be configured globally",
      );
    }
    this.#rejectVisualKeys(path, power);

    if (power.strategyId === "numeric_stat") {
      this.#requirePath(`${path}.statPath`, power.statPath);
      this.#validateDirection(`${path}.direction`, power.direction);
      this.#validateBaseline(`${path}.baseline`, power.baseline);
      return;
    }
    if (power.strategyId === "derived_stat") {
      this.#validateDerived(path, power);
      this.#validateDirection(`${path}.direction`, power.direction);
      this.#validateBaseline(`${path}.baseline`, power.baseline);
      return;
    }
    if (power.strategyId === "target_range") {
      this.#requirePath(`${path}.statPath`, power.statPath);
      this.#validateTargetRange(`${path}.targetRange`, power.targetRange);
      return;
    }
    if (power.strategyId === "composite") {
      this.#validateComposite(path, power.components);
    }
  }

  #validateDerived(path, power) {
    if (power.formulaId === "ratio") {
      this.#requirePath(`${path}.numeratorPath`, power.numeratorPath);
      this.#requirePath(`${path}.denominatorPath`, power.denominatorPath);
      return;
    }
    if (power.formulaId === "upgrade_level_stat") {
      this.#requirePath(`${path}.tablePath`, power.tablePath);
      this.#requirePath(`${path}.levelPath`, power.levelPath);
      this.#requirePath(`${path}.statKey`, power.statKey);
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
        const path = `ITEM_DB.${categoryId}.${itemId}`;
        const technical =
          categoryId === "builds" ||
          item?.type === "build_box" ||
          item?.type === "build_template";
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
        this.#validateItemMetric(path, item, group.power);
        if (group.capacity) {
          const capacityValue = this.#readPath(item, group.capacity.statPath);
          if (!Number.isFinite(Number(capacityValue))) {
            this.#error(
              `${path}.${group.capacity.statPath}`,
              `numeric capacity is required by group ${groupId}`,
            );
          }
        }
        const qualityValue = this.#readPath(item, group.quality?.statPath);
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

  #validateItemMetric(path, item, power) {
    if (power.strategyId === "composite") {
      for (const component of power.components || []) {
        this.#validateItemMetric(path, item, {
          ...component,
          strategyId: component.strategyId || "numeric_stat",
        });
      }
      return;
    }
    const metric = this.#readMetric(item, power);
    if (!Number.isFinite(metric)) {
      const metricPath = power.statPath || power.numeratorPath || power.tablePath;
      this.#error(
        `${path}.${metricPath || "engineStats"}`,
        `${metricPath || power.formulaId} is required and must be numeric`,
      );
    }
  }

  #validateCatalogRange(groupId, power, itemDb, groupPath) {
    if (power?.baseline?.mode !== "catalog") return;
    const values = [];
    for (const category of Object.values(itemDb || {})) {
      for (const item of Object.values(category || {})) {
        if (item?.progressionProfile?.groupId !== groupId) continue;
        const value = this.#readMetric(item, power);
        if (Number.isFinite(value)) values.push(value);
      }
    }
    if (new Set(values).size < 2 && !power.baseline.fallback) {
      this.#error(
        `${groupPath}.power.baseline`,
        "catalog requires two distinct values or a fixed fallback",
      );
    }
  }

  #readMetric(item, power) {
    if (!power) return NaN;
    if (power.strategyId === "numeric_stat" || power.strategyId === "target_range") {
      return Number(this.#readPath(item, power.statPath));
    }
    if (power.strategyId === "derived_stat" && power.formulaId === "ratio") {
      const numerator = Number(this.#readPath(item, power.numeratorPath));
      const denominator = Number(this.#readPath(item, power.denominatorPath));
      return denominator === 0 ? NaN : numerator / denominator;
    }
    if (
      power.strategyId === "derived_stat" &&
      power.formulaId === "upgrade_level_stat"
    ) {
      const table = this.#readPath(item, power.tablePath);
      const level = this.#readPath(item, power.levelPath);
      return Number(table?.[level]?.[power.statKey]);
    }
    return power.strategyId === "composite" ? 0 : NaN;
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

  #validateDirection(path, direction) {
    if (!ItemProgressionConfigValidator.#directions.has(direction)) {
      this.#error(path, "expected higher_is_better or lower_is_better");
    }
  }

  #validateLevelScale(scale) {
    if (scale?.source !== "power.normalized") {
      this.#error(
        "ITEM_PROGRESSION_CONFIG.levelScale.source",
        "expected power.normalized",
      );
    }
    if (scale?.distribution !== "equal_segments") {
      this.#error(
        "ITEM_PROGRESSION_CONFIG.levelScale.distribution",
        "expected equal_segments",
      );
    }
    if (!Number.isInteger(scale?.minimum) || scale.minimum < 1) {
      this.#error(
        "ITEM_PROGRESSION_CONFIG.levelScale.minimum",
        "expected integer >= 1",
      );
    }
    if (!Number.isInteger(scale?.segments) || scale.segments < 1) {
      this.#error(
        "ITEM_PROGRESSION_CONFIG.levelScale.segments",
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
