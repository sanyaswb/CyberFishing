class InventoryV2ItemCardRenderer {
  #dom;
  #attachmentRenderer;
  #longPressController;
  #rarityDomAdapter;
  #progressionDomAdapter;
  #conditionDomAdapter;
  #tooltipPresenter;
  #resourceMeterResolver;
  #resourceMeterRenderer;

  constructor({
    domFactory,
    attachmentRenderer,
    longPressController,
    rarityDomAdapter = null,
    progressionDomAdapter = null,
    conditionDomAdapter = null,
    tooltipPresenter = null,
    resourceMeterResolver = null,
    resourceMeterRenderer = null,
  } = {}) {
    this.#dom = domFactory || new globalThis.InventoryV2DomFactory();
    this.#attachmentRenderer =
      attachmentRenderer ||
      new globalThis.InventoryV2AttachmentBadgeRenderer({
        domFactory: this.#dom,
      });
    this.#longPressController = longPressController || null;
    this.#rarityDomAdapter = rarityDomAdapter;
    this.#progressionDomAdapter = progressionDomAdapter;
    this.#conditionDomAdapter = conditionDomAdapter;
    this.#tooltipPresenter = tooltipPresenter;
    this.#resourceMeterResolver =
      resourceMeterResolver || new globalThis.InventoryV2ResourceMeterResolver();
    this.#resourceMeterRenderer =
      resourceMeterRenderer ||
      new globalThis.InventoryV2ResourceMeterRenderer({
        domFactory: this.#dom,
      });
  }

  updateDynamicVisuals(card, item = null) {
    if (!card || !item) return;
    this.#resourceMeterRenderer.update(
      card,
      this.#resourceMeterResolver.resolve(item),
    );
    this.#tooltipPresenter?.update?.(item);
  }

  renderSlot(
    slot,
    {
      variant = "standard",
      onActivate = null,
      onLongPress = null,
      longPressDurationMs = null,
      onUnavailable = null,
      framelessItem = false,
      showAttachments = true,
    } = {},
  ) {
    const field = this.#dom.element(
      "div",
      `inventory-v2-field inventory-v2-field--${variant}`,
    );
    field.dataset.slotId = String(slot.slotId || "");
    const label = this.#dom.element(
      "div",
      "inventory-v2-field__label",
      slot.label,
    );
    const well = this.#dom.element(
      "div",
      `inventory-v2-slot inventory-v2-slot--${slot.state}`,
    );
    well.classList.toggle("is-highlighted", slot.highlighted === true);
    well.dataset.slotState = slot.state;

    if (slot.item) {
      well.classList.add("is-filled");
      well.appendChild(
        this.renderItem(slot.item, {
          variant,
          onActivate,
          onLongPress,
          longPressDurationMs,
          frameless: framelessItem,
          showAttachments,
        }),
      );
    } else {
      const isBlocked = ["locked", "unavailable"].includes(slot.state);
      const emptyButton = this.#dom.button(
        "inventory-v2-slot__empty-button",
        "",
        isBlocked ? {} : { title: slot.label },
      );
      emptyButton.setAttribute(
        "aria-label",
        isBlocked ? slot.warning || slot.label : slot.label,
      );
      emptyButton.addEventListener("click", () => {
        if (isBlocked) {
          onUnavailable?.(slot.warning);
          return;
        }
        onActivate?.();
      });
      well.appendChild(emptyButton);
    }

    field.append(label, well);
    return field;
  }

  renderInventoryItem(
    item,
    {
      selected = false,
      compatible = false,
      onActivate = null,
      onLongPress = null,
      longPressDurationMs = null,
    } = {},
  ) {
    const wrapper = this.#dom.element(
      "div",
      "inventory-v2-inventory-item",
    );
    wrapper.classList.toggle("is-selected", selected);
    wrapper.classList.toggle("is-compatible", compatible);
    wrapper.dataset.instanceId = String(item.instanceId || "");
    wrapper.appendChild(
      this.renderItem(item, {
        variant: "inventory",
        onActivate,
        onLongPress,
        longPressDurationMs,
      }),
    );
    return wrapper;
  }

  renderItem(
    item,
    {
      variant = "standard",
      onActivate = null,
      onLongPress = null,
      longPressDurationMs = null,
      frameless = false,
      showAttachments = true,
      showMetadata = true,
      showResourceMeter = true,
    } = {},
  ) {
    const card = this.#dom.button(
      `inventory-v2-item-card inventory-v2-item-card--${variant}`,
      "",
    );
    card.classList.toggle("is-frameless", frameless);
    card.dataset.instanceId = String(item.instanceId || "");
    card.setAttribute("aria-label", String(item.name || "Предмет"));
    this.#renderMainVisual(card, item);
    if (showMetadata) this.#renderMetadata(card, item);
    this.#applyVisualAdapters(card, item, frameless, { showMetadata });
    if (showResourceMeter) {
      this.#resourceMeterRenderer.update(
        card,
        this.#resourceMeterResolver.resolve(item),
      );
    }
    if (showAttachments) {
      this.#attachmentRenderer.render(card, item.attachments);
    }
    this.#tooltipPresenter?.bind?.(card, item);
    this.#bindInteraction(
      card,
      onActivate,
      onLongPress,
      longPressDurationMs,
    );
    return card;
  }

  #renderMainVisual(card, item) {
    const visual = this.#dom.element("span", "inventory-v2-item-card__visual");
    const image = this.#dom.image(
      item.iconUrl || item.imageUrl || item.src,
      "",
    );
    if (image) {
      image.className = "inventory-v2-item-card__image";
      image.setAttribute("aria-hidden", "true");
      visual.appendChild(image);
    } else {
      visual.appendChild(
        this.#dom.element(
          "span",
          "inventory-v2-item-card__icon",
          item.icon || item.emoji || "?",
        ),
      );
    }
    card.appendChild(visual);
  }

  #renderMetadata(card, item) {
    const progressionRendersLevel =
      typeof this.#progressionDomAdapter?.apply === "function" &&
      item.progression?.available === true &&
      item.progression?.level?.available === true;
    if (!progressionRendersLevel && Number.isFinite(Number(item.level))) {
      card.appendChild(
        this.#dom.element(
          "span",
          "inventory-v2-item-card__level",
          Math.max(0, Math.floor(Number(item.level))),
        ),
      );
    }
    if (Number(item.quantity) > 1) {
      card.appendChild(
        this.#dom.element(
          "span",
          "inventory-v2-item-card__quantity",
          Number(item.quantity),
        ),
      );
    }
    if (this.#showsIncompleteIndicator(item)) {
      const draft = this.#dom.element(
        "span",
        "inventory-v2-item-card__incomplete-dot",
      );
      draft.setAttribute("role", "img");
      draft.setAttribute("aria-label", "Неповністю укомплектовано");
      card.appendChild(draft);
    }
  }

  #showsIncompleteIndicator(item) {
    const completion = item?.assemblyCompletion;
    if (!completion || completion.isComplete !== false) return false;
    return item.equipped === true || completion.hasAnyComponent === true;
  }

  #applyVisualAdapters(card, item, frameless, { showMetadata = true } = {}) {
    if (!frameless) {
      if (this.#rarityDomAdapter?.apply && item.rarity) {
        this.#rarityDomAdapter.apply(card, item.rarity);
      } else {
        card.classList.add("has-rarity");
        const color = item.rarityVisual?.cssColor || item.rarityColor;
        if (this.#isSafeCssColor(color)) {
          card.style.setProperty("--rarity-color", color);
        }
      }
    }
    if (this.#progressionDomAdapter?.apply && item.progression) {
      this.#progressionDomAdapter.apply(
        card,
        item.progression,
        null,
        {
          renderCapacityBar: false,
          renderLevelBadge: showMetadata,
        },
      );
    }
    if (this.#conditionDomAdapter?.apply && item.condition) {
      this.#conditionDomAdapter.apply(card, item.condition);
    }
  }

  #bindInteraction(card, onActivate, onLongPress, longPressDurationMs) {
    if (this.#longPressController && typeof onLongPress === "function") {
      this.#longPressController.bind(card, {
        onClick: onActivate,
        onLongPress,
        durationMs: longPressDurationMs,
      });
      return;
    }
    if (typeof onActivate === "function") {
      card.addEventListener("click", onActivate);
    }
  }

  #isSafeCssColor(value) {
    return (
      typeof value === "string" &&
      /^(?:#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%a-z]+\)|[a-z]+)$/i.test(
        value.trim(),
      )
    );
  }
}

globalThis.InventoryV2ItemCardRenderer = InventoryV2ItemCardRenderer;
