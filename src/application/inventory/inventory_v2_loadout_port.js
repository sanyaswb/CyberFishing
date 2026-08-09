class InventoryV2LoadoutPort extends LoadoutApplicationPort {
  #repository;
  #loadouts;
  #transaction;
  #lineAllocationService;

  constructor({
    repository,
    loadouts,
    transaction,
    lineAllocationService = null,
  } = {}) {
    super();
    this.#repository = repository;
    this.#loadouts = loadouts;
    this.#transaction = transaction;
    this.#lineAllocationService = lineAllocationService;
  }

  runAtomic(operation) {
    return this.#transaction.runAtomic(operation);
  }

  getRootOwner(instanceId) {
    const item = this.#repository.get(instanceId);
    if (!item) return null;
    if (InventoryItemLocation.isLoadout(item.location)) {
      return {
        kind: "loadout",
        loadoutId: item.location.loadoutId,
        slotId: item.location.slotId,
      };
    }
    return { kind: "inventory" };
  }

  assignRootToLoadout(instanceId, loadoutId, slotId) {
    const item = this.#repository.require(instanceId);
    if (InventoryItemLocation.isAttached(item.location)) {
      throw new Error("Вкладений компонент не може стати коренем комплекту.");
    }
    this.#repository.setLocation(
      instanceId,
      InventoryItemLocation.loadout(loadoutId, slotId),
    );
  }

  releaseRootFromLoadout(instanceId, _loadoutId, slotId) {
    this.#repository.setLocation(
      instanceId,
      InventoryItemLocation.inventory(),
    );
    this.#releaseDetachedTerminalLine(instanceId, slotId);
  }

  saveLoadout(loadout) {
    return this.#loadouts.add(loadout);
  }

  removeLoadout(loadoutId) {
    return this.#loadouts.remove(loadoutId);
  }

  applyEquipmentMovement(movement) {
    const supported = new Set([
      "to-inventory",
      "to-equipment",
      "deactivate-loadout-root",
      "activate-loadout-root",
    ]);
    if (!supported.has(movement?.direction)) {
      throw new RangeError(`Unknown loadout movement: ${movement?.direction}`);
    }
    if (movement.direction === "to-inventory") {
      this.#releaseDetachedTerminalLine(movement.instanceId, movement.slotId);
    }
    // Equipment is orthogonal to custody. Loadout roots remain LOADOUT and
    // loose roots remain INVENTORY while EquipmentState points at either one.
  }

  commitEquipmentState() {}

  #releaseDetachedTerminalLine(instanceId, slotId) {
    if (slotId !== "terminalLine") return null;
    const item = this.#repository.get(instanceId);
    if (!item?.detachedLineSegment) return null;
    if (!this.#lineAllocationService?.release) {
      throw new Error("Terminal-line cleanup service is unavailable.");
    }
    const result = this.#lineAllocationService.release(instanceId);
    if (!result?.success) {
      throw new Error("Не вдалося повернути відрізок ліски до інвентарю.");
    }
    return result;
  }
}

globalThis.InventoryV2LoadoutPort = InventoryV2LoadoutPort;
