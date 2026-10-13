import { inventorySlotIconPath } from "./inventory_slot_icons.js";

export class InventoryHeaderRenderer {
  #dom;

  constructor({ domFactory } = {}) {
    this.#dom = domFactory;
  }

  render(
    header,
    settings,
    { onClose = null, onAutoBaitChange = null, onAutoChumChange = null } = {},
  ) {
    const top = this.#dom.element("header", "inventory-header");
    top.append(this.#renderLoad(header), this.#renderSettings(header, settings, {
      onAutoBaitChange, onAutoChumChange,
    }));
    const close = this.#dom.button("inventory-header__close ui-modal-close", "×", {
      title: "Закрити інвентар",
    });
    close.setAttribute("aria-label", "Закрити інвентар");
    close.addEventListener("click", () => onClose?.());
    top.appendChild(close);
    return top;
  }

  #renderLoad(header) {
    const load = this.#dom.element("div", "inventory-load");
    load.title = `${header.loadLabel}: ${this.#format(header.loadValue)} ${header.loadUnit}`;
    load.setAttribute("aria-label", load.title);
    const icon = this.#dom.image(inventorySlotIconPath("weight"), "");
    icon.className = "inventory-load__icon";
    icon.setAttribute("aria-hidden", "true");
    load.append(icon, this.#dom.element("strong", "inventory-load__value",
      `${this.#format(header.loadValue)} ${header.loadUnit}`));
    return load;
  }

  #renderSettings(header, settings, { onAutoBaitChange, onAutoChumChange }) {
    const container = this.#dom.element("div", "inventory-auto-settings");
    container.append(
      this.#createToggle("inventory-auto-bait", "bait", "Наживка", "Автонаживляння",
        header.activeBaits, settings.autoBait, header.baitStock, onAutoBaitChange),
      this.#createToggle("inventory-auto-chum", "chum", "Прикормка", "Автоприкормка",
        header.activeChums, settings.autoChum, header.chumStock, onAutoChumChange),
    );
    return container;
  }

  #createToggle(id, slotId, name, modeLabel, items, checked, stock = 0, onChange) {
    const label = this.#dom.element("label", "inventory-toggle");
    label.title = items.length ? items.map((item) => item.name || name).join(", ") : name;
    const content = this.#dom.element("span", "inventory-active-indicator__items");
    content.setAttribute("aria-label", name);
    if (!items.length) {
      const icon = this.#dom.image(inventorySlotIconPath(slotId), "");
      icon.className = "inventory-active-indicator__placeholder";
      icon.setAttribute("aria-hidden", "true");
      content.appendChild(icon);
    } else {
      for (const item of items) {
        const media = this.#dom.element("span", "inventory-active-indicator__item");
        media.title = item.name || name;
        const image = this.#dom.image(item.iconUrl || item.imageUrl, item.name || name);
        if (image) media.appendChild(image);
        else media.textContent = String(item.icon || item.emoji || "");
        content.appendChild(media);
      }
    }

    const input = this.#dom.element("input");
    input.id = id;
    input.type = "checkbox";
    input.checked = checked;
    input.setAttribute("role", "switch");
    input.setAttribute("aria-label", `${modeLabel}. Доступно в інвентарі: ${stock}`);
    input.addEventListener("change", () => onChange?.(input.checked));
    const control = this.#dom.element("span", "inventory-toggle__control");
    control.setAttribute("aria-hidden", "true");
    control.append(
      this.#dom.element("span", "inventory-toggle__count", String(stock)),
      this.#dom.element("span", "inventory-toggle__thumb", "A"),
    );
    label.append(content, input, control);
    return label;
  }

  #format(value) {
    const number = Number(value) || 0;
    return Number.isInteger(number) ? String(number) : number.toFixed(1);
  }
}
