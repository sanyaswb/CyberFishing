import { EQUIPMENT_ALL_SLOT_IDS, EQUIPMENT_MAIN_SLOT_IDS } from "../../domain/equipment/equipment_slot_catalog.js";
import { InventoryApplicationError } from "./inventory_application_error.js";
import { InventoryItemLocation } from "../../domain/inventory/inventory_item_location.js";
import { inventoryCommandFailure, inventoryCommandSuccess } from "./inventory_command_result.js";

export class InventoryCommandService {
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
  #hydrator;
  #instanceIdFactory;
  #lineAllocationService;
  #equipmentLineReadinessPolicy;
  #stackingPolicy;
  #reservationPolicy;
  #sortConfig;
  #actionTypes;
  #now;
  #fallbackSequence = 0;
  #uiState;
  #itemRemoval;

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
    hydrator,
    lineAllocationService,
    equipmentLineReadinessPolicy = null,
    stackingPolicy = null,
    reservationPolicy = null,
    instanceIdFactory = null,
    sortConfig,
    actionTypes,
    now = null,
    uiState,
    itemRemoval,
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
    this.#hydrator = hydrator;
    this.#lineAllocationService = lineAllocationService;
    this.#equipmentLineReadinessPolicy = equipmentLineReadinessPolicy;
    this.#stackingPolicy = stackingPolicy;
    this.#reservationPolicy = reservationPolicy;
    this.#instanceIdFactory = instanceIdFactory;
    this.#sortConfig = sortConfig;
    this.#actionTypes = actionTypes;
    this.#now = now;
    this.#uiState = uiState;
    this.#itemRemoval = itemRemoval;
    this.#assertDependencies();
  }

  getUiState() {
    return this.#uiState.snapshot();
  }

  dispatch(action = {}) {
    try {
      return this.#dispatch(action);
    } catch (error) {
      return this.#failure(error?.message || "Не вдалося виконати дію.", error);
    }
  }

  #dispatch(action) {
    // The UI action vocabulary is presentation-owned and injected by the composition root.
    const InventoryActionType = this.#actionTypes;
    switch (action.type) {
      case InventoryActionType.OPEN:
        this.#uiState.open();
        return this.#success();
      case InventoryActionType.CLOSE:
        this.#uiState.close();
        return this.#success();
      case InventoryActionType.CATEGORY_SELECT:
        this.#uiState.selectCategory(action.categoryId);
        return this.#success();
      case InventoryActionType.SUBFILTER_TOGGLE:
        return this.#toggleSubfilter(action.filterId, action.enabled);
      case InventoryActionType.SORT_CRITERION_SELECT:
        return this.#selectSortCriterion(action.criterionId);
      case InventoryActionType.SORT_DIRECTION_SELECT:
        return this.#selectSortDirection(action.directionId);
      case InventoryActionType.RARITY_FILTER_TOGGLE:
        return this.#toggleRarityFilter(action.rarityId, action.enabled);
      case InventoryActionType.INVENTORY_ITEM_ACTIVATE:
        return this.#activateInventoryItem(action.instanceId);
      case InventoryActionType.INVENTORY_ITEM_LONG_PRESS:
        return this.#longPressInventoryItem(action.instanceId);
      case InventoryActionType.EQUIPMENT_SLOT_ACTIVATE:
        return this.#activateEquipmentSlot(action.slotId);
      case InventoryActionType.EQUIPMENT_SLOT_LONG_PRESS:
        return this.#unequipSlot(action.slotId);
      case InventoryActionType.ASSEMBLY_SOCKET_ACTIVATE:
        return this.#activateAssemblySocket(action);
      case InventoryActionType.ASSEMBLY_EQUIP:
        return this.#equipAssembly(action.rootInstanceId);
      case InventoryActionType.ASSEMBLY_UNEQUIP:
        return this.#unequipAssembly(action.rootInstanceId);
      case InventoryActionType.ASSEMBLY_DISASSEMBLE:
        return this.#disassembleAssembly(action.rootInstanceId);
      case InventoryActionType.ASSEMBLY_BACK:
        this.#uiState.showLoadoutPanel();
        return this.#success();
      case InventoryActionType.LOADOUT_SAVE:
        return this.#saveLoadout(action.name);
      case InventoryActionType.LOADOUT_PREVIEW_SLOT_EQUIP:
        return this.#equipLoadoutSlot(action.loadoutId, action.slotId);
      case InventoryActionType.LOADOUT_EQUIP_ALL:
        return this.#equipLoadout(action.loadoutId);
      case InventoryActionType.LOADOUT_DISASSEMBLE:
        return this.#disassembleLoadout(action.loadoutId);
      case InventoryActionType.LOADOUT_PREVIEW_BACK:
        this.#uiState.showLoadoutPanel();
        return this.#success({ loadoutId: action.loadoutId });
      case InventoryActionType.AUTO_BAIT_CHANGE:
        return this.#changeSetting("autoBait", action.enabled);
      case InventoryActionType.AUTO_CHUM_CHANGE:
        return this.#changeSetting("autoChum", action.enabled);
      default:
        return this.#failure(`Невідома дія інвентарю: ${action.type || "—"}`);
    }
  }

  #activateInventoryItem(instanceId) {
    if (this.#loadouts.has(instanceId)) {
      this.#uiState.showSavedLoadoutPreview(instanceId);
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
        this.#uiState.select(source.instanceId);
        this.#uiState.setPlacementOrder(targets.some(
          (target) => !target.occupied,
        )
          ? this.#placementOrderKey(rootInstanceId, source.instanceId)
          : null);
        return this.#success({ requiresSocketChoice: true });
      }
      this.#uiState.clearSelection();
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
        this.#uiState.showAssemblyEditor(source.instanceId);
        return this.#success({ rootInstanceId: source.instanceId });
      }
      if (
        highlightedAssemblyState &&
        this.#validateActivationReadiness(
          highlightedSlotId,
          source.instanceId,
        ).isValid === false
      ) {
        this.#uiState.showAssemblyEditor(source.instanceId);
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
        this.#uiState.showAssemblyEditor(rootInstanceId);
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
        this.#uiState.showAssemblyEditor(source.instanceId);
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
      this.#uiState.showAssemblyEditor(rootInstanceId);
      return this.#success({ rootInstanceId });
    }

    const slotId = this.#findEquipmentSlot(source);
    if (!slotId) {
      this.#uiState.showAssemblyEditor(source.instanceId);
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
      this.#uiState.clearHighlightedSlot();
      this.#uiState.showAssemblyEditor(equippedId);
      return this.#success({ rootInstanceId: equippedId });
    }

    const selectedId = this.#uiState.selectedInstanceId;
    if (!selectedId || !this.#repository.has(selectedId)) {
      return this.#success({ highlightedSlotId: this.#uiState.toggleHighlightedSlot(slotId) });
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
    this.#uiState.clearSelection();
    this.#uiState.clearHighlightedSlot();
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
      if (result.success) this.#uiState.showLoadoutPanel();
      return result;
    }
    this.#transaction.runAtomic(() => {
      this.#assemblyService.prepare(rootInstanceId);
      this.#equipRootWithinTransaction(rootInstanceId, slotId);
    });
    this.#uiState.showLoadoutPanel();
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
    this.#uiState.showLoadoutPanel();
    return this.#equipmentSuccess({ equippedInstanceId: rootInstanceId, slotId });
  }

  #unequipAssembly(rootInstanceId) {
    if (!rootInstanceId) return this.#failure("Збірку не знайдено.");
    const slotId = this.#findActiveSlot(rootInstanceId);
    if (!slotId) return this.#failure("Збірка не споряджена.");
    const result = this.#unequipSlot(slotId);
    if (result.success) this.#uiState.showLoadoutPanel();
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
      this.#itemRemoval.releaseRootFromLoadout(rootInstanceId);
      const releasedLineIds = this.#collectAssemblyLineIds(rootInstanceId);
      const disassembled = this.#assemblyService.disassemble(rootInstanceId);
      for (const lineInstanceId of releasedLineIds) {
        if (this.#repository.has(lineInstanceId)) {
          this.#lineAllocationService.release(lineInstanceId);
        }
      }
      return disassembled;
    });
    this.#uiState.showLoadoutPanel();
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
    this.#uiState.showLoadoutPanel();
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
    this.#uiState.showSavedLoadoutPreview(loadoutId);
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
      this.#uiState.showLoadoutPanel();
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
    const activeSubfilterIds = this.#uiState.toggleSubfilter(filterId, enabled);
    return this.#success({ activeSubfilterIds });
  }

  #selectSortCriterion(criterionId) {
    const candidate = String(criterionId || "");
    const available = this.#sortConfig.criteria.some(
      (criterion) => criterion.id === candidate,
    );
    if (!available) return this.#failure("Невідомий критерій сортування.");
    return this.#success({
      sortCriterionIds: this.#uiState.toggleSortCriterion(candidate),
    });
  }

  #selectSortDirection(directionId) {
    const candidate = String(directionId || "");
    const available = this.#sortConfig.directions.some(
      (direction) => direction.id === candidate,
    );
    if (!available) return this.#failure("Невідомий напрямок сортування.");
    this.#uiState.selectSortDirection(candidate);
    return this.#success({ sortDirectionId: candidate });
  }

  #toggleRarityFilter(rarityId, enabled) {
    const candidate = String(rarityId || "");
    const available = Object.hasOwn(
      this.#sortConfig.rarityLabels,
      candidate,
    );
    if (!available) return this.#failure("Невідома рідкість предмета.");
    const activeRarityFilterIds = this.#uiState.toggleRarityFilter(candidate, enabled);
    return this.#success({ activeRarityFilterIds });
  }

  #equipLooseRoot(instanceId, slotId) {
    let equippedInstanceId = null;
    this.#transaction.runAtomic(() => {
      const source = this.#repository.require(instanceId);
      const validation = this.#validateEquipment(slotId, source);
      if (!validation.isValid) {
        throw new InventoryApplicationError(
          validation.warningCode || "INCOMPATIBLE_EQUIPMENT",
          validation.reason || "Предмет несумісний.",
        );
      }
      const preparedLine = this.#prepareLooseLineForEquipment(source, slotId);
      const root = preparedLine || this.#repository.splitOne(source.instanceId);
      equippedInstanceId = root.instanceId;
      this.#equipRootWithinTransaction(root.instanceId, slotId);
    });
    this.#uiState.clearSelection();
    this.#uiState.clearHighlightedSlot();
    return this.#equipmentSuccess({ equippedInstanceId, slotId });
  }

  #equipRootWithinTransaction(instanceId, slotId) {
    const item = this.#repository.require(instanceId);
    const validation = this.#validateEquipment(slotId, item);
    if (!validation.isValid) {
      throw new InventoryApplicationError(
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
    this.#uiState.clearSelection();
    this.#settlePlacementOrder(rootInstanceId, source.instanceId);
    return this.#success({ attached: true });
  }

  #settlePlacementOrder(rootInstanceId, sourceInstanceId) {
    const expectedKey = this.#placementOrderKey(
      rootInstanceId,
      sourceInstanceId,
    );
    if (this.#uiState.placementOrderKey !== expectedKey) {
      this.#uiState.clearPlacementOrder();
      return;
    }
    const source = this.#repository.get(sourceInstanceId);
    const hasEmptyCompatibleTarget =
      source &&
      InventoryItemLocation.isInventory(source.location) &&
      this.#attachmentTargetResolver
        .findCompatibleTargets(rootInstanceId, source)
        .some((target) => !target.occupied);
    if (!hasEmptyCompatibleTarget) this.#uiState.clearPlacementOrder();
  }

  #placementOrderKey(rootInstanceId, sourceInstanceId) {
    return `${String(rootInstanceId || "")}:${String(sourceInstanceId || "")}`;
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
      throw new InventoryApplicationError(
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
      throw new InventoryApplicationError(
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
      throw new InventoryApplicationError(
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

  #assertAllowedPlan(plan) {
    if (plan?.allowed !== true) {
      throw new InventoryApplicationError(
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
    this.#fallbackSequence += 1;
    return `${prefix}_${Date.now().toString(36)}_${this.#fallbackSequence}`;
  }

  #success(extra = {}) {
    return inventoryCommandSuccess(extra);
  }

  #equipmentSuccess(extra = {}) {
    this.#uiState.focusCompatibleCategory();
    return this.#success(extra);
  }

  #failure(warning, error = null) {
    return inventoryCommandFailure(warning, error);
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
      [this.#hydrator, "hydrator"],
      [this.#lineAllocationService, "lineAllocationService"],
      [this.#equipmentLineReadinessPolicy, "equipmentLineReadinessPolicy"],
      [this.#sortConfig, "sortConfig"],
      [this.#uiState, "uiState"],
      [this.#itemRemoval, "itemRemoval"],
    ];
    for (const [dependency, name] of dependencies) {
      if (!dependency) throw new TypeError(`InventoryCommandService requires ${name}`);
    }
    if (!this.#attachmentTargetResolver.findPlacementTargets) {
      throw new TypeError(
        "InventoryCommandService requires attachmentTargetResolver.findPlacementTargets()",
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
        "InventoryCommandService requires valid sortConfig defaults",
      );
    }
  }
}
