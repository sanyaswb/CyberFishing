import { InventoryItemLocation } from "../../domain/inventory/inventory_item_location.js";

// Adds new catalog items to the inventory. The repository change runs in the inventory transaction, whose commit
// saves the inventory, and the change is then announced once. The DEV item grant is the only caller today.
export class InventoryItemGrantService {
  #repository;
  #transaction;
  #definitionLookup;
  #instanceIdFactory;
  #notify;

  constructor({ repository, transaction, definitionLookup, instanceIdFactory, notify }) {
    this.#repository = repository;
    this.#transaction = transaction;
    this.#definitionLookup = definitionLookup;
    this.#instanceIdFactory = instanceIdFactory;
    this.#notify = notify;
  }

  grant(itemId, quantity = 1) {
    const count = Number(quantity);
    const definition = this.#definitionLookup(itemId);
    if (!Number.isInteger(count) || count < 1 || !definition) {
      return Object.freeze({ success: false, instanceId: null });
    }
    const item = this.#transaction.runAtomic(() => {
      const stack = definition.itemType === "aquarium_feed" ? this.#repository.list().find((entry) =>
        entry.itemId === itemId && InventoryItemLocation.isInventory(entry.location)) : null;
      if (stack) {
        if (!Number.isSafeInteger(stack.quantity + count)) throw new RangeError("Inventory quantity exceeds safe integer");
        return this.#repository.update(stack.instanceId, { quantity: stack.quantity + count });
      }
      return this.#repository.add({
        instanceId: this.#instanceIdFactory("item"),
        itemId,
        quantity: count,
        location: InventoryItemLocation.inventory(),
      });
    });
    this.#notify();
    return Object.freeze({ success: true, instanceId: item.instanceId });
  }
}
