class InventoryV2SavedLoadoutPreviewRenderer {
  #dom;
  #itemRenderer;

  constructor({ domFactory, itemRenderer } = {}) {
    this.#dom = domFactory || new globalThis.InventoryV2DomFactory();
    this.#itemRenderer =
      itemRenderer ||
      new globalThis.InventoryV2ItemCardRenderer({ domFactory: this.#dom });
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
      "inventory-v2-saved-loadout-preview",
    );
    const heading = this.#dom.element(
      "div",
      "inventory-v2-saved-loadout-preview__heading",
    );
    heading.append(
      this.#dom.element(
        "h3",
        "inventory-v2-saved-loadout-preview__title",
        model.name,
      ),
      this.#dom.element(
        "p",
        "inventory-v2-saved-loadout-preview__hint",
        "Натисніть предмет, щоб спорядити лише його",
      ),
    );

    const slots = this.#dom.element(
      "div",
      "inventory-v2-saved-loadout-preview__slots",
    );
    model.slots.forEach((slot) => {
      slots.appendChild(this.#renderSlot(slot, onSlotEquip));
    });
    if (!model.slots.length) {
      slots.appendChild(
        this.#dom.element(
          "p",
          "inventory-v2-saved-loadout-preview__empty",
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
      "inventory-v2-saved-loadout-preview__field",
    );
    field.dataset.slotId = String(slot.slotId || "");
    field.classList.toggle("is-active", slot.active === true);
    field.appendChild(
      this.#dom.element(
        "div",
        "inventory-v2-saved-loadout-preview__label",
        slot.label,
      ),
    );
    const well = this.#dom.element(
      "div",
      "inventory-v2-saved-loadout-preview__well",
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
        "inventory-v2-saved-loadout-preview__membership-dot",
      );
      membership.setAttribute("role", "img");
      membership.setAttribute("aria-label", "Належить до збірки");
      well.appendChild(membership);
    } else {
      well.classList.add("is-empty");
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
      "inventory-v2-saved-loadout-preview__actions",
    );
    actions.append(
      this.#actionButton(
        "Спорядити все",
        "is-primary",
        model.canEquipAll,
        () => {
          if (!model.canEquipAll) return onWarning?.(model.equipWarning);
          onEquipAll?.();
        },
      ),
      this.#actionButton("Назад", "is-muted", true, () => onBack?.()),
      this.#actionButton(
        "Розібрати",
        "is-danger",
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
      "inventory-v2-saved-loadout-preview__button",
      modifier,
    ]
      .filter(Boolean)
      .join(" ");
    const button = this.#dom.button(classes, label);
    button.classList.toggle("is-disabled", !enabled);
    button.setAttribute("aria-disabled", String(!enabled));
    button.addEventListener("click", action);
    return button;
  }
}

globalThis.InventoryV2SavedLoadoutPreviewRenderer =
  InventoryV2SavedLoadoutPreviewRenderer;
