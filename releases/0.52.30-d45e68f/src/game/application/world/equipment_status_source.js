import { isItemBroken } from "../../domain/items/condition/item_condition_quality.js";

// Spec 181 D1: statuses held by worn equipment — an item in its slot holds its status (the gas mask in `gasMask` holds
// the status `gasMask`, Q3: without a badge) and takes it off when it leaves the slot. It reacts to inventory changes
// only (never per frame) and reads the equipment once when built, so a loaded save holds its statuses at once.
export class EquipmentStatusSource {
  #inventory;
  #statuses;
  #slots;
  #unsubscribe;

  // inventory: { getEquipped(), onInventoryChanged(handler) → unsubscribe }; statuses: PlayerStatusEffects;
  // slots: { <equipment slot>: <status id> }.
  constructor({ inventory, statuses, slots }) {
    if (typeof inventory?.getEquipped !== "function") throw new TypeError("EquipmentStatusSource requires inventory");
    if (typeof statuses?.hold !== "function") throw new TypeError("EquipmentStatusSource requires statuses");
    this.#inventory = inventory;
    this.#statuses = statuses;
    this.#slots = Object.entries(slots || {});
    this.#unsubscribe = inventory.onInventoryChanged?.(() => this.sync()) ?? null;
    this.sync();
  }

  // Spec 179 D10: a broken item (condition 0) in its slot holds no status (a broken gas mask does not protect).
  sync() {
    const equipped = this.#inventory.getEquipped() || {};
    for (const [slot, statusId] of this.#slots) {
      const item = equipped[slot];
      this.#statuses.hold(statusId, Boolean(item) && !isItemBroken(item), { source: slot });
    }
  }

  dispose() {
    if (typeof this.#unsubscribe === "function") this.#unsubscribe();
    this.#unsubscribe = null;
  }
}
