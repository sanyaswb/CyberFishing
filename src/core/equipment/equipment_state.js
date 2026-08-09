/**
 * Single source of truth for active equipment roots.
 * Child hooks, bait, chum, reel line and boat cargo are intentionally absent.
 */
class EquipmentState {
  #slotIds;
  #mainSlotIds;
  #auxiliarySlotIds;
  #roots;

  constructor(rootInstanceIds = {}, {
    slotIds = null,
    mainSlotIds = null,
    auxiliarySlotIds = null,
  } = {}) {
    this.#mainSlotIds = Object.freeze([
      ...(mainSlotIds || this.#defaultMainSlotIds()),
    ]);
    this.#auxiliarySlotIds = Object.freeze([
      ...(auxiliarySlotIds || this.#defaultAuxiliarySlotIds()),
    ]);
    this.#slotIds = Object.freeze([
      ...(slotIds || [...this.#mainSlotIds, ...this.#auxiliarySlotIds]),
    ]);
    this.#roots = Object.create(null);
    for (const slotId of this.#slotIds) this.#roots[slotId] = null;
    this.restore(rootInstanceIds);
  }

  getRootInstanceId(slotId) {
    this.#assertKnownSlot(slotId);
    return this.#roots[slotId];
  }

  setRootInstanceId(slotId, instanceId) {
    this.#assertKnownSlot(slotId);
    this.#roots[slotId] = this.#normalizeRootReference(instanceId, slotId);
    return this;
  }

  clear(slotId) {
    return this.setRootInstanceId(slotId, null);
  }

  has(slotId) {
    return this.getRootInstanceId(slotId) !== null;
  }

  restore(snapshot = {}) {
    const source = snapshot?.rootInstanceIds || snapshot || {};
    for (const slotId of this.#slotIds) {
      const instanceId = Object.prototype.hasOwnProperty.call(source, slotId)
        ? source[slotId]
        : null;
      this.#roots[slotId] = this.#normalizeRootReference(instanceId, slotId);
    }
    return this;
  }

  snapshot() {
    const result = {};
    for (const slotId of this.#slotIds) result[slotId] = this.#roots[slotId];
    return Object.freeze(result);
  }

  getMainRootInstanceIds() {
    return this.#select(this.#mainSlotIds);
  }

  getAuxiliaryRootInstanceIds() {
    return this.#select(this.#auxiliarySlotIds);
  }

  getSlotIds() {
    return [...this.#slotIds];
  }

  #select(slotIds) {
    const result = {};
    for (const slotId of slotIds) result[slotId] = this.#roots[slotId];
    return Object.freeze(result);
  }

  #normalizeRootReference(instanceId, slotId) {
    if (instanceId === undefined || instanceId === null || instanceId === "") {
      return null;
    }
    if (typeof instanceId !== "string") {
      throw new TypeError(
        `EquipmentState.${slotId} must store a root instanceId string or null`,
      );
    }
    return instanceId;
  }

  #assertKnownSlot(slotId) {
    if (!this.#slotIds.includes(slotId)) {
      throw new RangeError(`Unknown equipment slot: ${slotId}`);
    }
  }

  #defaultMainSlotIds() {
    return typeof EQUIPMENT_MAIN_SLOT_IDS !== "undefined"
      ? EQUIPMENT_MAIN_SLOT_IDS
      : ["rod", "reel", "terminalLine", "tackle", "float"];
  }

  #defaultAuxiliarySlotIds() {
    return typeof EQUIPMENT_AUXILIARY_SLOT_IDS !== "undefined"
      ? EQUIPMENT_AUXILIARY_SLOT_IDS
      : ["handChum", "net", "delivery", "gasMask"];
  }
}
