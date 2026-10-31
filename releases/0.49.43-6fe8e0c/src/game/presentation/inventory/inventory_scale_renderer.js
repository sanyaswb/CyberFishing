import { clampFinite } from "../../../engine/math/number_normalization.js";

// One scale composition (spec 075): an icon, the shared resource meter and a reading centred on it. The load,
// backpack and keepnet capacity scales use it; each owner maps its value onto the percent and accessible label. The
// icon is an image (iconAsset) or, with iconSymbol, a symbol of that sprite drawn in currentColor (spec 088); both are
// asset ids (spec 157 R16). remainingPercent picks
// the meter colour when free space, not the reading, is what runs out.
export class InventoryScaleRenderer {
  #dom;
  #meters;
  #bindings = new WeakMap();

  constructor({ domFactory, resourceMeterRenderer }) {
    this.#dom = domFactory;
    this.#meters = resourceMeterRenderer;
  }

  create({ iconAsset = "", iconSymbol = "", meterId, className = "" }) {
    const root = this.#dom.element("div", `inventory-scale ${className}`.trim());
    const icon = iconSymbol ? this.#dom.svgIcon(iconAsset, iconSymbol, "inventory-scale__icon inventory-scale__icon--sprite")
      : this.#dom.image(iconAsset, "");
    if (!iconSymbol) {
      icon.className = "inventory-scale__icon";
      icon.setAttribute("aria-hidden", "true");
    }
    const meter = this.#meters.create({ id: meterId, percent: 0, label: "" }, { variant: "summary", showIcon: false });
    meter.classList.add("inventory-scale__meter");
    const value = this.#dom.element("strong", "inventory-scale__value");
    value.setAttribute("aria-hidden", "true");
    root.append(icon, meter, value);
    this.#bindings.set(root, { meter, value });
    return root;
  }

  update(root, { percent, remainingPercent, value, label }) {
    const binding = this.#bindings.get(root);
    if (binding.value.textContent !== value) binding.value.textContent = value;
    this.#meters.updateReading(binding.meter, { percent: clampFinite(percent, 0, 100), remainingPercent, label });
  }
}
