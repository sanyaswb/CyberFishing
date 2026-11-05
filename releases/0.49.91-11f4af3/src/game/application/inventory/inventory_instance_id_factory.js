// Creates inventory instance ids: the injected random id source when it yields one, otherwise a
// timestamp/counter id (the production path when crypto.randomUUID is unavailable, e.g. an insecure context).
// Production composes one factory per player inventory, so the counter is unique for that inventory.
export class InventoryInstanceIdFactory {
  #fallbackId = 0;
  #makeRandomId;
  #now;

  constructor({ makeRandomId = null, now }) {
    this.#makeRandomId = makeRandomId;
    this.#now = now;
  }

  create(prefix) {
    const randomId = this.#makeRandomId?.(prefix);
    if (randomId != null) return randomId;

    this.#fallbackId++;
    return `${prefix}_${this.#now()}_${this.#fallbackId}`;
  }
}
