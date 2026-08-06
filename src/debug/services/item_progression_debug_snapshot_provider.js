class ItemProgressionDebugSnapshotProvider {
  #itemDb;
  #progressionResolver;

  constructor({ itemDb = {}, progressionResolver } = {}) {
    if (!progressionResolver || typeof progressionResolver.resolve !== "function") {
      throw new TypeError(
        "ItemProgressionDebugSnapshotProvider requires progressionResolver",
      );
    }
    this.#itemDb = itemDb;
    this.#progressionResolver = progressionResolver;
  }

  getSnapshots() {
    const snapshots = [];
    for (const [categoryId, category] of Object.entries(this.#itemDb || {})) {
      if (categoryId === "builds") continue;
      for (const item of Object.values(category || {})) {
        if (!item?.progressionProfile) continue;
        const hydrated = {
          ...item,
          ...(item.engineStats || {}),
          engineStats: { ...(item.engineStats || {}) },
        };
        const progression = this.#progressionResolver.resolve(hydrated);
        snapshots.push(Object.freeze({
          itemId: item.id,
          group: progression.groupId,
          strategy: progression.power.strategyId,
          rawMetric: progression.power.rawValue,
          baseline: progression.power.available
            ? `${this.#format(progression.power.minimum)}–${this.#format(
                progression.power.maximum,
              )}`
            : "N/A",
          normalizedPower: progression.power.normalized,
          powerPercent: progression.power.percent,
          powerLevel: progression.level.available
            ? `${progression.level.current}/${progression.level.maximum}`
            : "N/A",
          quality: progression.quality.available
            ? `${this.#format(progression.quality.value)}/${progression.quality.maximum}`
            : "N/A",
          capacity: progression.capacity?.available
            ? `${this.#format(progression.capacity.current)}/${this.#format(
                progression.capacity.maximum,
              )} ${progression.capacity.metricSuffix} (${this.#format(
                progression.capacity.percent,
              )}%)`
            : "N/A",
          capacitySource: progression.capacity?.source || "N/A",
          outOfRange: progression.power.outOfRange || "none",
          configSource: progression.power.configSource || "N/A",
          breakdown: progression.power.breakdown || Object.freeze([]),
        }));
      }
    }
    return snapshots.sort((left, right) =>
      String(left.itemId).localeCompare(String(right.itemId)),
    );
  }

  #format(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "N/A";
    if (Number.isInteger(number)) return String(number);
    return number.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
  }
}
