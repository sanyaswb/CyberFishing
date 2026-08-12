class InventoryV2ItemHydrator {
  #definitionResolver;
  #plainDefinitions = new Map();
  #effectiveStatsResolver;

  constructor({
    itemDefinitionResolver = null,
    effectiveStatsResolver = new EffectiveItemStatsResolver(),
  } = {}) {
    this.#definitionResolver = itemDefinitionResolver;
    this.#effectiveStatsResolver = effectiveStatsResolver;
    if (
      itemDefinitionResolver &&
      typeof itemDefinitionResolver === "object" &&
      typeof itemDefinitionResolver.getItemData !== "function" &&
      typeof itemDefinitionResolver.get !== "function"
    ) {
      for (const [categoryId, category] of Object.entries(itemDefinitionResolver)) {
        if (!category || typeof category !== "object" || Array.isArray(category)) {
          continue;
        }
        for (const [itemId, definition] of Object.entries(category)) {
          if (definition && typeof definition === "object") {
            this.#plainDefinitions.set(itemId, definition);
          }
        }
      }
    }
  }

  getDefinition(itemId) {
    if (!itemId) return null;
    if (typeof this.#definitionResolver === "function") {
      return this.#normalizeDefinition(
        this.#definitionResolver(itemId) || null,
      );
    }
    const definition = (
      this.#definitionResolver?.getItemData?.(itemId) ||
      this.#definitionResolver?.get?.(itemId) ||
      this.#plainDefinitions.get(itemId) ||
      null
    );
    return this.#normalizeDefinition(definition);
  }

  hydrate(itemOrInstanceId, repository = null) {
    const raw =
      typeof itemOrInstanceId === "string"
        ? repository?.get?.(itemOrInstanceId)
        : itemOrInstanceId;
    if (!raw) return null;
    const definition = this.getDefinition(raw.itemId) || {};
    const effectiveStats = this.#effectiveStatsResolver.resolve({
      definition,
      instanceState: raw,
    });
    const { gameplayStats: _authoredStats, ...definitionMetadata } = definition;
    return {
      ...definitionMetadata,
      ...raw,
      id: definition.id || raw.itemId,
      itemId: raw.itemId,
      instanceId: raw.instanceId,
      quantity: raw.quantity,
      itemType: raw.itemType || definition.itemType || null,
      variant: raw.variant || definition.variant || null,
      effectiveStats,
    };
  }

  #normalizeDefinition(definition) {
    if (!definition || typeof definition !== "object") return null;
    const { gameplayStats: authoredStats = {}, ...metadata } = definition;
    return {
      ...metadata,
      itemType: definition.itemType || null,
      variant: definition.variant || null,
      gameplayStats: { ...authoredStats },
    };
  }
}

globalThis.InventoryV2ItemHydrator = InventoryV2ItemHydrator;
