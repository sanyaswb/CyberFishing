class ItemQualityResolver {
  resolve({ item, qualityConfig } = {}) {
    if (!qualityConfig || typeof qualityConfig !== "object") {
      return this.#unavailable("quality_config_missing");
    }
    const minimum = Number(qualityConfig.min);
    const maximum = Number(qualityConfig.maxSections);
    const runtimeValue = Object.prototype.hasOwnProperty.call(
      item || {},
      "quality",
    )
      ? item.quality
      : this.#readPath(item, qualityConfig.statPath);
    const value = Number(runtimeValue);
    if (!Number.isFinite(value)) return this.#unavailable("quality_missing");
    if (
      !Number.isFinite(minimum) ||
      !Number.isInteger(maximum) ||
      minimum >= maximum ||
      value < minimum ||
      value > maximum
    ) {
      return this.#unavailable("quality_out_of_range");
    }

    const filledSections = Math.max(
      0,
      Math.min(maximum, Math.round(value)),
    );
    return Object.freeze({
      available: true,
      reason: null,
      value,
      minimum,
      maximum,
      filledSections,
      totalSections: maximum,
      fillRatio: value / maximum,
      visualPosition: (value - minimum) / (maximum - minimum),
    });
  }

  #readPath(source, path) {
    if (!source || !path) return undefined;
    let current = source;
    for (const part of String(path).split(".")) {
      if (!current || typeof current !== "object") return undefined;
      current = current[part];
    }
    return current;
  }

  #unavailable(reason) {
    return Object.freeze({
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
  }
}
