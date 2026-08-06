class ItemProgressionResolver {
  #configProvider;
  #powerResolver;
  #levelResolver;
  #qualityResolver;
  #capacityResolver;
  #baselineRegistry;
  #cache = new Map();
  #revision = 0;

  constructor({
    configProvider,
    powerResolver,
    levelResolver,
    qualityResolver,
    capacityResolver = null,
    baselineRegistry,
  } = {}) {
    if (typeof configProvider !== "function") {
      throw new TypeError("ItemProgressionResolver requires configProvider");
    }
    if (!powerResolver || typeof powerResolver.resolve !== "function") {
      throw new TypeError("ItemProgressionResolver requires powerResolver");
    }
    if (!levelResolver || typeof levelResolver.resolve !== "function") {
      throw new TypeError("ItemProgressionResolver requires levelResolver");
    }
    if (!qualityResolver || typeof qualityResolver.resolve !== "function") {
      throw new TypeError("ItemProgressionResolver requires qualityResolver");
    }
    this.#configProvider = configProvider;
    this.#powerResolver = powerResolver;
    this.#levelResolver = levelResolver;
    this.#qualityResolver = qualityResolver;
    this.#capacityResolver = capacityResolver;
    this.#baselineRegistry = baselineRegistry || null;
  }

  resolve(item, context = {}) {
    const profile = item?.progressionProfile;
    if (!profile) return this.#unavailable("technical_item");
    const config = this.#configProvider() || {};
    const groupId = String(profile.groupId || "");
    const groupConfig = config.groups?.[groupId];
    if (!groupConfig) return this.#unavailable("group_missing", groupId);

    const capacity = this.#capacityResolver?.resolve?.({
      item,
      capacityConfig: groupConfig.capacity,
      context,
    }) || this.#unavailableCapacity("capacity_resolver_missing");
    const signature = this.#buildSignature(
      item,
      groupId,
      groupConfig,
      config.revision,
    );
    let core = this.#cache.get(signature);
    if (!core) {
      const power = this.#powerResolver.resolve({ item, groupId, groupConfig });
      const level = this.#levelResolver.resolve(power, config.levelScale);
      const quality = this.#qualityResolver.resolve({
        item,
        qualityConfig: groupConfig.quality,
      });
      const defaultCapacity = this.#unavailableCapacity(
        "capacity_config_missing",
      );
      core = Object.freeze({
        available: power.available || level.available || quality.available,
        reason: power.available || level.available || quality.available
          ? null
          : power.reason || level.reason || quality.reason,
        groupId,
        power,
        level,
        quality,
        descriptor: new ItemProgressionDescriptor({
          available: power.available || level.available || quality.available,
          reason: power.available || level.available || quality.available
            ? null
            : power.reason || level.reason || quality.reason,
          groupId,
          power,
          level,
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
      power: core.power,
      level: core.level,
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
    this.#collectMetricPaths(groupConfig.power, paths);
    if (groupConfig.quality?.statPath) paths.add(groupConfig.quality.statPath);
    const values = [];
    for (const path of Array.from(paths).sort()) {
      values.push([path, this.#readPath(item, path)]);
    }
    values.push(["qualityOverride", item?.quality]);
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
      "levelPath",
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
    const unavailablePower = Object.freeze({
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
    const unavailableLevel = Object.freeze({
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
      power: unavailablePower,
      level: unavailableLevel,
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
