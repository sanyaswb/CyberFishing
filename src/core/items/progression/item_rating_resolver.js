class ItemRatingResolver {
  #strategyRegistry;
  #baselineRegistry;

  constructor({ strategyRegistry, baselineRegistry } = {}) {
    if (!strategyRegistry || typeof strategyRegistry.get !== "function") {
      throw new TypeError("ItemRatingResolver requires strategyRegistry");
    }
    if (!baselineRegistry || typeof baselineRegistry.resolve !== "function") {
      throw new TypeError("ItemRatingResolver requires baselineRegistry");
    }
    this.#strategyRegistry = strategyRegistry;
    this.#baselineRegistry = baselineRegistry;
  }

  resolve({ item, groupId, groupConfig } = {}) {
    const ratingConfig = groupConfig?.rating;
    const strategy = this.#strategyRegistry.get(ratingConfig?.strategyId);
    if (!strategy) return this.#unavailable("strategy_missing", ratingConfig);

    const metric = strategy.evaluate({
      item,
      groupId,
      ratingConfig,
      strategyRegistry: this.#strategyRegistry,
      baselineRegistry: this.#baselineRegistry,
    });
    if (!metric?.available) {
      return this.#unavailable(
        metric?.reason || "metric_missing",
        ratingConfig,
        strategy.id,
        metric?.metricId,
      );
    }

    let normalized = Number(metric.normalized);
    let minimum = Number(metric.minimum);
    let maximum = Number(metric.maximum);
    let configSource = strategy.id;
    if (!Number.isFinite(normalized)) {
      const baseline = this.#baselineRegistry.resolve({
        groupId,
        ratingConfig,
        strategy,
      });
      if (!baseline.available) {
        return this.#unavailable(
          baseline.reason,
          ratingConfig,
          strategy.id,
          metric.metricId,
        );
      }
      minimum = baseline.minimum;
      maximum = baseline.maximum;
      configSource = baseline.source;
      normalized = ItemMetricStrategy.normalizeValue(
        metric.rawValue,
        minimum,
        maximum,
        ratingConfig.direction,
      );
    }
    if (!Number.isFinite(normalized)) {
      return this.#unavailable(
        "normalization_failed",
        ratingConfig,
        strategy.id,
        metric.metricId,
      );
    }

    normalized = Math.max(0, Math.min(1, normalized));
    const outOfRange = metric.outOfRange ?? this.#resolveOutOfRange(
      metric.rawValue,
      minimum,
      maximum,
    );
    return Object.freeze({
      available: true,
      reason: null,
      strategyId: strategy.id,
      metricId: metric.metricId,
      metricLabel: ratingConfig.metricLabel || metric.metricId,
      metricSuffix: ratingConfig.metricSuffix || "",
      rawValue: metric.rawValue,
      minimum,
      maximum,
      normalized,
      percent: Math.round(normalized * 10000) / 100,
      outOfRange,
      configSource,
      breakdown: metric.breakdown || Object.freeze([]),
    });
  }

  #resolveOutOfRange(value, minimum, maximum) {
    const raw = Number(value);
    if (![raw, minimum, maximum].every(Number.isFinite)) return null;
    if (raw < minimum) return "below";
    if (raw > maximum) return "above";
    return null;
  }

  #unavailable(reason, config = {}, strategyId = null, metricId = null) {
    return Object.freeze({
      available: false,
      reason,
      strategyId: strategyId || config?.strategyId || null,
      metricId: metricId || null,
      metricLabel: config?.metricLabel || null,
      metricSuffix: config?.metricSuffix || "",
      rawValue: null,
      minimum: null,
      maximum: null,
      normalized: null,
      percent: null,
      outOfRange: null,
      configSource: null,
      breakdown: Object.freeze([]),
    });
  }
}
