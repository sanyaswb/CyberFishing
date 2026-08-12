class ItemProgressionResolver {
  #configProvider;
  #ratingResolver;
  #progressionLevelResolver;
  #qualityResolver;
  #capacityResolver;
  #baselineRegistry;
  #effectiveStatsResolver;
  #cache = new Map();
  #revision = 0;

  constructor({
    configProvider,
    ratingResolver,
    progressionLevelResolver,
    qualityResolver,
    capacityResolver = null,
    baselineRegistry,
    effectiveStatsResolver = new EffectiveItemStatsResolver(),
  } = {}) {
    if (typeof configProvider !== "function") {
      throw new TypeError("ItemProgressionResolver requires configProvider");
    }
    if (!ratingResolver || typeof ratingResolver.resolve !== "function") {
      throw new TypeError("ItemProgressionResolver requires ratingResolver");
    }
    if (
      !progressionLevelResolver ||
      typeof progressionLevelResolver.resolve !== "function"
    ) {
      throw new TypeError(
        "ItemProgressionResolver requires progressionLevelResolver",
      );
    }
    if (!qualityResolver || typeof qualityResolver.resolve !== "function") {
      throw new TypeError("ItemProgressionResolver requires qualityResolver");
    }
    this.#configProvider = configProvider;
    this.#ratingResolver = ratingResolver;
    this.#progressionLevelResolver = progressionLevelResolver;
    this.#qualityResolver = qualityResolver;
    this.#capacityResolver = capacityResolver;
    this.#baselineRegistry = baselineRegistry || null;
    this.#effectiveStatsResolver = effectiveStatsResolver;
  }

  resolve(item, context = {}) {
    const effectiveItem = item?.effectiveStats
      ? item
      : {
          ...item,
          effectiveStats: this.#effectiveStatsResolver.resolve({
            definition: item,
            instanceState: item,
          }),
        };
    const profile = effectiveItem?.progressionProfile;
    if (!profile) return this.#unavailable("technical_item");
    const config = this.#configProvider() || {};
    const groupId = String(profile.groupId || "");
    const groupConfig = config.groups?.[groupId];
    if (!groupConfig) return this.#unavailable("group_missing", groupId);

    const capacity = this.#capacityResolver?.resolve?.({
      item: effectiveItem,
      capacityConfig: groupConfig.capacity,
      context,
    }) || this.#unavailableCapacity("capacity_resolver_missing");
    const signature = this.#buildSignature(
      effectiveItem,
      groupId,
      groupConfig,
      config.revision,
    );
    let core = this.#cache.get(signature);
    if (!core) {
      const rating = this.#ratingResolver.resolve({
        item: effectiveItem,
        groupId,
        groupConfig,
      });
      const progressionLevel = this.#progressionLevelResolver.resolve(
        rating,
        config.progressionLevelScale,
      );
      const quality = this.#qualityResolver.resolve({
        item: effectiveItem,
        qualityConfig: groupConfig.quality,
      });
      const defaultCapacity = this.#unavailableCapacity(
        "capacity_config_missing",
      );
      core = Object.freeze({
        available:
          rating.available || progressionLevel.available || quality.available,
        reason:
          rating.available || progressionLevel.available || quality.available
          ? null
          : rating.reason || progressionLevel.reason || quality.reason,
        groupId,
        rating,
        progressionLevel,
        quality,
        descriptor: new ItemProgressionDescriptor({
          available:
            rating.available || progressionLevel.available || quality.available,
          reason:
            rating.available || progressionLevel.available || quality.available
            ? null
            : rating.reason || progressionLevel.reason || quality.reason,
          groupId,
          rating,
          progressionLevel,
          quality,
          capacity: defaultCapacity,
        }),
      });
      this.#cache.set(signature, core);
    }
    if (!groupConfig.capacity) return core.descriptor;
    return new ItemProgressionDescriptor({
      available: core.available || capacity.available,
      reason: core.available || capacity.available
        ? null
        : core.reason || capacity.reason,
      groupId: core.groupId,
      rating: core.rating,
      progressionLevel: core.progressionLevel,
      quality: core.quality,
      capacity,
    });
  }

  invalidate() {
    this.#revision += 1;
    this.#cache.clear();
    this.#baselineRegistry?.invalidate?.();
  }

  #buildSignature(item, groupId, groupConfig, configRevision) {
    const paths = new Set();
    this.#collectMetricPaths(groupConfig.rating, paths);
    if (groupConfig.quality?.statPath) paths.add(groupConfig.quality.statPath);
    const values = [];
    for (const path of Array.from(paths).sort()) {
      values.push([path, this.#readPath(item, path)]);
    }
    values.push(["statOverrides", item?.statOverrides]);
    values.push(["rolledStats", item?.rolledStats]);
    return JSON.stringify([
      groupId,
      configRevision ?? 0,
      this.#revision,
      values,
    ]);
  }

  #collectMetricPaths(config, output) {
    if (!config || typeof config !== "object") return;
    for (const key of [
      "statPath",
      "numeratorPath",
      "denominatorPath",
      "tablePath",
      "upgradeLevelPath",
    ]) {
      if (config[key]) output.add(config[key]);
    }
    for (const component of config.components || []) {
      this.#collectMetricPaths(component, output);
    }
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

  #unavailable(reason, groupId = null) {
    const unavailableRating = Object.freeze({
      available: false,
      reason,
      strategyId: null,
      metricId: null,
      metricLabel: null,
      metricSuffix: "",
      rawValue: null,
      minimum: null,
      maximum: null,
      normalized: null,
      percent: null,
      outOfRange: null,
      configSource: null,
      breakdown: Object.freeze([]),
    });
    const unavailableProgressionLevel = Object.freeze({
      available: false,
      reason,
      current: null,
      maximum: null,
    });
    const unavailableQuality = Object.freeze({
      available: false,
      reason,
      value: null,
      minimum: null,
      maximum: null,
      filledSections: 0,
      totalSections: 0,
      fillRatio: 0,
      visualPosition: 0,
    });
    const unavailableCapacity = this.#unavailableCapacity(reason);
    return new ItemProgressionDescriptor({
      available: false,
      reason,
      groupId,
      rating: unavailableRating,
      progressionLevel: unavailableProgressionLevel,
      quality: unavailableQuality,
      capacity: unavailableCapacity,
    });
  }

  #unavailableCapacity(reason) {
    return Object.freeze({
      available: false,
      reason,
      strategyId: null,
      metricLabel: null,
      metricSuffix: "",
      detailLabel: null,
      source: null,
      current: null,
      maximum: null,
      used: null,
      normalized: null,
      percent: null,
    });
  }
}
