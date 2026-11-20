import { InventoryItemLocation } from "../../domain/inventory/inventory_item_location.js";
import { stacksAsOne } from "../../domain/inventory/consumable_stack_rule.js";

// Adds new catalog items to the inventory. The repository change runs in the inventory transaction, whose commit
// saves the inventory, and the change is then announced once. The DEV item grant is the only caller today.
// Spec 184 D2 (TK-375): an item kept as one stack (stacksAsOne: drinks, aquarium feed) joins an identical loose stack in
// the backpack (the stacking policy; never one in a slot or a loadout — reservationPolicy); anything else is new.
export class InventoryItemGrantService {
  #repository;
  #transaction;
  #definitionLookup;
  #instanceIdFactory;
  #notify;
  #capacity;
  #stackingPolicy;
  #reservationPolicy;

  // capacity: BackpackSlotCount (spec 164): a grant that does not fit the backpack is refused (reason backpack_full).
  // stackingPolicy: { canStack(left, right) }; reservationPolicy: { isReserved(item) }.
  constructor({ repository, transaction, definitionLookup, instanceIdFactory, notify, capacity, stackingPolicy,
    reservationPolicy }) {
    if (typeof capacity?.fitsAdding !== "function") throw new TypeError("InventoryItemGrantService requires capacity");
    if (typeof stackingPolicy?.canStack !== "function") throw new TypeError("InventoryItemGrantService requires stackingPolicy");
    if (typeof reservationPolicy?.isReserved !== "function") {
      throw new TypeError("InventoryItemGrantService requires reservationPolicy");
    }
    this.#capacity = capacity;
    this.#repository = repository;
    this.#transaction = transaction;
    this.#definitionLookup = definitionLookup;
    this.#instanceIdFactory = instanceIdFactory;
    this.#notify = notify;
    this.#stackingPolicy = stackingPolicy;
    this.#reservationPolicy = reservationPolicy;
  }

  grant(itemId, quantity = 1) {
    const count = Number(quantity);
    const definition = this.#definitionLookup(itemId);
    if (!Number.isInteger(count) || count < 1 || !definition) {
      return Object.freeze({ success: false, instanceId: null });
    }
    if (!this.#capacity.fitsAdding(this.#repository.list(), itemId, count)) {
      return Object.freeze({ success: false, instanceId: null, reason: "backpack_full" });
    }
    const instanceId = this.#transaction.runAtomic(() => {
      const item = this.#repository.add({
        instanceId: this.#instanceIdFactory("item"),
        itemId,
        quantity: count,
        location: InventoryItemLocation.inventory(),
      });
      if (!stacksAsOne(definition)) return item.instanceId;
      const target = this.#repository.list().find((entry) => entry.instanceId !== item.instanceId &&
        this.#joins(entry) && this.#stackingPolicy.canStack(entry, item));
      if (target && !Number.isSafeInteger(target.quantity + count)) throw new RangeError("Inventory quantity exceeds safe integer");
      return this.#repository.mergeInventoryItem(item.instanceId, this.#stackingPolicy,
        { canMerge: (candidate) => this.#joins(candidate) });
    });
    this.#notify();
    return Object.freeze({ success: true, instanceId });
  }

  #joins(item) {
    return InventoryItemLocation.isInventory(item.location) && !this.#reservationPolicy.isReserved(item);
  }
}
