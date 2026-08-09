const InventoryItemLocationKind = Object.freeze({
  INVENTORY: "INVENTORY",
  ATTACHED: "ATTACHED",
  LOADOUT: "LOADOUT",
});

class InventoryItemLocation {
  static inventory() {
    return Object.freeze({ kind: InventoryItemLocationKind.INVENTORY });
  }

  static attached(parentInstanceId, slotId, slotIndex = 0) {
    this.#assertId(parentInstanceId, "parentInstanceId");
    this.#assertId(slotId, "slotId");
    this.#assertSlotIndex(slotIndex);
    return Object.freeze({
      kind: InventoryItemLocationKind.ATTACHED,
      parentInstanceId,
      slotId,
      slotIndex,
    });
  }

  static loadout(loadoutId, slotId) {
    this.#assertId(loadoutId, "loadoutId");
    this.#assertId(slotId, "slotId");
    return Object.freeze({
      kind: InventoryItemLocationKind.LOADOUT,
      loadoutId,
      slotId,
    });
  }

  static normalize(location) {
    if (!location) return this.inventory();
    switch (location.kind) {
      case InventoryItemLocationKind.INVENTORY:
        return this.inventory();
      case InventoryItemLocationKind.ATTACHED:
        return this.attached(
          location.parentInstanceId,
          location.slotId,
          location.slotIndex,
        );
      case InventoryItemLocationKind.LOADOUT:
        return this.loadout(location.loadoutId, location.slotId);
      default:
        throw new RangeError(`Unknown inventory item location: ${location.kind}`);
    }
  }

  static isInventory(location) {
    return location?.kind === InventoryItemLocationKind.INVENTORY;
  }

  static isAttached(location) {
    return location?.kind === InventoryItemLocationKind.ATTACHED;
  }

  static isLoadout(location) {
    return location?.kind === InventoryItemLocationKind.LOADOUT;
  }

  static #assertId(value, name) {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new TypeError(`${name} must be a non-empty string`);
    }
  }

  static #assertSlotIndex(value) {
    if (!Number.isInteger(value) || value < 0) {
      throw new RangeError("slotIndex must be a non-negative integer");
    }
  }
}
