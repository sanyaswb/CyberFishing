export class ItemRarityResolver {
  #strategyRegistry;

  // strategyRegistry: the rarity strategies composed in bootstrap (the authored strategy today).
  constructor({ strategyRegistry } = {}) {
    this.#strategyRegistry = strategyRegistry;
  }

  resolve(rarityProfile) {
    if (!rarityProfile || typeof rarityProfile !== "object") {
      throw new TypeError("ItemRarityResolver requires rarityProfile");
    }
    return this.#strategyRegistry.resolve(rarityProfile);
  }
}
