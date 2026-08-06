class ItemCatalogBaselineRegistry {
  #itemDb;
  #strategyRegistry;
  #cache = new Map();
  #logger;

  constructor({ itemDb = {}, strategyRegistry, logger = console } = {}) {
    if (!strategyRegistry || typeof strategyRegistry.get !== "function") {
      throw new TypeError(
        "ItemCatalogBaselineRegistry requires strategyRegistry",
      );
    }
    this.#itemDb = itemDb || {};
    this.#strategyRegistry = strategyRegistry;
    this.#logger = logger;
  }

  resolve({ groupId, powerConfig, strategy, metricKey = "power" } = {}) {
    const baseline = powerConfig?.baseline;
    if (!baseline || typeof baseline !== "object") {
      return this.#unavailable("baseline_missing");
    }
    if (baseline.mode === "fixed") {
      return this.#fixed(
        baseline.minimum,
        baseline.maximum,
        "fixed",
      );
    }
    if (baseline.mode !== "catalog") {
      return this.#unavailable("baseline_mode_unsupported");
    }

    const key = [
      groupId,
      strategy?.id,
      metricKey,
      powerConfig?.statPath,
      powerConfig?.formulaId,
    ].join(":");
    const cached = this.#cache.get(key);
    if (cached) return cached;

    const values = [];
    for (const item of this.#catalogItems(groupId)) {
      const metric = strategy?.evaluate({
        item,
        groupId,
        powerConfig,
        strategyRegistry: this.#strategyRegistry,
        baselineRegistry: this,
      });
      if (!metric?.available || !Number.isFinite(Number(metric.rawValue))) {
        continue;
      }
      values.push(Number(metric.rawValue));
    }

    const distinct = Array.from(new Set(values));
    let descriptor;
    if (distinct.length >= 2) {
      descriptor = this.#fixed(
        Math.min(...distinct),
        Math.max(...distinct),
        "catalog",
      );
    } else if (baseline.fallback) {
      descriptor = this.#fixed(
        baseline.fallback.minimum,
        baseline.fallback.maximum,
        "catalog_fallback",
      );
      this.#logger?.warn?.(
        `[ItemProgression] ${groupId} catalog baseline has fewer than two ` +
          "distinct values; fixed fallback is active.",
      );
    } else {
      descriptor = this.#unavailable("baseline_has_no_range");
    }
    this.#cache.set(key, descriptor);
    return descriptor;
  }

  invalidate() {
    this.#cache.clear();
  }

  #catalogItems(groupId) {
    const result = [];
    for (const [categoryId, category] of Object.entries(this.#itemDb)) {
      if (categoryId === "builds" || !category || typeof category !== "object") {
        continue;
      }
      for (const item of Object.values(category)) {
        if (item?.progressionProfile?.groupId === groupId) result.push(item);
      }
    }
    return result;
  }

  #fixed(minimum, maximum, source) {
    const min = Number(minimum);
    const max = Number(maximum);
    if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) {
      return this.#unavailable("baseline_has_no_range");
    }
    return Object.freeze({
      available: true,
      reason: null,
      minimum: min,
      maximum: max,
      source,
    });
  }

  #unavailable(reason) {
    return Object.freeze({
      available: false,
      reason,
      minimum: null,
      maximum: null,
      source: null,
    });
  }
}
