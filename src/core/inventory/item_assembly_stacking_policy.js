class ItemAssemblyStackingPolicy {
  static #ignoredKeys = new Set(["instanceId", "quantity"]);

  canStack(left, right) {
    if (!left || !right || left.itemId !== right.itemId) return false;
    if (!InventoryItemLocation.isInventory(left.location)) return false;
    if (!InventoryItemLocation.isInventory(right.location)) return false;

    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    for (const key of keys) {
      if (ItemAssemblyStackingPolicy.#ignoredKeys.has(key)) continue;
      if (this.#stableSerialize(left[key]) !== this.#stableSerialize(right[key])) {
        return false;
      }
    }
    return true;
  }

  #stableSerialize(value) {
    if (Array.isArray(value)) {
      return `[${value.map((entry) => this.#stableSerialize(entry)).join(",")}]`;
    }
    if (value && typeof value === "object") {
      const entries = Object.keys(value)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${this.#stableSerialize(value[key])}`);
      return `{${entries.join(",")}}`;
    }
    return JSON.stringify(value);
  }
}
