class NumericStatMetricStrategy extends ItemMetricStrategy {
  constructor() {
    super("numeric_stat");
  }

  evaluate({ item, powerConfig } = {}) {
    const statPath = powerConfig?.statPath;
    const rawValue = this.finiteNumber(this.readPath(item, statPath));
    if (rawValue === null) {
      return this.unavailable("metric_missing", {
        metricId: String(statPath || "numeric_stat"),
      });
    }
    return this.available({
      metricId: String(statPath).split(".").pop(),
      rawValue,
    });
  }
}
