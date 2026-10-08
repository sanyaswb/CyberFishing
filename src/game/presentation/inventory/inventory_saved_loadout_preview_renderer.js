export class InventorySavedLoadoutPreviewRenderer {
  #dom;
  #itemRenderer;

  constructor({ domFactory, itemRenderer } = {}) {
    this.#dom = domFactory;
    this.#itemRenderer = itemRenderer;
  }

  render(
    model,
    {
      onSlotEquip = null,
      onEquipAll = null,
      onDisassemble = null,
      onBack = null,
      onWarning = null,
    } = {},
  ) {
    const preview = this.#dom.element(
      "section",
      "inventory-saved-loadout-preview inventory-panel inventory-panel--full-height",
    );
    const heading = this.#dom.element(
      "div",
      "inventory-saved-loadout-preview__heading",
    );
    heading.append(
      this.#dom.element(
        "h3",
        "inventory-saved-loadout-preview__title",
        model.name,
      ),
      this.#dom.element(
        "p",
        "inventory-saved-loadout-preview__hint",
        "Натисніть предмет, щоб спорядити лише його",
      ),
    );

    const slots = this.#dom.element(
      "div",
      "inventory-saved-loadout-preview__slots",
    );
    model.slots.forEach((slot) => {
      slots.appendChild(this.#renderSlot(slot, onSlotEquip));
    });
    if (!model.slots.length) {
      slots.appendChild(
        this.#dom.element(
          "p",
          "inventory-saved-loadout-preview__empty",
          "Збірка порожня",
        ),
      );
    }

    preview.append(
      heading,
      this.#renderActions(model, {
        onEquipAll,
        onDisassemble,
        onBack,
        onWarning,
      }),
      slots,
    );
    return preview;
  }

  #renderSlot(slot, onSlotEquip) {
    const field = this.#dom.element(
      "div",
      "inventory-saved-loadout-preview__field",
    );
    field.dataset.slotId = String(slot.slotId || "");
    field.classList.toggle("inventory-saved-loadout-preview__field--active", slot.active === true);
    field.appendChild(
      this.#dom.element(
        "div",
        "inventory-saved-loadout-preview__label",
        slot.label,
      ),
    );
    const well = this.#dom.element(
      "div",
      "inventory-saved-loadout-preview__well",
    );
    if (slot.item) {
      const card = this.#itemRenderer.renderItem(slot.item, {
        variant: "saved-loadout",
        onActivate: () => onSlotEquip?.(slot),
      });
      card.setAttribute("aria-pressed", String(slot.active === true));
      well.appendChild(card);
      const membership = this.#dom.element(
        "span",
        "inventory-saved-loadout-preview__membership-dot",
      );
      membership.setAttribute("role", "img");
      membership.setAttribute("aria-label", "Належить до збірки");
      well.appendChild(membership);
    } else {
      well.classList.add("inventory-saved-loadout-preview__well--empty");
      well.setAttribute("aria-label", `${slot.label}: порожньо`);
    }
    field.appendChild(well);
    return field;
  }

  #renderActions(
    model,
    { onEquipAll, onDisassemble, onBack, onWarning },
  ) {
    const actions = this.#dom.element(
      "div",
      "inventory-saved-loadout-preview__actions",
    );
    actions.append(
      this.#actionButton(
        "Спорядити все",
        "inventory-action--primary",
        model.canEquipAll,
        () => {
          if (!model.canEquipAll) return onWarning?.(model.equipWarning);
          onEquipAll?.();
        },
      ),
      this.#actionButton("Назад", "inventory-action--muted", true, () => onBack?.()),
      this.#actionButton(
        "Розібрати",
        "inventory-action--danger",
        model.canDisassemble,
        () => {
          if (!model.canDisassemble) {
            return onWarning?.(model.disassembleWarning);
          }
          onDisassemble?.();
        },
      ),
    );
    return actions;
  }

  #actionButton(label, modifier, enabled, action) {
    const classes = [
      "inventory-saved-loadout-preview__button inventory-action",
      modifier,
    ]
      .filter(Boolean)
      .join(" ");
    const button = this.#dom.button(classes, label);
    button.classList.toggle("inventory-action--disabled", !enabled);
    button.setAttribute("aria-disabled", String(!enabled));
    button.addEventListener("click", action);
    return button;
  }
}
