// This port owns only presentation fixtures. It never instantiates Inventory,
// dispatches a game command or writes persistence.
export class UiCatalogInventoryFixture {
  #actionTypes;
  #rarityResolver;
  #model;
  #state = "normal";
  #value = 67;
  constructor({ actionTypes, rarityVisualResolver }) {
    this.#actionTypes = actionTypes;
    this.#rarityResolver = rarityVisualResolver;
    this.reset("normal");
  }
  getViewModel() { return this.#model; }
  reset(state) {
    this.#state = state;
    const names = ["Вудилище", "Котушка", "Ліска", "Поплавок", "Наживка", "Прикормка", "Підсака", "Кораблик"];
    const icons = ["rod", "reel", "line", "float", "bait", "chum", "net", "boat"];
    const items = icons.map((icon, index) => ({
      instanceId: `catalog-${icon}`, itemId: `fixture-${icon}`, itemType: icon,
      name: state === "long" ? `${names[index]} · дуже довга назва контрольного предмета без скорочення доступного імені` : names[index],
      iconUrl: state === "missing" ? "" : `assets/ui/inventory/${icon}.svg`, icon: "?",
      quantity: index > 3 ? 12 : 1,
      rarity: { tier: 1 + index % 4, maxTier: 5, isUnique: index === 7 },
      charge: { percent: this.#value, label: "Заряд" }, attachments: [],
      compatibleWithHighlightedSlot: index === 1,
    }));
    const empty = state === "empty";
    const slot = (slotId, label, item, index) => ({ slotId, label,
      state: state === "locked" && index > 0 ? "locked" : item && !empty ? "filled" : "empty",
      item: state === "locked" && index > 0 || empty ? null : item,
      warning: "Комірка недоступна для контрольної збірки", highlighted: index === 1 });
    const mainSlots = [slot("rod", "Вудилище", items[0], 0), slot("reel", "Котушка", items[1], 1),
      slot("terminalLine", "Ліска", items[2], 2), slot("tackle", "Оснастка", null, 3), slot("float", "Поплавок", items[3], 4)];
    this.#model = {
      isOpen: true, settings: { autoBait: true, autoChum: false },
      header: { loadValue: 4.5, loadUnit: "кг", activeBaits: empty ? [] : [items[4]], activeChums: empty ? [] : [items[5]], baitStock: empty ? 0 : 12, chumStock: empty ? 0 : 12 },
      panel: { mode: ["assembly", "removal", "save"].includes(state) ? "assembly" : state === "saved" ? "saved-loadout" : "loadout",
        loadout: { mainSlots, auxiliarySlots: [slot("net", "Підсака", items[6], 0), slot("delivery", "Кораблик", items[7], 0)] },
        savedLoadout: { loadoutId: "catalog-loadout", name: "Контрольна збірка", slots: mainSlots, canEquipAll: false, equipWarning: "Контрольний стан: збірку не можна спорядити" },
        assembly: { root: items[0], rootInstanceId: items[0].instanceId,
          sockets: [slot("reel", "Котушка", items[1], 1)], equipped: false, canEquip: false,
          rodRemovalStep: state === "save" ? "save" : state === "removal" ? "choice" : null,
          canUnequip: false, canDisassemble: true, equipWarning: "Збірку не завершено — контрольний стан помилки" } },
      inventory: { items: empty ? [] : items, emptyMessage: "Інвентар порожній", selectedInstanceId: items[0].instanceId,
        categories: [{ id: "all", label: "Усі", selected: true }, { id: "rod", label: "Вудилища" }, { id: "bait", label: "Наживки" }, { id: "chum", label: "Прикормка" }],
        subfilters: [{ id: "float", label: "Поплавкова" }, { id: "spinning", label: "Спінінгова" }, { id: "bottom", label: "Донна" }],
        activeSubfilterIds: [], sort: {
          criteria: [{ id: "rarity", label: "Рідкість" }, { id: "name", label: "Назва" }, { id: "type", label: "Тип" }], criterionIds: ["rarity"],
          directionId: "descending", directions: [{ id: "ascending", label: "За зростанням", icon: "↑" }, { id: "descending", label: "За спаданням", icon: "↓" }],
          rarities: [1, 2, 3, 4, 5].map((tier) => ({ id: `tier-${tier}`, label: `Рівень ${tier}`, count: tier < 4 ? 2 : 1,
            color: this.#rarityResolver.resolve({ tier, maxTier: 5 }).cssColor })), activeRarityIds: [] } },
    };
  }
  setValue(value) {
    this.#value = Math.max(0, Math.min(100, Number(value) || 0));
    const items = this.#model.inventory.items;
    for (const item of items) item.charge.percent = this.#value;
  }
  dispatch(action) {
    const types = this.#actionTypes;
    const model = this.#model;
    const inventory = model.inventory;
    if (action.type === types.OPEN) model.isOpen = true;
    else if (action.type === types.CLOSE) model.isOpen = false;
    else if (this.#state === "error") return { warning: "Демонстраційна помилка: дія недоступна", refresh: false };
    else if (action.type === types.AUTO_BAIT_CHANGE) model.settings.autoBait = action.enabled;
    else if (action.type === types.AUTO_CHUM_CHANGE) model.settings.autoChum = action.enabled;
    else if (action.type === types.CATEGORY_SELECT) {
      for (const category of inventory.categories) category.selected = category.id === action.categoryId;
    } else if (action.type === types.INVENTORY_ITEM_ACTIVATE) inventory.selectedInstanceId = action.instanceId;
    else if (action.type === types.INVENTORY_ITEM_LONG_PRESS) {
      const item = inventory.items.find((entry) => entry.instanceId === action.instanceId);
      if (item) { model.panel.mode = "assembly"; model.panel.assembly.root = item; model.panel.assembly.rootInstanceId = item.instanceId; }
    } else if (action.type === types.SORT_DIRECTION_SELECT) inventory.sort.directionId = action.directionId;
    else if (action.type === types.SORT_CRITERION_SELECT) inventory.sort.criterionIds = [action.criterionId];
    else if (action.type === types.SUBFILTER_TOGGLE) inventory.activeSubfilterIds = action.enabled ? [action.filterId] : [];
    else if (action.type === types.RARITY_FILTER_TOGGLE) inventory.sort.activeRarityIds = action.enabled ? [action.rarityId] : [];
    else if (action.type === types.ASSEMBLY_BACK || action.type === types.LOADOUT_PREVIEW_BACK) model.panel.mode = "loadout";
    else if (action.type === types.ROD_REMOVAL_CHOICE) {
      if (action.choice === "save") model.panel.assembly.rodRemovalStep = "save";
      else model.panel.mode = "loadout";
    } else if (action.type === types.LOADOUT_SAVE) {
      model.panel.savedLoadout.name = action.name || "Контрольна збірка";
      model.panel.mode = "saved-loadout";
    }
    return { ok: true, viewModel: model };
  }
}
