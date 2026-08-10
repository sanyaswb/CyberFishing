class InventoryV2ContextItemFilter {
  #strategies;

  constructor({ strategies = [] } = {}) {
    this.#strategies = Object.freeze([...(strategies || [])]);
  }

  filter(items = [], context = {}) {
    const source = [...(items || [])];
    const strategy = this.#strategies.find((candidate) =>
      candidate?.supports?.(context),
    );
    if (!strategy) return Object.freeze(source);
    return Object.freeze([...(strategy.filter(source, context) || [])]);
  }
}

class AssemblyInventoryContextFilterStrategy {
  #targetResolver;

  constructor({ targetResolver } = {}) {
    if (!targetResolver?.filterCompatibleCandidates) {
      throw new TypeError(
        "AssemblyInventoryContextFilterStrategy requires targetResolver",
      );
    }
    this.#targetResolver = targetResolver;
  }

  supports(context = {}) {
    return context.mode === "assembly";
  }

  filter(items, context = {}) {
    return this.#targetResolver.filterCompatibleCandidates(
      context.rootInstanceId,
      items,
    );
  }
}

class EquipmentInventoryContextFilterStrategy {
  #equipmentState;
  #compatibilityPolicy;
  #visibilityPolicy;
  #targetResolver;
  #itemReader;
  #slotIds;

  constructor({
    equipmentState,
    compatibilityPolicy,
    visibilityPolicy,
    targetResolver,
    itemReader,
    slotIds = typeof EQUIPMENT_ALL_SLOT_IDS !== "undefined"
      ? EQUIPMENT_ALL_SLOT_IDS
      : [],
  } = {}) {
    if (!equipmentState?.snapshot) {
      throw new TypeError(
        "EquipmentInventoryContextFilterStrategy requires equipmentState",
      );
    }
    if (!compatibilityPolicy?.isCompatible) {
      throw new TypeError(
        "EquipmentInventoryContextFilterStrategy requires compatibilityPolicy",
      );
    }
    if (!visibilityPolicy?.isVisible) {
      throw new TypeError(
        "EquipmentInventoryContextFilterStrategy requires visibilityPolicy",
      );
    }
    if (!targetResolver?.listTargets || !targetResolver?.accepts) {
      throw new TypeError(
        "EquipmentInventoryContextFilterStrategy requires targetResolver",
      );
    }
    if (typeof itemReader !== "function") {
      throw new TypeError(
        "EquipmentInventoryContextFilterStrategy requires itemReader",
      );
    }
    this.#equipmentState = equipmentState;
    this.#compatibilityPolicy = compatibilityPolicy;
    this.#visibilityPolicy = visibilityPolicy;
    this.#targetResolver = targetResolver;
    this.#itemReader = itemReader;
    this.#slotIds = Object.freeze([...(slotIds || [])]);
  }

  supports(context = {}) {
    return context.mode === "equipment-compatible";
  }

  filter(items = []) {
    const equipment = this.#equipmentState.snapshot();
    const rodInstanceId = equipment.rod || null;
    const rod = this.#readItem(rodInstanceId);
    const candidateSlotIds = this.#slotIds.filter(
      (slotId) =>
        !(slotId === "rod" && rodInstanceId) &&
        this.#visibilityPolicy.isVisible(slotId, { rod }),
    );
    const assemblyRootIds = [
      ...new Set(Object.values(equipment).filter(Boolean)),
    ];
    const assemblyTargets = assemblyRootIds.flatMap((rootInstanceId) =>
      this.#targetResolver.listTargets(rootInstanceId),
    );

    return Object.freeze(
      [...(items || [])].filter((rawItem) => {
        const item = this.#readItem(rawItem) || rawItem;
        const fitsEquipment = candidateSlotIds.some((slotId) =>
          this.#compatibilityPolicy.isCompatible({
            slotId,
            item,
            equipmentState: this.#equipmentState,
            rod,
            enforceReadiness: false,
          }),
        );
        if (fitsEquipment) return true;
        return assemblyTargets.some((target) =>
          this.#targetResolver.accepts(target, item),
        );
      }),
    );
  }

  #readItem(itemOrInstanceId) {
    if (!itemOrInstanceId) return null;
    return this.#itemReader(itemOrInstanceId) || null;
  }
}

globalThis.InventoryV2ContextItemFilter = InventoryV2ContextItemFilter;
globalThis.AssemblyInventoryContextFilterStrategy =
  AssemblyInventoryContextFilterStrategy;
globalThis.EquipmentInventoryContextFilterStrategy =
  EquipmentInventoryContextFilterStrategy;
