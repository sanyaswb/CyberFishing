import { InventoryItemLocation } from "./inventory_item_location.js";
import { slotTakesWholeStack } from "../equipment/equipment_slot_catalog.js";

/**
 * Resolves whether a flat inventory root is reserved by equipment or a saved
 * loadout. Inventory location alone is deliberately insufficient because
 * active loose equipment remains in INVENTORY custody.
 */
export class InventoryItemReservationPolicy {
  #equipmentState;
  #loadouts;

  constructor({ equipmentState = null, loadouts = null } = {}) {
    this.#equipmentState = equipmentState;
    this.#loadouts = loadouts;
  }

  isReserved(itemOrInstanceId) {
    const item =
      itemOrInstanceId && typeof itemOrInstanceId === "object"
        ? itemOrInstanceId
        : null;
    const instanceId = item?.instanceId || itemOrInstanceId || null;
    if (!instanceId) return false;
    if (InventoryItemLocation.isLoadout(item?.location)) return true;
    if (this.#isEquipped(instanceId)) return true;
    return Boolean(this.#loadouts?.findByRootInstanceId?.(instanceId));
  }

  canMerge(item) {
    return !this.isReserved(item);
  }

  // Spec 184 D1 (TK-375): a reserved root may be a stack only as the root of a slot that holds stacks (the hand chum,
  // the drink); every other reserved root is one piece.
  allowsStack(itemOrInstanceId) {
    const instanceId = typeof itemOrInstanceId === "object" ? itemOrInstanceId?.instanceId : itemOrInstanceId;
    if (!instanceId || !this.#equipmentState?.getSlotIds) return false;
    return this.#equipmentState.getSlotIds().some((slotId) => slotTakesWholeStack(slotId) &&
      this.#equipmentState.getRootInstanceId(slotId) === instanceId);
  }

  #isEquipped(instanceId) {
    if (!this.#equipmentState?.getSlotIds) return false;
    return this.#equipmentState
      .getSlotIds()
      .some(
        (slotId) =>
          this.#equipmentState.getRootInstanceId(slotId) === instanceId,
      );
  }
}
