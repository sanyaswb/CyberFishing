// The one-time grants this inventory has already received (spec 143 D-P7: an existing save gets its first battery
// once). Saved with the inventory, so a reload, a merge or a spent item never repeats a grant.
export class InventoryGrantLedger {
  #ids;

  constructor(ids = []) {
    this.#ids = new Set(InventoryGrantLedger.#normalize(ids));
  }

  has(grantId) {
    return this.#ids.has(String(grantId));
  }

  mark(grantId) {
    const id = String(grantId || "");
    if (!id) throw new TypeError("InventoryGrantLedger.mark requires a grant id");
    this.#ids.add(id);
  }

  snapshot() {
    return [...this.#ids].sort();
  }

  // Transaction participant: a rolled-back grant leaves no mark.
  restore(ids = []) {
    this.#ids = new Set(InventoryGrantLedger.#normalize(ids));
  }

  static #normalize(ids) {
    return Array.isArray(ids) ? ids.filter((id) => typeof id === "string" && id.length > 0) : [];
  }
}
