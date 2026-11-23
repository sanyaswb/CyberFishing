import { InventoryItemLocation } from "../../domain/inventory/inventory_item_location.js";
import { stacksAsOne } from "../../domain/inventory/consumable_stack_rule.js";

// Spec 184 D2 (TK-375): on load, identical loose stacks of an item kept as one (stacksAsOne: drinks, aquarium feed —
// an older save has each bottle apart) join into one, in one inventory transaction (its commit saves). Stacks in a slot
// or a loadout (reservationPolicy) and differing ones (the stacking policy) stay as they are; nothing to join — no
// transaction, no save.
export class InventoryStackConsolidation {
  #repository;
  #transaction;
  #definitionLookup;
  #stackingPolicy;
  #reservationPolicy;

  constructor({ repository, transaction, definitionLookup, stackingPolicy, reservationPolicy }) {
    if (typeof stackingPolicy?.canStack !== "function") throw new TypeError("InventoryStackConsolidation requires stackingPolicy");
    if (typeof reservationPolicy?.isReserved !== "function") {
      throw new TypeError("InventoryStackConsolidation requires reservationPolicy");
    }
    this.#repository = repository;
    this.#transaction = transaction;
    this.#definitionLookup = definitionLookup;
    this.#stackingPolicy = stackingPolicy;
    this.#reservationPolicy = reservationPolicy;
  }

  // Returns how many stacks joined another.
  apply() {
    if (!this.#hasDuplicates()) return 0;
    return this.#transaction.runAtomic(() => {
      let joined = 0;
      for (const item of this.#repository.list()) {
        if (!this.#repository.has(item.instanceId) || !this.#loose(item)) continue;
        const kept = this.#repository.mergeInventoryItem(item.instanceId, this.#stackingPolicy,
          { canMerge: (candidate) => this.#loose(candidate) });
        if (kept !== item.instanceId) joined += 1;
      }
      return joined;
    });
  }

  #hasDuplicates() {
    const items = this.#repository.list().filter((item) => this.#loose(item));
    for (let left = 0; left < items.length; left++) {
      for (let right = left + 1; right < items.length; right++) {
        if (this.#stackingPolicy.canStack(items[left], items[right])) return true;
      }
    }
    return false;
  }

  #loose(item) {
    return InventoryItemLocation.isInventory(item.location) && stacksAsOne(this.#definitionLookup(item.itemId)) &&
      !this.#reservationPolicy.isReserved(item) && this.#repository.getChildren(item.instanceId).length === 0;
  }
}
