class ItemProgressionConfigValidator {
  static #capabilities = new Set([
    "rating",
    "ratingTier",
    "quality",
    "condition",
    "capacity",
    "freshness",
  ]);
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
    if (!groups || typeof groups !== "object" || Array.isArray(groups)) {
      this.#error("ITEM_PROGRESSION_CONFIG.groups", "missing groups config");
      return this.#errors.slice();
    }
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
    throw new Error(`Invalid item metric capability configuration:\n${details}`);
  }

  #validateGroups(config, itemDb) {
    const minSections = Number(config.qualityLimits?.minSections ?? 2);
    const maxSections = Number(config.qualityLimits?.maxSections ?? 12);
    for (const [groupId, group] of Object.entries(config.groups || {})) {
      const path = `ITEM_PROGRESSION_CONFIG.groups.${groupId}`;
      if (!groupId.trim()) this.#error(path, "group id must not be empty");
      if (!group || typeof group !== "object" || Array.isArray(group)) {
        this.#error(path, "expected capability profile object");
        continue;
      }
      for (const capabilityId of Object.keys(group)) {
        if (!ItemProgressionConfigValidator.#capabilities.has(capabilityId)) {
          this.#error(
            `${path}.${capabilityId}`,
            "unknown item metric capability",
          );
        }
      }
      if (group.rating !== undefined) {
        this.#validateRating(`${path}.rating`, group.rating);
        this.#validateCatalogRange(groupId, group.rating, itemDb, path);
      }
      if (group.ratingTier !== undefined) {
        this.#validateRatingTier(
          `${path}.ratingTier`,
          group.ratingTier,
          group.rating,
        );
      }
      if (group.quality !== undefined) {
        this.#validateQuality(
          `${path}.quality`,
          group.quality,
          minSections,
          maxSections,
        );
      }
      if (group.capacity !== undefined) {
        this.#validateCapacity(`${path}.capacity`, group.capacity);
      }
      if (group.condition !== undefined) {
        this.#validateBoundedMetric(`${path}.condition`, group.condition);
      }
      if (group.freshness !== undefined) {
        this.#validateBoundedMetric(`${path}.freshness`, group.freshness);
        this.#validateFreshness(`${path}.freshness`, group.freshness);
      }
    }
  }

  #validateRating(path, rating) {
    if (!rating || typeof rating !== "object" || Array.isArray(rating)) {
      this.#error(path, "expected rating config object");
      return;
    }
    if (!ItemProgressionConfigValidator.#strategies.has(rating.strategyId)) {
      this.#error(`${path}.strategyId`, "unsupported strategy");
    }
    this.#requireGameplayConsumer(path, rating.gameplayConsumer);
    if (Object.prototype.hasOwnProperty.call(rating, "maxLevel")) {
      this.#error(`${path}.maxLevel`, "use an explicit ratingTier capability");
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

  #validateRatingTier(path, ratingTier, rating) {
    if (!ratingTier || typeof ratingTier !== "object" || Array.isArray(ratingTier)) {
      this.#error(path, "expected ratingTier config object");
      return;
    }
    if (!rating || typeof rating !== "object") {
      this.#error(path, "ratingTier requires a rating capability");
    }
    if (ratingTier.source !== "rating.normalized") {
      this.#error(`${path}.source`, "expected rating.normalized");
    }
    if (ratingTier.distribution !== "equal_segments") {
      this.#error(`${path}.distribution`, "expected equal_segments");
    }
    if (!Number.isInteger(ratingTier.minimum) || ratingTier.minimum < 1) {
      this.#error(`${path}.minimum`, "expected integer >= 1");
    }
    if (!Number.isInteger(ratingTier.segments) || ratingTier.segments < 1) {
      this.#error(`${path}.segments`, "expected integer >= 1");
    }
    this.#rejectVisualKeys(path, ratingTier);
  }

  #validateDerived(path, rating) {
    if (rating.formulaId === "ratio") {
      this.#requirePath(`${path}.numeratorPath`, rating.numeratorPath);
      this.#requirePath(`${path}.denominatorPath`, rating.denominatorPath);
      return;
    }
    if (rating.formulaId === "upgrade_level_stat") {
      this.#requirePath(`${path}.tablePath`, rating.tablePath);
      this.#requirePath(`${path}.upgradeLevelPath`, rating.upgradeLevelPath);
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
        this.#validateDirection(`${componentPath}.direction`, component.direction);
        this.#validateBaseline(`${componentPath}.baseline`, component.baseline);
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
    if (!quality || typeof quality !== "object" || Array.isArray(quality)) {
      this.#error(path, "expected quality config object");
      return;
    }
    this.#requirePath(`${path}.statPath`, quality.statPath);
    this.#requireGameplayConsumer(path, quality.gameplayConsumer);
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
    if (!capacity || typeof capacity !== "object" || Array.isArray(capacity)) {
      this.#error(path, "expected capacity config object");
      return;
    }
    if (capacity.strategyId !== "line_capacity") {
      this.#error(`${path}.strategyId`, "unsupported capacity strategy");
    }
    this.#requirePath(`${path}.statPath`, capacity.statPath);
    this.#requireGameplayConsumer(path, capacity.gameplayConsumer);
    this.#rejectVisualKeys(path, capacity);
  }

  #validateBoundedMetric(path, metric) {
    if (!metric || typeof metric !== "object" || Array.isArray(metric)) {
      this.#error(path, "expected bounded metric config object");
      return;
    }
    const hasAuthoredPath = String(metric.statPath || "").trim().length > 0;
    const hasInstancePath = String(metric.instanceStatePath || "").trim().length > 0;
    const hasDefault = metric.defaultCurrent !== undefined;
    if (!hasAuthoredPath && !hasInstancePath && !hasDefault) {
      this.#error(path, "bounded metric requires statPath, instanceStatePath or defaultCurrent");
    }
    if (hasAuthoredPath) this.#requirePath(`${path}.statPath`, metric.statPath);
    this.#requireGameplayConsumer(path, metric.gameplayConsumer);
    if (metric.instanceStatePath !== undefined) {
      this.#requirePath(`${path}.instanceStatePath`, metric.instanceStatePath);
    }
    this.#validateRange(path, metric.minimum, metric.maximum);
    if (metric.defaultCurrent !== undefined) {
      const value = Number(metric.defaultCurrent);
      if (
        !Number.isFinite(value) ||
        value < Number(metric.minimum) ||
        value > Number(metric.maximum)
      ) {
        this.#error(`${path}.defaultCurrent`, "expected value inside metric range");
      }
    }
    this.#rejectVisualKeys(path, metric);
  }

  #validateFreshness(path, metric) {
    if (metric.decayPolicyId !== "water_exposure_linear") {
      this.#error(`${path}.decayPolicyId`, "expected water_exposure_linear");
    }
    const lossPerMinute = Number(metric.lossPerMinute);
    if (!Number.isFinite(lossPerMinute) || lossPerMinute < 0) {
      this.#error(`${path}.lossPerMinute`, "expected finite value >= 0");
    }
    if (metric.modifierPolicyId !== "linear_floor") {
      this.#error(`${path}.modifierPolicyId`, "expected linear_floor");
    }
    const minimumMultiplier = Number(metric.minimumMultiplier);
    if (
      !Number.isFinite(minimumMultiplier) ||
      minimumMultiplier < 0 ||
      minimumMultiplier > 1
    ) {
      this.#error(`${path}.minimumMultiplier`, "expected value in [0, 1]");
    }
  }

  #validateItems(groups, itemDb) {
    for (const [categoryId, category] of Object.entries(itemDb || {})) {
      if (!category || typeof category !== "object") continue;
      for (const [itemId, item] of Object.entries(category)) {
        const effectiveItem = this.#withEffectiveStats(item);
        const path = `ITEM_DB.${categoryId}.${itemId}`;
        this.#validateDefinitionContract(path, item);
        const technical =
          categoryId === "builds" ||
          item?.itemType === "build_box" ||
          item?.itemType === "build_template";
        if (!Object.prototype.hasOwnProperty.call(item || {}, "progressionProfile")) {
          this.#error(`${path}.progressionProfile`, "missing explicit metric profile");
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
        if (group.rating) this.#validateItemMetric(path, effectiveItem, group.rating);
        if (group.capacity) {
          this.#validateNumericCapability(
            path,
            effectiveItem,
            group.capacity.statPath,
            "capacity",
            groupId,
          );
        }
        if (group.quality) {
          this.#validateItemQuality(path, effectiveItem, group.quality, groupId);
        }
        if (group.condition) {
          this.#validateItemBoundedMetric(
            path,
            effectiveItem,
            group.condition,
            "condition",
            groupId,
          );
        }
        if (group.freshness) {
          this.#validateItemBoundedMetric(
            path,
            effectiveItem,
            group.freshness,
            "freshness",
            groupId,
          );
        }
      }
    }
  }

  #validateDefinitionContract(path, item) {
    const forbiddenTopLevel = ["level", "power", "type"];
    for (const key of forbiddenTopLevel) {
      if (Object.prototype.hasOwnProperty.call(item || {}, key)) {
        this.#error(`${path}.${key}`, `use a domain-specific field instead of ${key}`);
      }
    }
    const forbiddenGameplayStats = [
      "level",
      "power",
      "type",
      "rigPower",
      "sensitivity",
      "assemblyProfileId",
      "requiresTag",
      "capabilities",
      "equipmentCapabilities",
    ];
    for (const key of forbiddenGameplayStats) {
      if (Object.prototype.hasOwnProperty.call(item?.gameplayStats || {}, key)) {
        this.#error(
          `${path}.gameplayStats.${key}`,
          "definition metadata and unconsumed generic stats must not live in gameplayStats",
        );
      }
    }
  }

  #validateNumericCapability(path, item, statPath, capabilityId, groupId) {
    const value = this.#readPath(item, statPath);
    if (!Number.isFinite(Number(value))) {
      this.#error(
        `${path}.${statPath}`,
        `numeric ${capabilityId} is required by group ${groupId}`,
      );
    }
  }

  #validateItemQuality(path, item, quality, groupId) {
    const value = this.#readPath(item, quality.statPath);
    if (!Number.isFinite(Number(value))) {
      this.#error(
        `${path}.${quality.statPath}`,
        `numeric quality is required by group ${groupId}`,
      );
      return;
    }
    if (Number(value) < Number(quality.min) || Number(value) > Number(quality.maxSections)) {
      this.#error(`${path}.${quality.statPath}`, "quality value is outside group bounds");
    }
  }

  #validateItemBoundedMetric(path, item, metric, capabilityId, groupId) {
    const authored = metric.statPath
      ? this.#readPath(item, metric.statPath)
      : undefined;
    const value = authored ?? metric.defaultCurrent;
    if (!Number.isFinite(Number(value))) {
      this.#error(
        `${path}.${metric.statPath || metric.instanceStatePath || capabilityId}`,
        `numeric ${capabilityId} is required by group ${groupId}`,
      );
      return;
    }
    if (Number(value) < Number(metric.minimum) || Number(value) > Number(metric.maximum)) {
      this.#error(
        `${path}.${metric.statPath || metric.instanceStatePath || capabilityId}`,
        `${capabilityId} value is outside group bounds`,
      );
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
      const metricPath = rating.statPath || rating.numeratorPath || rating.tablePath;
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
    if (rating.strategyId === "numeric_stat" || rating.strategyId === "target_range") {
      return Number(this.#readPath(item, rating.statPath));
    }
    if (rating.strategyId === "derived_stat" && rating.formulaId === "ratio") {
      const numerator = Number(this.#readPath(item, rating.numeratorPath));
      const denominator = Number(this.#readPath(item, rating.denominatorPath));
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
      effectiveStats: this.#effectiveStatsResolver.resolve({ definition: item }),
    };
  }

  #validateDirection(path, direction) {
    if (!ItemProgressionConfigValidator.#directions.has(direction)) {
      this.#error(path, "expected higher_is_better or lower_is_better");
    }
  }

  #requirePath(path, value) {
    if (!String(value || "").trim()) this.#error(path, "expected non-empty path");
  }

  #requireGameplayConsumer(path, value) {
    if (!String(value || "").trim()) {
      this.#error(
        `${path}.gameplayConsumer`,
        "capability requires a confirmed gameplay consumer",
      );
    }
  }

  #rejectVisualKeys(path, value) {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (/(?:color|rgb|gradient)/i.test(key)) {
        this.#error(`${path}.${key}`, "metric config must not own colors");
      }
      this.#rejectVisualKeys(`${path}.${key}`, child);
    }
  }

  #error(path, message) {
    this.#errors.push(Object.freeze({ path, message }));
  }
}
