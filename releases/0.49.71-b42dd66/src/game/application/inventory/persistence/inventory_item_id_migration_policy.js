export class InventoryItemIdMigrationPolicy {
  static #itemIdMap = {
    line_test_25m: "line_test_1",
    line_test_10m: "line_test_2",
    line_test_50m: "line_test_3",
  };
  static #removedItemIds = new Set(["sinker_light"]);

  static migrateItems(items = []) {
    if (!Array.isArray(items)) return [];
    const migrated = [];
    for (const item of items) {
      const next = this.migrateItem(item);
      if (next) migrated.push(next);
    }
    return migrated;
  }

  static migrateItem(item) {
    if (!item || typeof item !== "object") return item;
    const itemId = this.#itemIdMap[item.itemId] || item.itemId;
    if (this.#removedItemIds.has(itemId)) return null;
    if (itemId === item.itemId) return { ...item };
    return { ...item, itemId };
  }
}
