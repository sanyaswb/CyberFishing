export class InventoryLoadoutPanelRenderer {
  #dom;
  #itemRenderer;
  #resourceMeterRenderer;
  #getEquippedLongPressDurationMs;

  constructor({ domFactory, itemRenderer, resourceMeterRenderer, getEquippedLongPressDurationMs } = {}) {
    this.#dom = domFactory;
    this.#itemRenderer = itemRenderer;
    this.#resourceMeterRenderer = resourceMeterRenderer;
    this.#getEquippedLongPressDurationMs = getEquippedLongPressDurationMs;
  }

  render(
    model,
    {
      onSlotActivate = null,
      onSlotLongPress = null,
      onWarning = null,
    } = {},
  ) {
    const handlers = { onSlotActivate, onSlotLongPress, onWarning };
    const shell = this.#dom.element(
      "section",
      "inventory-loadout-shell",
    );
    const panel = this.#dom.element(
      "div",
      "inventory-loadout-panel inventory-panel",
    );

    const primary = this.#dom.element(
      "div",
      "inventory-loadout-panel__primary",
    );
    const rod = model.mainSlots.find((slot) => slot.slotId === "rod");
    const dependentSlots = model.mainSlots.filter(
      (slot) => slot.slotId !== "rod",
    );
    // Without dependent slots (no rod selected) the rod cell spans the whole primary panel.
    primary.classList.toggle("inventory-loadout-panel__primary--single", dependentSlots.length === 0);
    if (rod) primary.appendChild(this.#renderRod(rod, handlers));
    if (dependentSlots.length) {
      const cascade = this.#dom.element(
        "div",
        "inventory-loadout-panel__cascade",
      );
      dependentSlots.forEach((slot) => {
        cascade.appendChild(this.#renderSlot(slot, "semantic", handlers));
      });
      primary.appendChild(cascade);
    }
    panel.appendChild(primary);

    if (model.auxiliarySlots.length) {
      const auxiliary = this.#dom.element(
        "div",
        "inventory-loadout-panel__auxiliary",
      );
      model.auxiliarySlots.forEach((slot) => {
        auxiliary.appendChild(this.#renderSlot(slot, "auxiliary", handlers));
      });
      panel.appendChild(auxiliary);
    }
    shell.appendChild(panel);
    return shell;
  }

  // The rod column: its cell, then the equipped rod's condition meter in a stats container under it (like the
  // backpack's stats); an empty rod cell has none.
  #renderRod(slot, handlers) {
    const column = this.#dom.element("div", "inventory-loadout-panel__rod");
    column.appendChild(this.#renderSlot(slot, "rod", handlers));
    const condition = slot.item?.condition;
    const percent = Number(condition?.percent);
    if (condition?.available && Number.isFinite(percent)) {
      const label = `${condition.metricLabel} ${Math.round(percent)}%`;
      const meter = this.#resourceMeterRenderer.create(
        { id: "condition", percent, label },
        { variant: "parameter", showIcon: false },
      );
      meter.classList.add("inventory-loadout-panel__rod-condition");
      const stats = this.#dom.element("div", "inventory-loadout-panel__rod-stats inventory-panel");
      stats.appendChild(meter);
      column.appendChild(stats);
    }
    return column;
  }

  #renderSlot(
    slot,
    variant,
    { onSlotActivate, onSlotLongPress, onWarning },
  ) {
    const supportsLongPress = Boolean(slot.item);
    return this.#itemRenderer.renderSlot(slot, {
      variant,
      onActivate: () => onSlotActivate?.(slot),
      onLongPress: supportsLongPress
        ? () => onSlotLongPress?.(slot)
        : null,
      longPressDurationMs:
        this.#getEquippedLongPressDurationMs(),
      onUnavailable: (warning) => onWarning?.(warning),
    });
  }

}
