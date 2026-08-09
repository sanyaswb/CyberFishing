class ItemAssemblyPath {
  static parse(path) {
    if (typeof path !== "string" || path.trim().length === 0) {
      throw new TypeError("Assembly path must be a non-empty string");
    }
    return path.split(".").map((rawSegment) => {
      const match = rawSegment.match(/^([A-Za-z][A-Za-z0-9_-]*)(?:\[(\d+)\])?$/);
      if (!match) throw new RangeError(`Invalid assembly path segment: ${rawSegment}`);
      return {
        slotId: match[1],
        slotIndex: match[2] == null ? 0 : Number(match[2]),
      };
    });
  }
}

class ItemAssemblyReader {
  #repository;
  #stateRepository;
  #profileRegistry;

  constructor({ repository, stateRepository, profileRegistry } = {}) {
    if (!repository) throw new TypeError("ItemAssemblyReader requires repository");
    if (!stateRepository) {
      throw new TypeError("ItemAssemblyReader requires stateRepository");
    }
    if (!profileRegistry) {
      throw new TypeError("ItemAssemblyReader requires profileRegistry");
    }
    this.#repository = repository;
    this.#stateRepository = stateRepository;
    this.#profileRegistry = profileRegistry;
  }

  getChild(parentInstanceId, slotId, slotIndex = 0) {
    return this.#repository.getChild(parentInstanceId, slotId, slotIndex);
  }

  getChildren(parentInstanceId, slotId = null) {
    return this.#repository.getChildren(parentInstanceId, slotId);
  }

  getSlotCapacity(parentInstanceId, slotId) {
    const parent = this.#repository.require(parentInstanceId);
    const rootInstanceId = this.getRootInstanceId(parentInstanceId);
    const definition = this.#resolveSlotDefinition(
      rootInstanceId,
      parent,
      slotId,
    );
    return definition
      ? this.#profileRegistry.getSlotCapacity(parent, definition)
      : 0;
  }

  readSlot(parentInstanceId, slotId, slotIndex = 0) {
    return this.getChild(parentInstanceId, slotId, slotIndex);
  }

  readChildren(parentInstanceId, slotId = null) {
    return this.getChildren(parentInstanceId, slotId);
  }

  readPath(rootInstanceId, path) {
    this.#repository.require(rootInstanceId);
    let current = this.#repository.get(rootInstanceId);
    for (const segment of ItemAssemblyPath.parse(path)) {
      current = this.getChild(
        current.instanceId,
        segment.slotId,
        segment.slotIndex,
      );
      if (!current) return null;
    }
    return current;
  }

  getRootInstanceId(instanceId) {
    let current = this.#repository.require(instanceId);
    const visited = new Set();
    while (InventoryItemLocation.isAttached(current.location)) {
      if (visited.has(current.instanceId)) {
        throw new Error(`Attachment cycle detected at ${current.instanceId}`);
      }
      visited.add(current.instanceId);
      current = this.#repository.require(current.location.parentInstanceId);
    }
    return current.instanceId;
  }

  getAssemblyState(rootInstanceId) {
    const state = this.#stateRepository.get(rootInstanceId);
    return state ? state.toSnapshot() : null;
  }

  getRefillSignature(rootInstanceId, path) {
    const state = this.#stateRepository.get(rootInstanceId);
    return state ? state.getRefillSignature(path) : null;
  }

  getPathToSlot(rootInstanceId, parentInstanceId, slotId, slotIndex = 0) {
    const root = this.#repository.require(rootInstanceId);
    const parent = this.#repository.require(parentInstanceId);
    if (this.getRootInstanceId(parent.instanceId) !== root.instanceId) {
      throw new Error(`${parentInstanceId} does not belong to assembly ${rootInstanceId}`);
    }

    const parentPath =
      parent.instanceId === root.instanceId
        ? ""
        : this.getPathToItem(root.instanceId, parent.instanceId);
    const slotDefinition = this.#resolveSlotDefinition(
      root.instanceId,
      parent,
      slotId,
    );
    if (!slotDefinition) {
      throw new RangeError(`Unknown slot ${slotId} on ${parent.instanceId}`);
    }
    const segment = this.#formatSegment(slotDefinition, slotIndex);
    return parentPath ? `${parentPath}.${segment}` : segment;
  }

  getPathToItem(rootInstanceId, targetInstanceId) {
    const root = this.#repository.require(rootInstanceId);
    let current = this.#repository.require(targetInstanceId);
    if (this.getRootInstanceId(current.instanceId) !== root.instanceId) {
      throw new Error(`${targetInstanceId} does not belong to assembly ${rootInstanceId}`);
    }
    if (current.instanceId === root.instanceId) return "";

    const segments = [];
    while (current.instanceId !== root.instanceId) {
      const location = current.location;
      if (!InventoryItemLocation.isAttached(location)) {
        throw new Error(`${targetInstanceId} has no path from ${rootInstanceId}`);
      }
      const parent = this.#repository.require(location.parentInstanceId);
      const definition = this.#resolveSlotDefinition(
        root.instanceId,
        parent,
        location.slotId,
      );
      if (!definition) {
        throw new RangeError(`Unknown slot ${location.slotId} on ${parent.instanceId}`);
      }
      segments.unshift(this.#formatSegment(definition, location.slotIndex));
      current = parent;
    }
    return segments.join(".");
  }

  listDescendants(rootInstanceId) {
    return this.#repository
      .listDescendants(rootInstanceId)
      .map((entry) => entry.item);
  }

  #resolveSlotDefinition(rootInstanceId, parent, slotId) {
    const explicitProfileId =
      parent.instanceId === rootInstanceId
        ? this.#stateRepository.require(rootInstanceId).profileId
        : null;
    return this.#profileRegistry.resolveSlot(parent, slotId, explicitProfileId);
  }

  #formatSegment(slotDefinition, slotIndex) {
    const isRepeated =
      Boolean(slotDefinition.capacityProperty) || slotDefinition.capacity > 1;
    return isRepeated
      ? `${slotDefinition.id}[${slotIndex}]`
      : slotDefinition.id;
  }
}
