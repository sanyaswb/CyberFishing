import { EQUIPMENT_ALL_SLOT_IDS, EQUIPMENT_MAIN_SLOT_IDS } from "../../domain/equipment/equipment_slot_catalog.js";
import { InventoryApplicationError } from "./inventory_application_error.js";
import { InventoryItemLocation } from "../../domain/inventory/inventory_item_location.js";
import { inventoryCommandFailure, inventoryCommandSuccess } from "./inventory_command_result.js";

export class InventoryCommandService {
  #messages;
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
  #fallbackSequence = 0;
  #uiState;
  #itemRemoval;
  #consumableTargets;
  #slotVisibility;

  constructor({
    messages,
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
    consumableTargets,
    slotVisibilityPolicy,
  } = {}) {
    this.#messages = messages;
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
    this.#uiState = uiState;
    this.#itemRemoval = itemRemoval;
    this.#consumableTargets = consumableTargets;
    this.#slotVisibility = slotVisibilityPolicy;
    this.#assertDependencies();
  }

  getUiState() {
    return this.#uiState.snapshot();
  }

  dispatch(action = {}) {
    try {
      return this.#dispatch(action);
    } catch (error) {
      return this.#failure(error?.message, error);
    }
  }

  #dispatch(action) {
    // The UI action vocabulary is presentation-owned and injected by the composition root.
    const InventoryActionType = this.#actionTypes;
    switch (action.type) {
      case InventoryActionType.ROD_REMOVAL_CHOICE:
        return this.#chooseRodRemoval(action.choice);
      case InventoryActionType.OPEN:
        this.#uiState.open();
        return this.#success();
      case InventoryActionType.CLOSE:
        this.#uiState.close();
        return this.#success();
      case InventoryActionType.CATEGORY_SELECT:
        this.#uiState.selectCategory(action.categoryId);
        return this.#success();
      case InventoryActionType.SECTION_SELECT:
        // Sections never close an open item editor (spec 092): returning to equipment shows it again.
        this.#uiState.selectSection(action.sectionId);
        return this.#success();
      case InventoryActionType.CONSUMABLE_SLOT_ACTIVATE:
        return this.#pickConsumable(action.kind, action.slotIndex, action.listVisible === true);
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
        return this.#activateEquipmentSlot(action.slotId, action.listVisible === true);
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
        this.#backFromItem(action.rootInstanceId);
        return this.#success();
      case InventoryActionType.LOADOUT_SAVE:
        return this.#uiState.rodRemovalStep === "save"
          ? this.#confirmRodRemovalSave(action.name) : this.#saveLoadout(action.name);
      case InventoryActionType.LOADOUT_PREVIEW_SLOT_EQUIP:
        return this.#equipLoadoutSlot(action.loadoutId, action.slotId);
      case InventoryActionType.LOADOUT_EQUIP_ALL:
        return this.#equipLoadout(action.loadoutId);
      case InventoryActionType.LOADOUT_PREVIEW_BACK:
        this.#uiState.showLoadoutPanel();
        return this.#success({ loadoutId: action.loadoutId });
      case InventoryActionType.AUTO_BAIT_CHANGE:
        return this.#changeSetting("autoBait", action.enabled);
      case InventoryActionType.AUTO_CHUM_CHANGE:
        return this.#changeSetting("autoChum", action.enabled);
      default:
        return this.#failure(this.#messages.unknownAction(action.type || "—"));
    }
  }

  // A card activated during a pick (spec 070) returns to the equipment section once it is equipped or opened.
  #activateInventoryItem(instanceId) {
    const source = this.#repository.get(instanceId);
    const kind = source ? this.#type(source) : null;
    if (!this.#uiState.highlightedEquipmentSlotId &&
        (this.#uiState.panelMode !== "assembly" || this.#uiState.isConsumablePick) &&
        (kind === "bait" || (kind === "chum_mix" && this.#uiState.isConsumablePick))) {
      const consumableKind = kind === "bait" ? "bait" : "chum";
      if (this.#uiState.isConsumablePick || this.#consumableTargets.list(consumableKind).length) {
        return this.#activateConsumable(source, consumableKind);
      }
    }
    const picking = this.#uiState.isPicking;
    const editorRootInstanceId = this.#uiState.panelMode === "assembly" ? this.#uiState.editingRootInstanceId : null;
    const result = this.#activateInventoryItemInPanel(instanceId);
    if (picking && result.success && !result.requiresSocketChoice) {
      this.#uiState.completePick();
    }
    // Inside an item editor only its own buttons leave it (spec 092): an item equipped from the editor (a pick for its
    // cell or a list card) returns to that editor instead of the equipment panel.
    if (editorRootInstanceId && result.success && this.#uiState.panelMode === "loadout" &&
        this.#repository.has(editorRootInstanceId)) {
      this.#uiState.showAssemblyEditor(editorRootInstanceId);
    }
    return result;
  }

  #activateInventoryItemInPanel(instanceId) {
    if (this.#loadouts.has(instanceId)) {
      this.#uiState.showSavedLoadoutPreview(instanceId);
      return this.#success({ loadoutId: instanceId });
    }

    const source = this.#repository.get(instanceId);
    if (!source) return this.#failure(this.#messages.itemNotFound);
    if (this.#type(source) === "rod") {
      if (!this.#equipmentState.getRootInstanceId("rod")) {
        return this.#equipLooseRoot(source.instanceId, "rod");
      }
      this.#uiState.showAssemblyEditor(source.instanceId);
      return this.#success({ rootInstanceId: source.instanceId });
    }
    if (
      this.#uiState.panelMode === "assembly" &&
      this.#assemblyStates.has(this.#uiState.editingRootInstanceId)
    ) {
      const rootInstanceId = this.#uiState.editingRootInstanceId;
      const pickedTarget = this.#attachmentTargetResolver
        .findCompatibleTargets(rootInstanceId, source)
        .find((target) => target.socketId === this.#uiState.pickedSocketId);
      if (pickedTarget) return this.#fillAssemblyTarget(rootInstanceId, source, pickedTarget);
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
        this.#messages.itemFitsNoAssemblySocket,
      );
    }

    const highlightedSlotId = this.#uiState.highlightedEquipmentSlotId;
    if (this.#type(source) === "hook" && this.#validateEquipment(highlightedSlotId || "tackle", source).isValid) {
      return this.#equipHook(source, highlightedSlotId || "tackle");
    }
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
      return this.#failure(this.#messages.notAnAssembledStack);
    }
    return this.#disassembleAssembly(instanceId);
  }

  // listVisible: the item list is already on screen (landscape), so the pick keeps the section (spec 074).
  #activateEquipmentSlot(slotId, listVisible = false) {
    const equippedId = this.#equipmentState.getRootInstanceId(slotId);
    if (equippedId) {
      this.#uiState.clearHighlightedSlot();
      this.#uiState.showAssemblyEditor(equippedId);
      return this.#success({ rootInstanceId: equippedId });
    }

    const selectedId = this.#uiState.selectedInstanceId;
    if (!selectedId || !this.#repository.has(selectedId)) {
      this.#uiState.pickForSlot(slotId, { showBackpack: !listVisible });
      return this.#success({ highlightedSlotId: slotId });
    }
    return this.#equipLooseRoot(selectedId, slotId);
  }

  // A header slot applies a backpack item waiting for confirmation at the first press, on the proposed slot or another
  // one (spec 074); without one it opens the pick for that slot.
  #pickConsumable(kind, slotIndex, listVisible) {
    const target = this.#consumableTargets.resolve(kind, slotIndex);
    if (!target) return this.#failure(this.#messages.consumableSlotUnavailable);
    const pending = this.#uiState.consumableKind === kind && this.#repository.get(this.#uiState.selectedInstanceId);
    if (pending && this.#attachmentTargetResolver.accepts(target, pending)) {
      const result = this.#fillAssemblyTarget(target.rootInstanceId, pending, target);
      if (result.success) this.#uiState.pickForConsumable(kind);
      return result;
    }
    this.#uiState.pickForConsumable(kind, target.socketId, { showBackpack: !listVisible });
    return this.#success({ pickedSocketId: target.socketId });
  }

  #equipHook(source, slotId) {
    const validation = this.#validateEquipment(slotId, source);
    if (!validation.isValid) return this.#failure(validation.reason || this.#messages.itemIncompatible);
    const rootInstanceId = this.#transaction.runAtomic(() => {
      const id = this.#assemblyStates.has(source.instanceId) ? source.instanceId :
        this.#assemblyService.startAssembly(source.instanceId);
      this.#assemblyService.prepare(id);
      this.#equipRootWithinTransaction(id, slotId);
      return id;
    });
    return this.#equipmentSuccess({ rootInstanceId, equippedInstanceId: rootInstanceId, slotId });
  }

  #activateConsumable(source, kind) {
    const targets = this.#consumableTargets.list(kind)
      .filter((target) => this.#attachmentTargetResolver.accepts(target, source));
    if (!targets.length) return this.#failure(this.#messages.consumableSlotUnavailable);
    const explicit = this.#uiState.consumableKind === kind
      ? targets.find((target) => target.socketId === this.#uiState.pickedSocketId) : null;
    const selectedId = this.#uiState.selectedInstanceId;
    const empty = targets.find((target) => !target.occupied);
    if ((explicit && (!selectedId || selectedId === source.instanceId)) || empty) {
      const target = explicit && (!selectedId || selectedId === source.instanceId) ? explicit : empty;
      const result = this.#fillAssemblyTarget(target.rootInstanceId, source, target);
      if (result.success) this.#uiState.pickForConsumable(kind);
      return result;
    }
    // Prefer a different bait: selecting a worm beside worm + bread proposes replacing only the bread.
    const target = targets.find((candidate) => candidate.occupied.itemId !== source.itemId) || targets[0];
    this.#uiState.pickForConsumable(kind, target.socketId);
    this.#uiState.select(source.instanceId);
    return this.#success({ requiresSocketChoice: true });
  }

  #unequipSlot(slotId) {
    const currentId = this.#equipmentState.getRootInstanceId(slotId);
    if (!currentId) return this.#failure(this.#messages.slotAlreadyEmpty);
    const isSavedRoot = InventoryItemLocation.isLoadout(this.#repository.require(currentId).location);
    // Only a fully equipped rod offers to be saved as a loadout; an incomplete one comes off at once and its components
    // return to the backpack as they are (spec 089).
    if (slotId === "rod" && !isSavedRoot && this.#isRodFullyEquipped(currentId)) {
      this.#uiState.showRodRemoval(currentId);
      return this.#success({ requiresRodRemovalChoice: true });
    }
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
    if (this.#type(this.#repository.get(rootInstanceId)) === "rod") {
      if (this.#equipmentState.getRootInstanceId("rod") !== rootInstanceId) {
        return this.#failure(this.#messages.equipRodBeforeComponents);
      }
      return this.#activateEquipmentSlot(action.slotId, action.listVisible === true);
    }
    if (!rootInstanceId || !this.#assemblyStates.has(rootInstanceId)) {
      return this.#failure(this.#messages.assemblyNotFound);
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
      this.#uiState.pickForSocket(action.socketId, { showBackpack: action.listVisible !== true });
      return this.#success({ pickedSocketId: action.socketId });
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
      return this.#failure(this.#messages.itemIncompatibleOrNoSlot);
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
      return this.#failure(this.#messages.assemblyIncompatibleWithSlot);
    }
    if (!slotId) return this.#failure(this.#messages.assemblyIncompatible);
    this.#transaction.runAtomic(() =>
      this.#equipRootWithinTransaction(rootInstanceId, slotId),
    );
    this.#uiState.showLoadoutPanel();
    return this.#equipmentSuccess({ equippedInstanceId: rootInstanceId, slotId });
  }

  #unequipAssembly(rootInstanceId) {
    if (!rootInstanceId) return this.#failure(this.#messages.assemblyNotFound);
    const slotId = this.#findActiveSlot(rootInstanceId);
    if (!slotId) return this.#failure(this.#messages.assemblyNotEquipped);
    const result = this.#unequipSlot(slotId);
    if (result.success && !result.requiresRodRemovalChoice) this.#uiState.showLoadoutPanel();
    return result;
  }

  #disassembleAssembly(rootInstanceId) {
    const root = this.#repository.get(rootInstanceId);
    if (InventoryItemLocation.isLoadout(root?.location)) {
      return this.#failure(this.#messages.loadoutLongPressToDisassemble);
    }
    if (!this.#assemblyStates.has(rootInstanceId)) {
      return this.#failure(this.#messages.assemblyNotFound);
    }
    if (this.#findActiveSlot(rootInstanceId)) {
      return this.#failure(
        this.#messages.unequipBeforeDisassembly,
      );
    }
    const result = this.#transaction.runAtomic(() => this.#disassembleRootWithinTransaction(rootInstanceId));
    this.#uiState.showLoadoutPanel();
    return this.#success({ disassembled: true, result });
  }

  #disassembleRootWithinTransaction(rootInstanceId) {
    this.#itemRemoval.releaseRootFromLoadout(rootInstanceId);
    const releasedLineIds = this.#collectAssemblyLineIds(rootInstanceId);
    const disassembled = this.#assemblyService.disassemble(rootInstanceId);
    for (const lineInstanceId of releasedLineIds) {
      if (this.#repository.has(lineInstanceId)) {
        this.#lineAllocationService.release(lineInstanceId);
      }
    }
    return disassembled;
  }

  #saveLoadout(name) {
    const normalizedName = this.#loadoutName(name);
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
      return this.#failure(this.#messages.savedLoadoutNotFound);
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
      return this.#failure(this.#messages.savedLoadoutNotFound);
    }
    if (!EQUIPMENT_MAIN_SLOT_IDS.includes(slotId)) {
      return this.#failure(this.#messages.slotNotInMainLoadout);
    }
    const rootInstanceId = this.#loadouts
      .require(loadoutId)
      .getRootInstanceId(slotId);
    if (!rootInstanceId || !this.#repository.has(rootInstanceId)) {
      return this.#failure(this.#messages.loadoutSlotEmpty);
    }
    if (this.#equipmentState.getRootInstanceId(slotId) === rootInstanceId) {
      return this.#success({
        loadoutId,
        slotId,
        equippedInstanceId: rootInstanceId,
        alreadyEquipped: true,
      });
    }

    this.#uiState.showLoadoutPanel();
    return this.#activateInventoryItem(rootInstanceId);
  }

  #disassembleLoadout(loadoutId) {
    if (!this.#loadouts.has(loadoutId)) {
      return this.#failure(this.#messages.savedLoadoutNotFound);
    }
    const result = this.#transaction.runAtomic(() => {
      const loadout = this.#loadouts.require(loadoutId);
      const roots = loadout.getContainedRootIds();
      const released = this.#loadoutService.disassemble({ loadout, equipmentState: this.#equipmentState });
      if (!released.success) throw new InventoryApplicationError("LOADOUT_DISASSEMBLY_FAILED", released.warning);
      for (const id of roots) {
        if (this.#assemblyStates.has(id)) this.#disassembleRootWithinTransaction(id);
      }
      return released;
    });
    if (!result.success) return this.#failure(result.warning);
    if (this.#uiState.viewingLoadoutId === loadoutId) {
      this.#uiState.showLoadoutPanel();
    }
    return this.#success({ loadoutId, disassembled: true });
  }

  #backFromItem(rootInstanceId) {
    const item = this.#repository.get(rootInstanceId);
    if (InventoryItemLocation.isLoadout(item?.location)) {
      this.#uiState.showSavedLoadoutPreview(item.location.loadoutId);
    } else this.#uiState.showLoadoutPanel();
  }

  // Every first-level cell the rod shows (reel, line, tackle, float as its capabilities allow) is filled.
  #isRodFullyEquipped(rodInstanceId) {
    const rod = this.#hydrate(this.#repository.require(rodInstanceId));
    return EQUIPMENT_MAIN_SLOT_IDS.every((slotId) => slotId === "rod" ||
      !this.#slotVisibility.isVisible(slotId, { rod }) || this.#equipmentState.getRootInstanceId(slotId) !== null);
  }

  #loadoutName(name) {
    const rod = this.#hydrate(this.#repository.get(this.#equipmentState.getRootInstanceId("rod")));
    return (String(name || "").trim() ||
      this.#messages.automaticLoadoutName(rod?.name || this.#messages.defaultRodName, this.#loadouts.list().length + 1)).slice(0, 40);
  }

  #chooseRodRemoval(choice) {
    const rodId = this.#uiState.editingRootInstanceId;
    if (!this.#uiState.rodRemovalStep || this.#equipmentState.getRootInstanceId("rod") !== rodId) {
      return this.#failure(this.#messages.rodRemovalExpired);
    }
    if (choice === "cancel") {
      this.#uiState.showAssemblyEditor(rodId);
      return this.#success();
    }
    if (choice === "save") {
      this.#uiState.showRodRemoval(rodId, "save");
      return this.#success();
    }
    if (choice !== "disassemble") return this.#failure(this.#messages.unknownAction(choice));
    this.#transaction.runAtomic(() => {
      const roots = this.#equipmentState.getMainRootInstanceIds();
      for (const id of Object.values(roots).filter(Boolean)) {
        this.#itemRemoval.releaseRootFromLoadout(id);
      }
      const plan = this.#rodChangePlanner.plan({ equipmentState: this.#equipmentState, nextRodInstanceId: null });
      this.#assertAllowedPlan(plan);
      this.#equipmentState.restore(plan.after);
      for (const [slotId, id] of Object.entries(roots)) {
        if (!id) continue;
        if (this.#assemblyStates.has(id)) this.#disassembleRootWithinTransaction(id);
        else this.#settleUnequippedRoot(id, slotId);
      }
    });
    this.#uiState.showLoadoutPanel();
    return this.#success({ disassembled: true });
  }

  #confirmRodRemovalSave(name) {
    const rodId = this.#uiState.editingRootInstanceId;
    if (this.#uiState.rodRemovalStep !== "save" || this.#equipmentState.getRootInstanceId("rod") !== rodId) {
      return this.#failure(this.#messages.rodRemovalExpired);
    }
    const loadoutId = this.#nextId("loadout");
    this.#transaction.runAtomic(() => {
      const saved = this.#loadoutService.createFromEquipment({
        loadoutId, name: this.#loadoutName(name), equipmentState: this.#equipmentState,
      });
      if (!saved.success) throw new InventoryApplicationError("LOADOUT_SAVE_FAILED", saved.warning);
      const plan = this.#rodChangePlanner.plan({ equipmentState: this.#equipmentState, nextRodInstanceId: null });
      this.#assertAllowedPlan(plan);
      this.#equipmentState.restore(plan.after);
      this.#settleUnequippedRootsAfterPlan(plan);
    });
    this.#uiState.showLoadoutPanel();
    return this.#success({ loadoutId });
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
    if (!available) return this.#failure(this.#messages.unknownSortCriterion);
    return this.#success({
      sortCriterionIds: this.#uiState.toggleSortCriterion(candidate),
    });
  }

  #selectSortDirection(directionId) {
    const candidate = String(directionId || "");
    const available = this.#sortConfig.directions.some(
      (direction) => direction.id === candidate,
    );
    if (!available) return this.#failure(this.#messages.unknownSortDirection);
    this.#uiState.selectSortDirection(candidate);
    return this.#success({ sortDirectionId: candidate });
  }

  #toggleRarityFilter(rarityId, enabled) {
    const candidate = String(rarityId || "");
    const available = Object.hasOwn(
      this.#sortConfig.rarityLabels,
      candidate,
    );
    if (!available) return this.#failure(this.#messages.unknownRarity);
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
          validation.reason || this.#messages.itemIncompatible,
        );
      }
      const savedRoot = InventoryItemLocation.isLoadout(source.location);
      const preparedLine = savedRoot ? null : this.#prepareLooseLineForEquipment(source, slotId);
      const root = preparedLine || (savedRoot ? source : this.#repository.splitOne(source.instanceId));
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
        validation.reason || this.#messages.itemIncompatible,
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
      .some((target) => target.slotId !== "bait" && !target.occupied);
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
    if (!target) return this.#failure(this.#messages.socketNotFound);
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
        result.warning || this.#messages.linePreparationFailed,
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
        readiness.warning || this.#messages.reelLineIncompatibleWithRod,
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
        result.warning || this.#messages.lineInstallOnReelFailed,
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
        plan?.warning || this.#messages.inventoryFull,
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
    const slotId = extra.slotId || (extra.equippedAll ? "rod" : null);
    const instanceId = extra.equippedInstanceId || (slotId ? this.#equipmentState.getRootInstanceId(slotId) : null);
    if (slotId && instanceId) this.#uiState.equipmentEquipped(slotId, instanceId);
    return this.#success(extra);
  }

  #failure(warning, error = null) {
    return inventoryCommandFailure(warning || this.#messages.actionFailed, error);
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
      [this.#consumableTargets, "consumableTargets"],
      [this.#slotVisibility, "slotVisibilityPolicy"],
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
