// Runtime context of inventory item views: the live reel config, the line-capacity context of the currently
// equipped reel and line, and the bait freshness exposure. Composition attaches the inventory equipment after
// the inventory exists; gameplay installs the line-capacity and freshness providers later.
export class InventoryItemViewContext {
  #runtimeConfigProvider;
  #itemDatabase;
  #effectiveStatsResolver;
  #equipmentState = null;
  #assemblyReader = null;
  #repository = null;
  #lineCapacityStateProvider = () => null;
  #freshnessExposureProvider = () => 0;

  constructor({ runtimeConfigProvider, itemDatabase, effectiveStatsResolver }) {
    this.#runtimeConfigProvider = runtimeConfigProvider;
    this.#itemDatabase = itemDatabase;
    this.#effectiveStatsResolver = effectiveStatsResolver;
  }

  attachEquipment({ equipmentState, assemblyReader, repository }) {
    this.#equipmentState = equipmentState;
    this.#assemblyReader = assemblyReader;
    this.#repository = repository;
  }

  setLineCapacityStateProvider(provider) {
    if (typeof provider !== "function") {
      throw new TypeError("Line capacity state provider must be a function");
    }
    this.#lineCapacityStateProvider = provider;
  }

  setFreshnessExposureProvider(provider) {
    if (typeof provider !== "function") {
      throw new TypeError("Freshness exposure provider must be a function");
    }
    this.#freshnessExposureProvider = provider;
  }

  resolve(item) {
    return {
      reelConfig: this.#runtimeConfigProvider.getReelConfig(),
      lineCapacity: this.#buildLineCapacityContext(),
      freshnessExposureMs: this.#freshnessExposureProvider(item),
    };
  }

  #buildLineCapacityContext() {
    const reelInstanceId = this.#equipmentState?.getRootInstanceId("reel") || null;
    const reelInstance = reelInstanceId ? this.#repository.get(reelInstanceId) : null;
    const equippedLine = reelInstanceId
      ? this.#assemblyReader.getChild(reelInstanceId, "line", 0)
      : this.#repository?.get(this.#equipmentState?.getRootInstanceId("terminalLine")) || null;
    const reelDefinition = reelInstance?.itemId
      ? this.#itemDatabase.getItemData(reelInstance.itemId)
      : null;
    // The same effective reel capacity the fight, landing and casting rules use.
    const reelCapacity = reelDefinition
      ? Number(this.#effectiveStatsResolver.resolve({
          definition: reelDefinition,
          instanceState: reelInstance,
        }).lineCapacityMeters)
      : NaN;
    return {
      equippedLineInstanceId: equippedLine?.instanceId || null,
      reelCapacityMeters: Number.isFinite(reelCapacity)
        ? Math.max(0, reelCapacity)
        : null,
      activeState: this.#lineCapacityStateProvider() || null,
    };
  }
}
