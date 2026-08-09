class InventoryV2ViewModelFactory {
  static #categories = Object.freeze([
    { id: "all", label: "Усе", icon: "🎒" },
    { id: "loadouts", label: "Комплекти", icon: "🧰" },
    { id: "rods", label: "Вудилища", icon: "🎣" },
    { id: "reels", label: "Котушки", icon: "⚙️" },
    { id: "lines", label: "Ліски", icon: "🧵" },
    { id: "tackle", label: "Оснастка", icon: "🪝" },
    { id: "baits", label: "Наживки", icon: "🪱" },
    { id: "chums", label: "Прикормки", icon: "🍞" },
    { id: "boats", label: "Кораблики", icon: "🚤" },
    { id: "nets", label: "Підсаки", icon: "🕸️" },
    { id: "tools", label: "Інше", icon: "☣️" },
  ]);

  #repository;
  #assemblyStates;
  #attachmentTargetResolver;
  #contextItemFilter;
  #equipmentState;
  #loadouts;
  #itemViews;
  #subfilterResolver;
  #visibilityPolicy;
  #availabilityPolicy;
  #terminalLineResolver;
  #compatibilityPolicy;
  #projectionService;
  #settings;
  #loadValueProvider;

  constructor({
    repository,
    assemblyStates,
    attachmentTargetResolver,
    contextItemFilter,
    equipmentState,
    loadouts,
    itemViews,
    subfilterResolver,
    visibilityPolicy,
    availabilityPolicy,
    terminalLineResolver,
    compatibilityPolicy,
    projectionService,
    settings,
    loadValueProvider = null,
  } = {}) {
    Object.assign(this, {});
    this.#repository = repository;
    this.#assemblyStates = assemblyStates;
    this.#attachmentTargetResolver = attachmentTargetResolver;
    this.#contextItemFilter = contextItemFilter;
    this.#equipmentState = equipmentState;
    this.#loadouts = loadouts;
    this.#itemViews = itemViews;
    this.#subfilterResolver = subfilterResolver;
    this.#visibilityPolicy = visibilityPolicy;
    this.#availabilityPolicy = availabilityPolicy;
    this.#terminalLineResolver = terminalLineResolver;
    this.#compatibilityPolicy = compatibilityPolicy;
    this.#projectionService = projectionService;
    this.#settings = settings;
    this.#loadValueProvider = loadValueProvider;
    if (!this.#attachmentTargetResolver?.listTargets) {
      throw new TypeError(
        "InventoryV2ViewModelFactory requires attachmentTargetResolver",
      );
    }
    if (!this.#contextItemFilter?.filter) {
      throw new TypeError(
        "InventoryV2ViewModelFactory requires contextItemFilter",
      );
    }
  }

  create(uiState = {}) {
    const equipmentProjection = this.#projectionService.project(
      this.#equipmentState,
    );
    const accessibleRawItems = this.#accessibleInventoryItems();
    const inventoryContext = {
      mode: uiState.panelMode === "assembly" ? "assembly" : "loadout",
      rootInstanceId: uiState.editingRootInstanceId || null,
    };
    const visibleInventoryItems = this.#contextItemFilter.filter(
      accessibleRawItems,
      inventoryContext,
    );
    const selectedRaw = uiState.selectedInstanceId
      ? this.#repository.get(uiState.selectedInstanceId)
      : null;
    const activeBaits = (equipmentProjection.baits || [])
      .map((item) => this.#createProjectedItemView(item))
      .filter(
        (item) => ["bait", "fishing_bait"].includes(this.#itemType(item)),
      );
    const activeChums = [equipmentProjection.feederChum]
      .map((item) => this.#createProjectedItemView(item))
      .filter(
        (item) => ["chum_mix", "groundbait"].includes(this.#itemType(item)),
      );
    const savedLoadout = this.#createSavedLoadoutPreview(
      uiState.viewingLoadoutId,
    );
    return {
      isOpen: uiState.isOpen === true,
      header: {
        loadValue: Number(this.#loadValueProvider?.() || 0),
        loadUnit: "кг",
        activeTackle: {
          baits: activeBaits,
          chums: activeChums,
        },
      },
      settings: this.#settings.snapshot(),
      tooltipContext: this.#createTooltipContext(equipmentProjection),
      panel: {
        mode: uiState.panelMode === "assembly" ? "assembly" : "loadout",
        loadout: this.#createEquipmentPanel(
          accessibleRawItems,
          equipmentProjection.rod,
          selectedRaw,
          uiState.highlightedEquipmentSlotId,
        ),
        assembly: this.#createAssemblyEditor(
          uiState.editingRootInstanceId,
          accessibleRawItems,
          selectedRaw,
        ),
      },
      inventory: {
        ...this.#createInventory(
          uiState,
          visibleInventoryItems,
          equipmentProjection.rod,
          inventoryContext,
        ),
        mode: uiState.viewingLoadoutId ? "saved-loadout" : "inventory",
        savedLoadout,
      },
    };
  }

  #createEquipmentPanel(
    accessibleRawItems,
    rod,
    selectedRaw,
    highlightedSlotId = null,
  ) {
    const mainSlots = [];
    const auxiliarySlots = [];
    for (const slotId of EQUIPMENT_ALL_SLOT_IDS) {
      if (!this.#visibilityPolicy.isVisible(slotId, { rod })) continue;
      const itemViews = accessibleRawItems
        .map((item) => this.#itemViews.create(item.instanceId))
        .filter(Boolean);
      const availability = this.#availabilityPolicy.resolve({
        slotId,
        equipmentState: this.#equipmentState,
        rod,
        inventoryItems: itemViews,
        isCompatible: ({ item }) =>
          this.#compatibilityPolicy.isCompatible({
            slotId,
            item,
            equipmentState: this.#equipmentState,
            rod,
            enforceReadiness: false,
          }),
      });
      const equippedId = this.#equipmentState.getRootInstanceId(slotId);
      const equippedItemView = equippedId
        ? this.#itemViews.create(equippedId)
        : null;
      const equippedItem = equippedItemView
        ? { ...equippedItemView, equipped: true }
        : null;
      const slot = {
        slotId,
        label: this.#equipmentLabel(slotId, rod, equippedItem),
        item: equippedItem,
        state: this.#slotState(availability.state),
        warning: availability.warning,
        highlighted:
          highlightedSlotId === slotId ||
          (Boolean(selectedRaw) &&
            this.#compatibilityPolicy.isCompatible({
              slotId,
              item: this.#itemViews.create(selectedRaw.instanceId),
              equipmentState: this.#equipmentState,
              rod,
              enforceReadiness: false,
            })),
      };
      if (EQUIPMENT_MAIN_SLOT_IDS.includes(slotId)) mainSlots.push(slot);
      else auxiliarySlots.push(slot);
    }
    return {
      mainSlots,
      auxiliarySlots,
      save: {
        visible: true,
        enabled: Object.values(
          this.#equipmentState.getMainRootInstanceIds(),
        ).some(Boolean),
        placeholder: "Назва комплекту...",
        maxNameLength: 40,
      },
    };
  }

  #createAssemblyEditor(rootInstanceId, accessibleRawItems, selectedRaw) {
    if (!rootInstanceId || !this.#assemblyStates.has(rootInstanceId)) {
      return {
        root: null,
        rootInstanceId: "",
        sockets: [],
        equipped: false,
        canEquip: false,
        canUnequip: false,
        showUnequip: false,
        canDisassemble: false,
        showDisassemble: false,
      };
    }
    const sockets = this.#attachmentTargetResolver
      .listTargets(rootInstanceId)
      .map((target) => {
        const hasCompatibleItem = accessibleRawItems.some((candidate) =>
          this.#attachmentTargetResolver.accepts(target, candidate),
        );
        const selectedCompatible = this.#attachmentTargetResolver.accepts(
          target,
          selectedRaw,
        );
        return {
          socketId: target.socketId,
          slotId: target.slotId,
          slotIndex: target.slotIndex,
          parentInstanceId: target.parentInstanceId,
          label: this.#socketLabel(target),
          item: target.occupied
            ? this.#itemViews.create(target.occupied.instanceId)
            : null,
          state: target.occupied
            ? "filled"
            : hasCompatibleItem
              ? "available"
              : "unavailable",
          warning: hasCompatibleItem
            ? ""
            : "В інвентарі немає відповідного доступного предмета.",
          highlighted: selectedCompatible,
        };
      });
    const equipped = Object.values(this.#equipmentState.snapshot()).includes(
      rootInstanceId,
    );
    const rootView = this.#itemViews.create(rootInstanceId);
    const hasAttachedComponents =
      rootView?.assemblyCompletion?.hasAnyComponent === true;
    return {
      root: rootView ? { ...rootView, equipped } : null,
      rootLabel: this.#itemViews.create(rootInstanceId)?.name || "Предмет",
      rootInstanceId,
      sockets,
      equipped,
      canEquip: true,
      canUnequip: equipped,
      showUnequip: equipped,
      canDisassemble: hasAttachedComponents,
      showDisassemble: hasAttachedComponents,
    };
  }

  #createSavedLoadoutPreview(loadoutId) {
    const loadout = this.#loadouts.get(loadoutId);
    if (!loadout) {
      return {
        loadoutId: "",
        name: "Збірка",
        slots: [],
        canEquipAll: false,
        canDisassemble: false,
      };
    }
    const rodInstanceId = loadout.getRootInstanceId("rod");
    const rod = rodInstanceId ? this.#itemViews.create(rodInstanceId) : null;
    const slots = [];
    for (const slotId of EQUIPMENT_MAIN_SLOT_IDS) {
      const rootInstanceId = loadout.getRootInstanceId(slotId);
      if (!rootInstanceId) continue;
      const itemView = rootInstanceId
        ? this.#itemViews.create(rootInstanceId)
        : null;
      const active =
        Boolean(rootInstanceId) &&
        this.#equipmentState.getRootInstanceId(slotId) === rootInstanceId;
      const item = itemView ? { ...itemView, equipped: active } : null;
      slots.push({
        slotId,
        label: this.#equipmentLabel(slotId, rod, item),
        item,
        state: item ? "filled" : "available",
        active,
      });
    }
    const hasContents = loadout.getContainedRootIds().length > 0;
    return {
      loadoutId: loadout.loadoutId,
      name: loadout.name,
      slots,
      canEquipAll: hasContents,
      canDisassemble: hasContents,
      equipWarning: hasContents ? "" : "Збірка порожня.",
      disassembleWarning: hasContents ? "" : "Збірка порожня.",
    };
  }

  #createInventory(uiState, accessibleRawItems, rod, context = {}) {
    const contextFiltered = context.mode === "assembly";
    const itemViews = accessibleRawItems
      .map((item) => this.#itemViews.create(item.instanceId))
      .filter(Boolean);
    const categories = contextFiltered
      ? InventoryV2ViewModelFactory.#categories.filter(
          (category) =>
            category.id === "all" ||
            itemViews.some((item) => this.#matchesCategory(item, category.id)),
        )
      : InventoryV2ViewModelFactory.#categories;
    const availableCategoryIds = new Set(
      categories.map((category) => category.id),
    );
    const requestedCategoryId = uiState.activeCategoryId || "all";
    const categoryId = availableCategoryIds.has(requestedCategoryId)
      ? requestedCategoryId
      : "all";
    const highlightedSlotId = uiState.highlightedEquipmentSlotId || null;
    const categoryItems = itemViews
      .filter((item) => this.#matchesCategory(item, categoryId))
      .map((item) => ({
        ...item,
        compatibleWithHighlightedSlot:
          Boolean(highlightedSlotId) &&
          this.#compatibilityPolicy.isCompatible({
            slotId: highlightedSlotId,
            item,
            equipmentState: this.#equipmentState,
            rod,
            enforceReadiness: false,
          }),
      }));
    if (!contextFiltered) {
      for (const loadout of this.#loadouts.list()) {
        const card = this.#itemViews.createLoadout(loadout);
        if (this.#matchesCategory(card, categoryId)) categoryItems.push(card);
      }
    }
    const requestedSubfilterIds = new Set(
      Array.isArray(uiState.activeSubfilterIds)
        ? uiState.activeSubfilterIds.filter(Boolean)
        : [],
    );
    const subfilterGroups = new Map();
    for (const item of categoryItems) {
      const group = this.#subfilterResolver.resolve(item, { categoryId });
      if (!group) continue;
      const current = subfilterGroups.get(group.id);
      subfilterGroups.set(group.id, {
        id: group.id,
        label: group.label,
        count: (current?.count || 0) + 1,
        selected: false,
      });
    }
    const activeSubfilterIds = new Set(
      [...requestedSubfilterIds].filter((filterId) =>
        subfilterGroups.has(filterId),
      ),
    );
    for (const group of subfilterGroups.values()) {
      group.selected = activeSubfilterIds.has(group.id);
    }
    const items = activeSubfilterIds.size
      ? categoryItems.filter((item) => {
          const group = this.#subfilterResolver.resolve(item, { categoryId });
          return group && activeSubfilterIds.has(group.id);
        })
      : categoryItems;
    return {
      categories,
      activeCategoryId: categoryId,
      subfilters: [...subfilterGroups.values()].sort((left, right) =>
        left.label.localeCompare(right.label, "uk-UA"),
      ),
      activeSubfilterIds: [...activeSubfilterIds],
      items,
      selectedInstanceId: uiState.selectedInstanceId || "",
      highlightedSlotId: highlightedSlotId || "",
      emptyMessage: contextFiltered
        ? "В інвентарі немає сумісних компонентів для цієї збірки."
        : "У цій категорії немає предметів",
    };
  }

  #accessibleInventoryItems() {
    const equipped = new Set(
      Object.values(this.#equipmentState.snapshot()).filter(Boolean),
    );
    return this.#repository.list().filter(
      (item) =>
        InventoryItemLocation.isInventory(item.location) &&
        !equipped.has(item.instanceId),
    );
  }

  #matchesCategory(item, categoryId) {
    if (categoryId === "all") return true;
    const type = item?.type;
    if (categoryId === "loadouts") return type === "equipment_loadout";
    if (categoryId === "rods") {
      return ["spinning", "feeder", "float", "pole", "match", "bolognese"].includes(type);
    }
    if (categoryId === "reels") return type === "spinning_reel";
    if (categoryId === "lines") return ["fishing_line", "leader_line"].includes(type);
    if (categoryId === "tackle") {
      return ["hook", "feeder_rig", "spring", "feeder_tackle", "lure", "spinner", "wobbler", "jig", "float_tackle", "day", "night"].includes(type);
    }
    if (categoryId === "baits") return ["bait", "fishing_bait"].includes(type);
    if (categoryId === "chums") return ["chum_mix", "groundbait"].includes(type);
    if (categoryId === "boats") return ["boat", "chum_delivery"].includes(type);
    if (categoryId === "nets") return type === "net";
    return type === "gas_mask";
  }

  #itemType(item) {
    return item?.type ?? item?.engineStats?.type ?? null;
  }

  #createProjectedItemView(item) {
    if (!item) return null;
    const instanceId = item.instanceId;
    if (!instanceId) return item;
    return this.#itemViews.create(instanceId) || item;
  }

  #createTooltipContext(equipmentProjection) {
    const projectedItems = [
      equipmentProjection.rod,
      equipmentProjection.reel,
      equipmentProjection.line,
      equipmentProjection.leader,
      equipmentProjection.float,
      equipmentProjection.feederRig,
      ...(equipmentProjection.hooks || []),
    ]
      .map((item) => this.#createProjectedItemView(item))
      .filter(Boolean);
    const capabilities = new Set();
    for (const item of projectedItems) {
      const authored = item.capabilities || item.engineStats?.capabilities;
      if (!Array.isArray(authored)) continue;
      authored.forEach((capability) => capabilities.add(capability));
    }
    const rod = projectedItems[0] || null;
    const rodType = this.#itemType(rod);
    const hasReel = rod
      ? Boolean(rod.hasReel ?? rod.engineStats?.hasReel ?? rodType !== "pole")
      : null;
    return {
      rodType,
      rodHasReel: hasReel,
      availableCapabilities: [...capabilities],
    };
  }

  #equipmentLabel(slotId, rod, item) {
    if (slotId === "terminalLine") {
      return this.#terminalLineResolver.resolve(rod).label;
    }
    if (slotId === "tackle" && item) return item.name || "Снасть";
    return EQUIPMENT_SLOT_CONFIG[slotId]?.label || slotId;
  }

  #socketLabel({ slotId, slotIndex, capacity, parentContext = null }) {
    const labels = {
      line: "Ліска",
      hook: "Гачок",
      bait: "Наживка",
      chum: "Прикормка",
      cargo: "Бункер",
    };
    const base = labels[slotId] || slotId;
    if (slotId === "bait" && parentContext?.slotId === "hook") {
      return `${base} — гачок ${parentContext.slotIndex + 1}`;
    }
    return capacity > 1 ? `${base} ${slotIndex + 1}` : base;
  }

  #slotState(state) {
    if (state === EquipmentSlotAvailabilityState.FILLED) return "filled";
    if (state === EquipmentSlotAvailabilityState.LOCKED) return "locked";
    if (state === EquipmentSlotAvailabilityState.NO_ACCESSIBLE_COMPATIBLE_ITEM) {
      return "unavailable";
    }
    return "available";
  }
}

globalThis.InventoryV2ViewModelFactory = InventoryV2ViewModelFactory;
