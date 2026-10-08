import { EQUIPMENT_MAIN_SLOT_IDS } from "./equipment_slot_catalog.js";
import { EquipmentTransitionPlan } from "./equipment_transition_plan.js";
import { UnlimitedInventoryCapacityPolicy } from "../inventory/unlimited_inventory_capacity_policy.js";

export class ManualRodChangePlanner {
  #capacityPolicy;
  #mainSlotIds;
  #messages;

  // The capacity warning text is injected by composition.
  constructor({ capacityPolicy = null, mainSlotIds = null, messages = null } = {}) {
    this.#messages = messages;
    this.#capacityPolicy =
      capacityPolicy || new UnlimitedInventoryCapacityPolicy();
    this.#mainSlotIds = [
      ...(mainSlotIds || EQUIPMENT_MAIN_SLOT_IDS),
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
        warning: capacity.warning || this.#messages.inventoryCapacityExceeded,
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
