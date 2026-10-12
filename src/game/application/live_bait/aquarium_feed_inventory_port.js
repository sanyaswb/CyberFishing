import { FlatInventoryItemRepository } from "../../domain/inventory/flat_inventory_item_repository.js";
import { InventoryItemLocation } from "../../domain/inventory/inventory_item_location.js";

// The inventory is the sole stock owner. Working stock maps are detached transaction projections.
export class AquariumFeedInventoryPort {
  #store;
  #catalog;
  #synchronize;
  constructor({ store, catalog, synchronize = null }) {
    this.#store = store; this.#catalog = catalog; this.#synchronize = synchronize;
  }
  read() {
    const loaded = this.#store.read();
    if (!loaded.ok) return loaded;
    let snapshot = null;
    try { snapshot = loaded.raw === null ? null : JSON.parse(loaded.raw); }
    catch { return { ok: false, reason: "invalid_inventory" }; }
    if (snapshot && (snapshot.schemaVersion !== 4 || !Array.isArray(snapshot.items))) return { ok: false, reason: "invalid_inventory" };
    const stock = {};
    for (const item of snapshot?.items || []) if (Object.hasOwn(this.#catalog, item.itemId) && InventoryItemLocation.isInventory(item.location)) {
      if (!Number.isSafeInteger(item.quantity) || item.quantity < 1) return { ok: false, reason: "invalid_inventory" };
      stock[item.itemId] = (stock[item.itemId] || 0) + item.quantity;
    }
    return { ...loaded, snapshot, stock };
  }
  prepare(plan, stock) {
    if (Object.keys(this.#catalog).every((id) => (plan.stock[id] || 0) === (stock[id] || 0))) return { ok: true, changes: [] };
    if (!plan.snapshot) return { ok: false, reason: "inventory_required" };
    try {
      const repository = new FlatInventoryItemRepository({ items: plan.snapshot.items });
      for (const id of Object.keys(this.#catalog)) {
        const quantity = stock[id] || 0;
        if (!Number.isSafeInteger(quantity) || quantity < 0) return { ok: false, reason: "invalid_quantity" };
        const items = repository.list().filter((item) => item.itemId === id && InventoryItemLocation.isInventory(item.location));
        const previous = items.reduce((sum, item) => sum + item.quantity, 0);
        if (quantity === previous) continue;
        for (const item of items) repository.remove(item.instanceId);
        if (quantity > 0) repository.add({ ...(items[0] || { instanceId: `aquarium-stock:${id}`, itemId: id,
          location: InventoryItemLocation.inventory() }), quantity });
      }
      const snapshot = { ...plan.snapshot, items: repository.toSnapshot() };
      return { ok: true, changes: [{ key: plan.key, before: plan.raw, after: JSON.stringify(snapshot) }], snapshot };
    } catch (error) { return { ok: false, reason: "invalid_inventory", error }; }
  }
  synchronize(snapshot = null) {
    const current = snapshot || this.read().snapshot;
    if (current) this.#synchronize?.(current.items);
  }
}
