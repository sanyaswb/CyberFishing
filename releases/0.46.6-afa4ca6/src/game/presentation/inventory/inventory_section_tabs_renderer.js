// Section tab bar: one icon tab per inventory section with roving keyboard focus.
// The caller owns the active section (spec 067); update() writes only changed tab states.
export class InventorySectionTabsRenderer {
  #dom;
  #sections;
  #tabsByBar = new WeakMap();

  constructor({ domFactory, sections }) {
    this.#dom = domFactory;
    this.#sections = sections;
  }

  create({ activeId, onSelect }) {
    const bar = this.#dom.element("nav", "inventory-section-tabs");
    bar.setAttribute("aria-label", this.#sections.label);
    const list = this.#dom.element("div", "inventory-section-tabs__list");
    list.setAttribute("role", "tablist");
    const tabs = this.#sections.items.map((section) => {
      const tab = this.#dom.element("button", "inventory-section-tabs__tab");
      tab.type = "button";
      tab.dataset.sectionId = section.id;
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-label", section.label);
      tab.title = section.label;
      tab.appendChild(this.#dom.svgIcon(`${this.#sections.iconSprite}#${section.icon}`, "inventory-section-tabs__icon"));
      tab.addEventListener("click", () => onSelect(section.id));
      return tab;
    });
    list.addEventListener("keydown", (event) => {
      const index = tabs.indexOf(event.target);
      if (index < 0) return;
      const last = tabs.length - 1;
      const next = event.key === "ArrowRight" ? (index + 1) % tabs.length
        : event.key === "ArrowLeft" ? (index + last) % tabs.length
          : event.key === "Home" ? 0 : event.key === "End" ? last : -1;
      if (next < 0) return;
      event.preventDefault();
      tabs[next].focus();
      onSelect(tabs[next].dataset.sectionId);
    });
    list.append(...tabs);
    this.#tabsByBar.set(bar, tabs);
    bar.appendChild(list);
    this.update(bar, activeId);
    return bar;
  }

  update(bar, activeId) {
    for (const tab of this.#tabsByBar.get(bar) || []) {
      const active = tab.dataset.sectionId === activeId;
      if (tab.classList.contains("inventory-section-tabs__tab--active") === active &&
        tab.getAttribute("aria-selected") === String(active)) continue;
      tab.classList.toggle("inventory-section-tabs__tab--active", active);
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
    }
  }
}
