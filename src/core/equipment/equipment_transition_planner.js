class EquipmentTransitionPlan {
  constructor({
    kind,
    allowed,
    before,
    after,
    movements = [],
    capacity = null,
    warning = null,
  } = {}) {
    this.kind = kind || "equipment-transition";
    this.allowed = allowed === true;
    this.before = Object.freeze({ ...(before || {}) });
    this.after = Object.freeze({ ...(after || before || {}) });
    this.movements = Object.freeze(
      movements.map((movement) => Object.freeze({ ...movement })),
    );
    this.capacity = capacity ? Object.freeze({ ...capacity }) : null;
    this.warning = warning || null;
    Object.freeze(this);
  }

  get isNoop() {
    return this.movements.length === 0;
  }
}

class ManualRodChangePlanner {
  #capacityPolicy;
  #mainSlotIds;

  constructor({ capacityPolicy = null, mainSlotIds = null } = {}) {
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
  }

  plan({ equipmentState, nextRodInstanceId = null, capacityContext = {} } = {}) {
    const before = this.#snapshot(equipmentState);
    const rodSlotId = this.#mainSlotIds[0] || "rod";
    const normalizedNextRodId = nextRodInstanceId || null;
    if (before[rodSlotId] === normalizedNextRodId) {
      return new EquipmentTransitionPlan({
        kind: "manual-rod-change",
        allowed: true,
        before,
        after: before,
      });
    }

    const incomingRootInstanceIds = [];
    const movements = [];
    // Dependants are intentionally removed on every actual rod change, even
    // when a particular item would also be compatible with the new rod.
    for (let index = 1; index < this.#mainSlotIds.length; index += 1) {
      const slotId = this.#mainSlotIds[index];
      const instanceId = before[slotId];
      if (!instanceId) continue;
      incomingRootInstanceIds.push(instanceId);
      movements.push({ direction: "to-inventory", slotId, instanceId });
    }
    if (before[rodSlotId]) {
      incomingRootInstanceIds.push(before[rodSlotId]);
      movements.push({
        direction: "to-inventory",
        slotId: rodSlotId,
        instanceId: before[rodSlotId],
      });
    }

    const outgoingRootInstanceIds = normalizedNextRodId
      ? [normalizedNextRodId]
      : [];
    if (normalizedNextRodId) {
      movements.push({
        direction: "to-equipment",
        slotId: rodSlotId,
        instanceId: normalizedNextRodId,
      });
    }

    const capacity = this.#capacityPolicy?.evaluateTransition?.({
      incomingRootInstanceIds,
      outgoingRootInstanceIds,
      conceptualCellCostByRoot: 1,
      reason: "manual-rod-change",
      ...capacityContext,
    }) || { allowed: true };

    if (capacity.allowed === false) {
      return new EquipmentTransitionPlan({
        kind: "manual-rod-change",
        allowed: false,
        before,
        after: before,
        capacity,
        warning: capacity.warning || "Недостатньо місця в інвентарі.",
      });
    }

    const after = { ...before, [rodSlotId]: normalizedNextRodId };
    for (let index = 1; index < this.#mainSlotIds.length; index += 1) {
      after[this.#mainSlotIds[index]] = null;
    }

    return new EquipmentTransitionPlan({
      kind: "manual-rod-change",
      allowed: true,
      before,
      after,
      movements,
      capacity,
    });
  }

  #snapshot(equipmentState) {
    if (typeof equipmentState?.snapshot === "function") {
      return equipmentState.snapshot();
    }
    return Object.freeze({ ...(equipmentState?.rootInstanceIds || equipmentState || {}) });
  }
}
