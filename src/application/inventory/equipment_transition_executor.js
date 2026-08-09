class EquipmentTransitionPort {
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

class EquipmentTransitionExecutor {
  #port;

  constructor({ port } = {}) {
    if (!port || typeof port.runAtomic !== "function") {
      throw new TypeError("EquipmentTransitionExecutor requires a transaction port");
    }
    this.#port = port;
  }

  execute({ plan, equipmentState } = {}) {
    if (!plan?.allowed) {
      return Object.freeze({ success: false, warning: plan?.warning || null });
    }
    if (!equipmentState || typeof equipmentState.restore !== "function") {
      throw new TypeError("EquipmentTransitionExecutor requires EquipmentState");
    }
    if (plan.isNoop) {
      return Object.freeze({ success: true, changed: false, warning: null });
    }

    const before = equipmentState.snapshot();
    try {
      this.#port.runAtomic(() => {
        for (const movement of plan.movements) {
          if (movement.direction === "to-inventory") {
            this.#port.moveRootToInventory(movement.instanceId, movement.slotId);
          } else if (movement.direction === "to-equipment") {
            this.#port.moveRootToEquipment(movement.instanceId, movement.slotId);
          } else {
            throw new RangeError(`Unknown equipment movement: ${movement.direction}`);
          }
        }
        equipmentState.restore(plan.after);
        this.#port.commitEquipmentState(equipmentState.snapshot());
      });
      return Object.freeze({ success: true, changed: true, warning: null });
    } catch (error) {
      equipmentState.restore(before);
      return Object.freeze({
        success: false,
        changed: false,
        warning: error?.message || "Не вдалося змінити спорядження.",
        error,
      });
    }
  }
}
