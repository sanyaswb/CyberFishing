class TargetRangeMetricStrategy extends ItemMetricStrategy {
  constructor() {
    super("target_range");
  }

  evaluate({ item, powerConfig } = {}) {
    const rawValue = this.finiteNumber(
      this.readPath(item, powerConfig?.statPath),
    );
    const target = powerConfig?.targetRange || {};
    const targetMinimum = this.finiteNumber(target.minimum);
    const targetMaximum = this.finiteNumber(target.maximum);
    const falloffMinimum = this.finiteNumber(target.falloffMinimum);
    const falloffMaximum = this.finiteNumber(target.falloffMaximum);
    if (rawValue === null) {
      return this.unavailable("metric_missing", {
        metricId: String(powerConfig?.statPath || "target_range"),
      });
    }
    if (
      [targetMinimum, targetMaximum, falloffMinimum, falloffMaximum]
        .some((value) => value === null) ||
      falloffMinimum >= targetMinimum ||
      targetMinimum > targetMaximum ||
      targetMaximum >= falloffMaximum
    ) {
      return this.unavailable("target_range_invalid", {
        metricId: String(powerConfig?.statPath || "target_range"),
      });
    }

    let normalized = 1;
    if (rawValue < targetMinimum) {
      normalized =
        (rawValue - falloffMinimum) / (targetMinimum - falloffMinimum);
    } else if (rawValue > targetMaximum) {
      normalized =
        (falloffMaximum - rawValue) / (falloffMaximum - targetMaximum);
    }
    normalized = Math.max(0, Math.min(1, normalized));
    return this.available({
      metricId: String(powerConfig.statPath).split(".").pop(),
      rawValue,
      normalized,
      minimum: falloffMinimum,
      maximum: falloffMaximum,
      outOfRange: rawValue < falloffMinimum
        ? "below"
        : rawValue > falloffMaximum
          ? "above"
          : null,
    });
  }
}
