import { EQUIPMENT_ALL_SLOT_IDS, EQUIPMENT_MAIN_SLOT_IDS, EQUIPMENT_SLOT_CONFIG } from "../../domain/equipment/equipment_slot_catalog.js";
import { EQUIPMENT_SLOT_PRESENTATION } from "./equipment_slot_presentation.js";
import { EquipmentSlotAvailabilityState } from "./equipment_slot_availability_policy.js";
import { InventoryItemLocation } from "../../domain/inventory/inventory_item_location.js";
import { EquipmentState } from "../../domain/equipment/equipment_state.js";
import { AutoRefillScope } from "../../domain/equipment/auto_refill_scope.js";
import { INVENTORY_SECTIONS } from "./inventory_sections.js";

const BAIT_REFILL_SCOPES = Object.freeze([AutoRefillScope.TACKLE_BAIT]);
const CHUM_REFILL_SCOPES = Object.freeze([AutoRefillScope.TACKLE_CHUM]);

export class InventoryViewModelFactory {
  static #categories = Object.freeze([
    { id: "all", label: "Усі", iconUrl: INVENTORY_SECTIONS.backpackImage },
    { id: "compatible", label: "Сумісне", icon: "✓" },
    { id: "loadouts", label: "Збірки", icon: "🎣" },
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
  #itemOrderResolver;
  #visibilityPolicy;
  #availabilityPolicy;
  #terminalLineLabelResolver;
  #compatibilityPolicy;
  #equipmentLineReadinessPolicy;
  #rodChangePlanner;
  #equipmentReadModelFactory;
  #settings;
  #autoRefillStock;
  #loadValueProvider;
  #consumableTargets;

  constructor({
    repository,
    assemblyStates,
    attachmentTargetResolver,
    contextItemFilter,
    equipmentState,
    loadouts,
    itemViews,
    subfilterResolver,
    itemOrderResolver,
    visibilityPolicy,
    availabilityPolicy,
    terminalLineLabelResolver,
    compatibilityPolicy,
    equipmentLineReadinessPolicy = null,
    rodChangePlanner,
    equipmentReadModelFactory,
    settings,
    autoRefillStock = null,
    loadValueProvider = null,
    consumableTargets,
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
    this.#itemOrderResolver = itemOrderResolver;
    this.#visibilityPolicy = visibilityPolicy;
    this.#availabilityPolicy = availabilityPolicy;
    this.#terminalLineLabelResolver = terminalLineLabelResolver;
    this.#compatibilityPolicy = compatibilityPolicy;
    this.#equipmentLineReadinessPolicy = equipmentLineReadinessPolicy;
    this.#rodChangePlanner = rodChangePlanner;
    this.#equipmentReadModelFactory = equipmentReadModelFactory;
    this.#settings = settings;
    this.#autoRefillStock = autoRefillStock;
    this.#loadValueProvider = loadValueProvider;
    this.#consumableTargets = consumableTargets;
    if (!consumableTargets?.list || !consumableTargets?.resolve) {
      throw new TypeError("InventoryViewModelFactory requires consumableTargets");
    }
    if (
      !this.#attachmentTargetResolver?.listTargets ||
      !this.#attachmentTargetResolver?.findPlacementTargets
    ) {
      throw new TypeError(
        "InventoryViewModelFactory requires attachmentTargetResolver",
      );
    }
    if (!this.#contextItemFilter?.filter) {
      throw new TypeError(
        "InventoryViewModelFactory requires contextItemFilter",
      );
    }
    if (
      !this.#itemOrderResolver?.resolve ||
      !this.#itemOrderResolver?.createControls
    ) {
      throw new TypeError(
        "InventoryViewModelFactory requires itemOrderResolver",
      );
    }
  }

  // Pick defaults use the same target matching and group catalogue as the rendered list.
  createPickSubfilterIds(uiState) {
    const inventory = this.create({ ...uiState, activeCategoryId: "compatible",
      activeSubfilterIds: [], activeRarityFilterIds: [] }).inventory;
    return inventory.subfilters.map(group => group.id);
  }

  create(uiState = {}) {
    const equipmentReadModel = this.#equipmentReadModelFactory.create(
      this.#equipmentState,
    );
    const accessibleRawItems = this.#accessibleInventoryItems();
    const editingRootInstanceId = uiState.editingRootInstanceId || null;
    const isAttachmentEditor =
      uiState.panelMode === "assembly" &&
      Boolean(editingRootInstanceId) &&
      this.#assemblyStates.has(editingRootInstanceId);
    const inventoryContext = {
      mode: uiState.consumableKind ? "consumable" : isAttachmentEditor ? "assembly" : "loadout",
      rootInstanceId: uiState.consumableKind ? this.#equipmentState.getRootInstanceId("tackle") : editingRootInstanceId,
    };
    let visibleInventoryItems = this.#contextItemFilter.filter(
      accessibleRawItems,
      inventoryContext,
    );
    if (isAttachmentEditor && !uiState.consumableKind) {
      visibleInventoryItems = visibleInventoryItems.filter((item) =>
        !["bait", "fishing_bait"].includes(this.#itemType(this.#itemViews.create(item.instanceId))));
    }
    if (uiState.consumableKind) {
      const targets = this.#consumableTargets.list(uiState.consumableKind);
      visibleInventoryItems = accessibleRawItems.filter((item) =>
        targets.some((target) => this.#attachmentTargetResolver.accepts(target, item)));
    }
    const selectedRaw = uiState.selectedInstanceId
      ? this.#repository.get(uiState.selectedInstanceId)
      : null;
    const activeBaits = (equipmentReadModel.baits || [])
      .map((item) => this.#createProjectedItemView(item))
      .filter(
        (item) => ["bait", "fishing_bait"].includes(this.#itemType(item)),
      );
    const activeChums = this.#consumableTargets.list("chum").map((target) => target.occupied)
      .map((item) => this.#createProjectedItemView(item))
      .filter(
        (item) => ["chum_mix", "groundbait"].includes(this.#itemType(item)),
      );
    const savedLoadout = this.#createSavedLoadoutPreview(
      uiState.viewingLoadoutId,
    );
    return {
      isOpen: uiState.isOpen === true,
      equipmentFeedback: uiState.equipmentFeedback || null,
      sections: {
        activeId: uiState.activeSectionId,
        backpackItemCount: accessibleRawItems.reduce((total, item) => total + Math.max(1, Number(item.quantity) || 1), 0),
      },
      header: {
        baitSlots: this.#createConsumableSlots("bait", uiState),
        chumSlots: this.#createConsumableSlots("chum", uiState),
        loadValue: Number(this.#loadValueProvider?.() || 0),
        loadUnit: "кг",
        activeTackle: {
          baits: activeBaits,
          chums: activeChums,
        },
        refillStock: {
          bait: this.#autoRefillStock?.count({ items: activeBaits, scopes: BAIT_REFILL_SCOPES }) || 0,
          chum: this.#autoRefillStock?.count({ items: activeChums, scopes: CHUM_REFILL_SCOPES }) || 0,
        },
      },
      settings: this.#settings.snapshot(),
      tooltipContext: this.#createTooltipContext(equipmentReadModel),
      panel: {
        mode: ["assembly", "saved-loadout"].includes(uiState.panelMode) ? uiState.panelMode : "loadout",
        savedLoadout,
        loadout: this.#createEquipmentPanel(
          accessibleRawItems,
          equipmentReadModel.rod,
          selectedRaw,
          uiState.highlightedEquipmentSlotId,
          Boolean(equipmentReadModel.line),
        ),
        assembly: this.#createAssemblyEditor(
          editingRootInstanceId,
          accessibleRawItems,
          selectedRaw,
          equipmentReadModel,
          uiState.rodRemovalStep,
          uiState.highlightedEquipmentSlotId,
          uiState.pickedSocketId,
        ),
      },
      inventory: {
        ...this.#createInventory(
          uiState,
          visibleInventoryItems,
          equipmentReadModel.rod,
          inventoryContext,
        ),
        mode: "inventory",
        savedLoadout,
      },
    };
  }

  #createConsumableSlots(kind, uiState) {
    const targets = this.#consumableTargets.list(kind);
    const sharedReserve = targets.length > 0 && targets.every((target) => target.occupied) &&
      this.#autoRefillStock?.shareReserve(targets.map((target) => target.occupied));
    return targets.map((target, slotIndex) => {
      const item = target.occupied ? this.#itemViews.create(target.occupied.instanceId) : null;
      return { slotIndex, available: true, highlighted: uiState.consumableKind === kind && target.socketId === uiState.pickedSocketId,
        showCount: !sharedReserve,
        stock: item ? this.#autoRefillStock?.count({ items: [item] }) || 0 : 0,
        item };
    });
  }

  #createEquipmentPanel(
    accessibleRawItems,
    rod,
    selectedRaw,
    highlightedSlotId = null,
    hasLine = false,
  ) {
    const mainSlots = [];
    const auxiliarySlots = [];
    const itemViews = this.#createItemViews(accessibleRawItems);
    for (const slotId of EQUIPMENT_ALL_SLOT_IDS) {
      if (!this.#visibilityPolicy.isVisible(slotId, { rod })) continue;
      const availability = this.#slotAvailability(slotId, rod, itemViews);
      const equippedId = this.#equipmentState.getRootInstanceId(slotId);
      const equippedItemView = equippedId
        ? this.#itemViews.create(equippedId)
        : null;
      const equippedItem = equippedItemView
        ? { ...equippedItemView, equipped: true }
        : null;
      // A skinned rod shows its whole artwork in its cell, with or without the equipped line (spec 071).
      const rodArtwork = slotId === "rod" ? equippedItem?.skin?.equipment : null;
      if (rodArtwork) equippedItem.equipmentArtUrl = hasLine ? rodArtwork.withLine : rodArtwork.withoutLine;
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
    };
  }

  #createItemViews(rawItems) {
    return rawItems.map((item) => this.#itemViews.create(item.instanceId)).filter(Boolean);
  }

  #slotAvailability(slotId, rod, itemViews) {
    return this.#availabilityPolicy.resolve({
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
  }

  #createAssemblyEditor(
    rootInstanceId,
    accessibleRawItems,
    selectedRaw,
    equipmentReadModel,
    rodRemovalStep = null,
    highlightedSlotId = null,
    pickedSocketId = null,
  ) {
    if (!rootInstanceId || !this.#repository.has(rootInstanceId)) {
      return {
        root: null,
        rootInstanceId: "",
        sockets: [],
        parameterItems: [],
        equipped: false,
        canEquip: false,
        showEquip: false,
        canUnequip: false,
        showUnequip: false,
        canDisassemble: false,
        showDisassemble: false,
      };
    }
    const hasAssembly = this.#assemblyStates.has(rootInstanceId);
    const targets = hasAssembly
      ? this.#attachmentTargetResolver.listTargets(rootInstanceId)
      : [];
    const highlightedSocketIds = new Set(
      hasAssembly && selectedRaw
        ? this.#attachmentTargetResolver
            .findPlacementTargets(rootInstanceId, selectedRaw)
            .map((target) => target.socketId)
        : [],
    );
    let sockets = targets.filter((target) => target.slotId !== "bait")
      .map((target) => {
        const compatibleItems = accessibleRawItems.filter((candidate) =>
          this.#attachmentTargetResolver.accepts(target, candidate),
        );
        const hasCompatibleItem = compatibleItems.length > 0;
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
          highlighted: target.socketId === pickedSocketId || highlightedSocketIds.has(target.socketId),
          compatibleItems: target.occupied ? [] : this.#createItemViews(compatibleItems),
          canSelectCompatibleItem: !target.occupied,
        };
      });
    const equipped = Object.values(this.#equipmentState.snapshot()).includes(
      rootInstanceId,
    );
    const rootView = this.#itemViews.create(rootInstanceId);
    if (rootView?.itemType === "rod") {
      const rodEquipment = equipped ? this.#equipmentState : new EquipmentState({ rod: rootInstanceId });
      const itemViews = equipped ? this.#createItemViews(accessibleRawItems) : [];
      sockets = EQUIPMENT_MAIN_SLOT_IDS.filter((id) => id !== "rod" &&
        this.#visibilityPolicy.isVisible(id, { rod: rootView })).map((slotId) => {
        const id = rodEquipment.getRootInstanceId(slotId);
        // An equipped rod's empty socket is an equipment cell: same availability and warning as the loadout (spec 070).
        const availability = !id && equipped ? this.#slotAvailability(slotId, equipmentReadModel.rod, itemViews) : null;
        return {
          socketId: slotId, slotId, slotIndex: 0, parentInstanceId: rootInstanceId,
          label: this.#equipmentLabel(slotId, rootView, null),
          item: id ? this.#itemViews.create(id) : null,
          state: id ? "filled" : availability ? this.#slotState(availability.state) : "unavailable",
          warning: availability ? availability.warning || "" : "Спочатку спорядіть це вудилище.",
          highlighted: highlightedSlotId === slotId || (Boolean(selectedRaw) && this.#compatibilityPolicy.isCompatible({
            slotId, item: this.#itemViews.create(selectedRaw.instanceId), equipmentState: this.#equipmentState,
            rod: equipmentReadModel.rod, enforceReadiness: false,
          })),
          compatibleItems: !id && equipped ? itemViews.filter((item) => this.#compatibilityPolicy.isCompatible({
            slotId, item, equipmentState: this.#equipmentState, rod: equipmentReadModel.rod, enforceReadiness: false,
          })) : [],
          canSelectCompatibleItem: !id && equipped && availability?.state !== EquipmentSlotAvailabilityState.LOCKED &&
            availability?.state !== EquipmentSlotAvailabilityState.UNSUPPORTED,
        };
      });
    }
    const hasAttachedComponents =
      rootView?.assemblyCompletion?.hasAnyComponent === true;
    const equipAvailability = equipped
      ? { canEquip: false, warning: "Цей предмет уже споряджений." }
      : this.#resolveAssemblyEquipAvailability(rootView);
    return {
      root: rootView ? { ...rootView, equipped } : null,
      rootLabel: this.#itemViews.create(rootInstanceId)?.name || "Предмет",
      rootInstanceId,
      rodRemovalStep,
      sockets,
      parameterItems: this.#createEquippedRodParameterItems(
        rootInstanceId,
        equipmentReadModel,
      ),
      equipped,
      canEquip: equipAvailability.canEquip,
      showEquip: !equipped,
      equipWarning: equipAvailability.warning,
      canUnequip: equipped,
      showUnequip: equipped,
      canDisassemble: !equipped && hasAssembly && !rootView?.loadoutMembership && hasAttachedComponents,
      showDisassemble: !equipped && hasAssembly && !rootView?.loadoutMembership && hasAttachedComponents,
    };
  }

  #resolveAssemblyEquipAvailability(rootView) {
    if (!rootView) {
      return {
        canEquip: false,
        warning: "Предмет не знайдено.",
      };
    }
    const rodInstanceId = this.#equipmentState.getRootInstanceId("rod");
    const rod = rodInstanceId
      ? this.#itemViews.create(rodInstanceId)
      : null;
    const slotConfig = EQUIPMENT_SLOT_CONFIG;
    const itemType = this.#itemType(rootView);
    const candidateSlotIds = EQUIPMENT_ALL_SLOT_IDS.filter((slotId) =>
      (slotConfig[slotId]?.acceptTypes || []).includes(itemType),
    );
    let warning = candidateSlotIds.length
      ? "Предмет не сумісний з поточним спорядженням."
      : "Для цього предмета немає доступної комірки спорядження.";
    for (const slotId of candidateSlotIds) {
      const validation = this.#compatibilityPolicy.validate({
        slotId,
        item: rootView,
        equipmentState: this.#equipmentState,
        rod,
      });
      if (validation.isValid) {
        const readiness = this.#validateActivationReadiness(
          slotId,
          rootView.instanceId,
        );
        if (readiness.isValid !== false) {
          return { canEquip: true, warning: "" };
        }
        warning = readiness.warning || warning;
        continue;
      }
      if (validation.reason) warning = validation.reason;
    }
    return { canEquip: false, warning };
  }

  #validateActivationReadiness(slotId, instanceId) {
    if (!this.#equipmentLineReadinessPolicy?.validate) {
      return { isValid: true };
    }
    const snapshot = slotId === "rod"
      ? this.#rodChangePlanner.plan({ equipmentState: this.#equipmentState, nextRodInstanceId: instanceId }).after
      : {
      ...this.#equipmentState.snapshot(),
      [slotId]: instanceId,
    };
    return this.#equipmentLineReadinessPolicy.validate(snapshot);
  }

  #createEquippedRodParameterItems(rootInstanceId, projection = {}) {
    if (projection?.rod?.instanceId !== rootInstanceId) return [];
    const candidates = [
      projection.reel,
      projection.line,
      projection.leader,
      projection.feederRig,
      ...(projection.hooks || []),
      ...(projection.baits || []),
      projection.feederChum,
      projection.float,
    ];
    const unique = new Map();
    for (const item of candidates) {
      const view = this.#createProjectedItemView(item);
      if (!view?.instanceId || view.instanceId === rootInstanceId) continue;
      if (!unique.has(view.instanceId)) unique.set(view.instanceId, view);
    }
    return [...unique.values()];
  }

  #createSavedLoadoutPreview(loadoutId) {
    const loadout = this.#loadouts.get(loadoutId);
    if (!loadout) {
      return {
        loadoutId: "",
        name: "Збірка",
        slots: [],
        canEquipAll: false,
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
    const nextEquipment = new EquipmentState({ ...this.#equipmentState.snapshot(), ...loadout.getRootInstanceIds() });
    const validation = slots.map((slot) => this.#compatibilityPolicy.validate({
      slotId: slot.slotId, item: slot.item, rod, equipmentState: nextEquipment, enforceReadiness: false,
    })).find((result) => !result.isValid);
    const readiness = this.#validateActivationReadinessForLoadout(nextEquipment.snapshot());
    return {
      loadoutId: loadout.loadoutId,
      name: loadout.name,
      slots,
      card: this.#itemViews.createLoadout(loadout),
      canEquipAll: hasContents && !validation && readiness.isValid !== false,
      equipWarning: !hasContents ? "Збірка порожня." : validation?.reason || readiness.warning || "",
    };
  }

  #validateActivationReadinessForLoadout(snapshot) {
    return this.#equipmentLineReadinessPolicy?.validate?.(snapshot) || { isValid: true };
  }

  #createInventory(uiState, accessibleRawItems, rod, context = {}) {
    const contextFiltered = ["assembly", "consumable"].includes(context.mode);
    const itemViews = this.#createItemViews(accessibleRawItems);
    const compatibleInstanceIds = contextFiltered
      ? new Set(itemViews.map((item) => item.instanceId))
      : new Set(
          this.#contextItemFilter
            .filter(accessibleRawItems, { mode: "equipment-compatible" })
            .map((item) => item.instanceId),
        );
    const categories = contextFiltered
      ? InventoryViewModelFactory.#categories.filter(
          (category) =>
            category.id === "all" ||
            category.id === "compatible" ||
            itemViews.some((item) => this.#matchesCategory(item, category.id)),
        )
      : InventoryViewModelFactory.#categories;
    const availableCategoryIds = new Set(
      categories.map((category) => category.id),
    );
    const requestedCategoryId = uiState.activeCategoryId || "all";
    const categoryId = availableCategoryIds.has(requestedCategoryId)
      ? requestedCategoryId
      : "all";
    const highlightedSlotId = uiState.highlightedEquipmentSlotId || null;
    const pickedTarget = contextFiltered && uiState.pickedSocketId
      ? this.#attachmentTargetResolver.listTargets(context.rootInstanceId)
          .find((target) => target.socketId === uiState.pickedSocketId) || null
      : null;
    const pickedSocketInstanceIds = new Set(pickedTarget
      ? accessibleRawItems.filter((item) => this.#attachmentTargetResolver.accepts(pickedTarget, item))
          .map((item) => item.instanceId)
      : []);
    const isTargetPick = Boolean(highlightedSlotId || pickedTarget);
    const matchesPick = item => pickedTarget
      ? pickedSocketInstanceIds.has(item.instanceId)
      : Boolean(highlightedSlotId) && this.#compatibilityPolicy.isCompatible({
          slotId: highlightedSlotId, item, equipmentState: this.#equipmentState, rod, enforceReadiness: false,
        });
    const categoryItems = itemViews
      .filter((item) =>
        categoryId === "compatible"
          ? isTargetPick ? matchesPick(item) : compatibleInstanceIds.has(item.instanceId)
          : this.#matchesCategory(item, categoryId),
      )
      .map((item) => ({
        ...item,
        compatibleWithHighlightedSlot: matchesPick(item),
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
    const subfilteredItems = activeSubfilterIds.size
      ? categoryItems.filter((item) => {
          const group = this.#subfilterResolver.resolve(item, { categoryId });
          return group && activeSubfilterIds.has(group.id);
        })
      : categoryItems;
    const sortOptions = {
      criterionIds: uiState.sortCriterionIds,
      directionId: uiState.sortDirectionId,
      activeRarityIds: uiState.activeRarityFilterIds,
      placementOrderKey: uiState.placementOrderKey,
    };
    const items = this.#itemOrderResolver.resolve(
      subfilteredItems,
      sortOptions,
    );
    return {
      categories,
      activeCategoryId: categoryId,
      subfilters: [...subfilterGroups.values()].sort((left, right) =>
        left.label.localeCompare(right.label, "uk-UA"),
      ),
      activeSubfilterIds: [...activeSubfilterIds],
      sort: this.#itemOrderResolver.createControls(
        subfilteredItems,
        sortOptions,
      ),
      items,
      selectedInstanceId: uiState.selectedInstanceId || "",
      highlightedSlotId: highlightedSlotId || "",
      emptyMessage: contextFiltered
        ? "В інвентарі немає сумісних компонентів для цієї збірки."
        : categoryId === "compatible"
          ? "Немає доступних предметів, сумісних із поточним спорядженням."
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
    if (categoryId === "compatible") return false;
    const itemType = item?.itemType;
    if (categoryId === "loadouts") return itemType === "equipment_loadout";
    if (categoryId === "rods") return itemType === "rod";
    if (categoryId === "reels") return itemType === "reel";
    if (categoryId === "lines") {
      return ["fishing_line", "leader_line"].includes(itemType);
    }
    if (categoryId === "tackle") {
      return ["hook", "feeder_rig", "lure", "float"].includes(itemType);
    }
    if (categoryId === "baits") {
      return ["bait", "fishing_bait"].includes(itemType);
    }
    if (categoryId === "chums") {
      return ["chum_mix", "groundbait", "aquarium_feed"].includes(itemType);
    }
    if (categoryId === "boats") {
      return ["boat", "chum_delivery"].includes(itemType);
    }
    if (categoryId === "nets") return itemType === "net";
    return itemType === "gas_mask" || itemType === "backpack" || itemType === "battery" || itemType === "radio";
  }

  #itemType(item) {
    return item?.itemType ?? null;
  }

  #variant(item) {
    return item?.variant ?? null;
  }

  #createProjectedItemView(item) {
    if (!item) return null;
    const instanceId = item.instanceId;
    if (!instanceId) return item;
    return this.#itemViews.create(instanceId) || item;
  }

  #createTooltipContext(equipmentReadModel) {
    const equipment = Object.freeze({
      rod: this.#createProjectedItemView(equipmentReadModel.rod),
      reel: this.#createProjectedItemView(equipmentReadModel.reel),
      line: this.#createProjectedItemView(equipmentReadModel.line),
      leader: this.#createProjectedItemView(equipmentReadModel.leader),
      float: this.#createProjectedItemView(equipmentReadModel.float),
      tackle: this.#createProjectedItemView(equipmentReadModel.feederRig),
      hooks: Object.freeze(
        (equipmentReadModel.hooks || [])
          .map((item) => this.#createProjectedItemView(item))
          .filter(Boolean),
      ),
    });
    const projectedItems = [
      equipment.rod,
      equipment.reel,
      equipment.line,
      equipment.leader,
      equipment.float,
      equipment.tackle,
      ...equipment.hooks,
    ].filter(Boolean);
    const capabilities = new Set();
    for (const item of projectedItems) {
      const authored = item.capabilities;
      if (!Array.isArray(authored)) continue;
      authored.forEach((capability) => capabilities.add(capability));
    }
    const rod = equipment.rod || null;
    const rodType = this.#variant(rod);
    const hasReel = rod
      ? Boolean(rod.effectiveStats?.hasReel ?? rodType !== "pole")
      : null;
    return {
      rodType,
      rodHasReel: hasReel,
      availableCapabilities: [...capabilities],
      equipment,
    };
  }

  #equipmentLabel(slotId, rod, item) {
    if (slotId === "terminalLine") {
      return this.#terminalLineLabelResolver.resolve(rod);
    }
    if (slotId === "tackle" && item) return item.name || "Снасть";
    return EQUIPMENT_SLOT_PRESENTATION[slotId]?.label || slotId;
  }

  #socketLabel({ slotId, slotIndex, capacity, parentContext = null }) {
    const labels = {
      line: "Ліска",
      hook: "Гачок",
      bait: "Наживка",
      chum: "Прикормка",
      cargo: "Бункер",
      battery: "Батарейка",
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
