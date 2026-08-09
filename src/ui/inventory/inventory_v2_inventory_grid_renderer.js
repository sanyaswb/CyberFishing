class InventoryV2InventoryGridRenderer {
  #dom;
  #itemRenderer;
  #subfiltersExpanded = false;

  constructor({ domFactory, itemRenderer } = {}) {
    this.#dom = domFactory || new globalThis.InventoryV2DomFactory();
    this.#itemRenderer =
      itemRenderer ||
      new globalThis.InventoryV2ItemCardRenderer({ domFactory: this.#dom });
  }

  render(
    model,
    {
      onCategorySelect = null,
      onSubfilterToggle = null,
      onItemActivate = null,
      onItemLongPress = null,
    } = {},
  ) {
    const panel = this.#dom.element(
      "section",
      "inventory-v2-inventory-panel",
    );
    const subfilters = this.#renderSubfilters(model, onSubfilterToggle);
    panel.appendChild(
      this.#renderCategories(model, onCategorySelect, (toggle) => {
        this.#subfiltersExpanded = !this.#subfiltersExpanded;
        subfilters.classList.toggle("is-open", this.#subfiltersExpanded);
        this.#syncSubfilterToggle(toggle);
      }),
    );
    panel.appendChild(subfilters);
    panel.appendChild(
      this.#renderItems(model, { onItemActivate, onItemLongPress }),
    );
    return panel;
  }

  #renderCategories(model, onCategorySelect, onSubfiltersToggle) {
    const navigation = this.#dom.element(
      "nav",
      "inventory-v2-categories",
    );
    navigation.setAttribute("aria-label", "Категорії інвентарю");
    const toggle = this.#dom.button(
      "inventory-v2-categories__toggle",
      "",
      { title: "Фільтри за підтипами" },
    );
    this.#syncSubfilterToggle(toggle);
    toggle.setAttribute(
      "aria-label",
      "Показати або приховати фільтри за підтипами",
    );
    toggle.addEventListener("click", () => onSubfiltersToggle?.(toggle));
    navigation.appendChild(toggle);
    model.categories.forEach((category) => {
      const label = [category.icon, category.label].filter(Boolean).join(" ");
      const button = this.#dom.button(
        "inventory-v2-categories__button",
        label,
      );
      button.classList.toggle("is-active", category.selected);
      button.setAttribute("aria-pressed", String(category.selected));
      button.addEventListener("click", () => onCategorySelect?.(category.id));
      navigation.appendChild(button);
    });
    return navigation;
  }

  #renderSubfilters(model, onSubfilterToggle) {
    const container = this.#dom.element("div", "inventory-v2-subfilters");
    container.classList.toggle("is-open", this.#subfiltersExpanded);
    container.setAttribute("aria-label", "Фільтри за підтипами");
    if (!model.subfilters.length) {
      container.appendChild(
        this.#dom.element(
          "span",
          "inventory-v2-subfilters__empty",
          "Немає предметів для фільтрації",
        ),
      );
      return container;
    }
    model.subfilters.forEach((filter) => {
      const label = this.#dom.element(
        "label",
        "inventory-v2-subfilters__option",
      );
      const checkbox = this.#dom.element(
        "input",
        "inventory-v2-subfilters__checkbox",
      );
      checkbox.type = "checkbox";
      checkbox.checked = filter.selected === true;
      checkbox.addEventListener("change", () =>
        onSubfilterToggle?.(filter.id, checkbox.checked),
      );
      label.append(
        checkbox,
        this.#dom.element(
          "span",
          "inventory-v2-subfilters__label",
          filter.label,
        ),
      );
      container.appendChild(label);
    });
    return container;
  }

  #syncSubfilterToggle(toggle) {
    toggle.textContent = this.#subfiltersExpanded ? "▴" : "▾";
    toggle.setAttribute("aria-expanded", String(this.#subfiltersExpanded));
    toggle.classList.toggle("is-active", this.#subfiltersExpanded);
  }

  #renderItems(model, { onItemActivate, onItemLongPress }) {
    const grid = this.#dom.element("div", "inventory-v2-inventory-grid");
    if (!model.items.length) {
      grid.appendChild(
        this.#dom.element(
          "p",
          "inventory-v2-inventory-grid__empty",
          model.emptyMessage,
        ),
      );
      return grid;
    }

    model.items.forEach((item) => {
      const supportsLongPress =
        item.longPressEnabled === true ||
        item.isAssembly === true ||
        item.composite === true ||
        item.status === "draft" ||
        item.status === "prepared" ||
        item.type === "equipment_loadout";
      grid.appendChild(
        this.#itemRenderer.renderInventoryItem(item, {
          selected: item.instanceId === model.selectedInstanceId,
          compatible: item.compatibleWithHighlightedSlot === true,
          onActivate: () => onItemActivate?.(item),
          onLongPress: supportsLongPress
            ? () => onItemLongPress?.(item)
            : null,
        }),
      );
    });
    return grid;
  }
}

globalThis.InventoryV2InventoryGridRenderer =
  InventoryV2InventoryGridRenderer;
