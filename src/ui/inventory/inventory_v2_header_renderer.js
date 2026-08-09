class InventoryV2HeaderRenderer {
  #dom;

  constructor({ domFactory } = {}) {
    this.#dom = domFactory || new globalThis.InventoryV2DomFactory();
  }

  render(
    header,
    settings,
    { onClose = null, onAutoBaitChange = null, onAutoChumChange = null } = {},
  ) {
    const top = this.#dom.element("header", "inventory-v2-header");
    top.appendChild(this.#renderLoad(header));
    top.appendChild(this.#renderActiveTackle(header));
    top.appendChild(
      this.#renderSettings(settings, {
        onAutoBaitChange,
        onAutoChumChange,
      }),
    );

    const close = this.#dom.button(
      "inventory-v2-header__close",
      "× Закрити",
      { title: "Закрити інвентар" },
    );
    close.addEventListener("click", () => onClose?.());
    top.appendChild(close);
    return top;
  }

  #renderLoad(header) {
    const load = this.#dom.element("div", "inventory-v2-load");
    load.append(
      this.#dom.element("span", "inventory-v2-load__icon", "🧱"),
      this.#dom.element(
        "span",
        "inventory-v2-load__label",
        `${header.loadLabel}:`,
      ),
      this.#dom.element(
        "strong",
        "inventory-v2-load__value",
        `${this.#format(header.loadValue)} ${header.loadUnit}`,
      ),
    );
    return load;
  }

  #renderActiveTackle(header) {
    const active = this.#dom.element(
      "div",
      "inventory-v2-active-tackle",
    );
    active.append(
      this.#renderIndicator("Наживка", header.activeBaits, "🪱"),
      this.#renderIndicator("Прикормка", header.activeChums, "🟫"),
    );
    return active;
  }

  #renderIndicator(labelText, items, fallbackIcon) {
    const indicator = this.#dom.element(
      "section",
      "inventory-v2-active-indicator",
    );
    indicator.appendChild(
      this.#dom.element(
        "div",
        "inventory-v2-active-indicator__label",
        labelText,
      ),
    );
    const content = this.#dom.element(
      "div",
      "inventory-v2-active-indicator__items",
    );
    if (!items.length) {
      content.appendChild(
        this.#dom.element(
          "span",
          "inventory-v2-active-indicator__empty",
          "—",
        ),
      );
    } else {
      items.forEach((item) => {
        const itemNode = this.#dom.element(
          "span",
          "inventory-v2-active-indicator__item",
        );
        itemNode.title = String(item.name || labelText);
        const image = this.#dom.image(
          item.iconUrl || item.imageUrl,
          item.name || "",
        );
        if (image) {
          itemNode.appendChild(image);
        } else {
          itemNode.textContent = String(item.icon || item.emoji || fallbackIcon);
        }
        content.appendChild(itemNode);
      });
    }
    indicator.appendChild(content);
    return indicator;
  }

  #renderSettings(
    settings,
    { onAutoBaitChange = null, onAutoChumChange = null } = {},
  ) {
    const container = this.#dom.element(
      "div",
      "inventory-v2-auto-settings",
    );
    container.append(
      this.#createToggle(
        "inventory-v2-auto-bait",
        "Автонаживляння",
        settings.autoBait,
        onAutoBaitChange,
      ),
      this.#createToggle(
        "inventory-v2-auto-chum",
        "Автоприкормка",
        settings.autoChum,
        onAutoChumChange,
      ),
    );
    return container;
  }

  #createToggle(id, labelText, checked, onChange) {
    const label = this.#dom.element("label", "inventory-v2-toggle");
    const input = this.#dom.element("input");
    input.id = id;
    input.type = "checkbox";
    input.checked = checked;
    input.addEventListener("change", () => onChange?.(input.checked));
    const control = this.#dom.element("span", "inventory-v2-toggle__control");
    const text = this.#dom.element(
      "span",
      "inventory-v2-toggle__label",
      labelText,
    );
    label.append(input, control, text);
    return label;
  }

  #format(value) {
    const number = Number(value) || 0;
    return Number.isInteger(number) ? String(number) : number.toFixed(1);
  }
}

globalThis.InventoryV2HeaderRenderer = InventoryV2HeaderRenderer;
