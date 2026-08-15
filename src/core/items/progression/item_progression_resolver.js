class ItemProgressionResolver {
  #configProvider;
  #ratingResolver;
  #ratingTierResolver;
  #qualityResolver;
  #capacityResolver;
  #baselineRegistry;
  #effectiveStatsResolver;
  #cache = new Map();
  #revision = 0;

  constructor({
    configProvider,
    ratingResolver,
    ratingTierResolver = null,
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
    if (ratingTierResolver && typeof ratingTierResolver.resolve !== "function") {
      throw new TypeError(
        "ItemProgressionResolver ratingTierResolver must implement resolve",
      );
    }
    if (!qualityResolver || typeof qualityResolver.resolve !== "function") {
      throw new TypeError("ItemProgressionResolver requires qualityResolver");
    }
    this.#configProvider = configProvider;
    this.#ratingResolver = ratingResolver;
    this.#ratingTierResolver = ratingTierResolver;
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
    if (!profile) return this.#empty("technical_item");

    const config = this.#configProvider() || {};
    const groupId = String(profile.groupId || "");
    const groupConfig = config.groups?.[groupId];
    if (!groupConfig) return this.#empty("group_missing", groupId);

    const signature = this.#buildSignature(
      effectiveItem,
      groupId,
      groupConfig,
      config.revision,
    );
    let core = this.#cache.get(signature);
    if (!core) {
      core = this.#resolveCore(effectiveItem, groupId, groupConfig);
      this.#cache.set(signature, core);
    }

    if (!groupConfig.capacity) return core;
    const capacity = this.#capacityResolver?.resolve?.({
      item: effectiveItem,
      capacityConfig: groupConfig.capacity,
      context,
    }) || Object.freeze({
      available: false,
      reason: "capacity_resolver_missing",
    });
    return this.#descriptor({
      groupId,
      rating: core.rating,
      ratingTier: core.ratingTier,
      quality: core.quality,
      capacity,
    });
  }

  invalidate() {
    this.#revision += 1;
    this.#cache.clear();
    this.#baselineRegistry?.invalidate?.();
  }

  #resolveCore(item, groupId, groupConfig) {
    const rating = groupConfig.rating
      ? this.#ratingResolver.resolve({ item, groupId, groupConfig })
      : null;
    const ratingTier = groupConfig.ratingTier
      ? this.#ratingTierResolver?.resolve?.(rating, groupConfig.ratingTier) ||
        Object.freeze({
          available: false,
          reason: "rating_tier_resolver_missing",
        })
      : null;
    const quality = groupConfig.quality
      ? this.#qualityResolver.resolve({
          item,
          qualityConfig: groupConfig.quality,
        })
      : null;
    return this.#descriptor({ groupId, rating, ratingTier, quality });
  }

  #descriptor({
    groupId,
    rating = null,
    ratingTier = null,
    quality = null,
    capacity = null,
  }) {
    const descriptors = [rating, ratingTier, quality, capacity].filter(Boolean);
    const available = descriptors.some((descriptor) => descriptor.available);
    return new ItemProgressionDescriptor({
      available,
      reason: available
        ? null
        : descriptors.find((descriptor) => descriptor.reason)?.reason ||
          "capabilities_not_configured",
      groupId,
      rating,
      ratingTier,
      quality,
      capacity,
    });
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

  #empty(reason, groupId = null) {
    return new ItemProgressionDescriptor({
      available: false,
      reason,
      groupId,
    });
  }
}

globalThis.ItemProgressionResolver = ItemProgressionResolver;
