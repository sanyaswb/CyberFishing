class BaitEffectivenessCatalogResolver {
  #fishDatabase;
  #resolver;
  #supportedItemTypes;

  constructor({
    fishDatabase,
    resolver,
    supportedItemTypes = ["bait", "lure"],
  } = {}) {
    if (!resolver || typeof resolver.resolve !== "function") {
      throw new TypeError(
        "BaitEffectivenessCatalogResolver requires resolver.resolve",
      );
    }
    this.#fishDatabase = this.#normalizeFishDatabase(fishDatabase);
    this.#resolver = resolver;
    this.#supportedItemTypes = new Set(supportedItemTypes);
  }

  resolve(item, context = {}) {
    const baitId = String(item?.itemId || item?.id || "");
    const itemType = String(item?.itemType || "");
    if (!baitId || !this.#supportedItemTypes.has(itemType)) {
      return this.#unavailable(baitId, "unsupported_item");
    }

    const entries = this.#fishDatabase
      .map((fish) => this.#resolver.resolve(fish, item, context))
      .filter((entry) => entry.available);
    if (entries.length === 0) {
      return this.#unavailable(baitId, "fish_catalog_empty");
    }

    return Object.freeze({
      capabilityId: "baitEffectiveness",
      available: true,
      reason: null,
      baitId,
      entries: Object.freeze(entries),
    });
  }

  #normalizeFishDatabase(source) {
    if (Array.isArray(source)) return [...source];
    if (Array.isArray(source?.fishes)) return [...source.fishes];
    return [];
  }

  #unavailable(baitId, reason) {
    return Object.freeze({
      capabilityId: "baitEffectiveness",
      available: false,
      reason,
      baitId,
      entries: Object.freeze([]),
    });
  }
}

globalThis.BaitEffectivenessCatalogResolver =
  BaitEffectivenessCatalogResolver;
