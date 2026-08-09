class AssemblyCompletionPolicy {
  #repository;
  #profileRegistry;
  #assemblyReader;

  constructor({ repository, profileRegistry, assemblyReader } = {}) {
    if (!repository || !profileRegistry || !assemblyReader) {
      throw new TypeError(
        "AssemblyCompletionPolicy requires repository, profileRegistry and assemblyReader",
      );
    }
    this.#repository = repository;
    this.#profileRegistry = profileRegistry;
    this.#assemblyReader = assemblyReader;
  }

  analyze(rootInstanceId, { profileId = null } = {}) {
    const root = this.#repository.get(rootInstanceId);
    if (!root) {
      return Object.freeze({
        hasSlots: false,
        hasAnyComponent: false,
        isComplete: true,
        filledSlotCount: 0,
        totalSlotCount: 0,
      });
    }
    return Object.freeze(
      this.#analyzeItem(root, profileId, new Set()),
    );
  }

  #analyzeItem(item, explicitProfileId, visited) {
    if (visited.has(item.instanceId)) {
      throw new RangeError(`Assembly cycle detected at ${item.instanceId}`);
    }
    const profile = this.#profileRegistry.resolveForItem(
      item,
      explicitProfileId,
    );
    if (!profile) {
      return {
        hasSlots: false,
        hasAnyComponent: false,
        isComplete: true,
        filledSlotCount: 0,
        totalSlotCount: 0,
      };
    }

    visited.add(item.instanceId);
    let totalSlotCount = 0;
    let filledSlotCount = 0;
    let hasAnyComponent = false;
    let isComplete = true;

    for (const definition of profile.slots) {
      const capacity = this.#profileRegistry.getSlotCapacity(item, definition);
      for (let slotIndex = 0; slotIndex < capacity; slotIndex += 1) {
        totalSlotCount += 1;
        const child = this.#assemblyReader.getChild(
          item.instanceId,
          definition.id,
          slotIndex,
        );
        if (!child) {
          isComplete = false;
          continue;
        }

        hasAnyComponent = true;
        filledSlotCount += 1;
        const childResult = this.#analyzeItem(child, null, visited);
        totalSlotCount += childResult.totalSlotCount;
        filledSlotCount += childResult.filledSlotCount;
        hasAnyComponent =
          hasAnyComponent || childResult.hasAnyComponent;
        isComplete = isComplete && childResult.isComplete;
      }
    }

    visited.delete(item.instanceId);
    return {
      hasSlots: totalSlotCount > 0,
      hasAnyComponent,
      isComplete: totalSlotCount === 0 || isComplete,
      filledSlotCount,
      totalSlotCount,
    };
  }
}

globalThis.AssemblyCompletionPolicy = AssemblyCompletionPolicy;
