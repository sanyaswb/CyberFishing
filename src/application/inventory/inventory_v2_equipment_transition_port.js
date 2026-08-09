class InventoryV2EquipmentTransitionPort extends EquipmentTransitionPort {
  #transaction;

  constructor({ transaction } = {}) {
    super();
    this.#transaction = transaction;
  }

  runAtomic(operation) {
    return this.#transaction.runAtomic(operation);
  }

  moveRootToInventory() {}

  moveRootToEquipment() {}

  commitEquipmentState() {}
}

globalThis.InventoryV2EquipmentTransitionPort =
  InventoryV2EquipmentTransitionPort;
