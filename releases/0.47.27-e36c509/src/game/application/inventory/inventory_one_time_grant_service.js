import { InventoryItemLocation } from "../../domain/inventory/inventory_item_location.js";

// Configured one-time grants ({ id, itemId, quantity }) for saves made before an item existed (spec 143 D-P7: the
// first battery). Each grant adds a new inventory item (or, when the item is already there, adds nothing) and marks
// its id in one inventory transaction, whose commit saves both; a marked grant is never applied again.
export class InventoryOneTimeGrantService {
  #ledger;
  #repository;
  #transaction;
  #definitionLookup;
  #instanceIdFactory;

  constructor({ ledger, repository, transaction, definitionLookup, instanceIdFactory }) {
    this.#ledger = ledger;
    this.#repository = repository;
    this.#transaction = transaction;
    this.#definitionLookup = definitionLookup;
    this.#instanceIdFactory = instanceIdFactory;
  }

  apply(grants = []) {
    const pending = (Array.isArray(grants) ? grants : []).filter((grant) =>
      grant?.id && !this.#ledger.has(grant.id) && this.#definitionLookup(grant.itemId));
    if (pending.length === 0) return Object.freeze([]);
    return Object.freeze(this.#transaction.runAtomic(() => pending.map((grant) => {
      // An inventory that already holds the item (a start or an earlier conversion with it) is only marked.
      if (this.#repository.find((entry) => entry.itemId === grant.itemId).length > 0) {
        this.#ledger.mark(grant.id);
        return Object.freeze({ grantId: grant.id, instanceId: null });
      }
      const quantity = Number.isInteger(grant.quantity) && grant.quantity > 0 ? grant.quantity : 1;
      const item = this.#repository.add({
        instanceId: this.#instanceIdFactory("item"),
        itemId: grant.itemId,
        quantity,
        location: InventoryItemLocation.inventory(),
      });
      this.#ledger.mark(grant.id);
      return Object.freeze({ grantId: grant.id, instanceId: item.instanceId });
    })));
  }
}
