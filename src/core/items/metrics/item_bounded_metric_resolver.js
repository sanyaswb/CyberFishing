class ItemBoundedMetricResolver {
  #capabilityId;
  #profileProvider;
  #descriptorFactory;

  constructor({ capabilityId, profileProvider, descriptorFactory } = {}) {
    if (!String(capabilityId || "").trim()) {
      throw new TypeError("ItemBoundedMetricResolver requires capabilityId");
    }
    if (typeof profileProvider !== "function") {
      throw new TypeError("ItemBoundedMetricResolver requires profileProvider");
    }
    if (typeof descriptorFactory !== "function") {
      throw new TypeError("ItemBoundedMetricResolver requires descriptorFactory");
    }
    this.#capabilityId = String(capabilityId);
    this.#profileProvider = profileProvider;
    this.#descriptorFactory = descriptorFactory;
  }

  resolve(item, capabilityConfig = undefined) {
    const config = capabilityConfig === undefined
      ? this.#profileProvider(item)
      : capabilityConfig;
    if (config === undefined || config === null) return null;
    if (!config || typeof config !== "object" || Array.isArray(config)) {
      return this.#unavailable("capability_config_invalid");
    }

    const minimum = Number(config.minimum);
    const maximum = Number(config.maximum);
    if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum >= maximum) {
      return this.#unavailable("capability_range_invalid");
    }

    const instanceValue = config.instanceStatePath
      ? this.#readPath(item, config.instanceStatePath)
      : undefined;
    const authoredValue = config.statPath
      ? this.#readPath(item, config.statPath)
      : undefined;
    const hasInstance = instanceValue !== undefined && instanceValue !== null;
    const hasAuthored = authoredValue !== undefined && authoredValue !== null;
    const hasDefault = config.defaultCurrent !== undefined;
    if (!hasInstance && !hasAuthored && !hasDefault) {
      return this.#unavailable(`${this.#capabilityId}_missing`);
    }

    const rawValue = hasInstance
      ? instanceValue
      : hasAuthored
        ? authoredValue
        : config.defaultCurrent;
    const numeric = Number(rawValue);
    if (!Number.isFinite(numeric)) {
      return this.#unavailable(`${this.#capabilityId}_invalid`);
    }

    const current = Math.max(minimum, Math.min(maximum, numeric));
    const normalized = (current - minimum) / (maximum - minimum);
    return this.#createDescriptor({
      available: true,
      reason: null,
      metricLabel: config.metricLabel || this.#capabilityId,
      source: hasInstance ? "instance" : hasAuthored ? "authored" : "default",
      rawValue: numeric,
      current,
      minimum,
      maximum,
      normalized,
      percent: normalized * 100,
      outOfRange: numeric < minimum ? "below" : numeric > maximum ? "above" : null,
    });
  }

  #unavailable(reason) {
    return this.#createDescriptor({ available: false, reason });
  }

  #createDescriptor(values) {
    return this.#descriptorFactory({
      capabilityId: this.#capabilityId,
      ...values,
    });
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
}

globalThis.ItemBoundedMetricResolver = ItemBoundedMetricResolver;
