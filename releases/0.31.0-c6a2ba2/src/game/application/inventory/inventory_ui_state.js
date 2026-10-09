// Navigation state of the inventory UI: open/closed, category, filters, sorting, selection, highlighted
// equipment slot, panel mode (loadout or assembly editor) and the pending placement order. Commands change it
// only through these named transitions; snapshot() is what view models read.
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
  #panelMode = "loadout";
  #editingRootInstanceId = null;
  #viewingLoadoutId = null;

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
      panelMode: this.#panelMode,
      editingRootInstanceId: this.#editingRootInstanceId,
      viewingLoadoutId: this.#viewingLoadoutId,
    });
  }

  get selectedInstanceId() { return this.#selectedInstanceId; }
  get highlightedEquipmentSlotId() { return this.#highlightedEquipmentSlotId; }
  get panelMode() { return this.#panelMode; }
  get editingRootInstanceId() { return this.#editingRootInstanceId; }
  get viewingLoadoutId() { return this.#viewingLoadoutId; }
  get placementOrderKey() { return this.#placementOrderKey; }

  open() {
    this.#isOpen = true;
    this.#highlightedEquipmentSlotId = null;
  }

  close() {
    this.#isOpen = false;
    this.#highlightedEquipmentSlotId = null;
    this.clearPlacementOrder();
  }

  selectCategory(categoryId) {
    this.#activeCategoryId = categoryId || "all";
    this.#activeSubfilterIds = [];
    this.#selectedInstanceId = null;
    this.#highlightedEquipmentSlotId = null;
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
    this.#highlightedEquipmentSlotId = null;
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

  toggleHighlightedSlot(slotId) {
    this.#highlightedEquipmentSlotId =
      this.#highlightedEquipmentSlotId === slotId ? null : slotId;
    return this.#highlightedEquipmentSlotId;
  }

  setPlacementOrder(key) {
    this.#placementOrderKey = key;
  }

  clearPlacementOrder() {
    this.#placementOrderKey = null;
  }

  showAssemblyEditor(rootInstanceId) {
    this.#showPanel("assembly", rootInstanceId, null);
  }

  showLoadoutPanel() {
    this.#showPanel("loadout", null, null);
  }

  showSavedLoadoutPreview(loadoutId) {
    this.#showPanel("loadout", null, loadoutId);
  }

  #showPanel(panelMode, editingRootInstanceId, viewingLoadoutId) {
    this.#panelMode = panelMode;
    this.#editingRootInstanceId = editingRootInstanceId;
    this.#viewingLoadoutId = viewingLoadoutId;
    this.#selectedInstanceId = null;
    this.#highlightedEquipmentSlotId = null;
    this.clearPlacementOrder();
  }
}
