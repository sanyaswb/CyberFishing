import { inventorySlotIconPath } from "./inventory_slot_icons.js";

// Projects the tackle's existing load limit onto the owner's fixed kilogram scale.
export class InventoryLoadRenderer {
  #scales;
  #maxLoadKg;

  constructor({ scaleRenderer, config }) {
    this.#scales = scaleRenderer;
    this.#maxLoadKg = config.maxLoadKg;
  }

  create() {
    return this.#scales.create({ iconPath: inventorySlotIconPath("weight"), meterId: "load", className: "inventory-load" });
  }

  update(root, header) {
    const load = Math.max(0, Number(header.loadValue) || 0);
    const formatted = Number.isInteger(load) ? String(load) : load.toFixed(1);
    const value = `${formatted} ${header.loadUnit}`;
    this.#scales.update(root, {
      percent: load / this.#maxLoadKg * 100,
      value,
      label: `${header.loadLabel}: ${value} / ${this.#maxLoadKg} ${header.loadUnit}`,
    });
  }
}
