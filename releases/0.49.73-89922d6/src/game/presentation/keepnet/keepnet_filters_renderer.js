// Keepnet filters in the backpack's filter style (spec 088): a category row with the species toggle and one button per
// fish kind, then the species row (one choice) that the toggle opens. Both rows drag-scroll horizontally like the
// backpack's. The keepnet section owns the filter values; update() writes only changed states.
export class KeepnetFiltersRenderer {
  #dom;
  #labels;
  #scroll;
  #bindings = new WeakMap();

  constructor({ domFactory, labels, horizontalScrollController }) {
    this.#dom = domFactory;
    this.#labels = labels;
    this.#scroll = horizontalScrollController;
  }

  create({ onKind, onSpecies }) {
    const root = this.#dom.element("div", "keepnet-section__filters");
    const kinds = this.#dom.element("nav", "inventory-categories keepnet-section__kinds");
    kinds.setAttribute("aria-label", this.#labels.kindLabel);
    const toggle = this.#dom.button("inventory-categories__toggle", "", { title: this.#labels.speciesLabel });
    toggle.setAttribute("aria-label", this.#labels.speciesToggle);
    const kindButtons = this.#labels.kinds.map(([value, label]) => {
      const button = this.#dom.button("inventory-categories__button", label);
      button.dataset.keepnetFocus = `kind:${value}`;
      button.addEventListener("click", () => onKind(value));
      return button;
    });
    kinds.append(toggle, ...kindButtons);
    const species = this.#dom.element("div", "inventory-subfilters keepnet-section__species");
    species.setAttribute("role", "radiogroup");
    species.setAttribute("aria-label", this.#labels.speciesLabel);
    const binding = { toggle, kindButtons, species, open: false, signature: "", radios: [], onSpecies };
    toggle.addEventListener("click", () => {
      binding.open = !binding.open;
      this.#syncToggle(binding);
    });
    this.#syncToggle(binding);
    this.#scroll.attach(kinds);
    this.#scroll.attach(species);
    root.append(kinds, species);
    this.#bindings.set(root, binding);
    return root;
  }

  update(root, { kind, species, speciesId }) {
    const binding = this.#bindings.get(root);
    binding.kindButtons.forEach((button, index) => {
      const active = this.#labels.kinds[index][0] === kind;
      if (button.getAttribute("aria-pressed") === String(active)) return;
      button.classList.toggle("inventory-categories__button--active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    const options = [{ id: "all", name: this.#labels.allSpecies }, ...species];
    const signature = JSON.stringify(options);
    if (signature !== binding.signature) {
      binding.radios = options.map((option) => this.#speciesOption(binding, option));
      binding.species.replaceChildren(...binding.radios.map((radio) => radio.parentNode));
      binding.signature = signature;
    }
    for (const radio of binding.radios) radio.checked = radio.value === speciesId;
  }

  // The active kind button: the focus target when the focused card disappears.
  activeKind(root) {
    return this.#bindings.get(root).kindButtons.find((button) => button.getAttribute("aria-pressed") === "true");
  }

  #speciesOption(binding, option) {
    const label = this.#dom.element("label", "inventory-subfilters__option");
    const radio = this.#dom.element("input", "inventory-subfilters__checkbox");
    radio.type = "radio";
    radio.name = "keepnet-species";
    radio.value = option.id;
    radio.addEventListener("change", () => binding.onSpecies(option.id));
    label.append(radio, this.#dom.element("span", "inventory-subfilters__label", option.name));
    return radio;
  }

  #syncToggle(binding) {
    binding.toggle.textContent = binding.open ? "▴" : "▾";
    binding.toggle.setAttribute("aria-expanded", String(binding.open));
    binding.toggle.classList.toggle("inventory-categories__toggle--active", binding.open);
    binding.species.classList.toggle("inventory-subfilters--open", binding.open);
  }
}
