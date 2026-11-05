import { EquipmentTransitionPort } from "./equipment_transition_port.js";

export class InventoryEquipmentTransitionAdapter extends EquipmentTransitionPort {
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
