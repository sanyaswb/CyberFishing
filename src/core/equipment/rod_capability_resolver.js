class RodCapabilityResolver {
  resolve(rod) {
    const equipmentCapabilities =
      rod?.equipmentCapabilities || rod?.engineStats?.equipmentCapabilities || {};
    const direct = this.#asCapabilityMap(rod?.capabilities);
    const engine = this.#asCapabilityMap(rod?.engineStats?.capabilities);
    const authored = rod?.capabilities && !Array.isArray(rod.capabilities)
      ? rod.capabilities
      : {};
    const engineAuthored =
      rod?.engineStats?.capabilities && !Array.isArray(rod.engineStats.capabilities)
        ? rod.engineStats.capabilities
        : {};

    return Object.freeze({
      supportsReel: this.#firstBoolean(
        equipmentCapabilities.supportsReel,
        authored.supportsReel,
        engineAuthored.supportsReel,
        rod?.supportsReel,
        rod?.engineStats?.supportsReel,
        rod?.hasReel,
        rod?.engineStats?.hasReel,
        direct.has("reel") || engine.has("reel"),
      ),
      supportsFloat: this.#firstBoolean(
        equipmentCapabilities.supportsFloat,
        authored.supportsFloat,
        engineAuthored.supportsFloat,
        rod?.supportsFloat,
        rod?.engineStats?.supportsFloat,
        direct.has("float") || engine.has("float"),
      ),
      supportsFeederRig: this.#firstBoolean(
        equipmentCapabilities.supportsFeederRig,
        authored.supportsFeederRig,
        engineAuthored.supportsFeederRig,
        rod?.supportsFeederRig,
        rod?.engineStats?.supportsFeederRig,
        direct.has("feeder_rig") || engine.has("feeder_rig"),
      ),
      supportsLures: this.#firstBoolean(
        equipmentCapabilities.supportsLures,
        authored.supportsLures,
        engineAuthored.supportsLures,
        rod?.supportsLures,
        rod?.engineStats?.supportsLures,
        direct.has("lure") || engine.has("lure"),
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
