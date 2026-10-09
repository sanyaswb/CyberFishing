import { InventoryActionType } from "./inventory_action_type.js";

export class InventoryActionContract {
  static assert(action) {
    if (!action || typeof action !== "object") {
      throw new TypeError("Inventory action must be an object");
    }
    const types = InventoryActionType;
    if (!Object.values(types).includes(action.type)) {
      throw new RangeError(`Unknown Inventory action: ${action.type}`);
    }

    switch (action.type) {
      case types.CATEGORY_SELECT:
        this.#requireId(action.categoryId, "categoryId");
        break;
      case types.SUBFILTER_TOGGLE:
        this.#requireId(action.filterId, "filterId");
        if (typeof action.enabled !== "boolean") {
          throw new TypeError("Inventory subfilter enabled must be boolean");
        }
        break;
      case types.SORT_CRITERION_SELECT:
        this.#requireId(action.criterionId, "criterionId");
        break;
      case types.SORT_DIRECTION_SELECT:
        this.#requireId(action.directionId, "directionId");
        break;
      case types.RARITY_FILTER_TOGGLE:
        this.#requireId(action.rarityId, "rarityId");
        if (typeof action.enabled !== "boolean") {
          throw new TypeError("Inventory rarity filter enabled must be boolean");
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
          throw new TypeError("Inventory action slotIndex must be >= 0");
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
          throw new TypeError("Inventory loadout name must be a string");
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
          throw new TypeError("Inventory setting enabled must be boolean");
        }
        break;
      default:
        break;
    }
    return action;
  }

  static #requireId(value, label) {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new TypeError(`Inventory action ${label} must be a non-empty string`);
    }
  }

  static #optionalId(value, label) {
    if (value === null || value === undefined) return;
    this.#requireId(value, label);
  }
}
