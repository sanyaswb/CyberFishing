class ItemRarityStrategyRegistry {
  #strategies = [];

  constructor(strategies = []) {
    for (const strategy of strategies) this.register(strategy);
  }

  register(strategy) {
    if (
      !strategy ||
      typeof strategy.supports !== "function" ||
      typeof strategy.resolve !== "function"
    ) {
      throw new TypeError(
        "Item rarity strategy requires supports and resolve methods",
      );
    }
    this.#strategies.push(strategy);
    return this;
  }

  resolve(profile) {
    for (const strategy of this.#strategies) {
      if (strategy.supports(profile)) return strategy.resolve(profile);
    }
    const mode = String(profile?.mode || "<missing>");
    throw new RangeError(`Unsupported item rarity mode: ${mode}`);
  }
}
