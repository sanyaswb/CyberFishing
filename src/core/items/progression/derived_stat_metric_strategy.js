class DerivedStatMetricStrategy extends ItemMetricStrategy {
  constructor() {
    super("derived_stat");
  }

  evaluate({ item, powerConfig } = {}) {
    const formulaId = powerConfig?.formulaId;
    if (formulaId === "ratio") {
      return this.#resolveRatio(item, powerConfig);
    }
    if (formulaId === "upgrade_level_stat") {
      return this.#resolveUpgradeLevelStat(item, powerConfig);
    }
    return this.unavailable("unsupported_formula", {
      metricId: String(formulaId || "derived_stat"),
    });
  }

  #resolveRatio(item, config) {
    const numerator = this.finiteNumber(
      this.readPath(item, config?.numeratorPath),
    );
    const denominator = this.finiteNumber(
      this.readPath(item, config?.denominatorPath),
    );
    if (numerator === null || denominator === null || denominator === 0) {
      return this.unavailable("metric_missing", {
        metricId: "ratio",
      });
    }
    return this.available({
      metricId: "ratio",
      rawValue: numerator / denominator,
      inputs: Object.freeze({ numerator, denominator }),
    });
  }

  #resolveUpgradeLevelStat(item, config) {
    const table = this.readPath(item, config?.tablePath);
    const level = this.readPath(item, config?.levelPath);
    const rawValue = this.finiteNumber(table?.[level]?.[config?.statKey]);
    if (rawValue === null) {
      return this.unavailable("metric_missing", {
        metricId: String(config?.statKey || "upgrade_level_stat"),
      });
    }
    return this.available({
      metricId: String(config.statKey),
      rawValue,
      inputs: Object.freeze({ level: Number(level) }),
    });
  }
}
