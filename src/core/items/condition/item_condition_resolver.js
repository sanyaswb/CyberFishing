class ItemConditionResolver {
  #configProvider;

  constructor({ configProvider } = {}) {
    if (typeof configProvider !== "function") {
      throw new TypeError("ItemConditionResolver requires configProvider");
    }
    this.#configProvider = configProvider;
  }

  resolve(item) {
    const config = this.#configProvider() || {};
    const minimum = Number(config.minimum);
    const maximum = Number(config.maximum);
    if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum >= maximum) {
      return this.#unavailable("invalid_config");
    }

    const runtimeValue = this.#readPath(item, config.runtimeOverridePath);
    const authoredValue = this.#readPath(item, config.statPath);
    const hasRuntime = runtimeValue !== undefined && runtimeValue !== null;
    const hasAuthored = authoredValue !== undefined && authoredValue !== null;
    const source = hasRuntime ? "runtime" : hasAuthored ? "authored" : "default";
    const rawValue = hasRuntime
      ? runtimeValue
      : hasAuthored
        ? authoredValue
        : config.defaultCurrent;
    const numeric = Number(rawValue);
    if (!Number.isFinite(numeric)) return this.#unavailable("condition_missing");

    const current = Math.max(minimum, Math.min(maximum, numeric));
    const normalized = (current - minimum) / (maximum - minimum);
    return new ItemConditionDescriptor({
      available: true,
      source,
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
    return new ItemConditionDescriptor({ available: false, reason });
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
