// Runtime context of inventory item views: the live reel config, the line-capacity context and the bait
// freshness exposure. Gameplay installs the line-capacity and freshness providers after composition.
//
// The line-capacity context reads the equipment of the legacy save that seeded Inventory V2 at startup (as the
// classic inventory did), not the live V2 equipment; this pre-existing behavior is kept unchanged.
export class InventoryItemViewContext {
  #runtimeConfigProvider;
  #itemDatabase;
  #legacyInventory;
  #legacyEquipment;
  #lineCapacityStateProvider = () => null;
  #freshnessExposureProvider = () => 0;

  constructor({ runtimeConfigProvider, itemDatabase, legacyInventory, legacyEquipment }) {
    this.#runtimeConfigProvider = runtimeConfigProvider;
    this.#itemDatabase = itemDatabase;
    this.#legacyInventory = legacyInventory;
    this.#legacyEquipment = legacyEquipment;
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
    const equipment = this.#legacyEquipment;
    const reelInstance = equipment.reelId
      ? this.#legacyInventory.getInstance(equipment.reelId)
      : null;
    const reelBase = reelInstance?.itemId
      ? this.#itemDatabase.getItemData(reelInstance.itemId)
      : null;
    const reelCapacity = Number(
      reelInstance?.statOverrides?.lineCapacityMeters ??
        reelBase?.gameplayStats?.lineCapacityMeters,
    );
    return {
      equippedLineInstanceId: equipment.lineId || null,
      reelCapacityMeters: Number.isFinite(reelCapacity)
        ? Math.max(0, reelCapacity)
        : null,
      activeState: this.#lineCapacityStateProvider() || null,
    };
  }
}
