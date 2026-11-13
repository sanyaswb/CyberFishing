// Derives the available reserve for selected and remembered refill choices; never takes items.
export class InventoryAutoRefillStockReadModel {
  #repository;
  #inventoryPort;
  #signaturePolicy;
  #targetProvider;

  constructor({ repository, inventoryPort, signaturePolicy, targetProvider }) {
    this.#repository = repository;
    this.#inventoryPort = inventoryPort;
    this.#signaturePolicy = signaturePolicy;
    this.#targetProvider = targetProvider;
  }

  count({ items = [], scopes = [] } = {}) {
    const signatures = new Map();
    const add = (signature) => {
      if (signature) signatures.set(this.#signaturePolicy.toKey(signature), signature);
    };
    for (const reference of items) {
      const raw = reference?.instanceId ? this.#repository.get(reference.instanceId) : null;
      if (raw) add(this.#signaturePolicy.create(raw));
    }
    for (const scope of scopes) {
      for (const target of this.#targetProvider.listTargets(scope)) add(target.signature);
    }
    let count = 0;
    for (const signature of signatures.values()) count += this.#inventoryPort.countExact(signature);
    return count;
  }

  shareReserve(items) {
    if (!items.length) return false;
    let firstKey;
    for (const reference of items) {
      const raw = reference?.instanceId ? this.#repository.get(reference.instanceId) : null;
      const signature = raw ? this.#signaturePolicy.create(raw) : null;
      if (!signature) return false;
      const key = this.#signaturePolicy.toKey(signature);
      if (firstKey !== undefined && key !== firstKey) return false;
      firstKey = key;
    }
    return true;
  }
}
