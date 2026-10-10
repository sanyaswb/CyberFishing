// The player's inventory as the game sees it: a port over Inventory that blocks equipment changes while
// tackle is in the water, caches the equipped read model (with the rod's cast display stats), forwards
// gameplay events and consumption, and announces "inventory-changed".
export class PlayerInventory {
  #messages;
  #facade;
  #gameplayBridge;
  #actions;
  #events;
  #rodCastDisplayStats;
  #tackleLoadLimitPolicy;
  #itemDatabase;
  #itemViewContext;
  #removeInventoryListener = null;
  #isLocked = false;
  #equippedCache = null;

  constructor({
    messages,
    inventory,
    actions,
    events,
    rodCastDisplayStats,
    tackleLoadLimitPolicy,
    itemDatabase,
    itemViewContext,
  }) {
    this.#messages = messages;
    this.#facade = inventory.facade;
    this.#gameplayBridge = inventory.gameplayBridge;
    this.#actions = actions;
    this.#events = events;
    this.#rodCastDisplayStats = rodCastDisplayStats;
    this.#tackleLoadLimitPolicy = tackleLoadLimitPolicy;
    this.#itemDatabase = itemDatabase;
    this.#itemViewContext = itemViewContext;
    this.#removeInventoryListener = this.#facade.subscribe(() => {
      this.#equippedCache = null;
      this.#events.emit("inventory-changed", {
        equipment: this.getEquipped(),
        source: "inventory",
      });
    });
  }

  setLock(locked) {
    this.#isLocked = locked;
  }

  get isLocked() {
    return this.#isLocked;
  }

  get inventoryFacade() {
    return this.#facade;
  }

  dispatchInventoryAction(action = {}) {
    const safeWhileLocked = new Set([
      this.#actions.OPEN,
      this.#actions.CLOSE,
      this.#actions.CATEGORY_SELECT,
      this.#actions.ASSEMBLY_BACK,
      this.#actions.AUTO_BAIT_CHANGE,
      this.#actions.AUTO_CHUM_CHANGE,
    ]);
    if (this.#isLocked && !safeWhileLocked.has(action.type)) {
      return {
        success: false,
        warning: this.#messages.equipmentLockedWhileFishing,
        refresh: false,
      };
    }
    return this.#facade.dispatch(action);
  }

  setBoatChargeProvider(provider) {
    this.#facade.setBoatChargeProvider(provider);
  }

  setFreshnessExposureProvider(provider) {
    this.#itemViewContext.setFreshnessExposureProvider(provider);
  }

  setLineCapacityStateProvider(provider) {
    this.#itemViewContext.setLineCapacityStateProvider(provider);
  }

  handleRodRetrieved(context = {}) {
    return this.#gameplayBridge.handleRodRetrieved(context) ?? null;
  }

  handleHandChumUsed(context = {}) {
    return this.#gameplayBridge.handleHandChumUsed(context) ?? null;
  }

  handleBoatReturned(context = {}) {
    return this.#gameplayBridge.handleBoatReturned(context) ?? null;
  }

  evaluateCastReadiness() {
    return this.#gameplayBridge.evaluateCastReadiness();
  }

  getMaxTackleLoadKg() {
    return this.#tackleLoadLimitPolicy.resolveMaxLoadKg(this.getEquipped());
  }

  breakEquippedLine(lossMeters) {
    return this.#gameplayBridge.breakEquippedLine(lossMeters);
  }

  consumeItem(instanceId, amount = 1) {
    return this.#gameplayBridge.consumeItem(instanceId, amount);
  }

  consumeHandChum() {
    return this.consumeEquipped("handChum", 1, true);
  }

  consumeEquipped(slotPath, amount = 1, unequipAfterConsume = true) {
    return this.#gameplayBridge.consumeEquipped(
      slotPath,
      amount,
      unequipAfterConsume,
    );
  }

  getEquipped() {
    if (this.#equippedCache) return this.#equippedCache;
    this.#equippedCache = this.#gameplayBridge.getEquipped();
    this.#rodCastDisplayStats.writeEquipped(this.#equippedCache);
    return this.#equippedCache;
  }

  onInventoryChanged(handler) {
    return this.#events.on("inventory-changed", handler);
  }

  refreshItemData() {
    this.#itemDatabase.refresh();
    this.#equippedCache = null;
    this.#facade.notify();
  }

  dispose() {
    this.#removeInventoryListener?.();
    this.#removeInventoryListener = null;
    this.#events.clear();
  }
}
