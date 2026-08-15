class ItemProgressionDebugSnapshotProvider {
  #itemDb;
  #progressionResolver;
  #effectiveStatsResolver;

  constructor({
    itemDb = {},
    progressionResolver,
    effectiveStatsResolver = new EffectiveItemStatsResolver(),
  } = {}) {
    if (!progressionResolver || typeof progressionResolver.resolve !== "function") {
      throw new TypeError(
        "ItemProgressionDebugSnapshotProvider requires progressionResolver",
      );
    }
    this.#itemDb = itemDb;
    this.#progressionResolver = progressionResolver;
    this.#effectiveStatsResolver = effectiveStatsResolver;
  }

  getSnapshots() {
    const snapshots = [];
    for (const [categoryId, category] of Object.entries(this.#itemDb || {})) {
      if (categoryId === "builds") continue;
      for (const item of Object.values(category || {})) {
        if (!item?.progressionProfile) continue;
        const hydrated = {
          ...item,
          effectiveStats: this.#effectiveStatsResolver.resolve({
            definition: item,
          }),
        };
        const progression = this.#progressionResolver.resolve(hydrated);
        snapshots.push(Object.freeze({
          itemId: item.id,
          group: progression.groupId,
          strategy: progression.rating?.strategyId || "N/A",
          rawMetric: progression.rating?.rawValue ?? null,
          baseline: progression.rating?.available
            ? `${this.#format(progression.rating.minimum)}–${this.#format(
                progression.rating.maximum,
              )}`
            : "N/A",
          normalizedRating: progression.rating?.normalized ?? null,
          ratingPercent: progression.rating?.percent ?? null,
          ratingTier: progression.ratingTier?.available
            ? `${progression.ratingTier.current}/${progression.ratingTier.maximum}`
            : "N/A",
          quality: progression.quality?.available
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
          outOfRange: progression.rating?.outOfRange || "none",
          configSource: progression.rating?.configSource || "N/A",
          breakdown: progression.rating?.breakdown || Object.freeze([]),
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
