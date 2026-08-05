class ItemRarityResolver {
  #strategyRegistry;

  constructor({ strategyRegistry = null } = {}) {
    this.#strategyRegistry =
      strategyRegistry ||
      new ItemRarityStrategyRegistry([new AuthoredItemRarityStrategy()]);
  }

  resolve(rarityProfile) {
    if (!rarityProfile || typeof rarityProfile !== "object") {
      throw new TypeError("ItemRarityResolver requires rarityProfile");
    }
    return this.#strategyRegistry.resolve(rarityProfile);
  }
}
