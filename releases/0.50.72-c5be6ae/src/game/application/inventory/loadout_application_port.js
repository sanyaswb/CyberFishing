export class LoadoutApplicationPort {
  runAtomic(_operation) {
    throw new Error("LoadoutApplicationPort.runAtomic() must be implemented");
  }

  getRootOwner(_instanceId) {
    return null;
  }

  assignRootToLoadout(_instanceId, _loadoutId, _slotId) {
    throw new Error(
      "LoadoutApplicationPort.assignRootToLoadout() must be implemented",
    );
  }

  releaseRootFromLoadout(_instanceId, _loadoutId, _slotId) {
    throw new Error(
      "LoadoutApplicationPort.releaseRootFromLoadout() must be implemented",
    );
  }

  saveLoadout(_loadout) {
    throw new Error("LoadoutApplicationPort.saveLoadout() must be implemented");
  }

  removeLoadout(_loadoutId) {
    throw new Error("LoadoutApplicationPort.removeLoadout() must be implemented");
  }

  applyEquipmentMovement(_movement) {
    throw new Error(
      "LoadoutApplicationPort.applyEquipmentMovement() must be implemented",
    );
  }

  commitEquipmentState(_snapshot) {
    throw new Error(
      "LoadoutApplicationPort.commitEquipmentState() must be implemented",
    );
  }
}
