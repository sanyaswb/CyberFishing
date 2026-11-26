export class InventoryCatalogItemSync {
  #repository;
  #ids;
  #notify;
  constructor({ repository, itemIds, notify }) { this.#repository = repository; this.#ids = new Set(itemIds); this.#notify = notify; }
  synchronize(items) {
    const current = this.#repository.list();
    const incoming = items.filter((item) => this.#ids.has(item.itemId));
    const signature = (entries) => JSON.stringify(entries.map((item) => [item.instanceId, item.itemId, item.quantity, item.location]));
    if (signature(current.filter((item) => this.#ids.has(item.itemId))) === signature(incoming)) return;
    this.#repository.restoreSnapshot([...current.filter((item) => !this.#ids.has(item.itemId)), ...incoming]);
    this.#notify();
  }
}
