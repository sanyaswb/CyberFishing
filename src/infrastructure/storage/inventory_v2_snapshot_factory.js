class InventoryV2SnapshotFactory {
  #repository;
  #assemblyStates;
  #equipmentState;
  #loadouts;
  #settings;
  #refillMemory;

  constructor({
    repository,
    assemblyStates,
    equipmentState,
    loadouts,
    settings,
    refillMemory,
  } = {}) {
    this.#repository = repository;
    this.#assemblyStates = assemblyStates;
    this.#equipmentState = equipmentState;
    this.#loadouts = loadouts;
    this.#settings = settings;
    this.#refillMemory = refillMemory;
  }

  create() {
    return {
      schemaVersion: INVENTORY_V2_SCHEMA_VERSION,
      items: this.#repository.toSnapshot(),
      assemblies: this.#assemblyStates.toSnapshot(),
      equipment: this.#equipmentState.snapshot(),
      loadouts: this.#loadouts.toSnapshot(),
      settings: {
        ...this.#settings.snapshot(),
        refillMemory: this.#refillMemory?.snapshot?.() || {},
      },
    };
  }
}

globalThis.InventoryV2SnapshotFactory = InventoryV2SnapshotFactory;
