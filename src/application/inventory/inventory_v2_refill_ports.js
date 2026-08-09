class InventoryV2RefillInventoryPort {
  #repository;
  #signaturePolicy;
  #stackingPolicy;
  #reservationPolicy;

  constructor({
    repository,
    signaturePolicy,
    stackingPolicy,
    reservationPolicy = null,
  } = {}) {
    if (!reservationPolicy?.isReserved) {
      throw new TypeError(
        "InventoryV2RefillInventoryPort requires a reservation policy",
      );
    }
    this.#repository = repository;
    this.#signaturePolicy = signaturePolicy;
    this.#stackingPolicy = stackingPolicy;
    this.#reservationPolicy = reservationPolicy;
  }

  takeOneExact(signature) {
    const source = this.#repository.list().find(
      (item) =>
        InventoryItemLocation.isInventory(item.location) &&
        !this.#isReserved(item) &&
        this.#repository.getChildren(item.instanceId).length === 0 &&
        this.#signaturePolicy.matches(item, signature),
    );
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

class InventoryV2RefillTargetWriter {
  #repository;
  #equipmentState;
  #assemblyService;
  #assemblyReader;

  constructor({ repository, equipmentState, assemblyService, assemblyReader } = {}) {
    this.#repository = repository;
    this.#equipmentState = equipmentState;
    this.#assemblyService = assemblyService;
    this.#assemblyReader = assemblyReader;
  }

  fillTarget(target, item) {
    if (target.targetType === "equipment-slot") {
      if (this.#equipmentState.getRootInstanceId(target.slotId)) return false;
      this.#equipmentState.setRootInstanceId(target.slotId, item.instanceId);
      return true;
    }
    if (target.targetType !== "assembly-slot") return false;

    const segments = ItemAssemblyPath.parse(target.path);
    const destination = segments.pop();
    let parentInstanceId = target.rootInstanceId;
    for (const segment of segments) {
      const child = this.#assemblyReader.getChild(
        parentInstanceId,
        segment.slotId,
        segment.slotIndex,
      );
      if (!child) return false;
      parentInstanceId = child.instanceId;
    }
    this.#assemblyService.attach({
      rootInstanceId: target.rootInstanceId,
      parentInstanceId,
      sourceInstanceId: item.instanceId,
      slotId: destination.slotId,
      slotIndex: destination.slotIndex,
    });
    return true;
  }
}

globalThis.InventoryV2RefillInventoryPort = InventoryV2RefillInventoryPort;
globalThis.InventoryV2RefillTargetWriter = InventoryV2RefillTargetWriter;
