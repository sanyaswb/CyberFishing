/**
 * Explicit mutable subset of ItemDefinition.gameplayStats.
 *
 * A gameplay stat is authored and immutable by default. Adding a rule here is
 * an architectural decision: a runtime system must own and persist that
 * instance-level value.
 */
const ITEM_STAT_OVERRIDE_CONFIG = (() => {
  const deepFreeze = (value) => {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) {
      return value;
    }
    for (const entry of Object.values(value)) deepFreeze(entry);
    return Object.freeze(value);
  };

  return deepFreeze({
    revision: 1,
    stats: {
      lengthMeters: {
        valueType: "number",
        minimum: 0,
        operations: ["set"],
        itemTypes: ["fishing_line"],
      },
      durability: {
        valueType: "number",
        minimum: 0,
        maximum: 100,
        operations: ["set"],
      },
      quality: {
        valueType: "number",
        minimum: 1,
        maximum: 10,
        operations: ["set"],
      },
      upgradeLevel: {
        valueType: "integer",
        minimum: 1,
        operations: ["set"],
        itemTypes: ["boat"],
      },
    },
  });
})();

globalThis.ITEM_STAT_OVERRIDE_CONFIG = ITEM_STAT_OVERRIDE_CONFIG;
