import { createInventorySlotIcon } from "./inventory_slot_icons.js";
import { createItemPlaceholderIcon } from "./inventory_icons.js";
import { applyArtSize } from "../ui/art_size.js";

export class InventoryItemCardRenderer {
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
    this.#dom = domFactory;
    this.#attachmentRenderer = attachmentRenderer;
    this.#longPressController = longPressController || null;
    this.#rarityDomAdapter = rarityDomAdapter;
    this.#progressionDomAdapter = progressionDomAdapter;
    this.#conditionDomAdapter = conditionDomAdapter;
    this.#tooltipPresenter = tooltipPresenter;
    this.#resourceMeterResolver = resourceMeterResolver;
    this.#resourceMeterRenderer = resourceMeterRenderer;
  }

  updateDynamicVisuals(card, item = null) {
    if (!card || !item) return;
    // A card rendered without its scale (editor tabs, spec 094) keeps it off on timer updates too.
    if (card.dataset.resourceMeter !== "off") {
      this.#resourceMeterRenderer.update(
        card,
        this.#resourceMeterResolver.resolve(item),
      );
    }
    this.#conditionDomAdapter?.apply(card, item.condition);
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
      showResourceMeter = true,
      showTooltip = true,
    } = {},
  ) {
    const field = this.#dom.element(
      "div",
      `inventory-field inventory-field--${variant}`,
    );
    field.dataset.slotId = String(slot.slotId || "");
    field.setAttribute("aria-label", slot.label);
    field.title = slot.label;
    const well = this.#dom.element(
      "div",
      `inventory-slot inventory-slot--${slot.state}`,
    );
    well.classList.toggle("inventory-slot--highlighted", slot.highlighted === true);
    well.dataset.slotState = slot.state;

    if (slot.item) {
      well.classList.add("inventory-slot--filled");
      well.appendChild(
        this.renderItem(slot.item, {
          variant,
          onActivate,
          onLongPress,
          longPressDurationMs,
          frameless: framelessItem,
          showAttachments,
          showResourceMeter,
          showTooltip,
          equippedArt: true,
        }),
      );
    } else {
      const isBlocked = ["locked", "unavailable"].includes(slot.state);
      const emptyButton = this.#dom.button(
        "inventory-slot__empty-button",
        "",
        isBlocked ? {} : { title: slot.label },
      );
      emptyButton.setAttribute(
        "aria-label",
        isBlocked ? slot.warning || slot.label : slot.label,
      );
      const placeholder = createInventorySlotIcon(this.#dom, slot.slotId, "inventory-slot-icon");
      if (placeholder) {
        placeholder.setAttribute("aria-hidden", "true");
        emptyButton.appendChild(placeholder);
      }
      emptyButton.addEventListener("click", () => {
        if (isBlocked) {
          onUnavailable?.(slot.warning);
          return;
        }
        onActivate?.();
      });
      well.appendChild(emptyButton);
    }

    field.appendChild(well);
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
      "inventory-list-item",
    );
    wrapper.classList.toggle("inventory-list-item--selected", selected);
    wrapper.classList.toggle("inventory-list-item--compatible", compatible);
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
      showTooltip = true,
      wholeArt = false,
      equippedArt = false,
    } = {},
  ) {
    const card = this.#dom.button(
      `inventory-item-card inventory-item-card--${variant}`,
      "",
    );
    card.classList.toggle("inventory-item-card--frameless", frameless);
    card.dataset.instanceId = String(item.instanceId || "");
    card.setAttribute("aria-label", String(item.name || "Предмет"));
    const content = this.#dom.element("span", "inventory-item-card__content");
    this.#renderMainVisual(content, item, { wholeArt, equippedArt });
    if (showAttachments) this.#attachmentRenderer.render(content, item.attachments);
    card.appendChild(content);
    if (showMetadata) this.#renderMetadata(card, item);
    this.#applyVisualAdapters(card, item, frameless, { showMetadata });
    if (!showResourceMeter) card.dataset.resourceMeter = "off";
    if (showResourceMeter) {
      this.#resourceMeterRenderer.update(
        card,
        this.#resourceMeterResolver.resolve(item),
      );
    }
    if (showTooltip) this.#tooltipPresenter?.bind?.(card, item);
    this.#bindInteraction(
      card,
      onActivate,
      onLongPress,
      longPressDurationMs,
    );
    return card;
  }

  // A skin's thumbnail shows only its lower part, bottom-aligned (anchor "top": its upper part, top-aligned); an
  // equipment cell may show the whole artwork (spec 071), and the editor preview (wholeArt) always does. A cell of an
  // equipped item (equippedArt) shows its equipped picture, the switcher's icon (TK-249.1: a chum pack in the tackle is
  // the mix's icon; the editor preview keeps the whole pack).
  #renderMainVisual(card, item, { wholeArt = false, equippedArt = false } = {}) {
    const visual = this.#dom.element("span", "inventory-item-card__visual");
    const isFloat = item.itemType === "float" || item.equipmentSlot === "float" || Boolean(item.skin?.scene?.waterline);
    if (isFloat) {
      visual.classList.add("inventory-item-card__visual--float");
    }
    const art = item.skin?.thumbnail;
    const equippedIcon = equippedArt && !item.equipmentArtAsset ? item.switcherIconAsset || "" : "";
    const thumbnail = item.equipmentArtAsset || equippedIcon || wholeArt ? null : art;
    const image = this.#dom.image(item.equipmentArtAsset || equippedIcon || art?.asset || item.iconAsset, "");
    if (thumbnail && image) {
      visual.classList.add("inventory-item-card__visual--cropped");
      visual.classList.toggle("inventory-item-card__visual--cropped-top", thumbnail.anchor === "top");
      visual.style.setProperty("--inventory-item-art-visible-height", String(thumbnail.visibleHeight));
      visual.style.setProperty("--inventory-item-art-focus-x", String(thumbnail.focusX));
    }
    // TK-224: an item marked with artSize shows its art smaller the smaller its size.
    applyArtSize(visual, item.artSize);
    if (image) {
      image.className = "inventory-item-card__image";
      image.setAttribute("aria-hidden", "true");
      visual.appendChild(image);
    } else {
      visual.appendChild(createItemPlaceholderIcon(this.#dom, item.icon, "inventory-item-card__icon"));
    }
    const glowAsset = item.glowAsset || item.skin?.glowAsset || item.skin?.scene?.glow?.asset;
    if (glowAsset) {
      const glowImage = this.#dom.image(glowAsset, "");
      if (glowImage) {
        glowImage.className = "inventory-item-card__glow-image";
        glowImage.setAttribute("aria-hidden", "true");
        visual.appendChild(glowImage);
      }
    }
    card.appendChild(visual);
  }

  #renderMetadata(card, item) {
    if (item.loadoutMembership) {
      const dot = this.#dom.element("span", "inventory-item-card__membership-dot");
      dot.style.setProperty("background-color", item.loadoutMembership.color);
      dot.setAttribute("role", "img");
      dot.setAttribute("aria-label", "Належить до збірки");
      card.appendChild(dot);
    }
    if (Number(item.quantity) > 1) {
      card.appendChild(
        this.#dom.element(
          "span",
          "inventory-item-card__quantity",
          Number(item.quantity),
        ),
      );
    }
    if (this.#showsIncompleteIndicator(item)) {
      const draft = this.#dom.element(
        "span",
        "inventory-item-card__incomplete-dot",
      );
      draft.setAttribute("role", "img");
      draft.setAttribute("aria-label", "Неповністю укомплектовано");
      card.appendChild(draft);
    }
  }

  #showsIncompleteIndicator(item) {
    // Consumables are filled through the header switchers, so an empty bait or chum slot is not incomplete (spec 090).
    const completion = item?.equipmentCompletion;
    if (!completion || completion.isComplete !== false) return false;
    return item.equipped === true || completion.hasAnyComponent === true;
  }

  #applyVisualAdapters(card, item, frameless, { showMetadata = true } = {}) {
    if (!frameless) {
      if (this.#rarityDomAdapter?.apply) {
        if (item.rarity) this.#rarityDomAdapter.apply(card, item.rarity);
        else this.#rarityDomAdapter.clear?.(card);
      } else {
        const color = item.rarityVisual?.cssColor || item.rarityColor;
        if (this.#isSafeCssColor(color)) {
          card.classList.add("item-rarity");
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
          renderRatingTierBadge: showMetadata,
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
