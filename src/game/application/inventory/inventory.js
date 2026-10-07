// Item list of the classic (pre-V2) save while it is migrated and seeded at startup.
export class Inventory {
  #items;
  #itemFactory;

  constructor(initialItems = [], itemFactory = null) {
    this.#items = new Map();
    this.#itemFactory = itemFactory;
    for (let i = 0; i < initialItems.length; i++) {
      this.addItem(initialItems[i]);
    }
  }

  addItem(itemData) {
    const item = this.#itemFactory
      ? this.#itemFactory.create(itemData)
      : itemData;
    this.#items.set(item.instanceId, item);
    return item;
  }

  getInstance(instanceId) {
    return this.#items.get(instanceId) || null;
  }

  remove(instanceId) {
    return this.#items.delete(instanceId);
  }

  getAll() {
    return Array.from(this.#items.values());
  }
}
