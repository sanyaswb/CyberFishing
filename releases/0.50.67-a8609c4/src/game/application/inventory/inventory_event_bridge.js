export class InventoryEventBridge {
  #target;
  #listeners = new Map();

  constructor(target = null) {
    this.#target = target;
  }

  on(type, handler) {
    let handlers = this.#listeners.get(type);
    if (!handlers) {
      handlers = new Set();
      this.#listeners.set(type, handlers);
    }
    handlers.add(handler);
    return () => handlers.delete(handler);
  }

  emit(type, detail) {
    const handlers = this.#listeners.get(type);
    if (handlers) {
      for (const handler of handlers) {
        handler(detail);
      }
    }

    this.#target?.emit(type, detail);
  }

  clear() {
    this.#listeners.clear();
  }
}
