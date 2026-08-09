class InventoryV2ContextItemFilter {
  #strategies;

  constructor({ strategies = [] } = {}) {
    this.#strategies = Object.freeze([...(strategies || [])]);
  }

  filter(items = [], context = {}) {
    const source = [...(items || [])];
    const strategy = this.#strategies.find((candidate) =>
      candidate?.supports?.(context),
    );
    if (!strategy) return Object.freeze(source);
    return Object.freeze([...(strategy.filter(source, context) || [])]);
  }
}

class AssemblyInventoryContextFilterStrategy {
  #targetResolver;

  constructor({ targetResolver } = {}) {
    if (!targetResolver?.filterCompatibleCandidates) {
      throw new TypeError(
        "AssemblyInventoryContextFilterStrategy requires targetResolver",
      );
    }
    this.#targetResolver = targetResolver;
  }

  supports(context = {}) {
    return context.mode === "assembly";
  }

  filter(items, context = {}) {
    return this.#targetResolver.filterCompatibleCandidates(
      context.rootInstanceId,
      items,
    );
  }
}

globalThis.InventoryV2ContextItemFilter = InventoryV2ContextItemFilter;
globalThis.AssemblyInventoryContextFilterStrategy =
  AssemblyInventoryContextFilterStrategy;
