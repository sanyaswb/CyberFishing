export class UiAutoSwitchRenderer {
  #dom;
  #bindings = new WeakMap();

  constructor({ domFactory }) {
    this.#dom = domFactory;
  }

  create({ id, name, modeLabel, items = [], placeholderUrl, checked = false,
    disabled = false, stock = 0, onChange = null, className = "", variant = "equipment" }) {
    const compact = variant === "control";
    const label = this.#dom.element("label", `inventory-toggle ${compact ? "inventory-toggle--control " : ""}${className}`.trim());
    label.title = items.length ? items.map((item) => item.name || name).join(", ") : name;
    const content = this.#dom.element("span", "inventory-toggle__items");
    content.setAttribute("aria-label", name);
    if (!items.length) {
      const icon = this.#dom.image(placeholderUrl, "");
      if (icon) {
        icon.className = "inventory-toggle__placeholder";
        icon.setAttribute("aria-hidden", "true");
        content.appendChild(icon);
      }
    } else {
      for (const item of items) {
        const media = this.#dom.element("span", "inventory-toggle__item");
        media.title = item.name || name;
        const image = this.#dom.image(item.iconUrl || item.imageUrl, item.name || name);
        if (image) {
          image.className = "inventory-toggle__image";
          media.appendChild(image);
        } else media.textContent = String(item.icon || item.emoji || "");
        content.appendChild(media);
      }
    }
    const input = this.#dom.element("input", "inventory-toggle__input");
    if (id) input.id = id;
    input.type = "checkbox";
    input.setAttribute("role", "switch");
    const change = () => { if (!input.disabled) onChange?.(input.checked); };
    input.addEventListener("change", change);
    const control = this.#dom.element("span", "inventory-toggle__control");
    control.setAttribute("aria-hidden", "true");
    const count = this.#dom.element("span", "inventory-toggle__count");
    if (!compact) control.append(count);
    control.append(this.#dom.element("span", "inventory-toggle__thumb", "A"));
    if (!compact) label.append(content);
    label.append(input, control);
    this.#bindings.set(label, { input, count, change, modeLabel, compact });
    this.update(label, { checked, disabled, stock });
    return label;
  }

  update(label, { checked, disabled, stock, modeLabel } = {}) {
    const binding = this.#bindings.get(label);
    if (!binding) return;
    if (checked !== undefined) binding.input.checked = Boolean(checked);
    if (disabled !== undefined) {
      binding.input.disabled = Boolean(disabled);
      label.classList.toggle("inventory-toggle--disabled", Boolean(disabled));
    }
    if (stock !== undefined) binding.count.textContent = String(stock);
    if (modeLabel !== undefined) binding.modeLabel = modeLabel;
    binding.input.setAttribute("aria-label", binding.compact ? binding.modeLabel :
      `${binding.modeLabel}. Доступно в інвентарі: ${binding.count.textContent}`);
  }

  dispose(label) {
    const binding = this.#bindings.get(label);
    if (binding) binding.input.removeEventListener("change", binding.change);
    this.#bindings.delete(label);
  }
}
