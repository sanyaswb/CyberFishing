import { inventorySlotIconAsset } from "./inventory_slot_icons.js";

export class InventorySavedLoadoutPreviewRenderer {
  #dom;
  #itemRenderer;
  #parametersRenderer;
  #parameterSectionResolver;

  constructor({ domFactory, itemRenderer, parametersRenderer, parameterSectionResolver } = {}) {
    this.#dom = domFactory;
    this.#itemRenderer = itemRenderer;
    this.#parametersRenderer = parametersRenderer;
    this.#parameterSectionResolver = parameterSectionResolver;
  }

  render(
    model,
    {
      onSlotEquip = null,
      onEquipAll = null,
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
        "Оберіть предмет для перегляду або спорядіть збірку",
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
        onBack,
        onWarning,
      }),
      slots,
    );
    const parameters = this.#parametersRenderer?.renderSections(this.#parameterSectionResolver.resolve({ sockets: model.slots }));
    if (parameters) preview.appendChild(parameters);
    return preview;
  }

  updateDynamicVisuals(host, model) {
    return this.#parametersRenderer?.updateSections(host, this.#parameterSectionResolver.resolve({ sockets: model.slots }));
  }

  #renderSlot(slot, onSlotEquip) {
    const field = this.#dom.element(
      "div",
      "inventory-saved-loadout-preview__field",
    );
    field.dataset.slotId = String(slot.slotId || "");
    field.classList.toggle("inventory-saved-loadout-preview__field--active", slot.active === true);
    field.setAttribute("aria-label", slot.label);
    field.title = slot.label;
    const well = this.#dom.element(
      "div",
      "inventory-saved-loadout-preview__well",
    );
    if (slot.item) {
      const card = this.#itemRenderer.renderItem(slot.item, {
        variant: "saved-loadout",
        onActivate: () => onSlotEquip?.(slot),
        showAttachments: false,
        showTooltip: !this.#parametersRenderer?.hasParameters(slot.item),
      });
      card.setAttribute("aria-pressed", String(slot.active === true));
      well.appendChild(card);
    } else {
      well.classList.add("inventory-saved-loadout-preview__well--empty");
      well.setAttribute("aria-label", `${slot.label}: порожньо`);
      const placeholder = this.#dom.image(inventorySlotIconAsset(slot.slotId), "");
      if (placeholder) {
        placeholder.className = "inventory-slot-icon";
        placeholder.setAttribute("aria-hidden", "true");
        well.appendChild(placeholder);
      }
    }
    field.appendChild(well);
    return field;
  }

  #renderActions(
    model,
    { onEquipAll, onBack, onWarning },
  ) {
    const actions = this.#dom.element(
      "div",
      "inventory-saved-loadout-preview__actions",
    );
    actions.append(
      this.#actionButton(
        "Спорядити",
        "inventory-action--primary",
        model.canEquipAll,
        () => {
          if (!model.canEquipAll) return onWarning?.(model.equipWarning);
          onEquipAll?.();
        },
      ),
      this.#actionButton("Назад", "inventory-action--muted", true, () => onBack?.()),
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
