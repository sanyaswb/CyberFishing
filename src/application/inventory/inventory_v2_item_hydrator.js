class InventoryV2ItemHydrator {
  #definitionResolver;
  #plainDefinitions = new Map();

  constructor({ itemDefinitionResolver = null } = {}) {
    this.#definitionResolver = itemDefinitionResolver;
    if (
      itemDefinitionResolver &&
      typeof itemDefinitionResolver === "object" &&
      typeof itemDefinitionResolver.getItemData !== "function" &&
      typeof itemDefinitionResolver.get !== "function"
    ) {
      for (const category of Object.values(itemDefinitionResolver)) {
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
      return this.#definitionResolver(itemId) || null;
    }
    return (
      this.#definitionResolver?.getItemData?.(itemId) ||
      this.#definitionResolver?.get?.(itemId) ||
      this.#plainDefinitions.get(itemId) ||
      null
    );
  }

  hydrate(itemOrInstanceId, repository = null) {
    const raw =
      typeof itemOrInstanceId === "string"
        ? repository?.get?.(itemOrInstanceId)
        : itemOrInstanceId;
    if (!raw) return null;
    const definition = this.getDefinition(raw.itemId) || {};
    const engineStats = {
      ...(definition.engineStats || {}),
      ...(raw.engineStats || {}),
    };
    return {
      ...definition,
      ...raw,
      id: definition.id || raw.itemId,
      itemId: raw.itemId,
      instanceId: raw.instanceId,
      quantity: raw.quantity,
      type:
        raw.type ||
        raw.engineStats?.type ||
        definition.type ||
        definition.engineStats?.type ||
        null,
      engineStats,
    };
  }
}

globalThis.InventoryV2ItemHydrator = InventoryV2ItemHydrator;
