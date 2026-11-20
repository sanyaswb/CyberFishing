// Spec 179 stage F (TK-340), spec 181; spec 184 D4 (TK-376): using an item with gameplayStats.use ({ statusId }) — a
// drink drunk from its editor («Випити») or from the HUD's drink button (the drink slot's stack). Its status starts
// (or stacks by its rule) first, so a refused use keeps the item; then one piece is consumed in one inventory
// transaction (its commit saves). The last piece in a slot leaves the slot empty (InventoryItemRemovalService).
// effects: PlayerStatusEffects' { apply(statusId, { source }) → boolean }, set once the statuses are composed.
export class InventoryItemUse {
  #repository;
  #hydrator;
  #itemRemoval;
  #transaction;
  #effects = null;

  constructor({ repository, hydrator, itemRemoval, transaction }) {
    if (typeof itemRemoval?.consume !== "function") throw new TypeError("InventoryItemUse requires itemRemoval");
    if (typeof transaction?.runAtomic !== "function") throw new TypeError("InventoryItemUse requires transaction");
    this.#repository = repository;
    this.#hydrator = hydrator;
    this.#itemRemoval = itemRemoval;
    this.#transaction = transaction;
  }

  setEffects(effects) {
    this.#effects = effects || null;
  }

  // Returns { used: true, statusId, gone } or { used: false, reason: "not-found" | "not-usable" | "unavailable" }.
  use(instanceId) {
    const source = instanceId ? this.#repository.get(instanceId) : null;
    if (!source) return Object.freeze({ used: false, reason: "not-found" });
    // The hydrated item carries its gameplay stats as effectiveStats (authored stats with the instance's overrides).
    const use = this.#hydrator.hydrate(source, this.#repository)?.effectiveStats?.use;
    if (!use || typeof use !== "object" || typeof use.statusId !== "string") {
      return Object.freeze({ used: false, reason: "not-usable" });
    }
    if (!this.#effects?.apply(use.statusId, { source: source.itemId })) {
      return Object.freeze({ used: false, reason: "unavailable" });
    }
    this.#transaction.runAtomic(() => this.#itemRemoval.consume(instanceId, 1));
    return Object.freeze({ used: true, statusId: use.statusId, gone: !this.#repository.has(instanceId) });
  }
}
