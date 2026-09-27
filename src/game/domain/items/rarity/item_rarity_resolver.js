import { AuthoredItemRarityStrategy } from "./authored_item_rarity_strategy.js";
import { ItemRarityStrategyRegistry } from "./item_rarity_strategy_registry.js";

export class ItemRarityResolver {
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
