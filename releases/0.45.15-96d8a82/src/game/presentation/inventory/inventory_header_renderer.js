import { inventorySlotIconPath } from "./inventory_slot_icons.js";

export class InventoryHeaderRenderer {
  #dom;
  #closeButtons;
  #autoSwitches;
  #loadRenderer;
  #bindings = new Map();

  constructor({ domFactory, closeButtonRenderer, autoSwitchRenderer, loadRenderer } = {}) {
    this.#dom = domFactory;
    this.#closeButtons = closeButtonRenderer;
    this.#autoSwitches = autoSwitchRenderer;
    this.#loadRenderer = loadRenderer;
  }

  render(
    header,
    settings,
    { onClose = null, onAutoBaitChange = null, onAutoChumChange = null, onConsumableActivate = null } = {},
  ) {
    const top = this.#dom.element("header", "inventory-header");
    const row = this.#dom.element("div", "inventory-header__controls");
    const controls = this.#renderSettings(header, settings, {
      onAutoBaitChange, onAutoChumChange, onConsumableActivate,
    });
    const close = this.#closeButtons.create({
      className: "inventory-header__close", label: "Закрити інвентар", onClose,
    });
    row.append(controls, close);
    const load = this.#loadRenderer.create();
    load.classList.add("inventory-header__load");
    top.append(row, load);
    this.#bindings.set(top, { close, switches: [...controls.children], load });
    this.updateLoad(top, header);
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

  update(node, header, settings) {
    const binding = this.#bindings.get(node);
    if (!binding) return;
    this.updateLoad(node, header);
    this.#autoSwitches.update(binding.switches[0], { slots: header.baitSlots,
      checked: settings.autoBait, stock: header.baitStock });
    this.#autoSwitches.update(binding.switches[1], { slots: header.chumSlots,
      checked: settings.autoChum, stock: header.chumStock });
  }

  updateLoad(node, header) {
    const binding = this.#bindings.get(node);
    if (binding) this.#loadRenderer.update(binding.load, header);
  }

  #renderSettings(header, settings, { onAutoBaitChange, onAutoChumChange, onConsumableActivate }) {
    const container = this.#dom.element("div", "inventory-auto-settings");
    container.append(
      this.#createToggle("inventory-auto-bait", "bait", "Наживка", "Автонаживляння",
        header.baitSlots || header.activeBaits.map((item) => ({ item, available: true })), settings.autoBait, header.baitStock, onAutoBaitChange, onConsumableActivate),
      this.#createToggle("inventory-auto-chum", "chum", "Прикормка", "Автоприкормка",
        header.chumSlots || header.activeChums.map((item) => ({ item, available: true })), settings.autoChum, header.chumStock, onAutoChumChange, onConsumableActivate),
    );
    return container;
  }

  #createToggle(id, slotId, name, modeLabel, slots, checked, stock = 0, onChange, onActivate) {
    return this.#autoSwitches.create({ id, name, modeLabel, slots, checked, stock, onChange,
      onSlotActivate: (slotIndex) => onActivate?.(slotId, slotIndex),
      placeholderUrl: inventorySlotIconPath(slotId) });
  }

}
