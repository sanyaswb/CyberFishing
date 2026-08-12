class InventoryV2GameplayBridge {
  #repository;
  #hydrator;
  #equipmentState;
  #equipmentReadModelFactory;
  #readinessPolicy;
  #commands;
  #itemViews;
  #afterMutation = null;
  #lastResult = null;

  constructor({
    repository,
    hydrator,
    equipmentState,
    equipmentReadModelFactory,
    readinessPolicy,
    commands,
    itemViews = null,
  } = {}) {
    this.#repository = repository;
    this.#hydrator = hydrator;
    this.#equipmentState = equipmentState;
    this.#equipmentReadModelFactory = equipmentReadModelFactory;
    this.#readinessPolicy = readinessPolicy;
    this.#commands = commands;
    this.#itemViews = itemViews;
  }

  setAfterMutation(listener) {
    this.#afterMutation = typeof listener === "function" ? listener : null;
    return this;
  }

  getEquipped() {
    return this.#equipmentReadModelFactory.create(this.#equipmentState);
  }

  listItems({
    includeAttached = false,
    includeLoadout = false,
    hydrated = true,
  } = {}) {
    return this.#repository
      .list()
      .filter((item) => includeAttached || !InventoryItemLocation.isAttached(item.location))
      .filter((item) => includeLoadout || !InventoryItemLocation.isLoadout(item.location))
      .map((item) => {
        if (!hydrated) return item;
        return this.#hydrator.hydrate(item, this.#repository);
      });
  }

  getInventoryItems() {
    return this.listItems();
  }

  listAllItems({ hydrated = true } = {}) {
    return this.listItems({
      includeAttached: true,
      includeLoadout: true,
      hydrated,
    });
  }

  getItem(instanceId, { hydrated = true } = {}) {
    const item = this.#repository.get(instanceId);
    if (!item || !hydrated) return item;
    return this.#hydrator.hydrate(item, this.#repository);
  }

  hydrateInstance(instanceId) {
    return this.#itemViews?.create?.(instanceId) || this.getItem(instanceId);
  }

  findFirstItemByType(type) {
    return this.listItems().find((item) => this.#matchesType(item, type)) || null;
  }

  findItemsByType(type, out = []) {
    out.length = 0;
    for (const item of this.listItems()) {
      if (this.#matchesType(item, type)) out.push(item);
    }
    return out;
  }

  consumeItem(instanceId, amount = 1) {
    return this.#booleanMutation(
      this.#commands.consumeItem(instanceId, amount),
    );
  }

  consumeEquipped(slotPath, amount = 1, unequipAfterConsume = true) {
    return this.#booleanMutation(
      this.#commands.consumeEquipped(
        slotPath,
        amount,
        unequipAfterConsume,
      ),
    );
  }

  breakEquippedLine(lossMeters) {
    return this.#booleanMutation(
      this.#commands.breakEquippedLine(lossMeters),
    );
  }

  rodRetrieved(context = {}) {
    return this.#reportMutation(this.#commands.rodRetrieved(context));
  }

  handleRodRetrieved(context = {}) {
    return this.rodRetrieved(context);
  }

  handChumUsed(context = {}) {
    return this.#reportMutation(this.#commands.handChumUsed(context));
  }

  handleHandChumUsed(context = {}) {
    return this.handChumUsed(context);
  }

  boatReturned(context = {}) {
    return this.#reportMutation(this.#commands.boatReturned(context));
  }

  handleBoatReturned(context = {}) {
    return this.boatReturned(context);
  }

  evaluateCastReadiness() {
    return this.#readinessPolicy.evaluateCast({
      equipmentState: this.#equipmentState,
    });
  }

  evaluateBiteReadiness() {
    return this.#readinessPolicy.evaluateBite({
      equipmentState: this.#equipmentState,
    });
  }

  evaluateChumBonus() {
    return this.#readinessPolicy.evaluateChumBonus({
      equipmentState: this.#equipmentState,
    });
  }

  setBoatChargeProvider(provider) {
    this.#itemViews?.setBoatChargeProvider?.(provider);
    this.#afterMutation?.();
    return this;
  }

  getLastResult() {
    return this.#lastResult;
  }

  #matchesType(item, type) {
    return item?.itemType === type || item?.variant === type;
  }

  #booleanMutation(result) {
    this.#lastResult = result;
    if (result?.success) this.#afterMutation?.(result);
    return result?.success === true;
  }

  #reportMutation(result) {
    this.#lastResult = result;
    if (result?.success) this.#afterMutation?.(result);
    return result?.report || result;
  }
}

globalThis.InventoryV2GameplayBridge = InventoryV2GameplayBridge;
