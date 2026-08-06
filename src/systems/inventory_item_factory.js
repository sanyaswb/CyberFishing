class InventoryItemFactory {
  static #derivedProgressionKeys = new Set([
    "progression",
    "powerPercent",
    "powerLevel",
    "normalizedPower",
    "powerColor",
    "powerGradient",
    "qualityMax",
    "capacityPercent",
    "capacityMeters",
    "capacityMaximumMeters",
    "condition",
    "conditionPercent",
  ]);

  #itemDatabase;
  #itemRarityResolver;

  constructor({ itemDatabase, itemRarityResolver }) {
    if (!itemDatabase || typeof itemDatabase.getItemData !== "function") {
      throw new TypeError("InventoryItemFactory requires itemDatabase");
    }
    if (!itemRarityResolver || typeof itemRarityResolver.resolve !== "function") {
      throw new TypeError("InventoryItemFactory requires itemRarityResolver");
    }
    this.#itemDatabase = itemDatabase;
    this.#itemRarityResolver = itemRarityResolver;
  }

  create(source) {
    if (!source || typeof source !== "object") {
      throw new TypeError("Inventory item source must be an object");
    }
    const baseItem = this.#itemDatabase.getItemData(source.itemId);
    if (!baseItem) {
      throw new RangeError(`Unknown inventory item: ${source.itemId}`);
    }

    const canonicalSource = this.#withoutDerivedProgression(source);
    const hasRuntimeRarity = Object.prototype.hasOwnProperty.call(
      canonicalSource,
      "rarity",
    );
    const raritySource = hasRuntimeRarity && canonicalSource.rarity != null
      ? canonicalSource.rarity
      : baseItem.rarityProfile;
    const rarity =
      raritySource === null
        ? null
        : this.#itemRarityResolver.resolve(raritySource);

    return {
      ...canonicalSource,
      rarity,
    };
  }

  createMany(sources = []) {
    if (!Array.isArray(sources)) return [];
    return sources.map((source) => this.create(source));
  }

  #withoutDerivedProgression(source) {
    const canonical = {};
    for (const [key, value] of Object.entries(source)) {
      if (!InventoryItemFactory.#derivedProgressionKeys.has(key)) {
        canonical[key] = value;
      }
    }
    return canonical;
  }
}
