class InventoryItemFactory {
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

    const hasRuntimeRarity = Object.prototype.hasOwnProperty.call(
      source,
      "rarity",
    );
    const raritySource = hasRuntimeRarity && source.rarity != null
      ? source.rarity
      : baseItem.rarityProfile;
    const rarity =
      raritySource === null
        ? null
        : this.#itemRarityResolver.resolve(raritySource);

    return {
      ...source,
      rarity,
    };
  }

  createMany(sources = []) {
    if (!Array.isArray(sources)) return [];
    return sources.map((source) => this.create(source));
  }
}
