import { EquipmentTransitionPort } from "./equipment_transition_executor.js";

export class InventoryEquipmentTransitionPort extends EquipmentTransitionPort {
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
