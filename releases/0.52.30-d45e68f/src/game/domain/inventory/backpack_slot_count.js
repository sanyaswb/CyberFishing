import { InventoryItemLocation } from "./inventory_item_location.js";

// Spec 164 (TK-239): the backpack's slots. Every item the player owns takes its place, wherever it is (the backpack,
// the equipment, attached to an assembly, a saved loadout), so moving an item between them never changes the count:
// - an item counts like its card: ceil(quantity / packSize) (a jar of 25 worms with 5 left is one slot, TK-154);
// - a portion of a pack attached to the tackle (a worm on the hook, chum in the feeder) belongs to its pack while a
//   pack of the same item is outside the tackle; the last portions, with no pack left, take their own slot;
// - a line segment cut onto a reel counts with its spool while the spool exists;
// - a system container (build box) takes no slot. Live baits are the keepnet's, never the backpack's.
// The backpack accepts a change while the count stays within MAX_SLOTS, or does not grow (an old save over the limit).
export class BackpackSlotCount {
  static MAX_SLOTS = 100;
  static #UNCOUNTED_TYPES = new Set(["build_box"]);

  #definitionOf;

  // definitionOf(itemId) -> the item's catalog definition ({ itemType, packSize }) or null.
  constructor({ definitionOf }) {
    if (typeof definitionOf !== "function") throw new TypeError("BackpackSlotCount requires definitionOf");
    this.#definitionOf = definitionOf;
  }

  get maxSlots() { return BackpackSlotCount.MAX_SLOTS; }

  // items: raw inventory items ({ instanceId, itemId, quantity, location, detachedLineSegment, sourceLineInstanceId }).
  count(items) {
    const ids = new Set(items.map((item) => item.instanceId));
    const packs = new Set();
    for (const item of items) {
      if (this.#packSize(item.itemId) > 1 && !InventoryItemLocation.isAttached(item.location)) packs.add(item.itemId);
    }
    const portions = new Map();
    let slots = 0;
    for (const item of items) {
      if (item.detachedLineSegment === true && ids.has(item.sourceLineInstanceId)) continue;
      if (BackpackSlotCount.#UNCOUNTED_TYPES.has(this.#definitionOf(item.itemId)?.itemType)) continue;
      const packSize = this.#packSize(item.itemId);
      const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));
      if (packSize > 1 && InventoryItemLocation.isAttached(item.location)) {
        if (!packs.has(item.itemId)) portions.set(item.itemId, (portions.get(item.itemId) || 0) + quantity);
        continue;
      }
      slots += Math.ceil(quantity / packSize);
    }
    for (const [itemId, quantity] of portions) slots += Math.ceil(quantity / this.#packSize(itemId));
    return slots;
  }

  // Whether the backpack takes the change from beforeItems to afterItems.
  fits(beforeItems, afterItems) {
    const after = this.count(afterItems);
    return after <= BackpackSlotCount.MAX_SLOTS || after <= this.count(beforeItems);
  }

  // Whether quantity more of itemId, as a new item in the backpack, fits beside items.
  fitsAdding(items, itemId, quantity) {
    return this.fits(items, [...items, { instanceId: "\u0000incoming", itemId, quantity,
      location: InventoryItemLocation.inventory() }]);
  }

  isFull(items) { return this.count(items) >= BackpackSlotCount.MAX_SLOTS; }

  #packSize(itemId) {
    return Math.max(1, Math.floor(Number(this.#definitionOf(itemId)?.packSize) || 1));
  }
}
