class InventoryV2SnapshotFactory {
  #repository;
  #assemblyStates;
  #equipmentState;
  #loadouts;
  #settings;
  #refillMemory;
  #itemSnapshotMapper;

  constructor({
    repository,
    assemblyStates,
    equipmentState,
    loadouts,
    settings,
    refillMemory,
    itemSnapshotMapper,
  } = {}) {
    this.#repository = repository;
    this.#assemblyStates = assemblyStates;
    this.#equipmentState = equipmentState;
    this.#loadouts = loadouts;
    this.#settings = settings;
    this.#refillMemory = refillMemory;
    if (!itemSnapshotMapper?.toSnapshots) {
      throw new TypeError(
        "InventoryV2SnapshotFactory requires InventoryItemSnapshotMapper",
      );
    }
    this.#itemSnapshotMapper = itemSnapshotMapper;
  }

  create() {
    return {
      schemaVersion: INVENTORY_V2_SCHEMA_VERSION,
      items: this.#itemSnapshotMapper.toSnapshots(this.#repository.list()),
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
