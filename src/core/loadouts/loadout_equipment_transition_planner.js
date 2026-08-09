class LoadoutEquipmentTransitionPlanner {
  #capacityPolicy;
  #ownershipReader;
  #mainSlotIds;

  constructor({
    capacityPolicy = null,
    ownershipReader = null,
    mainSlotIds = null,
  } = {}) {
    this.#capacityPolicy =
      capacityPolicy ||
      (typeof UnlimitedInventoryCapacityPolicy !== "undefined"
        ? new UnlimitedInventoryCapacityPolicy()
        : null);
    this.#ownershipReader = ownershipReader;
    this.#mainSlotIds = [
      ...(mainSlotIds ||
        (typeof EQUIPMENT_MAIN_SLOT_IDS !== "undefined"
          ? EQUIPMENT_MAIN_SLOT_IDS
          : ["rod", "reel", "terminalLine", "tackle", "float"])),
    ];
  }

  plan({ loadout, equipmentState, capacityContext = {} } = {}) {
    if (!loadout || typeof loadout.getRootInstanceIds !== "function") {
      throw new TypeError("LoadoutEquipmentTransitionPlanner requires EquipmentLoadout");
    }
    const before =
      typeof equipmentState?.snapshot === "function"
        ? equipmentState.snapshot()
        : { ...(equipmentState || {}) };
    const loadoutRoots = loadout.getRootInstanceIds();
    const after = { ...before };
    const movements = [];
    const incomingRootInstanceIds = [];

    for (const slotId of this.#mainSlotIds) {
      const currentRootId = before[slotId] || null;
      const nextRootId = loadoutRoots[slotId] || null;
      after[slotId] = nextRootId;
      if (currentRootId === nextRootId) continue;

      if (currentRootId) {
        const owner = this.#getOwner(currentRootId);
        const direction = owner?.kind === "loadout"
          ? "deactivate-loadout-root"
          : "to-inventory";
        movements.push({ direction, slotId, instanceId: currentRootId, owner });
        if (direction === "to-inventory") incomingRootInstanceIds.push(currentRootId);
      }
      if (nextRootId) {
        movements.push({
          direction: "activate-loadout-root",
          slotId,
          instanceId: nextRootId,
          loadoutId: loadout.loadoutId,
        });
      }
    }

    const capacity = this.#capacityPolicy?.evaluateTransition?.({
      incomingRootInstanceIds,
      outgoingRootInstanceIds: [],
      conceptualCellCostByRoot: 1,
      reason: "equip-loadout",
      loadoutId: loadout.loadoutId,
      ...capacityContext,
    }) || { allowed: true };

    return Object.freeze({
      kind: "equip-loadout",
      allowed: capacity.allowed !== false,
      before: Object.freeze({ ...before }),
      after: Object.freeze(capacity.allowed === false ? { ...before } : after),
      movements: Object.freeze(
        (capacity.allowed === false ? [] : movements).map((entry) =>
          Object.freeze({ ...entry }),
        ),
      ),
      capacity: Object.freeze({ ...capacity }),
      warning:
        capacity.allowed === false
          ? capacity.warning || "Недостатньо місця в інвентарі."
          : null,
    });
  }

  #getOwner(instanceId) {
    if (typeof this.#ownershipReader === "function") {
      return this.#ownershipReader(instanceId);
    }
    return this.#ownershipReader?.getOwner?.(instanceId) || { kind: "inventory" };
  }
}
