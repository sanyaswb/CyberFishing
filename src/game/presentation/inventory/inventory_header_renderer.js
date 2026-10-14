import { inventorySlotIconPath } from "./inventory_slot_icons.js";

export class InventoryHeaderRenderer {
  #dom;
  #closeButtons;
  #autoSwitches;
  #bindings = new Map();

  constructor({ domFactory, closeButtonRenderer, autoSwitchRenderer } = {}) {
    this.#dom = domFactory;
    this.#closeButtons = closeButtonRenderer;
    this.#autoSwitches = autoSwitchRenderer;
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
    const close = this.#closeButtons.create({
      className: "inventory-header__close", label: "Закрити інвентар", onClose,
    });
    top.appendChild(close);
    this.#bindings.set(top, { close, switches: [...top.children[1].children] });
    return top;
  }

  dispose(header = null) {
    const headers = header ? [header] : [...this.#bindings.keys()];
    for (const node of headers) {
      const binding = this.#bindings.get(node);
      if (!binding) continue;
      this.#closeButtons.dispose(binding.close);
      for (const toggle of binding.switches) this.#autoSwitches.dispose(toggle);
      this.#bindings.delete(node);
    }
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
    return this.#autoSwitches.create({ id, name, modeLabel, items, checked, stock, onChange,
      placeholderUrl: inventorySlotIconPath(slotId) });
  }

  #format(value) {
    const number = Number(value) || 0;
    return Number.isInteger(number) ? String(number) : number.toFixed(1);
  }
}
