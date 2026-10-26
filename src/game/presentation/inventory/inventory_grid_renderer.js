const MOBILE_COLUMNS_BY_SCALE_ID = Object.freeze({
  1: 6,
  2: 4,
  3: 3,
});

export class InventoryGridRenderer {
  #dom;
  #itemRenderer;
  #horizontalScrollController;
  #listScrollController;
  #backdropImage;
  #pager;
  #subfiltersExpanded = false;
  #sortExpanded = false;
  #settingsExpanded = false;
  #selectedCardScale = 1;
  #selectedCardScaleId = 2;
  #gridElement = null;

  constructor({
    domFactory,
    itemRenderer,
    horizontalScrollController = null,
    createHorizontalScrollController,
    listScrollController,
    backdropImage = "",
    pagerRenderer,
  } = {}) {
    this.#dom = domFactory;
    this.#backdropImage = backdropImage;
    this.#listScrollController = listScrollController;
    this.#pager = pagerRenderer;
    this.#itemRenderer = itemRenderer;
    this.#horizontalScrollController =
      horizontalScrollController || createHorizontalScrollController();
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
      onPagerEdge = null,
      backpackView,
    } = {},
  ) {
    // Shared collection (spec 074): the filters panel, a gap, then the items panel. In portrait the items panel is a
    // pager (spec 075): the list over the faded backpack, and the backpack view.
    const panel = this.#dom.element("section", "inventory-list-panel inventory-collection");
    const controls = this.#dom.element("div",
      "inventory-list-panel__controls inventory-collection__controls inventory-panel");
    const subfilters = this.#renderSubfilters(model, onSubfilterToggle);
    const sortOptions = this.#renderSortOptions(model, {
      onSortCriterionSelect,
      onSortDirectionSelect,
      onRarityFilterToggle,
    });
    const settingsOptions = this.#renderSettingsOptions();
    const categories = this.#renderCategories(model, {
      onCategorySelect,
      onSubfiltersToggle: (toggle) => {
        this.#subfiltersExpanded = !this.#subfiltersExpanded;
        subfilters.classList.toggle("inventory-subfilters--open", this.#subfiltersExpanded);
        this.#syncSubfilterToggle(toggle);
      },
      onSortToggle: (toggle) => {
        this.#sortExpanded = !this.#sortExpanded;
        sortOptions.classList.toggle("inventory-sort-options--open", this.#sortExpanded);
        this.#syncSortToggle(toggle);
      },
      onSettingsToggle: (toggle) => {
        this.#settingsExpanded = !this.#settingsExpanded;
        settingsOptions.classList.toggle("inventory-settings-options--open", this.#settingsExpanded);
        this.#syncSettingsToggle(toggle);
      },
    });
    this.#horizontalScrollController.attach(categories);
    this.#horizontalScrollController.attach(subfilters);
    this.#horizontalScrollController.attach(sortOptions);
    this.#horizontalScrollController.attach(settingsOptions);
    controls.append(categories, subfilters, sortOptions, settingsOptions);
    // The item page holds the faded backpack and the grid directly: the pager page is the flex parent that bounds the
    // grid's height, so no wrapper may sit between them (spec 076 follow-up).
    const items = [];
    const backdrop = this.#dom.image(this.#backdropImage, "");
    if (backdrop) {
      backdrop.className = "inventory-collection__backdrop";
      backdrop.setAttribute("aria-hidden", "true");
      items.push(backdrop);
    }
    const grid = this.#renderItems(model, { onItemActivate, onItemLongPress });
    // Dragging over a card scrolls the list instead of activating the card (spec 076).
    this.#listScrollController.attach(grid);
    items.push(grid);
    const pager = this.#pager.create([items, [backpackView]], {
      viewportClassName: "inventory-list-panel__items inventory-collection__items inventory-panel",
      onEdge: onPagerEdge,
    });
    panel.append(controls, pager);
    return panel;
  }

  // Entering the backpack section starts on the item list, so a pick always shows its highlighted cards.
  showItemsPage() {
    this.#pager.select(0);
  }

  // A swipe back from the next section enters on the backpack page next to it (spec 087).
  showBackpackPage() {
    this.#pager.selectLast();
  }

  #renderCategories(
    model,
    { onCategorySelect, onSubfiltersToggle, onSortToggle, onSettingsToggle },
  ) {
    const navigation = this.#dom.element(
      "nav",
      "inventory-categories",
    );
    navigation.setAttribute("aria-label", "Категорії інвентарю");
    const toggle = this.#dom.button(
      "inventory-categories__toggle",
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
      "inventory-categories__toggle inventory-categories__sort-toggle",
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
    const settingsToggle = this.#dom.button(
      "inventory-categories__toggle inventory-categories__settings-toggle",
      "",
      { title: "Налаштування відображення" },
    );
    this.#syncSettingsToggle(settingsToggle);
    settingsToggle.setAttribute(
      "aria-label",
      "Показати або приховати налаштування відображення",
    );
    settingsToggle.addEventListener("click", () => onSettingsToggle?.(settingsToggle));
    navigation.appendChild(settingsToggle);
    model.categories.forEach((category) => {
      const label = [category.iconUrl ? "" : category.icon, category.label].filter(Boolean).join(" ");
      const button = this.#dom.button(
        "inventory-categories__button",
        category.iconUrl ? "" : label,
      );
      const image = this.#dom.image(category.iconUrl, "");
      if (image) {
        image.className = "inventory-categories__image";
        image.setAttribute("aria-hidden", "true");
        button.append(image, this.#dom.element("span", "", label));
      }
      button.classList.toggle("inventory-categories__button--active", category.selected);
      button.setAttribute("aria-pressed", String(category.selected));
      button.addEventListener("click", () => onCategorySelect?.(category.id));
      navigation.appendChild(button);
    });
    return navigation;
  }

  #renderSubfilters(model, onSubfilterToggle) {
    const container = this.#dom.element("div", "inventory-subfilters");
    container.classList.toggle("inventory-subfilters--open", this.#subfiltersExpanded);
    container.setAttribute("aria-label", "Фільтри за підтипами");
    if (!model.subfilters.length) {
      container.appendChild(
        this.#dom.element(
          "span",
          "inventory-subfilters__empty",
          "Немає предметів для фільтрації",
        ),
      );
      return container;
    }
    model.subfilters.forEach((filter) => {
      const label = this.#dom.element(
        "label",
        "inventory-subfilters__option",
      );
      const checkbox = this.#dom.element(
        "input",
        "inventory-subfilters__checkbox",
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
          "inventory-subfilters__label",
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
    toggle.classList.toggle("inventory-categories__toggle--active", this.#subfiltersExpanded);
  }

  #renderSortOptions(
    model,
    {
      onSortCriterionSelect,
      onSortDirectionSelect,
      onRarityFilterToggle,
    },
  ) {
    const container = this.#dom.element("div", "inventory-sort-options");
    container.classList.toggle("inventory-sort-options--open", this.#sortExpanded);
    container.setAttribute("aria-label", "Сортування інвентарю");

    const directionGroup = this.#dom.element(
      "div",
      "inventory-sort-options__group inventory-sort-options__directions",
    );
    model.sort.directions.forEach((direction) => {
      const button = this.#dom.button(
        "inventory-sort-options__button inventory-sort-options__direction",
        direction.icon,
        { title: direction.label },
      );
      button.classList.toggle("inventory-sort-options__button--active", direction.selected);
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
      "inventory-sort-options__group inventory-sort-options__criteria",
    );
    model.sort.criteria.forEach((criterion) => {
      const button = this.#dom.button(
        "inventory-sort-options__button inventory-sort-options__criterion",
        criterion.label,
      );
      button.classList.toggle("inventory-sort-options__button--active", criterion.selected);
      button.setAttribute("aria-pressed", String(criterion.selected));
      button.dataset.sortPriority = criterion.selected
        ? String(criterion.priority)
        : "";
      button.setAttribute(
        "aria-label",
        criterion.selected
          ? `${criterion.label}, пріоритет ${criterion.priority}`
          : criterion.label,
      );
      button.addEventListener("click", () =>
        onSortCriterionSelect?.(criterion.id),
      );
      criterionGroup.appendChild(button);
    });
    container.appendChild(criterionGroup);

    const rarityGroup = this.#dom.element(
      "div",
      "inventory-sort-options__group inventory-sort-options__rarities",
    );
    model.sort.rarities.forEach((rarity) => {
      const label = `${rarity.label}: ${rarity.count}`;
      const button = this.#dom.button(
        "inventory-sort-options__rarity",
        "",
        { title: label },
      );
      button.style.setProperty("--inventory-rarity-filter-color", rarity.color);
      button.classList.toggle("inventory-sort-options__rarity--active", rarity.selected);
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
    toggle.classList.toggle("inventory-categories__toggle--active", this.#sortExpanded);
  }

  #renderSettingsOptions() {
    const container = this.#dom.element("div", "inventory-settings-options");
    container.classList.toggle("inventory-settings-options--open", this.#settingsExpanded);
    container.setAttribute("aria-label", "Налаштування відображення інвентарю");

    const group = this.#dom.element(
      "div",
      "inventory-settings-options__group",
    );
    const label = this.#dom.element(
      "span",
      "inventory-settings-options__label",
      "Розмір",
    );
    group.appendChild(label);

    const sizesGroup = this.#dom.element(
      "div",
      "inventory-settings-options__group inventory-settings-options__sizes",
    );
    const sizeButtons = [];
    const sizes = [
      { id: 1, scale: 0.5, label: "1" },
      { id: 2, scale: 1.0, label: "2" },
      { id: 3, scale: 1.5, label: "3" },
    ];
    sizes.forEach(({ id, scale, label: sizeLabel }) => {
      const button = this.#dom.button(
        "inventory-settings-options__size",
        sizeLabel,
        { title: `Розмір ${sizeLabel}` },
      );
      const isSelected = this.#selectedCardScaleId === id;
      button.classList.toggle("inventory-settings-options__size--active", isSelected);
      button.setAttribute("aria-pressed", String(isSelected));
      button.dataset.scale = String(scale);
      button.dataset.sizeId = String(id);
      button.addEventListener("click", () => {
        this.#selectedCardScaleId = id;
        this.#selectedCardScale = scale;
        this.#applyGridScale(this.#gridElement);
        sizeButtons.forEach((btn) => {
          const active = btn.dataset.sizeId === String(id);
          btn.classList.toggle("inventory-settings-options__size--active", active);
          btn.setAttribute("aria-pressed", String(active));
        });
      });
      sizeButtons.push(button);
      sizesGroup.appendChild(button);
    });
    group.appendChild(sizesGroup);
    container.appendChild(group);
    return container;
  }

  #applyGridScale(grid) {
    if (!grid) return;
    const mobileColumns = MOBILE_COLUMNS_BY_SCALE_ID[this.#selectedCardScaleId] ?? 4;
    grid.style.setProperty("--inventory-card-scale", String(this.#selectedCardScale));
    grid.style.setProperty("--inventory-grid-columns-mobile", String(mobileColumns));
    grid.dataset.sizeId = String(this.#selectedCardScaleId);
    grid.classList.toggle("inventory-list-grid--size-1", this.#selectedCardScaleId === 1);
    grid.classList.toggle("inventory-list-grid--size-3", this.#selectedCardScaleId === 3);
  }

  #syncSettingsToggle(toggle) {
    toggle.setAttribute("aria-expanded", String(this.#settingsExpanded));
    toggle.classList.toggle("inventory-categories__toggle--active", this.#settingsExpanded);
  }

  #renderItems(model, { onItemActivate, onItemLongPress }) {
    const grid = this.#dom.element("div", "inventory-list-grid inventory-collection__list");
    this.#gridElement = grid;
    this.#applyGridScale(grid);
    if (!model.items.length) {
      grid.appendChild(
        this.#dom.element(
          "p",
          "inventory-list-grid__empty",
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
        item.itemType === "equipment_loadout";
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
