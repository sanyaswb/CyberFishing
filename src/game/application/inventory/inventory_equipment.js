export class InventoryEquipment {
  #slots;
  #config;

  constructor(config, initialEquipment = {}) {
    this.#config = config;
    this.#slots = new Map();
    this.#initializeSlots(initialEquipment);
  }

  #initializeSlots(initialEquipment) {
    for (const [slotName, settings] of Object.entries(this.#config)) {
      if (settings.type === "array") {
        this.#slots.set(slotName, initialEquipment[slotName] || []);
      } else {
        const key = `${slotName}Id`;
        this.#slots.set(slotName, initialEquipment[key] || null);
      }
    }
  }

  equip(slotPath, instanceId) {
    const { baseSlot, index } = this.#parseSlotPath(slotPath);
    if (!this.#config[baseSlot]) return false;

    if (this.#config[baseSlot].type === "array") {
      const arr = this.#slots.get(baseSlot);
      arr[index] = instanceId;
    } else {
      this.#slots.set(baseSlot, instanceId);
    }
    return true;
  }

  unequip(slotPath) {
    const { baseSlot, index } = this.#parseSlotPath(slotPath);
    if (!this.#config[baseSlot]) return;

    if (this.#config[baseSlot].type === "array") {
      if (index !== null) {
        const arr = this.#slots.get(baseSlot);
        arr[index] = null;
      } else {
        this.#slots.set(baseSlot, []);
      }
    } else {
      this.#slots.set(baseSlot, null);
    }

    this.#clearDependencies(baseSlot);
  }

  #clearDependencies(slotName) {
    const deps = this.#config[slotName]?.dependencies || [];
    for (const dep of deps) {
      this.unequip(dep);
    }
  }

  findSlotByInstanceId(instanceId) {
    for (const [slot, value] of this.#slots.entries()) {
      if (Array.isArray(value)) {
        const idx = value.indexOf(instanceId);
        if (idx !== -1) return `${slot}_${idx}`;
      } else if (value === instanceId) {
        return slot;
      }
    }
    return null;
  }

  replaceInstance(oldInstanceId, newInstanceId) {
    if (!oldInstanceId || !newInstanceId || oldInstanceId === newInstanceId)
      return;

    for (const [slot, value] of this.#slots.entries()) {
      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          if (value[i] === oldInstanceId) value[i] = newInstanceId;
        }
      } else if (value === oldInstanceId) {
        this.#slots.set(slot, newInstanceId);
      }
    }
  }

  getRawState() {
    const state = {};
    for (const [slotName, settings] of Object.entries(this.#config)) {
      const value = this.#slots.get(slotName);
      if (settings.type === "array") {
        state[slotName] = [...value];
      } else {
        state[`${slotName}Id`] = value;
      }
    }
    return state;
  }

  #parseSlotPath(slotPath) {
    const parts = slotPath.split("_");
    return {
      baseSlot: parts[0],
      index: parts.length > 1 ? parseInt(parts[1], 10) : null,
    };
  }
}
