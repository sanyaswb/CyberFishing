class AssemblyStateRepository {
  #states = new Map();

  constructor({ states = [] } = {}) {
    const snapshots = Array.isArray(states)
      ? states
      : Object.values(states || {});
    for (const snapshot of snapshots) this.add(new AssemblyState(snapshot));
  }

  has(rootInstanceId) {
    return this.#states.has(rootInstanceId);
  }

  get(rootInstanceId) {
    return this.#states.get(rootInstanceId) || null;
  }

  require(rootInstanceId) {
    const state = this.get(rootInstanceId);
    if (!state) throw new RangeError(`Unknown assembly root: ${rootInstanceId}`);
    return state;
  }

  add(state) {
    const normalized =
      state instanceof AssemblyState ? state : new AssemblyState(state);
    if (this.has(normalized.rootInstanceId)) {
      throw new RangeError(`Assembly state already exists: ${normalized.rootInstanceId}`);
    }
    this.#states.set(normalized.rootInstanceId, normalized);
    return normalized;
  }

  create({ rootInstanceId, profileId } = {}) {
    return this.add(
      new AssemblyState({
        rootInstanceId,
        profileId,
        status: AssemblyPreparationStatus.DRAFT,
      }),
    );
  }

  remove(rootInstanceId) {
    const state = this.require(rootInstanceId);
    this.#states.delete(rootInstanceId);
    return state;
  }

  list() {
    return [...this.#states.values()];
  }

  toSnapshot() {
    return this.list().map((state) => state.toSnapshot());
  }

  createSnapshot() {
    return this.toSnapshot();
  }

  restoreSnapshot(snapshot) {
    const replacement = new Map();
    for (const entry of snapshot || []) {
      const state = new AssemblyState(entry);
      if (replacement.has(state.rootInstanceId)) {
        throw new RangeError(`Duplicate assembly state: ${state.rootInstanceId}`);
      }
      replacement.set(state.rootInstanceId, state);
    }
    this.#states = replacement;
  }
}
