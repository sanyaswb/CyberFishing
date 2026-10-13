export class InventoryResourceMeterRenderer {
  #dom;
  #colors;

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
    meter.style.setProperty(
      "--inventory-resource-percent",
      `${model.percent}%`,
    );
    // Occupancy grows toward danger; remaining resources shrink toward it.
    const color = this.#colors?.resolvePercent(model.remainingPercent ?? model.percent);
    meter.style.setProperty("--inventory-resource-color", color?.cssColor || "");
    meter.setAttribute("aria-valuenow", String(model.percent));
    meter.setAttribute("aria-label", model.label);
    meter.title = model.label;
  }

  #findDirectMeter(host) {
    return (
      Array.from(host.children || []).find((child) =>
        child.classList?.contains("inventory-resource-meter--thumbnail"),
      ) || null
    );
  }
}
