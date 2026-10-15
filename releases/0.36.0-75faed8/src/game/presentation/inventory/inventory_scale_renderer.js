import { clampFinite } from "../../../engine/math/number_normalization.js";

// One scale composition (spec 075): an SVG icon, the shared resource meter and a reading centred on it. The load
// and backpack capacity scales use it; each owner maps its value onto the percent and accessible label.
export class InventoryScaleRenderer {
  #dom;
  #meters;
  #bindings = new WeakMap();

  constructor({ domFactory, resourceMeterRenderer }) {
    this.#dom = domFactory;
    this.#meters = resourceMeterRenderer;
  }

  create({ iconPath, meterId, className = "" }) {
    const root = this.#dom.element("div", `inventory-scale ${className}`.trim());
    const icon = this.#dom.image(iconPath, "");
    icon.className = "inventory-scale__icon";
    icon.setAttribute("aria-hidden", "true");
    const meter = this.#meters.create({ id: meterId, percent: 0, label: "" }, { variant: "summary", showIcon: false });
    meter.classList.add("inventory-scale__meter");
    const value = this.#dom.element("strong", "inventory-scale__value");
    value.setAttribute("aria-hidden", "true");
    root.append(icon, meter, value);
    this.#bindings.set(root, { meter, value });
    return root;
  }

  update(root, { percent, value, label }) {
    const binding = this.#bindings.get(root);
    if (binding.value.textContent !== value) binding.value.textContent = value;
    this.#meters.updateReading(binding.meter, { percent: clampFinite(percent, 0, 100), label });
  }
}
