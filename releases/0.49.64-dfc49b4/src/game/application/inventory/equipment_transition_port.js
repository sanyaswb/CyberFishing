export class EquipmentTransitionPort {
  runAtomic(_operation) {
    throw new Error("EquipmentTransitionPort.runAtomic() must be implemented");
  }

  moveRootToInventory(_instanceId, _slotId) {
    throw new Error(
      "EquipmentTransitionPort.moveRootToInventory() must be implemented",
    );
  }

  moveRootToEquipment(_instanceId, _slotId) {
    throw new Error(
      "EquipmentTransitionPort.moveRootToEquipment() must be implemented",
    );
  }

  commitEquipmentState(_snapshot) {
    throw new Error(
      "EquipmentTransitionPort.commitEquipmentState() must be implemented",
    );
  }
}
