import { clampFinite } from "../../../engine/math/number_normalization.js";
import { inventorySlotIconPath } from "./inventory_slot_icons.js";

// Projects the tackle's existing load limit onto the owner's fixed kilogram scale.
export class InventoryLoadRenderer {
  #dom;
  #meters;
  #maxLoadKg;
  #bindings = new WeakMap();

  constructor({ domFactory, resourceMeterRenderer, config }) {
    this.#dom = domFactory;
    this.#meters = resourceMeterRenderer;
    this.#maxLoadKg = config.maxLoadKg;
  }

  create() {
    const root = this.#dom.element("div", "inventory-load");
    const icon = this.#dom.image(inventorySlotIconPath("weight"), "");
    icon.className = "inventory-load__icon";
    icon.setAttribute("aria-hidden", "true");
    const meter = this.#meters.create({ id: "load", percent: 0, label: "" },
      { variant: "summary", showIcon: false });
    meter.classList.add("inventory-load__meter");
    const value = this.#dom.element("strong", "inventory-load__value");
    value.setAttribute("aria-hidden", "true");
    root.append(icon, meter, value);
    this.#bindings.set(root, { meter, value });
    return root;
  }

  update(root, header) {
    const binding = this.#bindings.get(root);
    const load = Math.max(0, Number(header.loadValue) || 0);
    const formatted = Number.isInteger(load) ? String(load) : load.toFixed(1);
    const value = `${formatted} ${header.loadUnit}`;
    if (binding.value.textContent !== value) binding.value.textContent = value;
    this.#meters.updateReading(binding.meter, {
      percent: clampFinite(load / this.#maxLoadKg * 100, 0, 100),
      label: `${header.loadLabel}: ${value} / ${this.#maxLoadKg} ${header.loadUnit}`,
    });
  }
}
