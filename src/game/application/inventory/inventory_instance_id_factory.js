// Creates inventory instance ids: the injected random id source when it yields one, otherwise a
// timestamp/counter id (the production path when crypto.randomUUID is unavailable, e.g. an insecure context).
export class InventoryInstanceIdFactory {
  static #fallbackId = 0;

  #makeRandomId;
  #now;

  constructor({ makeRandomId = null, now }) {
    this.#makeRandomId = makeRandomId;
    this.#now = now;
  }

  create(prefix) {
    const randomId = this.#makeRandomId?.(prefix);
    if (randomId != null) return randomId;

    InventoryInstanceIdFactory.#fallbackId++;
    return `${prefix}_${this.#now()}_${InventoryInstanceIdFactory.#fallbackId}`;
  }
}
