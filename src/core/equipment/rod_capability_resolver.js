class RodCapabilityResolver {
  resolve(rod) {
    const equipmentCapabilities =
      rod?.effectiveStats?.equipmentCapabilities || {};
    const capabilities = this.#asCapabilityMap(
      rod?.effectiveStats?.capabilities,
    );
    const capabilityFlags =
      rod?.effectiveStats?.capabilities && !Array.isArray(rod.effectiveStats.capabilities)
        ? rod.effectiveStats.capabilities
        : {};

    return Object.freeze({
      supportsReel: this.#firstBoolean(
        equipmentCapabilities.supportsReel,
        capabilityFlags.supportsReel,
        rod?.effectiveStats?.supportsReel,
        rod?.effectiveStats?.hasReel,
        capabilities.has("reel"),
      ),
      supportsFloat: this.#firstBoolean(
        equipmentCapabilities.supportsFloat,
        capabilityFlags.supportsFloat,
        rod?.effectiveStats?.supportsFloat,
        capabilities.has("float"),
      ),
      supportsFeederRig: this.#firstBoolean(
        equipmentCapabilities.supportsFeederRig,
        capabilityFlags.supportsFeederRig,
        rod?.effectiveStats?.supportsFeederRig,
        capabilities.has("feeder_rig"),
      ),
      supportsLures: this.#firstBoolean(
        equipmentCapabilities.supportsLures,
        capabilityFlags.supportsLures,
        rod?.effectiveStats?.supportsLures,
        capabilities.has("lure"),
      ),
    });
  }

  #asCapabilityMap(value) {
    if (Array.isArray(value)) return new Set(value);
    if (!value || typeof value !== "object") return new Set();
    const enabled = [];
    for (const [key, isEnabled] of Object.entries(value)) {
      if (isEnabled === true) enabled.push(key);
    }
    return new Set(enabled);
  }

  #firstBoolean(...values) {
    for (let index = 0; index < values.length; index += 1) {
      if (typeof values[index] === "boolean") return values[index];
    }
    return false;
  }
}
