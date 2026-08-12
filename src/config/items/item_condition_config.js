/**
 * Single source of truth for the item-condition scale.
 * Rarity colors remain owned by RARITY_VISUAL_CONFIG.
 */
const ITEM_CONDITION_CONFIG = Object.freeze({
  revision: 1,
  statPath: "effectiveStats.durability",
  runtimeOverridePath: "statOverrides.durability",
  minimum: 0,
  maximum: 100,
  defaultCurrent: 100,
});
