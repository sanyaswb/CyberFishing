class InventoryV2InventoryGridRenderer {
  #dom;
  #itemRenderer;
  #subfiltersExpanded = false;
  #sortExpanded = false;

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
      onSortCriterionSelect = null,
      onSortDirectionSelect = null,
      onRarityFilterToggle = null,
      onItemActivate = null,
      onItemLongPress = null,
    } = {},
  ) {
    const panel = this.#dom.element(
      "section",
      "inventory-v2-inventory-panel",
    );
    const subfilters = this.#renderSubfilters(model, onSubfilterToggle);
    const sortOptions = this.#renderSortOptions(model, {
      onSortCriterionSelect,
      onSortDirectionSelect,
      onRarityFilterToggle,
    });
    panel.appendChild(
      this.#renderCategories(model, {
        onCategorySelect,
        onSubfiltersToggle: (toggle) => {
          this.#subfiltersExpanded = !this.#subfiltersExpanded;
          subfilters.classList.toggle("is-open", this.#subfiltersExpanded);
          this.#syncSubfilterToggle(toggle);
        },
        onSortToggle: (toggle) => {
          this.#sortExpanded = !this.#sortExpanded;
          sortOptions.classList.toggle("is-open", this.#sortExpanded);
          this.#syncSortToggle(toggle);
        },
      }),
    );
    panel.appendChild(subfilters);
    panel.appendChild(sortOptions);
    panel.appendChild(
      this.#renderItems(model, { onItemActivate, onItemLongPress }),
    );
    return panel;
  }

  #renderCategories(
    model,
    { onCategorySelect, onSubfiltersToggle, onSortToggle },
  ) {
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
    const sortToggle = this.#dom.button(
      "inventory-v2-categories__toggle inventory-v2-categories__sort-toggle",
      "",
      { title: "Сортування та фільтр рідкості" },
    );
    this.#syncSortToggle(sortToggle);
    sortToggle.setAttribute(
      "aria-label",
      "Показати або приховати сортування та фільтр рідкості",
    );
    sortToggle.addEventListener("click", () => onSortToggle?.(sortToggle));
    navigation.appendChild(sortToggle);
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

  #renderSortOptions(
    model,
    {
      onSortCriterionSelect,
      onSortDirectionSelect,
      onRarityFilterToggle,
    },
  ) {
    const container = this.#dom.element("div", "inventory-v2-sort-options");
    container.classList.toggle("is-open", this.#sortExpanded);
    container.setAttribute("aria-label", "Сортування інвентарю");

    const directionGroup = this.#dom.element(
      "div",
      "inventory-v2-sort-options__group inventory-v2-sort-options__directions",
    );
    model.sort.directions.forEach((direction) => {
      const button = this.#dom.button(
        "inventory-v2-sort-options__button inventory-v2-sort-options__direction",
        direction.icon,
        { title: direction.label },
      );
      button.classList.toggle("is-active", direction.selected);
      button.setAttribute("aria-label", direction.label);
      button.setAttribute("aria-pressed", String(direction.selected));
      button.addEventListener("click", () =>
        onSortDirectionSelect?.(direction.id),
      );
      directionGroup.appendChild(button);
    });
    container.appendChild(directionGroup);

    const criterionGroup = this.#dom.element(
      "div",
      "inventory-v2-sort-options__group inventory-v2-sort-options__criteria",
    );
    model.sort.criteria.forEach((criterion) => {
      const button = this.#dom.button(
        "inventory-v2-sort-options__button inventory-v2-sort-options__criterion",
        criterion.label,
      );
      button.classList.toggle("is-active", criterion.selected);
      button.setAttribute("aria-pressed", String(criterion.selected));
      button.addEventListener("click", () =>
        onSortCriterionSelect?.(criterion.id),
      );
      criterionGroup.appendChild(button);
    });
    container.appendChild(criterionGroup);

    const rarityGroup = this.#dom.element(
      "div",
      "inventory-v2-sort-options__group inventory-v2-sort-options__rarities",
    );
    model.sort.rarities.forEach((rarity) => {
      const label = `${rarity.label}: ${rarity.count}`;
      const button = this.#dom.button(
        "inventory-v2-sort-options__rarity",
        "",
        { title: label },
      );
      button.style.setProperty("--inventory-v2-rarity-filter-color", rarity.color);
      button.classList.toggle("is-active", rarity.selected);
      button.setAttribute("aria-label", label);
      button.setAttribute("aria-pressed", String(rarity.selected));
      button.addEventListener("click", () =>
        onRarityFilterToggle?.(rarity.id, !rarity.selected),
      );
      rarityGroup.appendChild(button);
    });
    container.appendChild(rarityGroup);
    return container;
  }

  #syncSortToggle(toggle) {
    toggle.setAttribute("aria-expanded", String(this.#sortExpanded));
    toggle.classList.toggle("is-active", this.#sortExpanded);
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
