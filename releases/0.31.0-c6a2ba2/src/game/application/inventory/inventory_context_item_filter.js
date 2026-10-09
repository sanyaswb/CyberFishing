export class InventoryContextItemFilter {
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
