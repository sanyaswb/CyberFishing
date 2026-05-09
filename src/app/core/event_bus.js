class EventBus {
  #listeners = new Map();

  on(type, handler) {
    let handlers = this.#listeners.get(type);
    if (!handlers) {
      handlers = new Set();
      this.#listeners.set(type, handlers);
    }
    handlers.add(handler);
    return () => handlers.delete(handler);
  }

  emit(type, payload) {
    const handlers = this.#listeners.get(type);
    if (!handlers) return;

    for (const handler of handlers) {
      handler(payload);
    }
  }

  clear() {
    this.#listeners.clear();
  }
}
