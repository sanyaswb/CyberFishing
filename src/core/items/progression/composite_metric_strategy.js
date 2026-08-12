class CompositeMetricStrategy extends ItemMetricStrategy {
  constructor() {
    super("composite");
  }

  evaluate({
    item,
    groupId,
    ratingConfig,
    strategyRegistry,
    baselineRegistry,
  } = {}) {
    const components = Array.isArray(ratingConfig?.components)
      ? ratingConfig.components
      : [];
    if (components.length === 0) {
      return this.unavailable("composite_components_missing", {
        metricId: "composite",
      });
    }

    let normalized = 0;
    const breakdown = [];
    for (let index = 0; index < components.length; index += 1) {
      const component = components[index];
      const strategy = strategyRegistry?.get(
        component.strategyId || "numeric_stat",
      );
      if (!strategy) {
        return this.unavailable("component_strategy_missing", {
          metricId: "composite",
        });
      }
      const metric = strategy.evaluate({
        item,
        groupId,
        ratingConfig: component,
        strategyRegistry,
        baselineRegistry,
      });
      if (!metric.available) {
        return this.unavailable(metric.reason || "component_metric_missing", {
          metricId: "composite",
        });
      }

      let score = Number(metric.normalized);
      let minimum = Number(metric.minimum);
      let maximum = Number(metric.maximum);
      if (!Number.isFinite(score)) {
        const baseline = baselineRegistry?.resolve({
          groupId,
          ratingConfig: component,
          strategy,
          metricKey: `component:${index}`,
        });
        if (!baseline?.available) {
          return this.unavailable(
            baseline?.reason || "component_baseline_missing",
            { metricId: "composite" },
          );
        }
        minimum = baseline.minimum;
        maximum = baseline.maximum;
        score = ItemMetricStrategy.normalizeValue(
          metric.rawValue,
          minimum,
          maximum,
          component.direction,
        );
      }
      if (!Number.isFinite(score)) {
        return this.unavailable("component_normalization_failed", {
          metricId: "composite",
        });
      }

      const weight = Number(component.weight);
      normalized += score * weight;
      breakdown.push(Object.freeze({
        id: metric.metricId,
        label: component.metricLabel || metric.metricId,
        rawValue: metric.rawValue,
        minimum,
        maximum,
        normalized: score,
        percent: score * 100,
        weight,
      }));
    }

    normalized = Math.max(0, Math.min(1, normalized));
    return this.available({
      metricId: "composite",
      rawValue: normalized,
      normalized,
      minimum: 0,
      maximum: 1,
      outOfRange: null,
      breakdown: Object.freeze(breakdown),
    });
  }
}
