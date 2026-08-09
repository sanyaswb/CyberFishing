class ItemAssemblyDomainError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "ItemAssemblyDomainError";
    this.code = code;
    this.details = details;
  }
}

class ItemAssemblyService {
  #repository;
  #stateRepository;
  #profileRegistry;
  #reader;
  #stackingPolicy;
  #capacityPolicy;
  #signaturePolicy;
  #reservationPolicy;

  constructor({
    repository,
    stateRepository,
    profileRegistry,
    reader = null,
    stackingPolicy = null,
    capacityPolicy = null,
    signaturePolicy = null,
    reservationPolicy = null,
  } = {}) {
    if (!repository) throw new TypeError("ItemAssemblyService requires repository");
    if (!stateRepository) {
      throw new TypeError("ItemAssemblyService requires stateRepository");
    }
    if (!profileRegistry) {
      throw new TypeError("ItemAssemblyService requires profileRegistry");
    }
    this.#repository = repository;
    this.#stateRepository = stateRepository;
    this.#profileRegistry = profileRegistry;
    this.#reader =
      reader ||
      new ItemAssemblyReader({ repository, stateRepository, profileRegistry });
    this.#stackingPolicy = stackingPolicy || new ItemAssemblyStackingPolicy();
    this.#capacityPolicy =
      capacityPolicy || new UnlimitedAssemblyCapacityPolicy();
    this.#signaturePolicy =
      signaturePolicy || new ExactAssemblyRefillSignaturePolicy();
    this.#reservationPolicy = reservationPolicy;
  }

  startAssembly(instanceId, { assemblyProfileId = null } = {}) {
    const source = this.#repository.require(instanceId);
    if (this.#stateRepository.has(instanceId)) return instanceId;
    this.#assertInventorySource(source);

    const profileId = this.#profileRegistry.resolveProfileIdForItem(
      source,
      assemblyProfileId,
    );
    if (!profileId) {
      throw this.#error(
        "PROFILE_NOT_FOUND",
        `Item ${source.itemId} has no assembly profile`,
        { instanceId },
      );
    }
    this.#assertCapacity({
      operation: "START_ASSEMBLY",
      incomingItems: source.quantity > 1 ? [source] : [],
      releasingInstanceIds: [],
    });

    return this.#transact(() => {
      const root = this.#repository.splitOne(instanceId);
      this.#stateRepository.create({
        rootInstanceId: root.instanceId,
        profileId,
      });
      return root.instanceId;
    });
  }

  prepare(rootInstanceId) {
    return this.#transact(() => {
      const state = this.#requireRoot(rootInstanceId);
      state.markPrepared();
      return state.toSnapshot();
    });
  }

  attach({
    rootInstanceId,
    parentInstanceId = rootInstanceId,
    sourceInstanceId,
    slotId,
    slotIndex = 0,
  } = {}) {
    return this.#transact(() =>
      this.#attachInternal({
        rootInstanceId,
        parentInstanceId,
        sourceInstanceId,
        slotId,
        slotIndex,
      }),
    );
  }

  detach({
    rootInstanceId,
    parentInstanceId = rootInstanceId,
    slotId,
    slotIndex = 0,
  } = {}) {
    const child = this.#requireChild(parentInstanceId, slotId, slotIndex);
    this.#assertBelongsToRoot(rootInstanceId, child.instanceId);
    const subtree = this.#subtree(child.instanceId);
    this.#assertCapacity({
      operation: "DETACH",
      incomingItems: subtree.map((entry) => entry.item),
      releasingInstanceIds: [],
    });

    return this.#transact(() =>
      this.#detachInternal({
        rootInstanceId,
        parentInstanceId,
        slotId,
        slotIndex,
        clearRefillPreference: true,
      }),
    );
  }

  replace({
    rootInstanceId,
    parentInstanceId = rootInstanceId,
    sourceInstanceId,
    slotId,
    slotIndex = 0,
  } = {}) {
    const existing = this.#requireChild(parentInstanceId, slotId, slotIndex);
    this.#validateAttachment({
      rootInstanceId,
      parentInstanceId,
      sourceInstanceId,
      slotId,
      slotIndex,
      allowOccupiedBy: existing.instanceId,
    });
    this.#assertCapacity({
      operation: "REPLACE",
      incomingItems: this.#subtree(existing.instanceId).map(
        (entry) => entry.item,
      ),
      releasingInstanceIds: [sourceInstanceId],
    });

    return this.#transact(() => {
      const detached = this.#detachInternal({
        rootInstanceId,
        parentInstanceId,
        slotId,
        slotIndex,
        clearRefillPreference: true,
      });
      const attached = this.#attachInternal({
        rootInstanceId,
        parentInstanceId,
        sourceInstanceId,
        slotId,
        slotIndex,
      });
      return { detached, attached };
    });
  }

  consume({
    rootInstanceId,
    parentInstanceId = rootInstanceId,
    slotId,
    slotIndex = 0,
  } = {}) {
    const child = this.#requireChild(parentInstanceId, slotId, slotIndex);
    this.#assertBelongsToRoot(rootInstanceId, child.instanceId);
    if (this.#repository.getChildren(child.instanceId).length > 0) {
      throw this.#error(
        "NON_LEAF_CONSUMPTION",
        `Cannot consume component ${child.instanceId} while it has children`,
      );
    }

    return this.#transact(() => {
      const path = this.#reader.getPathToSlot(
        rootInstanceId,
        parentInstanceId,
        slotId,
        slotIndex,
      );
      const removed = this.#repository.remove(child.instanceId);
      return { consumedItem: removed, path };
    });
  }

  disassemble(rootInstanceId) {
    this.#requireRoot(rootInstanceId);
    const root = this.#repository.require(rootInstanceId);
    const descendants = this.#repository.listDescendants(rootInstanceId);
    this.#assertCapacity({
      operation: "DISASSEMBLE",
      incomingItems: [root, ...descendants.map((entry) => entry.item)],
      releasingInstanceIds: [rootInstanceId],
    });

    return this.#transact(() => {
      const returnedInstanceIds = [];
      for (const entry of [...descendants].sort((left, right) => right.depth - left.depth)) {
        returnedInstanceIds.push(this.#returnToInventory(entry.item.instanceId));
      }
      this.#stateRepository.remove(rootInstanceId);
      if (!InventoryItemLocation.isInventory(root.location)) {
        this.#repository.setLocation(
          rootInstanceId,
          InventoryItemLocation.inventory(),
        );
      }
      const returnedRootInstanceId = this.#repository.mergeInventoryItem(
        rootInstanceId,
        this.#stackingPolicy,
        { canMerge: (item) => !this.#stateRepository.has(item.instanceId) },
      );
      returnedInstanceIds.push(returnedRootInstanceId);
      return {
        disassembledRootInstanceId: rootInstanceId,
        returnedRootInstanceId,
        returnedInstanceIds: [...new Set(returnedInstanceIds)],
      };
    });
  }

  clearRefillPreference(rootInstanceId, path) {
    return this.#transact(() => {
      const state = this.#requireRoot(rootInstanceId);
      state.clearRefill(path, { descendants: true });
      return state.toSnapshot();
    });
  }

  #attachInternal({
    rootInstanceId,
    parentInstanceId,
    sourceInstanceId,
    slotId,
    slotIndex,
  }) {
    const validation = this.#validateAttachment({
      rootInstanceId,
      parentInstanceId,
      sourceInstanceId,
      slotId,
      slotIndex,
    });
    const source = this.#repository.require(sourceInstanceId);
    const nestedAssemblyState = this.#stateRepository.get(sourceInstanceId);
    const attached = nestedAssemblyState
      ? source
      : this.#repository.splitOne(sourceInstanceId);
    this.#repository.setLocation(
      attached.instanceId,
      InventoryItemLocation.attached(parentInstanceId, slotId, slotIndex),
    );

    const path = this.#reader.getPathToSlot(
      rootInstanceId,
      parentInstanceId,
      slotId,
      slotIndex,
    );
    if (validation.slotDefinition.refillable) {
      this.#stateRepository
        .require(rootInstanceId)
        .rememberRefill(path, this.#signaturePolicy.create(attached));
    }
    if (nestedAssemblyState) {
      this.#absorbNestedAssemblyState({
        parentRootInstanceId: rootInstanceId,
        nestedRootInstanceId: attached.instanceId,
        destinationPath: path,
      });
    }
    return {
      rootInstanceId,
      attachedInstanceId: attached.instanceId,
      path,
    };
  }

  #detachInternal({
    rootInstanceId,
    parentInstanceId,
    slotId,
    slotIndex,
    clearRefillPreference,
  }) {
    const child = this.#requireChild(parentInstanceId, slotId, slotIndex);
    this.#assertBelongsToRoot(rootInstanceId, child.instanceId);
    const path = this.#reader.getPathToSlot(
      rootInstanceId,
      parentInstanceId,
      slotId,
      slotIndex,
    );
    const subtree = this.#subtree(child.instanceId);
    if (clearRefillPreference) {
      this.#stateRepository
        .require(rootInstanceId)
        .clearRefill(path, { descendants: true });
    }

    const returnedInstanceIds = [];
    for (const entry of [...subtree].sort((left, right) => right.depth - left.depth)) {
      returnedInstanceIds.push(this.#returnToInventory(entry.item.instanceId));
    }
    return {
      detachedInstanceId: child.instanceId,
      returnedInstanceIds: [...new Set(returnedInstanceIds)],
      path,
    };
  }

  #validateAttachment({
    rootInstanceId,
    parentInstanceId,
    sourceInstanceId,
    slotId,
    slotIndex,
    allowOccupiedBy = null,
  }) {
    const state = this.#requireRoot(rootInstanceId);
    const root = this.#repository.require(rootInstanceId);
    const parent = this.#repository.require(parentInstanceId);
    const source = this.#repository.require(sourceInstanceId);
    this.#assertBelongsToRoot(rootInstanceId, parentInstanceId);
    this.#assertInventorySource(source);
    if (source.instanceId === root.instanceId || source.instanceId === parent.instanceId) {
      throw this.#error("ATTACHMENT_CYCLE", "An assembly cannot contain itself");
    }
    const isNestedAssemblyRoot = this.#stateRepository.has(source.instanceId);
    if (
      this.#repository.getChildren(source.instanceId).length > 0 &&
      !isNestedAssemblyRoot
    ) {
      throw this.#error(
        "SOURCE_HAS_CHILDREN",
        "An attached source must not already own child components",
      );
    }

    const explicitProfileId =
      parent.instanceId === root.instanceId ? state.profileId : null;
    const slotDefinition = this.#profileRegistry.resolveSlot(
      parent,
      slotId,
      explicitProfileId,
    );
    if (!slotDefinition) {
      throw this.#error(
        "INVALID_SLOT",
        `Slot ${slotId} is not defined for ${parent.itemId}`,
      );
    }
    const capacity = this.#profileRegistry.getSlotCapacity(
      parent,
      slotDefinition,
    );
    if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= capacity) {
      throw this.#error(
        "INVALID_SLOT_INDEX",
        `Slot ${slotId}[${slotIndex}] is outside capacity ${capacity}`,
      );
    }
    if (!this.#profileRegistry.accepts(slotDefinition, source)) {
      throw this.#error(
        "INCOMPATIBLE_COMPONENT",
        `${source.itemId} is not compatible with slot ${slotId}`,
      );
    }
    const occupied = this.#repository.getChild(parentInstanceId, slotId, slotIndex);
    if (occupied && occupied.instanceId !== allowOccupiedBy) {
      throw this.#error(
        "SLOT_OCCUPIED",
        `Slot ${slotId}[${slotIndex}] is already occupied`,
      );
    }
    return { slotDefinition, capacity };
  }

  #absorbNestedAssemblyState({
    parentRootInstanceId,
    nestedRootInstanceId,
    destinationPath,
  }) {
    if (parentRootInstanceId === nestedRootInstanceId) {
      throw this.#error(
        "ATTACHMENT_CYCLE",
        "An assembly cannot absorb itself",
      );
    }
    const nestedState = this.#stateRepository.require(nestedRootInstanceId);
    const nestedSnapshot = nestedState.toSnapshot();
    const parentState = this.#stateRepository.require(parentRootInstanceId);
    for (const [nestedPath, signature] of Object.entries(
      nestedSnapshot.refillSignatures || {},
    )) {
      parentState.rememberRefill(
        `${destinationPath}.${nestedPath}`,
        signature,
      );
    }
    this.#stateRepository.remove(nestedRootInstanceId);
  }

  #requireRoot(rootInstanceId) {
    const root = this.#repository.require(rootInstanceId);
    const state = this.#stateRepository.require(rootInstanceId);
    if (InventoryItemLocation.isAttached(root.location)) {
      throw this.#error(
        "INVALID_ASSEMBLY_ROOT",
        `Assembly root ${rootInstanceId} cannot be attached to another item`,
      );
    }
    return state;
  }

  #requireChild(parentInstanceId, slotId, slotIndex) {
    const child = this.#repository.getChild(parentInstanceId, slotId, slotIndex);
    if (!child) {
      throw this.#error(
        "EMPTY_SLOT",
        `Slot ${slotId}[${slotIndex}] is empty on ${parentInstanceId}`,
      );
    }
    return child;
  }

  #assertBelongsToRoot(rootInstanceId, instanceId) {
    this.#requireRoot(rootInstanceId);
    const actualRootInstanceId = this.#reader.getRootInstanceId(instanceId);
    if (actualRootInstanceId !== rootInstanceId) {
      throw this.#error(
        "FOREIGN_COMPONENT",
        `${instanceId} does not belong to assembly ${rootInstanceId}`,
      );
    }
  }

  #assertInventorySource(source) {
    if (
      !InventoryItemLocation.isInventory(source.location) ||
      this.#reservationPolicy?.isReserved?.(source)
    ) {
      throw this.#error(
        "SOURCE_NOT_AVAILABLE",
        `Item ${source.instanceId} is not a free inventory item`,
      );
    }
  }

  #subtree(instanceId) {
    const root = this.#repository.require(instanceId);
    return [
      { item: root, depth: 0 },
      ...this.#repository.listDescendants(instanceId),
    ];
  }

  #returnToInventory(instanceId) {
    this.#repository.setLocation(
      instanceId,
      InventoryItemLocation.inventory(),
    );
    return this.#repository.mergeInventoryItem(
      instanceId,
      this.#stackingPolicy,
      { canMerge: (item) => !this.#stateRepository.has(item.instanceId) },
    );
  }

  #assertCapacity({ operation, incomingItems, releasingInstanceIds }) {
    const context = {
      operation,
      repository: this.#repository,
      incomingItems,
      releasingInstanceIds,
      incomingRootInstanceIds: (incomingItems || []).map(
        (item) => item.instanceId,
      ),
      outgoingRootInstanceIds: releasingInstanceIds || [],
    };
    const result = this.#capacityPolicy?.canApply
      ? this.#capacityPolicy.canApply(context)
      : this.#capacityPolicy?.evaluateTransition
        ? this.#capacityPolicy.evaluateTransition(context)
        : { allowed: true };
    const allowed = typeof result === "boolean" ? result : result?.allowed !== false;
    if (!allowed) {
      throw this.#error(
        "INVENTORY_CAPACITY_EXCEEDED",
        result?.reason ||
          result?.warning ||
          "Inventory has no room for this operation",
      );
    }
  }

  #transact(action) {
    const itemSnapshot = this.#repository.createSnapshot();
    const stateSnapshot = this.#stateRepository.createSnapshot();
    try {
      return action();
    } catch (error) {
      this.#repository.restoreSnapshot(itemSnapshot);
      this.#stateRepository.restoreSnapshot(stateSnapshot);
      throw error;
    }
  }

  #error(code, message, details = {}) {
    return new ItemAssemblyDomainError(code, message, details);
  }
}
