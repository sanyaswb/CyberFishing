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
      onSaveLoadout = null,
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
    if (model.save.visible) {
      shell.appendChild(
        this.#renderSaveBar(model.save, { onSaveLoadout, onWarning }),
      );
    }

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

  #renderSaveBar(save, { onSaveLoadout, onWarning }) {
    const bar = this.#dom.element("div", "inventory-loadout-save");
    const input = this.#dom.element("input", "inventory-loadout-save__input");
    input.type = "text";
    input.maxLength = save.maxNameLength;
    input.placeholder = save.placeholder;
    input.setAttribute("aria-label", save.placeholder);
    const button = this.#dom.button(
      "inventory-loadout-save__button",
      "💾 Зберегти комплект",
    );
    button.classList.toggle("inventory-loadout-save__button--disabled", !save.enabled);
    button.setAttribute("aria-disabled", String(!save.enabled));
    const saveAction = () => {
      if (!save.enabled) {
        onWarning?.(save.warning || "Комплект зараз неможливо зберегти");
        return;
      }
      onSaveLoadout?.(input.value.trim());
    };
    button.addEventListener("click", saveAction);
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      saveAction();
    });
    bar.append(input, button);
    return bar;
  }
}
