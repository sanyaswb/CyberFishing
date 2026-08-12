class InventoryItemViewFactory {
  #itemDatabase;
  #progressionResolver;
  #conditionResolver;
  #displayStatsResolver;
  #runtimeContextProvider;
  #effectiveStatsResolver;

  constructor({
    itemDatabase,
    progressionResolver,
    conditionResolver = null,
    displayStatsResolver = null,
    runtimeContextProvider = () => ({}),
    effectiveStatsResolver = new EffectiveItemStatsResolver(),
  } = {}) {
    if (!itemDatabase || typeof itemDatabase.getItemData !== "function") {
      throw new TypeError("InventoryItemViewFactory requires itemDatabase");
    }
    if (!progressionResolver || typeof progressionResolver.resolve !== "function") {
      throw new TypeError(
        "InventoryItemViewFactory requires progressionResolver",
      );
    }
    this.#itemDatabase = itemDatabase;
    this.#progressionResolver = progressionResolver;
    if (conditionResolver && typeof conditionResolver.resolve !== "function") {
      throw new TypeError(
        "InventoryItemViewFactory conditionResolver must implement resolve",
      );
    }
    this.#conditionResolver = conditionResolver;
    this.#displayStatsResolver = displayStatsResolver;
    this.#runtimeContextProvider = runtimeContextProvider;
    this.#effectiveStatsResolver = effectiveStatsResolver;
  }

  create(instance) {
    if (!instance?.itemId) return null;
    const baseItem = this.#itemDatabase.getItemData(instance.itemId);
    if (!baseItem) return null;
    const effectiveStats = this.#effectiveStatsResolver.resolve({
      definition: baseItem,
      instanceState: instance,
    });
    const { gameplayStats: _authoredStats, ...definitionMetadata } = baseItem;
    const hydrated = {
      ...definitionMetadata,
      ...instance,
      effectiveStats,
      displayStats: { ...(baseItem.displayStats || {}) },
      instanceId: instance.instanceId,
      quantity: instance.quantity || 1,
      buildId: instance.buildId,
      rarity: instance.rarity ?? null,
    };
    const runtimeContext = {
      ...(this.#runtimeContextProvider() || {}),
      catalogItem: baseItem,
    };
    this.#displayStatsResolver?.apply?.(hydrated, runtimeContext);
    hydrated.progression = this.#progressionResolver.resolve(
      hydrated,
      runtimeContext,
    );
    hydrated.condition = this.#conditionResolver?.resolve(hydrated) || null;
    return hydrated;
  }

}
