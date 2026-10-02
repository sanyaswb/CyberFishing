import { EquipmentTransitionPort } from "./equipment_transition_executor.js";

export class InventoryV2EquipmentTransitionPort extends EquipmentTransitionPort {
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
