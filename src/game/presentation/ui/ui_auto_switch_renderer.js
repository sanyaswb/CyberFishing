export class UiAutoSwitchRenderer {
  #dom;
  #bindings = new WeakMap();
  #longPressController;
  #longPressDurationMs;
  #longPressActivationDelayMs;

  constructor({ domFactory, longPressController = null, longPressDurationMs = null, longPressActivationDelayMs }) {
    this.#dom = domFactory;
    this.#longPressController = longPressController;
    this.#longPressDurationMs = longPressDurationMs;
    this.#longPressActivationDelayMs = longPressActivationDelayMs;
  }

  create({ id, name, modeLabel, items = [], placeholderUrl, checked = false,
    slots = null, onSlotActivate = null, onSlotLongPress = null,
    disabled = false, stock = 0, onChange = null, className = "", variant = "equipment", activateUnavailable = false }) {
    const compact = variant === "control";
    const label = this.#dom.element(compact ? "label" : "div", `inventory-toggle ${compact ? "inventory-toggle--control " : ""}${className}`.trim());
    const content = this.#dom.element("span", "inventory-toggle__items");
    content.setAttribute("aria-label", name);
    const input = this.#dom.element("input", "inventory-toggle__input");
    if (id) input.id = id;
    input.type = "checkbox";
    input.setAttribute("role", "switch");
    const change = () => {
      if (input.disabled) return;
      this.update(label, { checked: input.checked });
      onChange?.(input.checked);
    };
    input.addEventListener("change", change);
    const control = this.#dom.element("span", "inventory-toggle__control");
    control.setAttribute("aria-hidden", "true");
    const count = this.#dom.element("span", "inventory-toggle__count");
    if (!compact) control.append(count);
    control.append(this.#dom.element("span", "inventory-toggle__thumb", "A"));
    if (!compact) label.append(content);
    const switchHost = compact ? label : this.#dom.element("label", "inventory-toggle__switch");
    switchHost.append(input, control);
    if (!compact) label.append(switchHost);
    this.#bindings.set(label, { input, count, change, modeLabel, compact, content,
      name, placeholderUrl, onSlotActivate, onSlotLongPress, activateUnavailable, stock: 0, slots: [], slotBindings: [] });
    this.update(label, { checked, disabled, stock, slots: slots || items.map((item) => ({ item, available: true })) });
    return label;
  }

  update(label, { checked, disabled, stock, modeLabel, slots } = {}) {
    const binding = this.#bindings.get(label);
    if (!binding) return;
    if (checked !== undefined) binding.input.checked = Boolean(checked);
    label.classList.toggle("inventory-toggle--automatic", binding.input.checked);
    if (disabled !== undefined) {
      binding.input.disabled = Boolean(disabled);
      label.classList.toggle("inventory-toggle--disabled", Boolean(disabled));
    }
    if (stock !== undefined) binding.stock = Math.max(0, Math.floor(Number(stock) || 0));
    if (slots) binding.slots = slots;
    const equippedCount = binding.slots.filter((slot) => slot.item).length;
    const displayedCount = String(binding.input.checked ? binding.stock : equippedCount);
    if (binding.count.textContent !== displayedCount) binding.count.textContent = displayedCount;
    if (!binding.compact) this.#updateSlots(label, binding, binding.slots);
    if (modeLabel !== undefined) binding.modeLabel = modeLabel;
    binding.input.setAttribute("aria-label", binding.compact ? binding.modeLabel :
      `${binding.modeLabel}. ${binding.input.checked ? "Доступно в інвентарі" : "Споряджено"}: ${binding.count.textContent}`);
  }

  #updateSlots(label, binding, slots) {
    const source = slots.length ? slots : [{ item: null, available: false }];
    while (binding.slotBindings.length > source.length) {
      const { media, click, pointerDown, unbindHold } = binding.slotBindings.pop();
      unbindHold?.();
      media.removeEventListener("click", click);
      media.removeEventListener("pointerdown", pointerDown);
      media.remove();
    }
    source.forEach((slot, index) => {
      let nodes = binding.slotBindings[index];
      if (!nodes) {
        const media = this.#dom.button("inventory-toggle__item", "");
        const artwork = this.#dom.element("span", "inventory-toggle__artwork");
        const count = this.#dom.element("span", "inventory-toggle__item-count");
        const click = event => {
          if (nodes.suppressClick && event.detail !== 0) {
            nodes.suppressClick = false;
            event.preventDefault(); event.stopImmediatePropagation?.(); event.stopPropagation(); return;
          }
          if (!media.disabled) binding.onSlotActivate?.(index);
        };
        const pointerDown = event => { if (event.isPrimary !== false && event.button === 0) nodes.suppressClick = false; };
        media.addEventListener("click", click);
        media.addEventListener("pointerdown", pointerDown);
        media.append(artwork, count);
        binding.content.appendChild(media);
        nodes = { media, artwork, count, click, pointerDown, suppressClick: false, holdItemId: undefined,
          unbindHold: null, image: null, source: undefined, icon: undefined };
        binding.slotBindings.push(nodes);
      }
      const item = slot.item;
      const holdItemId = binding.onSlotLongPress && slot.available && !slot.highlighted && !binding.input.disabled
        ? item?.instanceId || null : null;
      if (nodes.holdItemId !== holdItemId) {
        nodes.unbindHold?.();
        nodes.holdItemId = holdItemId;
        nodes.unbindHold = holdItemId ? this.#longPressController?.bind(nodes.media, {
          durationMs: this.#longPressDurationMs, activationDelayMs: this.#longPressActivationDelayMs,
          progressHost: nodes.artwork,
          onLongPress: () => { nodes.suppressClick = true; binding.onSlotLongPress(index, holdItemId); },
        }) : null;
      }
      const stock = Math.max(0, Math.floor(Number(slot.stock) || 0));
      const title = `${binding.name} ${index + 1}${item ? `: ${item.name || binding.name}. Доступно в інвентарі: ${stock}` : ""}`;
      if (nodes.media.title !== title) {
        nodes.media.title = title;
        nodes.media.setAttribute("aria-label", title);
      }
      nodes.media.disabled = !slot.available && !binding.activateUnavailable;
      nodes.media.setAttribute("aria-disabled", String(!slot.available));
      nodes.media.classList.toggle("inventory-toggle__item--available", slot.available === true);
      nodes.media.classList.toggle("inventory-toggle__item--highlighted", slot.highlighted === true);
      nodes.media.setAttribute("aria-pressed", String(slot.highlighted === true));
      const imageSource = item ? item.switcherIconUrl || item.iconUrl || item.imageUrl || "" : binding.placeholderUrl;
      const icon = String(item?.icon || item?.emoji || "");
      if (nodes.source !== imageSource || nodes.icon !== icon) {
        nodes.image = this.#dom.image(imageSource, "");
        const visual = nodes.image || this.#dom.glyph(icon, "inventory-toggle__glyph");
        visual.setAttribute("aria-hidden", "true");
        nodes.visual?.remove();
        nodes.artwork.appendChild(visual);
        nodes.visual = visual;
        nodes.source = imageSource;
        nodes.icon = icon;
      }
      if (nodes.image) {
        nodes.image.className = item ? "inventory-toggle__image" : "inventory-toggle__placeholder";
        nodes.image.setAttribute("aria-hidden", "true");
      }
      nodes.count.hidden = !item || slot.showCount === false;
      const displayedCount = String(binding.input.checked ? stock : item ? 1 : 0);
      if (nodes.count.textContent !== displayedCount) nodes.count.textContent = displayedCount;
    });
    label.classList.toggle("inventory-toggle--multiple", source.length > 1);
    label.classList.toggle("inventory-toggle--equipped", source.some((slot) => slot.item));
  }

  dispose(label) {
    const binding = this.#bindings.get(label);
    if (binding) binding.input.removeEventListener("change", binding.change);
    for (const { media, click, pointerDown, unbindHold } of binding?.slotBindings || []) {
      unbindHold?.();
      media.removeEventListener("click", click);
      media.removeEventListener("pointerdown", pointerDown);
    }
    this.#bindings.delete(label);
  }
}
