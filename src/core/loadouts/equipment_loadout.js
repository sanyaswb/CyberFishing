const LOADOUT_DISPLAY_NAME = "Комплект";

/**
 * A Комплект owns only the five main equipment roots. Child assembly items are
 * reached through their root and auxiliary equipment never belongs here.
 */
class EquipmentLoadout {
  #mainSlotIds;
  #rootInstanceIds;

  constructor({
    loadoutId,
    name = LOADOUT_DISPLAY_NAME,
    rootInstanceIds = {},
    createdAt = null,
    updatedAt = null,
    mainSlotIds = null,
  } = {}) {
    if (typeof loadoutId !== "string" || loadoutId.length === 0) {
      throw new TypeError("EquipmentLoadout requires a loadoutId");
    }
    this.#mainSlotIds = Object.freeze([
      ...(mainSlotIds ||
        (typeof EQUIPMENT_MAIN_SLOT_IDS !== "undefined"
          ? EQUIPMENT_MAIN_SLOT_IDS
          : ["rod", "reel", "terminalLine", "tackle", "float"])),
    ]);
    this.#assertNoAuxiliaryAssignments(rootInstanceIds);
    this.#rootInstanceIds = Object.create(null);
    for (const slotId of this.#mainSlotIds) {
      this.#rootInstanceIds[slotId] = this.#normalizeRoot(
        rootInstanceIds[slotId],
        slotId,
      );
    }

    this.loadoutId = loadoutId;
    this.name = String(name || LOADOUT_DISPLAY_NAME);
    this.type = "equipment_loadout";
    this.displayType = LOADOUT_DISPLAY_NAME;
    this.inventoryCellCost = 1;
    this.createdAt = createdAt || new Date().toISOString();
    this.updatedAt = updatedAt || this.createdAt;
  }

  getRootInstanceId(slotId) {
    if (!this.#mainSlotIds.includes(slotId)) return null;
    return this.#rootInstanceIds[slotId];
  }

  getRootInstanceIds() {
    return Object.freeze({ ...this.#rootInstanceIds });
  }

  getContainedRootIds() {
    return this.#mainSlotIds
      .map((slotId) => this.#rootInstanceIds[slotId])
      .filter(Boolean);
  }

  containsRoot(instanceId) {
    return this.getContainedRootIds().includes(instanceId);
  }

  snapshot() {
    return Object.freeze({
      loadoutId: this.loadoutId,
      name: this.name,
      type: this.type,
      displayType: this.displayType,
      inventoryCellCost: 1,
      rootInstanceIds: this.getRootInstanceIds(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    });
  }

  #assertNoAuxiliaryAssignments(assignments) {
    const auxiliaryIds =
      typeof EQUIPMENT_AUXILIARY_SLOT_IDS !== "undefined"
        ? EQUIPMENT_AUXILIARY_SLOT_IDS
        : ["handChum", "net", "delivery", "gasMask"];
    for (const slotId of auxiliaryIds) {
      if (assignments?.[slotId]) {
        throw new RangeError(`A Комплект cannot contain auxiliary slot ${slotId}`);
      }
    }
  }

  #normalizeRoot(instanceId, slotId) {
    if (instanceId === null || instanceId === undefined || instanceId === "") {
      return null;
    }
    if (typeof instanceId !== "string") {
      throw new TypeError(`Loadout slot ${slotId} must contain a root instanceId`);
    }
    return instanceId;
  }
}
