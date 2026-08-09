class InventoryV2ResourceMeterRenderer {
  #dom;

  constructor({ domFactory } = {}) {
    this.#dom = domFactory || new globalThis.InventoryV2DomFactory();
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
        "inventory-v2-resource-meter",
        `inventory-v2-resource-meter--${variant}`,
        `inventory-v2-resource-meter--${model.id}`,
      ].join(" "),
    );
    meter.dataset.resourceId = model.id;
    meter.setAttribute("role", "meter");
    meter.setAttribute("aria-valuemin", "0");
    meter.setAttribute("aria-valuemax", "100");
    if (showIcon && model.icon) {
      const icon = this.#dom.element(
        "span",
        "inventory-v2-resource-meter__icon",
        model.icon,
      );
      icon.setAttribute("aria-hidden", "true");
      meter.appendChild(icon);
    }
    const track = this.#dom.element(
      "span",
      "inventory-v2-resource-meter__track",
    );
    track.appendChild(
      this.#dom.element("span", "inventory-v2-resource-meter__fill"),
    );
    meter.appendChild(track);
    this.#applyModel(meter, model);
    return meter;
  }

  #applyModel(meter, model) {
    meter.style.setProperty(
      "--inventory-v2-resource-percent",
      `${model.percent}%`,
    );
    meter.setAttribute("aria-valuenow", String(model.percent));
    meter.setAttribute("aria-label", model.label);
  }

  #findDirectMeter(host) {
    return (
      Array.from(host.children || []).find((child) =>
        child.classList?.contains("inventory-v2-resource-meter--thumbnail"),
      ) || null
    );
  }
}

globalThis.InventoryV2ResourceMeterRenderer =
  InventoryV2ResourceMeterRenderer;
