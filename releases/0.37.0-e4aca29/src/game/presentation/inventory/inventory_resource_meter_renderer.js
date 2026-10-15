import { clampFinite } from "../../../engine/math/number_normalization.js";

export class InventoryResourceMeterRenderer {
  #dom;
  #colors;
  #readings = new WeakMap();

  constructor({ domFactory, degradationColorResolver = null } = {}) {
    this.#dom = domFactory;
    this.#colors = degradationColorResolver;
  }

  update(host, model) {
    if (!host) return null;
    let meter = this.#findDirectMeter(host);
    if (!model) {
      meter?.remove();
      return null;
    }
    if (!meter || meter.dataset.resourceId !== model.id) {
      meter?.remove();
      meter = this.create(model);
      host.appendChild(meter);
    }
    this.#applyModel(meter, model);
    return meter;
  }

  create(model, { variant = "thumbnail", showIcon = true } = {}) {
    const meter = this.#dom.element(
      "span",
      [
        "inventory-resource-meter",
        `inventory-resource-meter--${variant}`,
        `inventory-resource-meter--${model.id}`,
      ].join(" "),
    );
    meter.dataset.resourceId = model.id;
    meter.setAttribute("role", "meter");
    meter.setAttribute("aria-valuemin", "0");
    meter.setAttribute("aria-valuemax", "100");
    if (showIcon && model.icon) {
      const icon = this.#dom.element(
        "span",
        "inventory-resource-meter__icon",
        model.icon,
      );
      icon.setAttribute("aria-hidden", "true");
      meter.appendChild(icon);
    }
    const track = this.#dom.element(
      "span",
      "inventory-resource-meter__track",
    );
    track.appendChild(
      this.#dom.element("span", "inventory-resource-meter__fill"),
    );
    meter.appendChild(track);
    this.#applyModel(meter, model);
    return meter;
  }

  updateReading(meter, model) {
    this.#applyModel(meter, model);
  }

  #applyModel(meter, model) {
    const percent = clampFinite(model.percent, 0, 100);
    const previous = this.#readings.get(meter);
    if (previous?.percent !== percent) meter.style.setProperty("--inventory-resource-percent", `${percent}%`);
    // Occupancy grows toward danger; remaining resources shrink toward it.
    const color = this.#colors?.resolvePercent(model.remainingPercent ?? model.percent);
    const cssColor = color?.cssColor || "";
    if (previous?.color !== cssColor) meter.style.setProperty("--inventory-resource-color", cssColor);
    if (previous?.percent !== percent) meter.setAttribute("aria-valuenow", String(percent));
    if (previous?.label !== model.label) {
      meter.setAttribute("aria-valuetext", model.label);
      meter.setAttribute("aria-label", model.label);
      meter.title = model.label;
    }
    if (previous) { previous.percent = percent; previous.color = cssColor; previous.label = model.label; }
    else this.#readings.set(meter, { percent, color: cssColor, label: model.label });
  }

  #findDirectMeter(host) {
    return (
      Array.from(host.children || []).find((child) =>
        child.classList?.contains("inventory-resource-meter--thumbnail"),
      ) || null
    );
  }
}
