class EquipmentLoadoutRepository {
  #loadouts = new Map();

  constructor({ loadouts = [] } = {}) {
    for (const snapshot of loadouts || []) this.add(snapshot);
  }

  has(loadoutId) {
    return this.#loadouts.has(loadoutId);
  }

  get(loadoutId) {
    return this.#loadouts.get(loadoutId) || null;
  }

  require(loadoutId) {
    const loadout = this.get(loadoutId);
    if (!loadout) throw new RangeError(`Unknown equipment loadout: ${loadoutId}`);
    return loadout;
  }

  add(loadout) {
    const entity =
      loadout instanceof EquipmentLoadout
        ? loadout
        : new EquipmentLoadout(loadout);
    if (this.has(entity.loadoutId)) {
      throw new RangeError(`Duplicate equipment loadout: ${entity.loadoutId}`);
    }
    this.#loadouts.set(entity.loadoutId, entity);
    return entity;
  }

  remove(loadoutId) {
    const loadout = this.require(loadoutId);
    this.#loadouts.delete(loadoutId);
    return loadout;
  }

  list() {
    return [...this.#loadouts.values()];
  }

  findByRootInstanceId(instanceId) {
    return (
      this.list().find((loadout) => loadout.containsRoot(instanceId)) || null
    );
  }

  toSnapshot() {
    return this.list().map((loadout) => ({ ...loadout.snapshot() }));
  }

  createSnapshot() {
    return this.toSnapshot();
  }

  restoreSnapshot(snapshot) {
    const replacement = new Map();
    for (const entry of snapshot || []) {
      const loadout = new EquipmentLoadout(entry);
      if (replacement.has(loadout.loadoutId)) {
        throw new RangeError(`Duplicate equipment loadout: ${loadout.loadoutId}`);
      }
      replacement.set(loadout.loadoutId, loadout);
    }
    this.#loadouts = replacement;
  }
}

globalThis.EquipmentLoadoutRepository = EquipmentLoadoutRepository;
