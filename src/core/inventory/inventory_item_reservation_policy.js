/**
 * Resolves whether a flat inventory root is reserved by equipment or a saved
 * loadout. Inventory location alone is deliberately insufficient because
 * active loose equipment remains in INVENTORY custody.
 */
class InventoryItemReservationPolicy {
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

globalThis.InventoryItemReservationPolicy = InventoryItemReservationPolicy;
