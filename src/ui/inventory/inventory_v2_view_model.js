const InventoryV2ActionType = Object.freeze({
  OPEN: "inventory-v2/open",
  CLOSE: "inventory-v2/close",
  CATEGORY_SELECT: "inventory-v2/category-select",
  SUBFILTER_TOGGLE: "inventory-v2/subfilter-toggle",
  INVENTORY_ITEM_ACTIVATE: "inventory-v2/inventory-item-activate",
  INVENTORY_ITEM_LONG_PRESS: "inventory-v2/inventory-item-long-press",
  EQUIPMENT_SLOT_ACTIVATE: "inventory-v2/equipment-slot-activate",
  EQUIPMENT_SLOT_LONG_PRESS: "inventory-v2/equipment-slot-long-press",
  ASSEMBLY_SOCKET_ACTIVATE: "inventory-v2/assembly-socket-activate",
  ASSEMBLY_EQUIP: "inventory-v2/assembly-equip",
  ASSEMBLY_UNEQUIP: "inventory-v2/assembly-unequip",
  ASSEMBLY_DISASSEMBLE: "inventory-v2/assembly-disassemble",
  ASSEMBLY_BACK: "inventory-v2/assembly-back",
  LOADOUT_SAVE: "inventory-v2/loadout-save",
  LOADOUT_PREVIEW_SLOT_EQUIP: "inventory-v2/loadout-preview-slot-equip",
  LOADOUT_EQUIP_ALL: "inventory-v2/loadout-equip-all",
  LOADOUT_DISASSEMBLE: "inventory-v2/loadout-disassemble",
  LOADOUT_PREVIEW_BACK: "inventory-v2/loadout-preview-back",
  AUTO_BAIT_CHANGE: "inventory-v2/auto-bait-change",
  AUTO_CHUM_CHANGE: "inventory-v2/auto-chum-change",
});

class InventoryV2FacadeContract {
  static assert(facade, { actionDispatcher = null } = {}) {
    if (!facade || typeof facade.getViewModel !== "function") {
      throw new TypeError(
        "InventoryV2UI requires a facade with getViewModel()",
      );
    }
    if (
      typeof actionDispatcher !== "function" &&
      typeof facade.dispatch !== "function"
    ) {
      throw new TypeError(
        "InventoryV2UI requires facade.dispatch(action) or onAction(action)",
      );
    }
    if (
      facade.subscribe !== undefined &&
      typeof facade.subscribe !== "function"
    ) {
      throw new TypeError("InventoryV2 facade.subscribe must be a function");
    }
    return facade;
  }
}

class InventoryV2ActionContract {
  static assert(action) {
    if (!action || typeof action !== "object") {
      throw new TypeError("Inventory V2 action must be an object");
    }
    const types = globalThis.InventoryV2ActionType || InventoryV2ActionType;
    if (!Object.values(types).includes(action.type)) {
      throw new RangeError(`Unknown Inventory V2 action: ${action.type}`);
    }

    switch (action.type) {
      case types.CATEGORY_SELECT:
        this.#requireId(action.categoryId, "categoryId");
        break;
      case types.SUBFILTER_TOGGLE:
        this.#requireId(action.filterId, "filterId");
        if (typeof action.enabled !== "boolean") {
          throw new TypeError("Inventory V2 subfilter enabled must be boolean");
        }
        break;
      case types.INVENTORY_ITEM_ACTIVATE:
      case types.INVENTORY_ITEM_LONG_PRESS:
        this.#requireId(action.instanceId, "instanceId");
        break;
      case types.EQUIPMENT_SLOT_ACTIVATE:
        this.#requireId(action.slotId, "slotId");
        this.#optionalId(action.instanceId, "instanceId");
        break;
      case types.EQUIPMENT_SLOT_LONG_PRESS:
        this.#requireId(action.slotId, "slotId");
        this.#requireId(action.instanceId, "instanceId");
        break;
      case types.ASSEMBLY_SOCKET_ACTIVATE:
        this.#requireId(action.rootInstanceId, "rootInstanceId");
        this.#requireId(action.socketId, "socketId");
        this.#requireId(action.slotId, "slotId");
        this.#requireId(action.parentInstanceId, "parentInstanceId");
        if (!Number.isInteger(action.slotIndex) || action.slotIndex < 0) {
          throw new TypeError("Inventory V2 action slotIndex must be >= 0");
        }
        break;
      case types.ASSEMBLY_EQUIP:
      case types.ASSEMBLY_UNEQUIP:
      case types.ASSEMBLY_DISASSEMBLE:
      case types.ASSEMBLY_BACK:
        this.#requireId(action.rootInstanceId, "rootInstanceId");
        break;
      case types.LOADOUT_SAVE:
        if (typeof action.name !== "string") {
          throw new TypeError("Inventory V2 loadout name must be a string");
        }
        break;
      case types.LOADOUT_PREVIEW_SLOT_EQUIP:
        this.#requireId(action.loadoutId, "loadoutId");
        this.#requireId(action.slotId, "slotId");
        break;
      case types.LOADOUT_EQUIP_ALL:
      case types.LOADOUT_DISASSEMBLE:
      case types.LOADOUT_PREVIEW_BACK:
        this.#requireId(action.loadoutId, "loadoutId");
        break;
      case types.AUTO_BAIT_CHANGE:
      case types.AUTO_CHUM_CHANGE:
        if (typeof action.enabled !== "boolean") {
          throw new TypeError("Inventory V2 setting enabled must be boolean");
        }
        break;
      default:
        break;
    }
    return action;
  }

  static #requireId(value, label) {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new TypeError(`Inventory V2 action ${label} must be a non-empty string`);
    }
  }

  static #optionalId(value, label) {
    if (value === null || value === undefined) return;
    this.#requireId(value, label);
  }
}

class InventoryV2ViewModelNormalizer {
  static MAIN_SLOT_IDS = Object.freeze([
    "rod",
    "reel",
    "terminalLine",
    "tackle",
    "float",
  ]);

  static AUXILIARY_SLOT_IDS = Object.freeze([
    "net",
    "handChum",
    "delivery",
    "gasMask",
  ]);

  normalize(source = {}) {
    const panel = source.panel || {};
    const requestedMode = panel.mode || source.mode;
    const mode = requestedMode === "assembly" ? "assembly" : "loadout";

    return Object.freeze({
      isOpen: source.isOpen !== false,
      header: this.#normalizeHeader(source.header),
      settings: this.#normalizeSettings(source.settings),
      tooltipContext: this.#normalizeTooltipContext(source.tooltipContext),
      panel: Object.freeze({
        mode,
        loadout: this.#normalizeLoadout(panel.loadout || source.loadout),
        assembly: this.#normalizeAssembly(
          panel.assembly || source.assembly,
        ),
      }),
      inventory: this.#normalizeInventory(source.inventory),
    });
  }

  #normalizeHeader(source = {}) {
    const activeTackle = source.activeTackle || {};
    return Object.freeze({
      loadLabel: this.#text(source.loadLabel, "Макс. навантаження снасті"),
      loadValue: this.#finite(source.loadValue, 0),
      loadUnit: this.#text(source.loadUnit, "кг"),
      activeBaits: this.#array(activeTackle.baits || source.activeBaits),
      activeChums: this.#array(activeTackle.chums || source.activeChums),
    });
  }

  #normalizeSettings(source = {}) {
    return Object.freeze({
      autoBait: source.autoBait === true,
      autoChum: source.autoChum === true,
    });
  }

  #normalizeTooltipContext(source = {}) {
    return Object.freeze({
      rodType: this.#text(source.rodType, ""),
      rodHasReel:
        typeof source.rodHasReel === "boolean" ? source.rodHasReel : null,
      availableCapabilities: Object.freeze(
        this.#array(source.availableCapabilities).filter(
          (value) => typeof value === "string" && value.trim(),
        ),
      ),
    });
  }

  #normalizeLoadout(source = {}) {
    const mainSlots = this.#normalizeSlots(source.mainSlots, "equipment");
    const orderedSlots = this.#orderMainSlots(mainSlots);
    return Object.freeze({
      mainSlots: Object.freeze(orderedSlots),
      auxiliarySlots: Object.freeze(
        this.#orderSlots(
          this.#normalizeSlots(source.auxiliarySlots, "auxiliary"),
          InventoryV2ViewModelNormalizer.AUXILIARY_SLOT_IDS,
        ),
      ),
      save: Object.freeze({
        visible: source.save?.visible !== false,
        enabled: source.save?.enabled !== false,
        maxNameLength: Math.max(
          1,
          Math.floor(this.#finite(source.save?.maxNameLength, 40)),
        ),
        placeholder: this.#text(
          source.save?.placeholder,
          "Назва комплекту...",
        ),
        warning: this.#text(source.save?.warning, ""),
      }),
    });
  }

  #normalizeAssembly(source = {}) {
    return Object.freeze({
      root: source.root || null,
      rootLabel: this.#text(source.rootLabel, source.root?.name || "Предмет"),
      rootInstanceId: this.#text(
        source.rootInstanceId,
        source.root?.instanceId || "",
      ),
      sockets: Object.freeze(this.#normalizeSlots(source.sockets, "socket")),
      equipped: source.equipped === true,
      canEquip: source.canEquip !== false,
      canUnequip: source.canUnequip !== false,
      showUnequip: source.showUnequip !== false,
      canDisassemble: source.canDisassemble !== false,
      showDisassemble: source.showDisassemble !== false,
      equipWarning: this.#text(source.equipWarning, ""),
      unequipWarning: this.#text(source.unequipWarning, ""),
      disassembleWarning: this.#text(source.disassembleWarning, ""),
    });
  }

  #normalizeSavedLoadout(source = {}) {
    return Object.freeze({
      loadoutId: this.#text(source.loadoutId, ""),
      name: this.#text(source.name, "Збірка"),
      slots: Object.freeze(this.#normalizeSlots(source.slots, "saved-loadout")),
      canEquipAll: source.canEquipAll !== false,
      canDisassemble: source.canDisassemble !== false,
      equipWarning: this.#text(source.equipWarning, ""),
      disassembleWarning: this.#text(source.disassembleWarning, ""),
    });
  }

  #normalizeInventory(source = {}) {
    const categories = this.#array(source.categories).map((category) =>
      Object.freeze({
        id: this.#text(category?.id, "all"),
        label: this.#text(category?.label, "Усе"),
        icon: this.#text(category?.icon, ""),
        selected:
          category?.selected === true ||
          category?.id === source.activeCategoryId,
      }),
    );
    const subfilters = this.#array(source.subfilters).map((filter) =>
      Object.freeze({
        id: this.#text(filter?.id, "filter"),
        label: this.#text(filter?.label, "Фільтр"),
        count: Math.max(0, Math.floor(this.#finite(filter?.count, 0))),
        selected:
          filter?.selected === true ||
          this.#array(source.activeSubfilterIds).includes(filter?.id),
      }),
    );
    return Object.freeze({
      mode: source.mode === "saved-loadout" ? "saved-loadout" : "inventory",
      savedLoadout: this.#normalizeSavedLoadout(source.savedLoadout),
      categories: Object.freeze(categories),
      subfilters: Object.freeze(subfilters),
      activeSubfilterIds: Object.freeze(
        this.#array(source.activeSubfilterIds).filter(
          (value) => typeof value === "string" && value.trim(),
        ),
      ),
      items: Object.freeze(this.#array(source.items)),
      selectedInstanceId: this.#text(source.selectedInstanceId, ""),
      highlightedSlotId: this.#text(source.highlightedSlotId, ""),
      emptyMessage: this.#text(source.emptyMessage, "Інвентар порожній"),
    });
  }

  #normalizeSlots(slots, context) {
    return this.#array(slots)
      .filter((slot) => slot?.visible !== false)
      .map((slot, index) => {
        const item = slot.item || null;
        const state = this.#resolveSlotState(slot, item);
        return Object.freeze({
          ...slot,
          slotId: this.#text(slot.slotId || slot.id, `${context}-${index}`),
          socketId: this.#text(
            slot.socketId,
            slot.slotId || slot.id || `${context}-${index}`,
          ),
          label: this.#text(slot.label, "Комірка"),
          item,
          state,
          warning: this.#text(
            slot.warning,
            state === "locked"
              ? "Ще не розблоковано"
              : state === "unavailable"
                ? "Немає відповідного предмета"
                : "",
          ),
          highlighted: slot.highlighted === true,
        });
      });
  }

  #resolveSlotState(slot, item) {
    if (item) return "filled";
    const state = String(slot.state || slot.availability || "available");
    if (state === "locked") return "locked";
    if (
      state === "unavailable" ||
      state === "no-item" ||
      state === "missing"
    ) {
      return "unavailable";
    }
    return "available";
  }

  #orderMainSlots(slots) {
    return this.#orderSlots(
      slots,
      InventoryV2ViewModelNormalizer.MAIN_SLOT_IDS,
    );
  }

  #orderSlots(slots, orderedIds) {
    const positions = new Map(
      orderedIds.map((id, index) => [id, index]),
    );
    return slots.slice().sort((left, right) => {
      const leftPosition = positions.get(left.slotId) ?? Number.MAX_SAFE_INTEGER;
      const rightPosition =
        positions.get(right.slotId) ?? Number.MAX_SAFE_INTEGER;
      return leftPosition - rightPosition;
    });
  }

  #array(value) {
    return Array.isArray(value) ? value.filter(Boolean) : [];
  }

  #text(value, fallback) {
    return typeof value === "string" && value.trim() ? value : fallback;
  }

  #finite(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }
}

globalThis.InventoryV2ActionType = InventoryV2ActionType;
globalThis.InventoryV2ActionContract = InventoryV2ActionContract;
globalThis.InventoryV2FacadeContract = InventoryV2FacadeContract;
globalThis.InventoryV2ViewModelNormalizer = InventoryV2ViewModelNormalizer;
