/**
 * Resolves the immutable rarity descriptor exposed by runtime item views.
 *
 * Authored rarity belongs to ItemDefinition. ItemInstanceState may override it
 * only when the instance carries its own rarity fact. Persistence therefore
 * stays free of authored duplicates while every read model receives the same
 * effective descriptor after hydration.
 */
class EffectiveItemRarityResolver {
  #itemRarityResolver;

  constructor({ itemRarityResolver = new ItemRarityResolver() } = {}) {
    if (!itemRarityResolver || typeof itemRarityResolver.resolve !== "function") {
      throw new TypeError(
        "EffectiveItemRarityResolver requires itemRarityResolver.resolve",
      );
    }
    this.#itemRarityResolver = itemRarityResolver;
  }

  resolve({ definition, instanceState = null } = {}) {
    const instanceRarity = instanceState?.rarity;
    const source = instanceRarity ?? definition?.rarityProfile ?? null;
    if (!source) return null;
    return this.#itemRarityResolver.resolve(source);
  }
}

globalThis.EffectiveItemRarityResolver = EffectiveItemRarityResolver;
