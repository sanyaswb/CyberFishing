export class InventoryLoadoutPanelRenderer {
  #dom;
  #itemRenderer;
  #getEquippedLongPressDurationMs;

  constructor({ domFactory, itemRenderer, getEquippedLongPressDurationMs } = {}) {
    this.#dom = domFactory;
    this.#itemRenderer = itemRenderer;
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
    if (rod) {
      primary.appendChild(
        this.#renderSlot(rod, "rod", {
          onSlotActivate,
          onSlotLongPress,
          onWarning,
        }),
      );
    }
    const cascade = this.#dom.element(
      "div",
      "inventory-loadout-panel__cascade",
    );
    dependentSlots.forEach((slot) => {
      cascade.appendChild(
        this.#renderSlot(slot, "semantic", {
          onSlotActivate,
          onSlotLongPress,
          onWarning,
        }),
      );
    });
    primary.appendChild(cascade);
    panel.appendChild(primary);

    if (model.auxiliarySlots.length) {
      const auxiliary = this.#dom.element(
        "div",
        "inventory-loadout-panel__auxiliary",
      );
      model.auxiliarySlots.forEach((slot) => {
        auxiliary.appendChild(
          this.#renderSlot(slot, "auxiliary", {
            onSlotActivate,
            onSlotLongPress,
            onWarning,
          }),
        );
      });
      panel.appendChild(auxiliary);
    }
    shell.appendChild(panel);
    return shell;
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
