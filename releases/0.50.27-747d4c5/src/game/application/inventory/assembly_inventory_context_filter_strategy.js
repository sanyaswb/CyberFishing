export class AssemblyInventoryContextFilterStrategy {
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
