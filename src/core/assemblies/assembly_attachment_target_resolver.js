class AssemblyAttachmentTargetResolver {
  #repository;
  #stateRepository;
  #profileRegistry;
  #reader;

  constructor({ repository, stateRepository, profileRegistry, reader } = {}) {
    if (!repository) {
      throw new TypeError(
        "AssemblyAttachmentTargetResolver requires repository",
      );
    }
    if (!stateRepository) {
      throw new TypeError(
        "AssemblyAttachmentTargetResolver requires stateRepository",
      );
    }
    if (!profileRegistry) {
      throw new TypeError(
        "AssemblyAttachmentTargetResolver requires profileRegistry",
      );
    }
    if (!reader) {
      throw new TypeError("AssemblyAttachmentTargetResolver requires reader");
    }
    this.#repository = repository;
    this.#stateRepository = stateRepository;
    this.#profileRegistry = profileRegistry;
    this.#reader = reader;
  }

  listTargets(rootInstanceId) {
    if (
      !rootInstanceId ||
      !this.#repository.has(rootInstanceId) ||
      !this.#stateRepository.has(rootInstanceId)
    ) {
      return Object.freeze([]);
    }

    const targets = [];
    const visited = new Set();
    const rootState = this.#stateRepository.require(rootInstanceId);
    const visit = (parent, explicitProfileId, depth, parentContext = null) => {
      if (!parent || depth > 5 || visited.has(parent.instanceId)) return;
      visited.add(parent.instanceId);
      const profile = this.#profileRegistry.resolveForItem(
        parent,
        explicitProfileId,
      );
      if (profile) {
        for (const slotDefinition of profile.slots) {
          const capacity = this.#profileRegistry.getSlotCapacity(
            parent,
            slotDefinition,
          );
          for (let slotIndex = 0; slotIndex < capacity; slotIndex += 1) {
            targets.push(Object.freeze({
              rootInstanceId,
              parentInstanceId: parent.instanceId,
              slotId: slotDefinition.id,
              slotIndex,
              socketId: this.#reader.getPathToSlot(
                rootInstanceId,
                parent.instanceId,
                slotDefinition.id,
                slotIndex,
              ),
              capacity,
              depth,
              parentContext,
              slotDefinition,
              occupied: this.#reader.getChild(
                parent.instanceId,
                slotDefinition.id,
                slotIndex,
              ),
            }));
          }
        }
      }
      for (const child of this.#reader.getChildren(parent.instanceId)) {
        visit(
          child,
          null,
          depth + 1,
          Object.freeze({
            slotId: child.location?.slotId || "",
            slotIndex: Number(child.location?.slotIndex) || 0,
          }),
        );
      }
    };

    visit(
      this.#repository.require(rootInstanceId),
      rootState.profileId,
      0,
      null,
    );
    return Object.freeze(targets);
  }

  accepts(target, candidate) {
    return Boolean(
      target?.slotDefinition &&
      candidate &&
      candidate.instanceId !== target.rootInstanceId &&
      this.#profileRegistry.accepts(target.slotDefinition, candidate),
    );
  }

  findCompatibleTargets(rootInstanceId, candidate) {
    if (!candidate || candidate.instanceId === rootInstanceId) {
      return Object.freeze([]);
    }
    return Object.freeze(
      this.listTargets(rootInstanceId).filter((target) =>
        this.accepts(target, candidate),
      ),
    );
  }

  findPlacementTargets(rootInstanceId, candidate) {
    const compatible = this.findCompatibleTargets(rootInstanceId, candidate);
    const empty = compatible.filter((target) => !target.occupied);
    return Object.freeze(empty.length > 0 ? empty : [...compatible]);
  }

  hasCompatibleTarget(rootInstanceId, candidate) {
    if (!candidate || candidate.instanceId === rootInstanceId) return false;
    return this.listTargets(rootInstanceId).some((target) =>
      this.accepts(target, candidate),
    );
  }

  filterCompatibleCandidates(rootInstanceId, candidates = []) {
    const targets = this.listTargets(rootInstanceId);
    if (!targets.length) return Object.freeze([]);
    return Object.freeze(
      [...(candidates || [])].filter(
        (candidate) =>
          candidate?.instanceId !== rootInstanceId &&
          targets.some((target) => this.accepts(target, candidate)),
      ),
    );
  }
}

globalThis.AssemblyAttachmentTargetResolver =
  AssemblyAttachmentTargetResolver;
