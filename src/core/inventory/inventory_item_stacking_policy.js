class InventoryItemStackingPolicy {
  static #ignoredKeys = new Set([
    "instanceId",
    "quantity",
    "buildId",
    "progression",
    "powerPercent",
    "powerLevel",
    "normalizedPower",
    "powerColor",
    "powerGradient",
    "qualityMax",
  ]);

  canStack(left, right) {
    if (!left || !right || left.itemId !== right.itemId) return false;
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    for (const key of keys) {
      if (InventoryItemStackingPolicy.#ignoredKeys.has(key)) continue;
      if (JSON.stringify(left[key]) !== JSON.stringify(right[key])) {
        return false;
      }
    }
    return true;
  }
}
