import { inventorySlotIconAsset } from "./inventory_slot_icons.js";

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
    { onClose = null, onAutoBaitChange = null, onAutoChumChange = null, onConsumableActivate = null,
      onConsumableLongPress = null } = {},
  ) {
    const top = this.#dom.element("header", "inventory-header");
    const row = this.#dom.element("div", "inventory-header__controls");
    const controls = this.#renderSettings(header, settings, {
      onAutoBaitChange, onAutoChumChange, onConsumableActivate, onConsumableLongPress,
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
    this.#autoSwitches.update(binding.switches[0], { slots: header.baitSlots, stock: header.baitStock,
      ...InventoryHeaderRenderer.#automaticState(header.baitSlots, settings.autoBait) });
    this.#autoSwitches.update(binding.switches[1], { slots: header.chumSlots, stock: header.chumStock,
      ...InventoryHeaderRenderer.#automaticState(header.chumSlots, settings.autoChum) });
  }

  updateLoad(node, header) {
    const binding = this.#bindings.get(node);
    if (binding) this.#loadRenderer.update(binding.load, header);
  }

  #renderSettings(header, settings, { onAutoBaitChange, onAutoChumChange, onConsumableActivate, onConsumableLongPress }) {
    const container = this.#dom.element("div", "inventory-auto-settings");
    container.append(
      this.#createToggle("inventory-auto-bait", "bait", "Наживка", "Автонаживляння",
        header.baitSlots || header.activeBaits.map((item) => ({ item, available: true })), settings.autoBait, header.baitStock, onAutoBaitChange, onConsumableActivate, onConsumableLongPress),
      this.#createToggle("inventory-auto-chum", "chum", "Прикормка", "Автоприкормка",
        header.chumSlots || header.activeChums.map((item) => ({ item, available: true })), settings.autoChum, header.chumStock, onAutoChumChange, onConsumableActivate),
    );
    return container;
  }

  // TK-237: automatic mode needs a chosen bait/chum: without one in any slot the switch is off and inactive (the
  // remembered refill choice must not turn it on with an old reserve); the saved setting itself is kept.
  static #automaticState(slots, enabled) {
    const chosen = (slots || []).some((slot) => slot.item);
    return { checked: chosen && enabled === true, disabled: !chosen };
  }

  #createToggle(id, slotId, name, modeLabel, slots, checked, stock = 0, onChange, onActivate, onLongPress = null) {
    return this.#autoSwitches.create({ id, name, modeLabel, slots, stock, onChange, activateUnavailable: true,
      ...InventoryHeaderRenderer.#automaticState(slots, checked),
      onSlotActivate: (slotIndex) => onActivate?.(slotId, slotIndex),
      onSlotLongPress: slotId === "bait" && onLongPress
        ? (slotIndex, instanceId) => onLongPress(slotId, slotIndex, instanceId) : null,
      placeholderAsset: inventorySlotIconAsset(slotId) });
  }

}
