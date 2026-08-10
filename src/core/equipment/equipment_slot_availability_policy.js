const EquipmentSlotAvailabilityState = Object.freeze({
  UNSUPPORTED: "unsupported",
  FILLED: "filled",
  EMPTY: "empty",
  NO_ACCESSIBLE_COMPATIBLE_ITEM: "no-accessible-compatible-item",
  LOCKED: "locked",
});

const EquipmentSlotWarningCode = Object.freeze({
  NO_ACCESSIBLE_COMPATIBLE_ITEM: "no-accessible-compatible-item",
  LOCKED: "slot-locked",
});

class EquipmentSlotAvailabilityPolicy {
  #slotConfig;
  #visibilityPolicy;
  #terminalLineResolver;

  constructor({
    slotConfig = null,
    visibilityPolicy = null,
    terminalLineResolver = null,
  } = {}) {
    this.#slotConfig =
      slotConfig ||
      (typeof EQUIPMENT_SLOT_CONFIG !== "undefined" ? EQUIPMENT_SLOT_CONFIG : {});
    this.#visibilityPolicy =
      visibilityPolicy ||
      (typeof EquipmentSlotVisibilityPolicy !== "undefined"
        ? new EquipmentSlotVisibilityPolicy({ slotConfig: this.#slotConfig })
        : null);
    this.#terminalLineResolver =
      terminalLineResolver ||
      (typeof TerminalLineSlotResolver !== "undefined"
        ? new TerminalLineSlotResolver()
        : null);
  }

  resolve({
    slotId,
    equipmentState = null,
    rod = null,
    inventoryItems = [],
    isCompatible = null,
    isUnlocked = null,
    isAccessible = null,
  } = {}) {
    const config = this.#slotConfig[slotId];
    const visible = Boolean(
      config && this.#visibilityPolicy?.isVisible?.(slotId, { rod }),
    );
    if (!visible) {
      return this.#result({
        slotId,
        state: EquipmentSlotAvailabilityState.UNSUPPORTED,
        supported: false,
        visible: false,
      });
    }

    const unlocked =
      config.locked !== true &&
      (typeof isUnlocked !== "function" || isUnlocked(slotId, config) !== false);
    if (!unlocked) {
      return this.#result({
        slotId,
        state: EquipmentSlotAvailabilityState.LOCKED,
        supported: true,
        visible: true,
        showCross: true,
        warningCode: EquipmentSlotWarningCode.LOCKED,
        warning: config.lockedWarning || "Цей слот ще не розблоковано.",
      });
    }

    const equippedRootId = this.#getRootInstanceId(equipmentState, slotId);
    if (equippedRootId) {
      return this.#result({
        slotId,
        state: EquipmentSlotAvailabilityState.FILLED,
        supported: true,
        visible: true,
        equippedRootId,
      });
    }

    const acceptTypes = this.#resolveAcceptedTypes(slotId, config, rod);
    const accessiblePredicate =
      typeof isAccessible === "function"
        ? isAccessible
        : (item) => this.#isAccessibleInventoryRoot(item);
    const compatibleItem = (inventoryItems || []).find((item) => {
      if (!accessiblePredicate(item)) return false;
      const itemType = item?.type ?? item?.engineStats?.type;
      if (!acceptTypes.includes(itemType)) return false;
      return (
        typeof isCompatible !== "function" ||
        isCompatible({ slotId, item, rod, equipmentState }) !== false
      );
    });

    if (compatibleItem) {
      return this.#result({
        slotId,
        state: EquipmentSlotAvailabilityState.EMPTY,
        supported: true,
        visible: true,
        showCross: false,
        compatibleInstanceId: compatibleItem.instanceId || null,
      });
    }

    return this.#result({
      slotId,
      state: EquipmentSlotAvailabilityState.NO_ACCESSIBLE_COMPATIBLE_ITEM,
      supported: true,
      visible: true,
      showCross: false,
      warningCode: EquipmentSlotWarningCode.NO_ACCESSIBLE_COMPATIBLE_ITEM,
      warning: "В інвентарі немає відповідного доступного предмета.",
    });
  }

  getClickWarning(resolution) {
    return resolution?.warning || null;
  }

  #resolveAcceptedTypes(slotId, config, rod) {
    const terminalLineId =
      typeof EquipmentSlotId !== "undefined"
        ? EquipmentSlotId.TERMINAL_LINE
        : "terminalLine";
    if (slotId === terminalLineId && this.#terminalLineResolver) {
      return [...this.#terminalLineResolver.resolve(rod).acceptTypes];
    }
    return [...(config.acceptTypes || [])];
  }

  #getRootInstanceId(equipmentState, slotId) {
    if (typeof equipmentState?.getRootInstanceId === "function") {
      return equipmentState.getRootInstanceId(slotId);
    }
    return equipmentState?.rootInstanceIds?.[slotId] ?? equipmentState?.[slotId] ?? null;
  }

  #isAccessibleInventoryRoot(item) {
    if (!item || item.isAccessible === false || item.available === false) return false;
    const quantity = item.quantity === undefined ? 1 : Number(item.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) return false;
    if (item.parentInstanceId || item.loadoutId || item.buildId) return false;
    const location = item.location?.kind ?? item.location;
    const inventoryKind =
      typeof InventoryItemLocationKind !== "undefined"
        ? InventoryItemLocationKind.INVENTORY
        : "INVENTORY";
    return (
      !location ||
      location === inventoryKind ||
      location === "INVENTORY" ||
      location === "inventory" ||
      location === "free"
    );
  }

  #result(values) {
    return Object.freeze({
      equippedRootId: null,
      compatibleInstanceId: null,
      showCross: false,
      warningCode: null,
      warning: null,
      ...values,
    });
  }
}
