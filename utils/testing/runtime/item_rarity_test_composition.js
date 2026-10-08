"use strict";

// Composes the item rarity resolver the way GameCompositionRoot composes it (one authored strategy), from the
// classes a check has loaded.
function composeItemRarityResolver({ ItemRarityResolver, ItemRarityStrategyRegistry, AuthoredItemRarityStrategy }) {
  return new ItemRarityResolver({
    strategyRegistry: new ItemRarityStrategyRegistry([new AuthoredItemRarityStrategy()]),
  });
}

module.exports = { composeItemRarityResolver };
