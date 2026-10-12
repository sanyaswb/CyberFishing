import { InventoryItemLocation } from "../../domain/inventory/inventory_item_location.js";

export class InventoryRefillInventoryPort {
  #repository;
  #signaturePolicy;
  #stackingPolicy;
  #reservationPolicy;
  #candidatePolicy;

  constructor({
    repository,
    signaturePolicy,
    stackingPolicy,
    reservationPolicy = null,
    candidatePolicy,
  } = {}) {
    if (!reservationPolicy?.isReserved) {
      throw new TypeError(
        "InventoryRefillInventoryPort requires a reservation policy",
      );
    }
    this.#repository = repository;
    this.#signaturePolicy = signaturePolicy;
    this.#stackingPolicy = stackingPolicy;
    this.#reservationPolicy = reservationPolicy;
    if (!candidatePolicy?.select) {
      throw new TypeError("InventoryRefillInventoryPort requires candidatePolicy.select");
    }
    this.#candidatePolicy = candidatePolicy;
  }

  takeOneExact(signature) {
    const candidates = this.#repository.list().filter(
      (item) =>
        InventoryItemLocation.isInventory(item.location) &&
        !this.#isReserved(item) &&
        this.#repository.getChildren(item.instanceId).length === 0 &&
        this.#signaturePolicy.matches(item, signature),
    );
    const source = this.#candidatePolicy.select(candidates);
    return source ? this.#repository.splitOne(source.instanceId) : null;
  }

  returnOne(item) {
    if (!item?.instanceId || !this.#repository.has(item.instanceId)) return;
    this.#repository.setLocation(
      item.instanceId,
      InventoryItemLocation.inventory(),
    );
    this.#repository.mergeInventoryItem(
      item.instanceId,
      this.#stackingPolicy,
    );
  }

  #isReserved(item) {
    return this.#reservationPolicy.isReserved(item);
  }
}
