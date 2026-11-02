export class InventoryItemViewFactory {
  #itemDatabase;
  #progressionResolver;
  #conditionResolver;
  #freshnessResolver;
  #chargeResolver;
  #displayStatsResolver;
  #runtimeContextProvider;
  #effectiveStatsResolver;
  #effectiveRarityResolver;
  #baitEffectivenessCatalogResolver;

  constructor({
    itemDatabase,
    progressionResolver,
    conditionResolver = null,
    freshnessResolver = null,
    chargeResolver = null,
    displayStatsResolver = null,
    runtimeContextProvider = () => ({}),
    effectiveStatsResolver,
    effectiveRarityResolver,
    baitEffectivenessCatalogResolver = null,
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
    if (freshnessResolver && typeof freshnessResolver.resolve !== "function") {
      throw new TypeError(
        "InventoryItemViewFactory freshnessResolver must implement resolve",
      );
    }
    this.#freshnessResolver = freshnessResolver;
    if (chargeResolver && typeof chargeResolver.resolve !== "function") {
      throw new TypeError(
        "InventoryItemViewFactory chargeResolver must implement resolve",
      );
    }
    this.#chargeResolver = chargeResolver;
    this.#displayStatsResolver = displayStatsResolver;
    this.#runtimeContextProvider = runtimeContextProvider;
    this.#effectiveStatsResolver = effectiveStatsResolver;
    if (
      !effectiveRarityResolver ||
      typeof effectiveRarityResolver.resolve !== "function"
    ) {
      throw new TypeError(
        "InventoryItemViewFactory effectiveRarityResolver must implement resolve",
      );
    }
    this.#effectiveRarityResolver = effectiveRarityResolver;
    if (
      baitEffectivenessCatalogResolver &&
      typeof baitEffectivenessCatalogResolver.resolve !== "function"
    ) {
      throw new TypeError(
        "InventoryItemViewFactory baitEffectivenessCatalogResolver must implement resolve",
      );
    }
    this.#baitEffectivenessCatalogResolver =
      baitEffectivenessCatalogResolver;
  }

  create(instance) {
    if (!instance?.itemId) return null;
    const baseItem = this.#itemDatabase.getItemData(instance.itemId);
    if (!baseItem) return null;
    const effectiveStats = this.#effectiveStatsResolver.resolve({
      definition: baseItem,
      instanceState: instance,
    });
    const rarity = this.#effectiveRarityResolver.resolve({
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
      rarity,
    };
    const runtimeContext = {
      ...(this.#runtimeContextProvider(hydrated) || {}),
      catalogItem: baseItem,
    };
    const charge = this.#chargeResolver?.resolve(hydrated) || null;
    if (charge) hydrated.charge = charge;
    this.#displayStatsResolver?.apply?.(hydrated, runtimeContext);
    hydrated.progression = this.#progressionResolver.resolve(
      hydrated,
      runtimeContext,
    );
    const condition = this.#conditionResolver?.resolve(hydrated) || null;
    if (condition) hydrated.condition = condition;
    const freshness = this.#freshnessResolver?.resolve(
      hydrated,
      undefined,
      { exposureMs: runtimeContext.freshnessExposureMs },
    ) || null;
    if (freshness) hydrated.freshness = freshness;
    const baitEffectiveness =
      this.#baitEffectivenessCatalogResolver?.resolve(hydrated, runtimeContext) ||
      null;
    if (baitEffectiveness?.available) {
      hydrated.baitEffectiveness = baitEffectiveness;
    }
    return hydrated;
  }

}
