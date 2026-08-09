class LoadoutApplicationPort {
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

class LoadoutApplicationService {
  #port;
  #capacityPolicy;
  #transitionPlanner;
  #mainSlotIds;
  #equipmentActivationValidator;

  constructor({
    port,
    capacityPolicy = null,
    transitionPlanner = null,
    mainSlotIds = null,
    equipmentActivationValidator = null,
  } = {}) {
    if (!port || typeof port.runAtomic !== "function") {
      throw new TypeError("LoadoutApplicationService requires LoadoutApplicationPort");
    }
    this.#port = port;
    this.#capacityPolicy =
      capacityPolicy ||
      (typeof UnlimitedInventoryCapacityPolicy !== "undefined"
        ? new UnlimitedInventoryCapacityPolicy()
        : null);
    this.#mainSlotIds = [
      ...(mainSlotIds ||
        (typeof EQUIPMENT_MAIN_SLOT_IDS !== "undefined"
          ? EQUIPMENT_MAIN_SLOT_IDS
          : ["rod", "reel", "terminalLine", "tackle", "float"])),
    ];
    this.#transitionPlanner =
      transitionPlanner ||
      (typeof LoadoutEquipmentTransitionPlanner !== "undefined"
        ? new LoadoutEquipmentTransitionPlanner({
            capacityPolicy: this.#capacityPolicy,
            ownershipReader: (instanceId) => this.#port.getRootOwner?.(instanceId),
            mainSlotIds: this.#mainSlotIds,
          })
        : null);
    this.#equipmentActivationValidator = equipmentActivationValidator;
  }

  createFromEquipment({ loadoutId, name, equipmentState, capacityContext = {} } = {}) {
    const rootInstanceIds = this.#mainAssignments(equipmentState);
    const containedRoots = Object.values(rootInstanceIds).filter(Boolean);
    if (containedRoots.length === 0) {
      return Object.freeze({ success: false, warning: "Немає спорядження для комплекту." });
    }
    for (const instanceId of containedRoots) {
      const owner = this.#port.getRootOwner?.(instanceId);
      if (owner?.kind === "loadout" && owner.loadoutId !== loadoutId) {
        return Object.freeze({
          success: false,
          warning: "Один із предметів уже належить іншому комплекту.",
        });
      }
    }

    const capacity = this.#capacityPolicy.evaluateTransition({
      incomingRootInstanceIds: [],
      outgoingRootInstanceIds: [],
      incomingConceptualCellCount: 1,
      reason: "create-loadout",
      ...capacityContext,
    });
    if (capacity.allowed === false) {
      return Object.freeze({ success: false, warning: capacity.warning || null });
    }

    const loadout = new EquipmentLoadout({ loadoutId, name, rootInstanceIds });
    try {
      this.#port.runAtomic(() => {
        for (const slotId of this.#mainSlotIds) {
          const instanceId = rootInstanceIds[slotId];
          if (instanceId) {
            this.#port.assignRootToLoadout(instanceId, loadoutId, slotId);
          }
        }
        this.#port.saveLoadout(loadout);
      });
      return Object.freeze({ success: true, loadout, warning: null });
    } catch (error) {
      return Object.freeze({ success: false, warning: error.message, error });
    }
  }

  equip({ loadout, equipmentState, capacityContext = {} } = {}) {
    const plan = this.#transitionPlanner.plan({
      loadout,
      equipmentState,
      capacityContext,
    });
    if (!plan.allowed) {
      return Object.freeze({ success: false, warning: plan.warning, plan });
    }
    const readiness = this.#validateEquipmentActivation(plan.after);
    if (readiness.isValid === false) {
      return Object.freeze({
        success: false,
        warning: readiness.warning || null,
        readiness,
        plan,
      });
    }
    const before = equipmentState.snapshot();
    try {
      this.#port.runAtomic(() => {
        // Publish the post-transition equipment aggregate before cleanup so an
        // outgoing loose root is no longer reserved and can safely merge back
        // into inventory. The aggregate transaction restores this snapshot on
        // any later failure.
        equipmentState.restore(plan.after);
        for (const movement of plan.movements) {
          this.#port.applyEquipmentMovement(movement);
        }
        this.#port.commitEquipmentState(equipmentState.snapshot());
      });
      return Object.freeze({ success: true, warning: null, plan });
    } catch (error) {
      equipmentState.restore(before);
      return Object.freeze({ success: false, warning: error.message, error, plan });
    }
  }

  disassemble({ loadout, equipmentState, capacityContext = {} } = {}) {
    if (!loadout || typeof loadout.getRootInstanceIds !== "function") {
      throw new TypeError("LoadoutApplicationService.disassemble requires EquipmentLoadout");
    }
    const roots = loadout.getRootInstanceIds();
    const rootIds = Object.values(roots).filter(Boolean);
    const capacity = this.#capacityPolicy.evaluateTransition({
      incomingRootInstanceIds: rootIds,
      outgoingRootInstanceIds: [],
      outgoingConceptualCellCount: 1,
      reason: "disassemble-loadout",
      ...capacityContext,
    });
    if (capacity.allowed === false) {
      return Object.freeze({ success: false, warning: capacity.warning || null });
    }

    const before = equipmentState.snapshot();
    const after = { ...before };
    for (const slotId of this.#mainSlotIds) {
      if (roots[slotId] && after[slotId] === roots[slotId]) after[slotId] = null;
    }
    try {
      this.#port.runAtomic(() => {
        // Both ownership sources must release the roots before terminal-line
        // cleanup: EquipmentState owns activity and the loadout owns custody.
        equipmentState.restore(after);
        this.#port.removeLoadout(loadout.loadoutId);
        for (const slotId of this.#mainSlotIds) {
          const instanceId = roots[slotId];
          if (instanceId) {
            this.#port.releaseRootFromLoadout(
              instanceId,
              loadout.loadoutId,
              slotId,
            );
          }
        }
        this.#port.commitEquipmentState(equipmentState.snapshot());
      });
      return Object.freeze({ success: true, warning: null });
    } catch (error) {
      equipmentState.restore(before);
      return Object.freeze({ success: false, warning: error.message, error });
    }
  }

  #mainAssignments(equipmentState) {
    if (typeof equipmentState?.getMainRootInstanceIds === "function") {
      return equipmentState.getMainRootInstanceIds();
    }
    const source = equipmentState?.rootInstanceIds || equipmentState || {};
    const result = {};
    for (const slotId of this.#mainSlotIds) result[slotId] = source[slotId] || null;
    return result;
  }

  #validateEquipmentActivation(snapshot) {
    if (!this.#equipmentActivationValidator) return { isValid: true };
    const result =
      typeof this.#equipmentActivationValidator === "function"
        ? this.#equipmentActivationValidator(snapshot)
        : this.#equipmentActivationValidator.validate?.(snapshot);
    return result || { isValid: true };
  }
}
