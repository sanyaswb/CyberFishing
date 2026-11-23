export class InventoryRodRemovalRenderer {
  #dom;

  constructor({ domFactory } = {}) {
    this.#dom = domFactory;
  }

  render(model, { onChoice, onSave }) {
    const panel = this.#dom.element("div", "inventory-rod-removal");
    panel.appendChild(this.#dom.element("h3", "inventory-rod-removal__title", model.root?.name || "Вудилище"));
    const saving = model.rodRemovalStep === "save";
    panel.appendChild(this.#dom.element("p", "inventory-rod-removal__hint", saving
      ? "Назвіть збірку або залиште поле порожнім для автоматичної назви."
      : "Зберегти вудилище з навісами як збірку чи повернути всі предмети окремо до інвентаря?"));
    if (saving) {
      const form = this.#dom.element("form", "inventory-loadout-save");
      const input = this.#dom.element("input", "inventory-loadout-save__input");
      input.type = "text";
      input.maxLength = 40;
      input.placeholder = "Назва збірки (необов’язково)";
      input.setAttribute("aria-label", input.placeholder);
      const save = this.#dom.button("inventory-loadout-save__button", "Зберегти");
      save.type = "submit";
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        onSave?.(input.value.trim());
      });
      form.append(input, save);
      panel.appendChild(form);
    } else {
      panel.append(this.#button("Зберегти збірку", "inventory-action--primary", () => onChoice?.("save")),
        this.#button("Розібрати", "inventory-action--danger", () => onChoice?.("disassemble")));
    }
    panel.appendChild(this.#button("Назад", "inventory-action--muted", () => onChoice?.("cancel")));
    return panel;
  }

  #button(label, modifier, callback) {
    const button = this.#dom.button(`inventory-action ${modifier}`, label);
    button.addEventListener("click", callback);
    return button;
  }
}
