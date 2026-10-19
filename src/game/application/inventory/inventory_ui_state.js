// Navigation state of the inventory UI: open/closed, category, filters, sorting, selection, the pick target
// (highlighted equipment slot or craft socket), panel mode (loadout or assembly editor), the visible section and the
// pending placement order. Commands change it only through these named transitions; snapshot() is what view models read.
export class InventoryUiState {
  #isOpen = false;
  #activeCategoryId = "all";
  #activeSubfilterIds = [];
  #sortCriterionIds = [];
  #sortDirectionId = null;
  #activeRarityFilterIds = [];
  #placementOrderKey = null;
  #selectedInstanceId = null;
  #highlightedEquipmentSlotId = null;
  #pickedSocketId = null;
  #consumableKind = null;
  #equipmentFeedback = null;
  #equipmentFeedbackRevision = 0;
  #panelMode = "loadout";
  #editingRootInstanceId = null;
  #viewingLoadoutId = null;
  #rodRemovalStep = null;
  #editorReturnContext = null;
  // Equipment, backpack or keepnet (spec 067). It survives closing for the rest of the session.
  #activeSectionId = "equipment";

  constructor({ sortConfig } = {}) {
    this.#sortCriterionIds = [...(sortConfig?.defaults?.criterionIds || [])];
    this.#sortDirectionId = sortConfig?.defaults?.directionId || null;
  }

  snapshot() {
    return Object.freeze({
      isOpen: this.#isOpen,
      activeCategoryId: this.#activeCategoryId,
      activeSubfilterIds: Object.freeze([...this.#activeSubfilterIds]),
      sortCriterionIds: Object.freeze([...this.#sortCriterionIds]),
      sortDirectionId: this.#sortDirectionId,
      activeRarityFilterIds: Object.freeze([...this.#activeRarityFilterIds]),
      placementOrderKey: this.#placementOrderKey,
      selectedInstanceId: this.#selectedInstanceId,
      highlightedEquipmentSlotId: this.#highlightedEquipmentSlotId,
      pickedSocketId: this.#pickedSocketId,
      consumableKind: this.#consumableKind,
      equipmentFeedback: this.#equipmentFeedback,
      panelMode: this.#panelMode,
      editingRootInstanceId: this.#editingRootInstanceId,
      viewingLoadoutId: this.#viewingLoadoutId,
      rodRemovalStep: this.#rodRemovalStep,
      activeSectionId: this.#activeSectionId,
    });
  }

  get selectedInstanceId() { return this.#selectedInstanceId; }
  get highlightedEquipmentSlotId() { return this.#highlightedEquipmentSlotId; }
  get pickedSocketId() { return this.#pickedSocketId; }
  get isConsumablePick() { return this.#consumableKind !== null; }
  get consumableKind() { return this.#consumableKind; }
  get isPicking() { return this.#highlightedEquipmentSlotId !== null || this.#pickedSocketId !== null || this.isConsumablePick; }
  get panelMode() { return this.#panelMode; }
  get editingRootInstanceId() { return this.#editingRootInstanceId; }
  get viewingLoadoutId() { return this.#viewingLoadoutId; }
  get placementOrderKey() { return this.#placementOrderKey; }
  get rodRemovalStep() { return this.#rodRemovalStep; }
  get activeSectionId() { return this.#activeSectionId; }
  get editorReturnContext() { return this.#editorReturnContext; }

  selectSection(sectionId) {
    this.#activeSectionId = sectionId;
    this.#clearPick();
  }

  // Pick (spec 070): an empty equipment cell or craft socket opens the backpack at the compatible items; activating a
  // card completes the pick and returns to the equipment section.
  // showBackpack: false keeps the current section when the item list is already visible beside it (spec 074).
  pickForSlot(slotId, { showBackpack = true } = {}) {
    this.#startPick(showBackpack);
    this.#highlightedEquipmentSlotId = slotId;
  }

  pickForSocket(socketId, { showBackpack = true } = {}) {
    this.#startPick(showBackpack);
    this.#pickedSocketId = socketId;
  }

  pickForConsumable(kind, socketId = null, { showBackpack = false } = {}) {
    this.showLoadoutPanel();
    this.#startPick(showBackpack);
    this.#pickedSocketId = socketId;
    this.#consumableKind = kind;
  }

  completePick() {
    this.#activeSectionId = "equipment";
    this.#clearPick();
  }

  equipmentEquipped(slotId, instanceId) {
    this.showLoadoutPanel();
    this.#activeSectionId = "equipment";
    this.#equipmentFeedback = Object.freeze({ revision: ++this.#equipmentFeedbackRevision, slotId, instanceId });
  }

  open() {
    this.#isOpen = true;
    this.#clearPick();
  }

  close() {
    this.#rodRemovalStep = null;
    this.#isOpen = false;
    if (this.isPicking) this.completePick();
    if (this.#panelMode === "assembly") this.showLoadoutPanel();
    this.#editorReturnContext = null;
    this.clearPlacementOrder();
  }

  selectCategory(categoryId) {
    this.#activeCategoryId = categoryId || "all";
    this.#activeSubfilterIds = [];
    this.#selectedInstanceId = null;
    this.clearPlacementOrder();
  }

  // Equipping something switches the item list to the compatible category.
  focusCompatibleCategory() {
    this.#activeCategoryId = "compatible";
    this.#activeSubfilterIds = [];
    this.clearPlacementOrder();
  }

  toggleSubfilter(filterId, enabled) {
    const selected = new Set(this.#activeSubfilterIds);
    if (enabled === true) selected.add(filterId);
    else selected.delete(filterId);
    this.#activeSubfilterIds = [...selected];
    this.#selectedInstanceId = null;
    this.clearPlacementOrder();
    return [...selected];
  }

  toggleSortCriterion(criterionId) {
    const selected = this.#sortCriterionIds;
    this.#sortCriterionIds = selected.includes(criterionId)
      ? selected.filter((id) => id !== criterionId)
      : [...selected, criterionId];
    return [...this.#sortCriterionIds];
  }

  selectSortDirection(directionId) {
    this.#sortDirectionId = directionId;
  }

  toggleRarityFilter(rarityId, enabled) {
    const selected = new Set(this.#activeRarityFilterIds);
    if (enabled === true) selected.add(rarityId);
    else selected.delete(rarityId);
    this.#activeRarityFilterIds = [...selected];
    return [...selected];
  }

  select(instanceId) {
    this.#selectedInstanceId = instanceId;
  }

  clearSelection() {
    this.#selectedInstanceId = null;
  }

  clearHighlightedSlot() {
    this.#highlightedEquipmentSlotId = null;
  }

  setPlacementOrder(key) {
    this.#placementOrderKey = key;
  }

  clearPlacementOrder() {
    this.#placementOrderKey = null;
  }

  showAssemblyEditor(rootInstanceId, { returnContext = null } = {}) {
    this.#editorReturnContext = returnContext || this.#editorReturnContext || Object.freeze({
      sectionId: this.#activeSectionId,
      categoryId: this.#activeCategoryId,
      subfilterIds: Object.freeze([...this.#activeSubfilterIds]),
      rarityFilterIds: Object.freeze([...this.#activeRarityFilterIds]),
      sortCriterionIds: Object.freeze([...this.#sortCriterionIds]),
      sortDirectionId: this.#sortDirectionId,
    });
    this.#showPanel("assembly", rootInstanceId, null);
    this.#activeSectionId = "equipment";
    this.focusCompatibleCategory();
  }

  backFromAssemblyEditor(loadoutId = null) {
    const context = this.#editorReturnContext;
    if (loadoutId) this.showSavedLoadoutPreview(loadoutId);
    else this.showLoadoutPanel();
    this.#activeSectionId = loadoutId ? "equipment" : context?.sectionId || "equipment";
    if (context?.sectionId === "backpack" && !loadoutId) {
      this.#activeCategoryId = context.categoryId;
      this.#activeSubfilterIds = [...context.subfilterIds];
      this.#activeRarityFilterIds = [...context.rarityFilterIds];
      this.#sortCriterionIds = [...context.sortCriterionIds];
      this.#sortDirectionId = context.sortDirectionId;
    }
  }

  showLoadoutPanel() {
    this.#showPanel("loadout", null, null);
  }

  showSavedLoadoutPreview(loadoutId) {
    this.#showPanel("saved-loadout", null, loadoutId);
  }

  showRodRemoval(rootInstanceId, step = "choice") {
    this.showAssemblyEditor(rootInstanceId);
    this.#rodRemovalStep = step;
  }

  #showPanel(panelMode, editingRootInstanceId, viewingLoadoutId) {
    if (panelMode !== "assembly") this.#editorReturnContext = null;
    this.#panelMode = panelMode;
    this.#rodRemovalStep = null;
    this.#editingRootInstanceId = editingRootInstanceId;
    this.#viewingLoadoutId = viewingLoadoutId;
    this.#selectedInstanceId = null;
    this.#clearPick();
    this.clearPlacementOrder();
  }

  #startPick(showBackpack) {
    this.#clearPick();
    if (showBackpack) this.#activeSectionId = "backpack";
    this.#selectedInstanceId = null;
    this.focusCompatibleCategory();
  }

  #clearPick() {
    this.#highlightedEquipmentSlotId = null;
    this.#pickedSocketId = null;
    this.#consumableKind = null;
  }
}
