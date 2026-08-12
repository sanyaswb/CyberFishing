class InventoryV2ApplicationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "InventoryV2ApplicationError";
    this.code = code;
    this.details = details;
  }
}

class InventoryV2CommandService {
  #repository;
  #assemblyStates;
  #profileRegistry;
  #assemblyReader;
  #attachmentTargetResolver;
  #assemblyService;
  #equipmentState;
  #loadouts;
  #transaction;
  #compatibilityPolicy;
  #rodChangePlanner;
  #loadoutService;
  #settings;
  #refillMemory;
  #signaturePolicy;
  #autoRefillCoordinator;
  #hydrator;
  #instanceIdFactory;
  #lineAllocationService;
  #equipmentLineReadinessPolicy;
  #stackingPolicy;
  #reservationPolicy;
  #sortConfig;
  #fallbackSequence = 0;
  #uiState = {
    isOpen: false,
    activeCategoryId: "all",
    activeSubfilterIds: [],
    sortCriterionIds: [],
    sortDirectionId: null,
    activeRarityFilterIds: [],
    placementOrderKey: null,
    selectedInstanceId: null,
    highlightedEquipmentSlotId: null,
    panelMode: "loadout",
    editingRootInstanceId: null,
    viewingLoadoutId: null,
  };

  constructor({
    repository,
    assemblyStates,
    profileRegistry,
    assemblyReader,
    attachmentTargetResolver,
    assemblyService,
    equipmentState,
    loadouts,
    transaction,
    compatibilityPolicy,
    rodChangePlanner,
    loadoutService,
    settings,
    refillMemory,
    signaturePolicy,
    autoRefillCoordinator,
    hydrator,
    lineAllocationService,
    equipmentLineReadinessPolicy = null,
    stackingPolicy = null,
    reservationPolicy = null,
    instanceIdFactory = null,
    sortConfig = typeof INVENTORY_V2_SORT_CONFIG !== "undefined"
      ? INVENTORY_V2_SORT_CONFIG
      : null,
  } = {}) {
    this.#repository = repository;
    this.#assemblyStates = assemblyStates;
    this.#profileRegistry = profileRegistry;
    this.#assemblyReader = assemblyReader;
    this.#attachmentTargetResolver = attachmentTargetResolver;
    this.#assemblyService = assemblyService;
    this.#equipmentState = equipmentState;
    this.#loadouts = loadouts;
    this.#transaction = transaction;
    this.#compatibilityPolicy = compatibilityPolicy;
    this.#rodChangePlanner = rodChangePlanner;
    this.#loadoutService = loadoutService;
    this.#settings = settings;
    this.#refillMemory = refillMemory;
    this.#signaturePolicy = signaturePolicy;
    this.#autoRefillCoordinator = autoRefillCoordinator;
    this.#hydrator = hydrator;
    this.#lineAllocationService = lineAllocationService;
    this.#equipmentLineReadinessPolicy = equipmentLineReadinessPolicy;
    this.#stackingPolicy =
      stackingPolicy || new ItemAssemblyStackingPolicy();
    this.#reservationPolicy = reservationPolicy;
    this.#instanceIdFactory = instanceIdFactory;
    this.#sortConfig = sortConfig;
    this.#uiState.sortCriterionIds = [
      ...(sortConfig?.defaults?.criterionIds || []),
    ];
    this.#uiState.sortDirectionId = sortConfig?.defaults?.directionId || null;
    this.#assertDependencies();
  }

  getUiState() {
    return Object.freeze({
      ...this.#uiState,
      activeSubfilterIds: Object.freeze([
        ...this.#uiState.activeSubfilterIds,
      ]),
      sortCriterionIds: Object.freeze([
        ...this.#uiState.sortCriterionIds,
      ]),
      activeRarityFilterIds: Object.freeze([
        ...this.#uiState.activeRarityFilterIds,
      ]),
    });
  }

  dispatch(action = {}) {
    try {
      return this.#dispatch(action);
    } catch (error) {
      return this.#failure(error?.message || "Не вдалося виконати дію.", error);
    }
  }

  consumeItem(instanceId, amount = 1) {
    try {
      const consumed = this.#transaction.runAtomic(() =>
        this.#consumeItemWithinTransaction(instanceId, amount),
      );
      return consumed
        ? this.#success({ consumed: true })
        : this.#failure("Предмет не знайдено або його кількості недостатньо.");
    } catch (error) {
      return this.#failure(error.message, error);
    }
  }

  consumeEquipped(slotPath, amount = 1, unequipAfterConsume = true) {
    try {
      const consumed = this.#transaction.runAtomic(() => {
        const target = this.#resolveLegacyEquippedTarget(slotPath);
        if (!target?.item?.instanceId) return false;
        const success = this.#consumeItemWithinTransaction(
          target.item.instanceId,
          amount,
        );
        if (success && unequipAfterConsume && this.#repository.has(target.item.instanceId)) {
          this.#clearEquipmentRootReference(target.rootInstanceId);
        }
        return success;
      });
      return consumed
        ? this.#success({ consumed: true })
        : this.#failure("У вказаній комірці немає предмета для витрати.");
    } catch (error) {
      return this.#failure(error.message, error);
    }
  }

  breakEquippedLine(lossMeters) {
    const loss = Math.max(0, Number(lossMeters) || 0);
    try {
      const result = this.#transaction.runAtomic(() => {
        const target = this.#resolveLegacyEquippedTarget("line");
        if (!target?.item?.instanceId) return null;
        const breakResult = this.#lineAllocationService.break(
          target.item.instanceId,
          loss,
        );
        if (breakResult.success && breakResult.depleted) {
          this.#clearEquipmentRootReference(target.item.instanceId);
        }
        return breakResult;
      });
      return result?.success
        ? this.#success({ broken: true, breakResult: result })
        : this.#failure("Спорядженої ліски немає.");
    } catch (error) {
      return this.#failure(error.message, error);
    }
  }

  rodRetrieved(context = {}) {
    return this.#runAutoRefill(AutoRefillTrigger.ROD_RETRIEVED, context);
  }

  handChumUsed(context = {}) {
    return this.#runAutoRefill(AutoRefillTrigger.HAND_CHUM_USED, context);
  }

  boatReturned(context = {}) {
    return this.#runAutoRefill(AutoRefillTrigger.BOAT_RETURNED, context);
  }

  #dispatch(action) {
    switch (action.type) {
      case InventoryV2ActionType.OPEN:
        this.#uiState.isOpen = true;
        this.#uiState.highlightedEquipmentSlotId = null;
        return this.#success();
      case InventoryV2ActionType.CLOSE:
        this.#uiState.isOpen = false;
        this.#uiState.highlightedEquipmentSlotId = null;
        this.#clearPlacementOrder();
        return this.#success();
      case InventoryV2ActionType.CATEGORY_SELECT:
        this.#uiState.activeCategoryId = action.categoryId || "all";
        this.#uiState.activeSubfilterIds = [];
        this.#uiState.selectedInstanceId = null;
        this.#uiState.highlightedEquipmentSlotId = null;
        this.#clearPlacementOrder();
        return this.#success();
      case InventoryV2ActionType.SUBFILTER_TOGGLE:
        return this.#toggleSubfilter(action.filterId, action.enabled);
      case InventoryV2ActionType.SORT_CRITERION_SELECT:
        return this.#selectSortCriterion(action.criterionId);
      case InventoryV2ActionType.SORT_DIRECTION_SELECT:
        return this.#selectSortDirection(action.directionId);
      case InventoryV2ActionType.RARITY_FILTER_TOGGLE:
        return this.#toggleRarityFilter(action.rarityId, action.enabled);
      case InventoryV2ActionType.INVENTORY_ITEM_ACTIVATE:
        return this.#activateInventoryItem(action.instanceId);
      case InventoryV2ActionType.INVENTORY_ITEM_LONG_PRESS:
        return this.#longPressInventoryItem(action.instanceId);
      case InventoryV2ActionType.EQUIPMENT_SLOT_ACTIVATE:
        return this.#activateEquipmentSlot(action.slotId);
      case InventoryV2ActionType.EQUIPMENT_SLOT_LONG_PRESS:
        return this.#unequipSlot(action.slotId);
      case InventoryV2ActionType.ASSEMBLY_SOCKET_ACTIVATE:
        return this.#activateAssemblySocket(action);
      case InventoryV2ActionType.ASSEMBLY_EQUIP:
        return this.#equipAssembly(action.rootInstanceId);
      case InventoryV2ActionType.ASSEMBLY_UNEQUIP:
        return this.#unequipAssembly(action.rootInstanceId);
      case InventoryV2ActionType.ASSEMBLY_DISASSEMBLE:
        return this.#disassembleAssembly(action.rootInstanceId);
      case InventoryV2ActionType.ASSEMBLY_BACK:
        this.#showLoadoutPanel();
        return this.#success();
      case InventoryV2ActionType.LOADOUT_SAVE:
        return this.#saveLoadout(action.name);
      case InventoryV2ActionType.LOADOUT_PREVIEW_SLOT_EQUIP:
        return this.#equipLoadoutSlot(action.loadoutId, action.slotId);
      case InventoryV2ActionType.LOADOUT_EQUIP_ALL:
        return this.#equipLoadout(action.loadoutId);
      case InventoryV2ActionType.LOADOUT_DISASSEMBLE:
        return this.#disassembleLoadout(action.loadoutId);
      case InventoryV2ActionType.LOADOUT_PREVIEW_BACK:
        this.#showLoadoutPanel();
        return this.#success({ loadoutId: action.loadoutId });
      case InventoryV2ActionType.AUTO_BAIT_CHANGE:
        return this.#changeSetting("autoBait", action.enabled);
      case InventoryV2ActionType.AUTO_CHUM_CHANGE:
        return this.#changeSetting("autoChum", action.enabled);
      default:
        return this.#failure(`Невідома дія інвентарю: ${action.type || "—"}`);
    }
  }

  #activateInventoryItem(instanceId) {
    if (this.#loadouts.has(instanceId)) {
      this.#showSavedLoadoutPreview(instanceId);
      return this.#success({ loadoutId: instanceId });
    }

    const source = this.#repository.get(instanceId);
    if (!source) return this.#failure("Предмет не знайдено.");
    if (
      this.#uiState.panelMode === "assembly" &&
      this.#assemblyStates.has(this.#uiState.editingRootInstanceId)
    ) {
      const rootInstanceId = this.#uiState.editingRootInstanceId;
      const targets = this.#findAssemblyTargets(rootInstanceId, source);
      if (targets.length === 1) {
        return this.#fillAssemblyTarget(rootInstanceId, source, targets[0]);
      }
      if (
        targets.length > 1 &&
        this.#uiState.selectedInstanceId === source.instanceId
      ) {
        return this.#fillAssemblyTarget(rootInstanceId, source, targets[0]);
      }
      if (targets.length > 1) {
        this.#uiState.selectedInstanceId = source.instanceId;
        this.#uiState.placementOrderKey = targets.some(
          (target) => !target.occupied,
        )
          ? this.#placementOrderKey(rootInstanceId, source.instanceId)
          : null;
        return this.#success({ requiresSocketChoice: true });
      }
      this.#uiState.selectedInstanceId = null;
      return this.#failure(
        "Предмет не підходить до доступних комірок цієї збірки.",
      );
    }

    const highlightedSlotId = this.#uiState.highlightedEquipmentSlotId;
    if (
      highlightedSlotId &&
      this.#validateEquipment(highlightedSlotId, source).isValid
    ) {
      const highlightedAssemblyState = this.#assemblyStates.get(source.instanceId);
      if (
        highlightedAssemblyState &&
        this.#hasEmptyAssemblySockets(source.instanceId)
      ) {
        this.#showAssemblyEditor(source.instanceId);
        return this.#success({ rootInstanceId: source.instanceId });
      }
      if (
        highlightedAssemblyState &&
        this.#validateActivationReadiness(
          highlightedSlotId,
          source.instanceId,
        ).isValid === false
      ) {
        this.#showAssemblyEditor(source.instanceId);
        return this.#success({ rootInstanceId: source.instanceId });
      }
      if (highlightedAssemblyState?.isPrepared) {
        return this.#equipPreparedRoot(source.instanceId, highlightedSlotId);
      }
      if (highlightedAssemblyState) {
        return this.#equipAssembly(source.instanceId);
      }
      if (this.#isAssemblyCapable(source)) {
        const rootInstanceId = this.#transaction.runAtomic(() =>
          this.#assemblyService.startAssembly(source.instanceId),
        );
        this.#showAssemblyEditor(rootInstanceId);
        return this.#success({ rootInstanceId });
      }
      return this.#equipLooseRoot(source.instanceId, highlightedSlotId);
    }

    const assemblyState = this.#assemblyStates.get(source.instanceId);
    if (assemblyState) {
      const slotId = this.#findEquipmentSlot(source);
      const activation = slotId
        ? this.#validateActivationReadiness(slotId, source.instanceId)
        : { isValid: false };
      if (
        this.#hasEmptyAssemblySockets(source.instanceId) ||
        !slotId ||
        activation.isValid === false
      ) {
        this.#showAssemblyEditor(source.instanceId);
        return this.#success({ rootInstanceId: source.instanceId });
      }
      return assemblyState.isPrepared
        ? this.#equipPreparedRoot(source.instanceId, slotId)
        : this.#equipAssembly(source.instanceId);
    }

    if (this.#isAssemblyCapable(source)) {
      const rootInstanceId = this.#transaction.runAtomic(() =>
        this.#assemblyService.startAssembly(source.instanceId),
      );
      this.#showAssemblyEditor(rootInstanceId);
      return this.#success({ rootInstanceId });
    }

    const slotId = this.#findEquipmentSlot(source);
    if (!slotId) {
      this.#showAssemblyEditor(source.instanceId);
      return this.#success({ rootInstanceId: source.instanceId });
    }
    return this.#equipLooseRoot(source.instanceId, slotId);
  }

  #longPressInventoryItem(instanceId) {
    if (this.#loadouts.has(instanceId)) {
      return this.#disassembleLoadout(instanceId);
    }
    if (!this.#assemblyStates.has(instanceId)) {
      return this.#failure("Цей предмет не є складеним стеком.");
    }
    return this.#disassembleAssembly(instanceId);
  }

  #activateEquipmentSlot(slotId) {
    const equippedId = this.#equipmentState.getRootInstanceId(slotId);
    if (equippedId) {
      this.#uiState.highlightedEquipmentSlotId = null;
      this.#showAssemblyEditor(equippedId);
      return this.#success({ rootInstanceId: equippedId });
    }

    const selectedId = this.#uiState.selectedInstanceId;
    if (!selectedId || !this.#repository.has(selectedId)) {
      this.#uiState.highlightedEquipmentSlotId =
        this.#uiState.highlightedEquipmentSlotId === slotId ? null : slotId;
      return this.#success({ highlightedSlotId: this.#uiState.highlightedEquipmentSlotId });
    }
    return this.#equipLooseRoot(selectedId, slotId);
  }

  #unequipSlot(slotId) {
    const currentId = this.#equipmentState.getRootInstanceId(slotId);
    if (!currentId) return this.#failure("Комірка вже порожня.");
    let unequippedInstanceId = currentId;
    this.#transaction.runAtomic(() => {
      if (slotId === "rod") {
        const plan = this.#rodChangePlanner.plan({
          equipmentState: this.#equipmentState,
          nextRodInstanceId: null,
        });
        this.#assertAllowedPlan(plan);
        this.#equipmentState.restore(plan.after);
        const settledRoots = this.#settleUnequippedRootsAfterPlan(plan);
        unequippedInstanceId = settledRoots.get(currentId) || currentId;
      } else {
        this.#equipmentState.clear(slotId);
        unequippedInstanceId =
          this.#settleUnequippedRoot(currentId, slotId) || currentId;
      }
    });
    this.#uiState.selectedInstanceId = null;
    this.#uiState.highlightedEquipmentSlotId = null;
    return this.#success({ unequippedInstanceId });
  }

  #activateAssemblySocket(action) {
    const rootInstanceId = action.rootInstanceId || this.#uiState.editingRootInstanceId;
    if (!rootInstanceId || !this.#assemblyStates.has(rootInstanceId)) {
      return this.#failure("Збірку не знайдено.");
    }
    const parentInstanceId = action.parentInstanceId || rootInstanceId;
    const slotIndex = Number(action.slotIndex) || 0;
    const occupied = this.#assemblyReader.getChild(
      parentInstanceId,
      action.slotId,
      slotIndex,
    );
    const selectedId = this.#uiState.selectedInstanceId;
    if (selectedId && this.#repository.has(selectedId)) {
      return this.#fillAssemblyTarget(
        rootInstanceId,
        this.#repository.require(selectedId),
        {
          parentInstanceId,
          slotId: action.slotId,
          slotIndex,
          occupied,
        },
      );
    }
    if (!occupied) {
      return this.#failure("Спочатку виберіть компонент в інвентарі.");
    }

    this.#transaction.runAtomic(() => {
      const detached = this.#assemblyService.detach({
        rootInstanceId,
        parentInstanceId,
        slotId: action.slotId,
        slotIndex,
      });
      if (action.slotId === "line") {
        this.#lineAllocationService.release(occupied.instanceId);
      }
      return detached;
    });
    return this.#success({ detached: true });
  }

  #equipAssembly(rootInstanceId) {
    const root = this.#repository.require(rootInstanceId);
    const slotId = this.#findEquipmentSlot(root);
    if (!slotId) {
      return this.#failure("Предмет не сумісний з поточним спорядженням або для нього немає доступної комірки.");
    }
    if (!this.#assemblyStates.has(rootInstanceId)) {
      const result = this.#equipLooseRoot(rootInstanceId, slotId);
      if (result.success) this.#showLoadoutPanel();
      return result;
    }
    this.#transaction.runAtomic(() => {
      this.#assemblyService.prepare(rootInstanceId);
      this.#equipRootWithinTransaction(rootInstanceId, slotId);
    });
    this.#showLoadoutPanel();
    return this.#equipmentSuccess({ equippedInstanceId: rootInstanceId, slotId });
  }

  #equipPreparedRoot(rootInstanceId, preferredSlotId = null) {
    const root = this.#repository.require(rootInstanceId);
    const slotId = preferredSlotId || this.#findEquipmentSlot(root);
    if (
      preferredSlotId &&
      !this.#validateEquipment(preferredSlotId, root).isValid
    ) {
      return this.#failure("Збірка не сумісна з обраною коміркою спорядження.");
    }
    if (!slotId) return this.#failure("Збірка не сумісна з поточним спорядженням.");
    this.#transaction.runAtomic(() =>
      this.#equipRootWithinTransaction(rootInstanceId, slotId),
    );
    this.#showLoadoutPanel();
    return this.#equipmentSuccess({ equippedInstanceId: rootInstanceId, slotId });
  }

  #unequipAssembly(rootInstanceId) {
    if (!rootInstanceId) return this.#failure("Збірку не знайдено.");
    const slotId = this.#findActiveSlot(rootInstanceId);
    if (!slotId) return this.#failure("Збірка не споряджена.");
    const result = this.#unequipSlot(slotId);
    if (result.success) this.#showLoadoutPanel();
    return result;
  }

  #disassembleAssembly(rootInstanceId) {
    if (!this.#assemblyStates.has(rootInstanceId)) {
      return this.#failure("Збірку не знайдено.");
    }
    if (this.#findActiveSlot(rootInstanceId)) {
      return this.#failure(
        "Спочатку зніміть предмет. Розібрати його можна лише в інвентарі.",
      );
    }
    const result = this.#transaction.runAtomic(() => {
      this.#releaseRootFromLoadout(rootInstanceId);
      const releasedLineIds = this.#collectAssemblyLineIds(rootInstanceId);
      const disassembled = this.#assemblyService.disassemble(rootInstanceId);
      for (const lineInstanceId of releasedLineIds) {
        if (this.#repository.has(lineInstanceId)) {
          this.#lineAllocationService.release(lineInstanceId);
        }
      }
      return disassembled;
    });
    this.#showLoadoutPanel();
    return this.#success({
      disassembled: true,
      result,
    });
  }

  #saveLoadout(name) {
    const normalizedName = String(name || "").trim().slice(0, 40);
    if (!normalizedName) return this.#failure("Введіть назву комплекту.");
    const result = this.#loadoutService.createFromEquipment({
      loadoutId: this.#nextId("loadout"),
      name: normalizedName,
      equipmentState: this.#equipmentState,
    });
    return result.success
      ? this.#success({ loadoutId: result.loadout.loadoutId })
      : this.#failure(result.warning);
  }

  #equipLoadout(loadoutId) {
    if (!this.#loadouts.has(loadoutId)) {
      return this.#failure("Збережену збірку не знайдено.");
    }
    const result = this.#loadoutService.equip({
      loadout: this.#loadouts.require(loadoutId),
      equipmentState: this.#equipmentState,
    });
    if (!result.success) return this.#failure(result.warning);
    this.#showLoadoutPanel();
    return this.#equipmentSuccess({ loadoutId, equippedAll: true });
  }

  #equipLoadoutSlot(loadoutId, slotId) {
    if (!this.#loadouts.has(loadoutId)) {
      return this.#failure("Збережену збірку не знайдено.");
    }
    if (!EQUIPMENT_MAIN_SLOT_IDS.includes(slotId)) {
      return this.#failure("Ця комірка не належить до основної збірки.");
    }
    const rootInstanceId = this.#loadouts
      .require(loadoutId)
      .getRootInstanceId(slotId);
    if (!rootInstanceId || !this.#repository.has(rootInstanceId)) {
      return this.#failure("У цій комірці збірки немає предмета.");
    }
    if (this.#equipmentState.getRootInstanceId(slotId) === rootInstanceId) {
      return this.#success({
        loadoutId,
        slotId,
        equippedInstanceId: rootInstanceId,
        alreadyEquipped: true,
      });
    }

    this.#transaction.runAtomic(() => {
      this.#equipRootWithinTransaction(rootInstanceId, slotId);
    });
    this.#showSavedLoadoutPreview(loadoutId);
    return this.#equipmentSuccess({
      loadoutId,
      slotId,
      equippedInstanceId: rootInstanceId,
    });
  }

  #disassembleLoadout(loadoutId) {
    if (!this.#loadouts.has(loadoutId)) {
      return this.#failure("Збережену збірку не знайдено.");
    }
    const result = this.#loadoutService.disassemble({
      loadout: this.#loadouts.require(loadoutId),
      equipmentState: this.#equipmentState,
    });
    if (!result.success) return this.#failure(result.warning);
    if (this.#uiState.viewingLoadoutId === loadoutId) {
      this.#showLoadoutPanel();
    }
    return this.#success({ loadoutId, disassembled: true });
  }

  #changeSetting(setting, enabled) {
    this.#transaction.runAtomic(() => {
      if (setting === "autoBait") this.#settings.setAutoBait(enabled === true);
      else this.#settings.setAutoChum(enabled === true);
    });
    return this.#success({ setting, enabled: enabled === true });
  }

  #toggleSubfilter(filterId, enabled) {
    const selected = new Set(this.#uiState.activeSubfilterIds);
    if (enabled === true) selected.add(filterId);
    else selected.delete(filterId);
    this.#uiState.activeSubfilterIds = [...selected];
    this.#uiState.selectedInstanceId = null;
    this.#uiState.highlightedEquipmentSlotId = null;
    this.#clearPlacementOrder();
    return this.#success({ activeSubfilterIds: [...selected] });
  }

  #selectSortCriterion(criterionId) {
    const candidate = String(criterionId || "");
    const available = this.#sortConfig.criteria.some(
      (criterion) => criterion.id === candidate,
    );
    if (!available) return this.#failure("Невідомий критерій сортування.");
    const selected = this.#uiState.sortCriterionIds;
    this.#uiState.sortCriterionIds = selected.includes(candidate)
      ? selected.filter((id) => id !== candidate)
      : [...selected, candidate];
    return this.#success({
      sortCriterionIds: [...this.#uiState.sortCriterionIds],
    });
  }

  #selectSortDirection(directionId) {
    const candidate = String(directionId || "");
    const available = this.#sortConfig.directions.some(
      (direction) => direction.id === candidate,
    );
    if (!available) return this.#failure("Невідомий напрямок сортування.");
    this.#uiState.sortDirectionId = candidate;
    return this.#success({ sortDirectionId: candidate });
  }

  #toggleRarityFilter(rarityId, enabled) {
    const candidate = String(rarityId || "");
    const available = Object.hasOwn(
      this.#sortConfig.rarityLabels,
      candidate,
    );
    if (!available) return this.#failure("Невідома рідкість предмета.");
    const selected = new Set(this.#uiState.activeRarityFilterIds);
    if (enabled === true) selected.add(candidate);
    else selected.delete(candidate);
    this.#uiState.activeRarityFilterIds = [...selected];
    return this.#success({ activeRarityFilterIds: [...selected] });
  }

  #equipLooseRoot(instanceId, slotId) {
    let equippedInstanceId = null;
    this.#transaction.runAtomic(() => {
      const source = this.#repository.require(instanceId);
      const validation = this.#validateEquipment(slotId, source);
      if (!validation.isValid) {
        throw new InventoryV2ApplicationError(
          validation.warningCode || "INCOMPATIBLE_EQUIPMENT",
          validation.reason || "Предмет несумісний.",
        );
      }
      const preparedLine = this.#prepareLooseLineForEquipment(source, slotId);
      const root = preparedLine || this.#repository.splitOne(source.instanceId);
      equippedInstanceId = root.instanceId;
      this.#equipRootWithinTransaction(root.instanceId, slotId);
    });
    this.#uiState.selectedInstanceId = null;
    this.#uiState.highlightedEquipmentSlotId = null;
    return this.#equipmentSuccess({ equippedInstanceId, slotId });
  }

  #equipRootWithinTransaction(instanceId, slotId) {
    const item = this.#repository.require(instanceId);
    const validation = this.#validateEquipment(slotId, item);
    if (!validation.isValid) {
      throw new InventoryV2ApplicationError(
        validation.warningCode || "INCOMPATIBLE_EQUIPMENT",
        validation.reason || "Предмет несумісний.",
      );
    }
    if (slotId === "rod") {
      const plan = this.#rodChangePlanner.plan({
        equipmentState: this.#equipmentState,
        nextRodInstanceId: instanceId,
      });
      this.#assertAllowedPlan(plan);
      this.#equipmentState.restore(plan.after);
      this.#settleUnequippedRootsAfterPlan(plan);
    } else {
      const previousRootId = this.#equipmentState.getRootInstanceId(slotId);
      if (slotId === "reel") {
        this.#assertEquipmentLineReady({
          ...this.#equipmentState.snapshot(),
          reel: instanceId,
        });
      }
      this.#equipmentState.setRootInstanceId(slotId, instanceId);
      if (previousRootId && previousRootId !== instanceId) {
        this.#settleUnequippedRoot(previousRootId, slotId);
      }
    }
    if (slotId === "handChum") {
      this.#refillMemory.remember(
        "handChum",
        this.#signaturePolicy.create(item),
      );
    }
  }

  #validateEquipment(slotId, rawItem) {
    const item = this.#hydrate(rawItem);
    const rod = this.#hydrate(
      this.#repository.get(this.#equipmentState.getRootInstanceId("rod")),
    );
    return this.#compatibilityPolicy.validate({
      slotId,
      item,
      equipmentState: this.#equipmentState,
      rod,
    });
  }

  #findEquipmentSlot(rawItem) {
    for (const slotId of EQUIPMENT_ALL_SLOT_IDS) {
      if (this.#validateEquipment(slotId, rawItem).isValid) return slotId;
    }
    return null;
  }

  #findAssemblyTargets(rootInstanceId, source) {
    return this.#attachmentTargetResolver.findPlacementTargets(
      rootInstanceId,
      source,
    );
  }

  #hasEmptyAssemblySockets(rootInstanceId) {
    return this.#attachmentTargetResolver
      .listTargets(rootInstanceId)
      .some((target) => !target.occupied);
  }

  #validateActivationReadiness(slotId, instanceId) {
    if (!this.#equipmentLineReadinessPolicy?.validate) {
      return { isValid: true };
    }
    return this.#equipmentLineReadinessPolicy.validate({
      ...this.#equipmentState.snapshot(),
      [slotId]: instanceId,
    });
  }

  #fillAssemblyTarget(rootInstanceId, source, target) {
    if (!target) return this.#failure("Комірку не знайдено.");
    this.#transaction.runAtomic(() => {
      const preparedSource = this.#prepareLineForAssemblySocket(source, target);
      const sourceInstanceId = preparedSource?.instanceId || source.instanceId;
      if (target.occupied) {
        this.#assemblyService.replace({
          rootInstanceId,
          parentInstanceId: target.parentInstanceId,
          sourceInstanceId,
          slotId: target.slotId,
          slotIndex: target.slotIndex,
        });
        if (target.slotId === "line") {
          this.#lineAllocationService.release(target.occupied.instanceId);
        }
      } else {
        this.#assemblyService.attach({
          rootInstanceId,
          parentInstanceId: target.parentInstanceId,
          sourceInstanceId,
          slotId: target.slotId,
          slotIndex: target.slotIndex,
        });
      }
    });
    this.#uiState.selectedInstanceId = null;
    this.#settlePlacementOrder(rootInstanceId, source.instanceId);
    return this.#success({ attached: true });
  }

  #settlePlacementOrder(rootInstanceId, sourceInstanceId) {
    const expectedKey = this.#placementOrderKey(
      rootInstanceId,
      sourceInstanceId,
    );
    if (this.#uiState.placementOrderKey !== expectedKey) {
      this.#clearPlacementOrder();
      return;
    }
    const source = this.#repository.get(sourceInstanceId);
    const hasEmptyCompatibleTarget =
      source &&
      InventoryItemLocation.isInventory(source.location) &&
      this.#attachmentTargetResolver
        .findCompatibleTargets(rootInstanceId, source)
        .some((target) => !target.occupied);
    if (!hasEmptyCompatibleTarget) this.#clearPlacementOrder();
  }

  #placementOrderKey(rootInstanceId, sourceInstanceId) {
    return `${String(rootInstanceId || "")}:${String(sourceInstanceId || "")}`;
  }

  #clearPlacementOrder() {
    this.#uiState.placementOrderKey = null;
  }

  #consumeItemWithinTransaction(instanceId, amount) {
    const item = this.#repository.get(instanceId);
    const quantity = Number(item?.quantity || 0);
    const requested = Number(amount);
    if (!item || !Number.isInteger(requested) || requested < 1 || quantity < requested) {
      return false;
    }
    if (quantity > requested) {
      this.#repository.update(instanceId, { quantity: quantity - requested });
      return true;
    }

    if (InventoryItemLocation.isAttached(item.location)) {
      if (this.#repository.getChildren(item.instanceId).length === 0) {
        const rootInstanceId = this.#assemblyReader.getRootInstanceId(
          item.instanceId,
        );
        this.#assemblyService.consume({
          rootInstanceId,
          parentInstanceId: item.location.parentInstanceId,
          slotId: item.location.slotId,
          slotIndex: item.location.slotIndex,
        });
        return true;
      }
      const rootInstanceId = this.#assemblyReader.getRootInstanceId(item.instanceId);
      const path = this.#assemblyReader.getPathToItem(rootInstanceId, item.instanceId);
      this.#assemblyService.clearRefillPreference(rootInstanceId, path);
      this.#removeSubtree(item.instanceId);
      return true;
    }

    this.#clearEquipmentRootReference(item.instanceId);
    this.#releaseRootFromLoadout(item.instanceId);
    this.#removeSubtree(item.instanceId);
    return true;
  }

  #removeSubtree(instanceId) {
    const descendants = this.#repository
      .listDescendants(instanceId)
      .sort((left, right) => right.depth - left.depth);
    for (const entry of descendants) {
      if (this.#repository.has(entry.item.instanceId)) {
        this.#repository.remove(entry.item.instanceId);
      }
    }
    if (this.#assemblyStates.has(instanceId)) {
      this.#assemblyStates.remove(instanceId);
    }
    if (this.#repository.has(instanceId)) this.#repository.remove(instanceId);
  }

  #releaseRootFromLoadout(instanceId) {
    const item = this.#repository.get(instanceId);
    if (!InventoryItemLocation.isLoadout(item?.location)) return;
    const location = item.location;
    const loadout = this.#loadouts.require(location.loadoutId);
    const roots = { ...loadout.getRootInstanceIds(), [location.slotId]: null };
    this.#loadouts.remove(loadout.loadoutId);
    if (Object.values(roots).some(Boolean)) {
      this.#loadouts.add(
        new EquipmentLoadout({
          loadoutId: loadout.loadoutId,
          name: loadout.name,
          rootInstanceIds: roots,
          createdAt: loadout.createdAt,
          updatedAt: new Date().toISOString(),
        }),
      );
    }
    this.#repository.setLocation(instanceId, InventoryItemLocation.inventory());
  }

  #prepareLooseLineForEquipment(source, slotId) {
    if (slotId !== "terminalLine" || this.#type(source) !== "fishing_line") {
      return null;
    }
    const rod = this.#hydrate(
      this.#repository.get(this.#equipmentState.getRootInstanceId("rod")),
    );
    const result = this.#lineAllocationService.prepare({
      sourceInstanceId: source.instanceId,
      rod,
      reel: null,
    });
    if (!result.success) {
      throw new InventoryV2ApplicationError(
        "LINE_ALLOCATION_FAILED",
        result.warning || "Не вдалося підготувати ліску.",
        { allocation: result.allocation || null },
      );
    }
    return this.#repository.require(result.instanceId);
  }

  #settleUnequippedRootsAfterPlan(plan) {
    const settledRoots = new Map();
    for (const movement of plan?.movements || []) {
      if (movement.direction !== "to-inventory" || !movement.instanceId) {
        continue;
      }
      settledRoots.set(
        movement.instanceId,
        this.#settleUnequippedRoot(movement.instanceId, movement.slotId) ||
          movement.instanceId,
      );
    }
    return settledRoots;
  }

  #settleUnequippedRoot(instanceId, slotId) {
    const item = this.#repository.get(instanceId);
    if (!item || InventoryItemLocation.isLoadout(item.location)) {
      return instanceId;
    }
    if (slotId === "terminalLine") {
      return this.#releaseLooseLine(instanceId)?.instanceId || instanceId;
    }
    if (
      !InventoryItemLocation.isInventory(item.location) ||
      this.#assemblyStates.has(instanceId)
    ) {
      return instanceId;
    }
    return this.#repository.mergeInventoryItem(
      instanceId,
      this.#stackingPolicy,
      {
        canMerge: (candidate) =>
          !this.#assemblyStates.has(candidate.instanceId) &&
          !this.#reservationPolicy?.isReserved?.(candidate),
      },
    );
  }

  #assertEquipmentLineReady(equipmentSnapshot) {
    if (!this.#equipmentLineReadinessPolicy?.validate) return;
    const readiness = this.#equipmentLineReadinessPolicy.validate(
      equipmentSnapshot,
    );
    if (readiness?.isValid === false) {
      throw new InventoryV2ApplicationError(
        readiness.warningCode || "REEL_LINE_INCOMPATIBLE",
        readiness.warning || "Ліска в котушці несумісна з вудилищем.",
        { readiness },
      );
    }
  }

  #releaseLooseLine(instanceId) {
    const item = this.#repository.get(instanceId);
    if (
      !item ||
      !InventoryItemLocation.isInventory(item.location) ||
      this.#type(item) !== "fishing_line"
    ) {
      return null;
    }
    return this.#lineAllocationService.release(instanceId);
  }

  #prepareLineForAssemblySocket(source, target) {
    if (target.slotId !== "line" || this.#type(source) !== "fishing_line") {
      return null;
    }
    const reel = this.#hydrate(this.#repository.get(target.parentInstanceId));
    const result = this.#lineAllocationService.prepareForReel({
      sourceInstanceId: source.instanceId,
      reel,
    });
    if (!result.success) {
      throw new InventoryV2ApplicationError(
        "LINE_ALLOCATION_FAILED",
        result.warning || "Не вдалося встановити ліску на котушку.",
        { allocation: result.allocation || null },
      );
    }
    return this.#repository.require(result.instanceId);
  }

  #collectAssemblyLineIds(rootInstanceId) {
    return this.#repository
      .listDescendants(rootInstanceId)
      .map((entry) => entry.item)
      .filter((item) => this.#type(item) === "fishing_line")
      .map((item) => item.instanceId);
  }

  #resolveLegacyEquippedTarget(slotPath) {
    const match = /^(hooks|baits|deliveryChums)_(\d+)$/.exec(slotPath || "");
    const index = match ? Number(match[2]) : 0;
    const tackleRootId = this.#equipmentState.getRootInstanceId("tackle");
    const deliveryRootId = this.#equipmentState.getRootInstanceId("delivery");
    const reelRootId = this.#equipmentState.getRootInstanceId("reel");
    const terminalRootId = this.#equipmentState.getRootInstanceId("terminalLine");

    let item = null;
    let rootInstanceId = null;
    if (slotPath === "line") {
      item = reelRootId
        ? this.#assemblyReader.getChild(reelRootId, "line", 0)
        : this.#repository.get(terminalRootId);
      rootInstanceId = reelRootId || terminalRootId;
    } else if (slotPath === "leader") {
      item = this.#repository.get(terminalRootId);
      rootInstanceId = terminalRootId;
    } else if (slotPath === "feederRig") {
      item = this.#repository.get(tackleRootId);
      rootInstanceId = tackleRootId;
    } else if (slotPath === "feederChum") {
      item = this.#assemblyReader.getChild(tackleRootId, "chum", 0);
      rootInstanceId = tackleRootId;
    } else if (match?.[1] === "hooks") {
      const root = this.#repository.get(tackleRootId);
      item = this.#type(root) === "hook" && index === 0
        ? root
        : this.#assemblyReader.getChild(tackleRootId, "hook", index);
      rootInstanceId = tackleRootId;
    } else if (match?.[1] === "baits") {
      const root = this.#repository.get(tackleRootId);
      if (["lure", "spinner", "wobbler", "jig"].includes(this.#type(root))) {
        item = index === 0 ? root : null;
      } else {
        const hook = this.#type(root) === "hook" && index === 0
          ? root
          : this.#assemblyReader.getChild(tackleRootId, "hook", index);
        item = hook
          ? this.#assemblyReader.getChild(hook.instanceId, "bait", 0)
          : null;
      }
      rootInstanceId = tackleRootId;
    } else if (match?.[1] === "deliveryChums") {
      item = this.#assemblyReader.getChild(deliveryRootId, "cargo", index);
      rootInstanceId = deliveryRootId;
    } else {
      const slotMap = {
        rod: "rod",
        reel: "reel",
        float: "float",
        net: "net",
        delivery: "delivery",
        handChum: "handChum",
      };
      const equipmentSlotId = slotMap[slotPath];
      rootInstanceId = equipmentSlotId
        ? this.#equipmentState.getRootInstanceId(equipmentSlotId)
        : null;
      item = this.#repository.get(rootInstanceId);
    }
    return item ? { item, rootInstanceId } : null;
  }

  #runAutoRefill(trigger, context) {
    try {
      const report = this.#transaction.runAtomic(() =>
        this.#autoRefillCoordinator.handle(trigger, context),
      );
      return this.#success({ report, warning: report.warning });
    } catch (error) {
      return this.#failure(error.message, error);
    }
  }

  #clearEquipmentRootReference(instanceId) {
    if (!instanceId) return;
    for (const slotId of this.#equipmentState.getSlotIds()) {
      if (this.#equipmentState.getRootInstanceId(slotId) === instanceId) {
        this.#equipmentState.clear(slotId);
      }
    }
  }

  #findActiveSlot(instanceId) {
    return this.#equipmentState
      .getSlotIds()
      .find(
        (slotId) =>
          this.#equipmentState.getRootInstanceId(slotId) === instanceId,
      ) || null;
  }

  #isAssemblyCapable(rawItem) {
    try {
      return Boolean(this.#profileRegistry.resolveProfileIdForItem(rawItem));
    } catch (_error) {
      return false;
    }
  }

  #hydrate(rawItem) {
    return this.#hydrator.hydrate(rawItem, this.#repository);
  }

  #type(rawItem) {
    return this.#hydrate(rawItem)?.itemType || null;
  }

  #showAssemblyEditor(rootInstanceId) {
    this.#uiState.panelMode = "assembly";
    this.#uiState.editingRootInstanceId = rootInstanceId;
    this.#uiState.viewingLoadoutId = null;
    this.#uiState.selectedInstanceId = null;
    this.#uiState.highlightedEquipmentSlotId = null;
    this.#clearPlacementOrder();
  }

  #showLoadoutPanel() {
    this.#uiState.panelMode = "loadout";
    this.#uiState.editingRootInstanceId = null;
    this.#uiState.viewingLoadoutId = null;
    this.#uiState.selectedInstanceId = null;
    this.#uiState.highlightedEquipmentSlotId = null;
    this.#clearPlacementOrder();
  }

  #showSavedLoadoutPreview(loadoutId) {
    this.#uiState.panelMode = "loadout";
    this.#uiState.editingRootInstanceId = null;
    this.#uiState.viewingLoadoutId = loadoutId;
    this.#uiState.selectedInstanceId = null;
    this.#uiState.highlightedEquipmentSlotId = null;
    this.#clearPlacementOrder();
  }

  #assertAllowedPlan(plan) {
    if (plan?.allowed !== true) {
      throw new InventoryV2ApplicationError(
        "INVENTORY_CAPACITY_EXCEEDED",
        plan?.warning || "Недостатньо місця в інвентарі.",
      );
    }
  }

  #nextId(prefix) {
    if (typeof this.#instanceIdFactory === "function") {
      return String(this.#instanceIdFactory({ prefix }));
    }
    if (typeof this.#instanceIdFactory?.create === "function") {
      return String(this.#instanceIdFactory.create({ prefix }));
    }
    if (globalThis.crypto?.randomUUID) {
      return `${prefix}_${globalThis.crypto.randomUUID()}`;
    }
    this.#fallbackSequence += 1;
    return `${prefix}_${Date.now().toString(36)}_${this.#fallbackSequence}`;
  }

  #success(extra = {}) {
    return Object.freeze({ success: true, warning: null, refresh: true, ...extra });
  }

  #equipmentSuccess(extra = {}) {
    this.#uiState.activeCategoryId = "compatible";
    this.#uiState.activeSubfilterIds = [];
    this.#clearPlacementOrder();
    return this.#success(extra);
  }

  #failure(warning, error = null) {
    return Object.freeze({
      success: false,
      warning: warning || "Не вдалося виконати дію.",
      refresh: true,
      error,
    });
  }

  #assertDependencies() {
    const dependencies = [
      [this.#repository, "repository"],
      [this.#assemblyStates, "assemblyStates"],
      [this.#profileRegistry, "profileRegistry"],
      [this.#assemblyReader, "assemblyReader"],
      [this.#attachmentTargetResolver, "attachmentTargetResolver"],
      [this.#assemblyService, "assemblyService"],
      [this.#equipmentState, "equipmentState"],
      [this.#loadouts, "loadouts"],
      [this.#transaction, "transaction"],
      [this.#compatibilityPolicy, "compatibilityPolicy"],
      [this.#rodChangePlanner, "rodChangePlanner"],
      [this.#loadoutService, "loadoutService"],
      [this.#settings, "settings"],
      [this.#refillMemory, "refillMemory"],
      [this.#signaturePolicy, "signaturePolicy"],
      [this.#autoRefillCoordinator, "autoRefillCoordinator"],
      [this.#hydrator, "hydrator"],
      [this.#lineAllocationService, "lineAllocationService"],
      [this.#equipmentLineReadinessPolicy, "equipmentLineReadinessPolicy"],
      [this.#sortConfig, "sortConfig"],
    ];
    for (const [dependency, name] of dependencies) {
      if (!dependency) throw new TypeError(`InventoryV2CommandService requires ${name}`);
    }
    if (!this.#attachmentTargetResolver.findPlacementTargets) {
      throw new TypeError(
        "InventoryV2CommandService requires attachmentTargetResolver.findPlacementTargets()",
      );
    }
    if (
      !Array.isArray(this.#sortConfig.defaults?.criterionIds) ||
      this.#sortConfig.defaults.criterionIds.length === 0 ||
      !this.#sortConfig.defaults?.directionId ||
      !Array.isArray(this.#sortConfig.criteria) ||
      !Array.isArray(this.#sortConfig.directions) ||
      this.#sortConfig.defaults.criterionIds.some(
        (criterionId) =>
          !this.#sortConfig.criteria.some(
            (criterion) => criterion.id === criterionId,
          ),
      ) ||
      !this.#sortConfig.directions.some(
        (direction) =>
          direction.id === this.#sortConfig.defaults.directionId,
      )
    ) {
      throw new TypeError(
        "InventoryV2CommandService requires valid sortConfig defaults",
      );
    }
  }
}

globalThis.InventoryV2ApplicationError = InventoryV2ApplicationError;
globalThis.InventoryV2CommandService = InventoryV2CommandService;
