import { InventoryItemLocation } from "../../domain/inventory/inventory_item_location.js";

export class InventoryV2GameplayBridge {
  #repository;
  #hydrator;
  #equipmentState;
  #equipmentReadModelFactory;
  #readinessPolicy;
  #gameplayCommands;
  #itemViews;
  #afterMutation = null;
  #lastResult = null;

  constructor({
    repository,
    hydrator,
    equipmentState,
    equipmentReadModelFactory,
    readinessPolicy,
    gameplayCommands,
    itemViews = null,
  } = {}) {
    this.#repository = repository;
    this.#hydrator = hydrator;
    this.#equipmentState = equipmentState;
    this.#equipmentReadModelFactory = equipmentReadModelFactory;
    this.#readinessPolicy = readinessPolicy;
    this.#gameplayCommands = gameplayCommands;
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

  getItem(instanceId, { hydrated = true } = {}) {
    const item = this.#repository.get(instanceId);
    if (!item || !hydrated) return item;
    return this.#hydrator.hydrate(item, this.#repository);
  }

  hydrateInstance(instanceId) {
    return this.#itemViews?.create?.(instanceId) || this.getItem(instanceId);
  }

  consumeItem(instanceId, amount = 1) {
    return this.#booleanMutation(
      this.#gameplayCommands.consumeItem(instanceId, amount),
    );
  }

  consumeEquipped(slotPath, amount = 1, unequipAfterConsume = true) {
    return this.#booleanMutation(
      this.#gameplayCommands.consumeEquipped(
        slotPath,
        amount,
        unequipAfterConsume,
      ),
    );
  }

  breakEquippedLine(lossMeters) {
    return this.#booleanMutation(
      this.#gameplayCommands.breakEquippedLine(lossMeters),
    );
  }

  rodRetrieved(context = {}) {
    return this.#reportMutation(this.#gameplayCommands.rodRetrieved(context));
  }

  handleRodRetrieved(context = {}) {
    return this.rodRetrieved(context);
  }

  handChumUsed(context = {}) {
    return this.#reportMutation(this.#gameplayCommands.handChumUsed(context));
  }

  handleHandChumUsed(context = {}) {
    return this.handChumUsed(context);
  }

  boatReturned(context = {}) {
    return this.#reportMutation(this.#gameplayCommands.boatReturned(context));
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
