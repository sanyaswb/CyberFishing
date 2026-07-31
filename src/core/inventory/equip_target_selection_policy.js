class InventoryEquipTargetSelectionPolicy {
  #slotConfig;

  constructor(slotConfig = {}) {
    this.#slotConfig = slotConfig || {};
  }

  resolve({ item, slotGroups = [], validateSlot = null } = {}) {
    if (!item) return this.#result("blocked", [], null);

    const validSlotIds = [];
    const visitedSlotIds = new Set();
    let rejectionReason = null;

    for (const group of slotGroups || []) {
      for (const slot of group?.slots || []) {
        const slotId = slot?.id;
        if (!slotId || visitedSlotIds.has(slotId)) continue;
        visitedSlotIds.add(slotId);

        const baseSlot = slotId.split("_")[0];
        const acceptedTypes = this.#slotConfig[baseSlot]?.acceptTypes || [];
        if (!acceptedTypes.includes(item.type)) continue;

        const validation =
          typeof validateSlot === "function"
            ? validateSlot(slotId, item)
            : { isValid: true };
        if (validation?.isValid) {
          validSlotIds.push(slotId);
        } else if (!rejectionReason && validation?.reason) {
          rejectionReason = validation.reason;
        }
      }
    }

    const mode =
      validSlotIds.length === 0
        ? "blocked"
        : validSlotIds.length === 1
          ? "immediate"
          : "choose";
    return this.#result(mode, validSlotIds, rejectionReason);
  }

  #result(mode, validSlotIds, rejectionReason) {
    return {
      mode,
      validSlotIds,
      rejectionReason,
      shouldEquipImmediately: mode === "immediate",
      requiresSlotChoice: mode === "choose",
    };
  }
}
