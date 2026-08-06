class ItemPowerResolver {
  #strategyRegistry;
  #baselineRegistry;

  constructor({ strategyRegistry, baselineRegistry } = {}) {
    if (!strategyRegistry || typeof strategyRegistry.get !== "function") {
      throw new TypeError("ItemPowerResolver requires strategyRegistry");
    }
    if (!baselineRegistry || typeof baselineRegistry.resolve !== "function") {
      throw new TypeError("ItemPowerResolver requires baselineRegistry");
    }
    this.#strategyRegistry = strategyRegistry;
    this.#baselineRegistry = baselineRegistry;
  }

  resolve({ item, groupId, groupConfig } = {}) {
    const powerConfig = groupConfig?.power;
    const strategy = this.#strategyRegistry.get(powerConfig?.strategyId);
    if (!strategy) return this.#unavailable("strategy_missing", powerConfig);

    const metric = strategy.evaluate({
      item,
      groupId,
      powerConfig,
      strategyRegistry: this.#strategyRegistry,
      baselineRegistry: this.#baselineRegistry,
    });
    if (!metric?.available) {
      return this.#unavailable(
        metric?.reason || "metric_missing",
        powerConfig,
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
        powerConfig,
        strategy,
      });
      if (!baseline.available) {
        return this.#unavailable(
          baseline.reason,
          powerConfig,
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
        powerConfig.direction,
      );
    }
    if (!Number.isFinite(normalized)) {
      return this.#unavailable(
        "normalization_failed",
        powerConfig,
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
      metricLabel: powerConfig.metricLabel || metric.metricId,
      metricSuffix: powerConfig.metricSuffix || "",
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
      strategyId: strategyId || config.strategyId || null,
      metricId: metricId || null,
      metricLabel: config.metricLabel || null,
      metricSuffix: config.metricSuffix || "",
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
