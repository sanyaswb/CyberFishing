class InventoryItemViewFactory {
  static #identityKeys = new Set([
    "instanceId",
    "itemId",
    "quantity",
    "buildId",
    "buildName",
    "rarity",
  ]);
  static #derivedKeys = new Set([
    "progression",
    "powerPercent",
    "powerLevel",
    "normalizedPower",
    "powerColor",
    "powerGradient",
    "qualityMax",
    "capacityPercent",
    "capacityMeters",
    "capacityMaximumMeters",
    "condition",
    "conditionPercent",
  ]);

  #itemDatabase;
  #progressionResolver;
  #conditionResolver;
  #displayStatsResolver;
  #runtimeContextProvider;

  constructor({
    itemDatabase,
    progressionResolver,
    conditionResolver = null,
    displayStatsResolver = null,
    runtimeContextProvider = () => ({}),
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
  }

  create(instance) {
    if (!instance?.itemId) return null;
    const baseItem = this.#itemDatabase.getItemData(instance.itemId);
    if (!baseItem) return null;
    const overrides = this.#runtimeOverrides(instance);
    const hydrated = {
      ...baseItem,
      ...overrides,
      engineStats: {
        ...(baseItem.engineStats || {}),
        ...overrides,
      },
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

  #runtimeOverrides(instance) {
    const overrides = {};
    for (const [key, value] of Object.entries(instance || {})) {
      if (
        InventoryItemViewFactory.#identityKeys.has(key) ||
        InventoryItemViewFactory.#derivedKeys.has(key) ||
        value === undefined ||
        typeof value === "function"
      ) {
        continue;
      }
      overrides[key] = value;
    }
    return overrides;
  }
}
