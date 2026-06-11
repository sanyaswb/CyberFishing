class EventBus {
  static #activeListenerCount = 0;

  #listeners = new Map();

  on(type, handler) {
    let handlers = this.#listeners.get(type);
    if (!handlers) {
      handlers = new Set();
      this.#listeners.set(type, handlers);
    }
    const added = !handlers.has(handler);
    handlers.add(handler);
    if (added) EventBus.#activeListenerCount += 1;
    let active = added;
    return () => {
      if (!active) return false;
      active = false;
      const removed = handlers.delete(handler);
      if (removed) {
        EventBus.#activeListenerCount = Math.max(
          0,
          EventBus.#activeListenerCount - 1,
        );
      }
      if (handlers.size === 0) this.#listeners.delete(type);
      return removed;
    };
  }

  emit(type, payload) {
    const handlers = this.#listeners.get(type);
    if (!handlers) return;

    for (const handler of handlers) {
      handler(payload);
    }
  }

  clear() {
    for (const handlers of this.#listeners.values()) {
      EventBus.#activeListenerCount = Math.max(
        0,
        EventBus.#activeListenerCount - handlers.size,
      );
    }
    this.#listeners.clear();
  }

  static getActiveListenerCount() {
    return EventBus.#activeListenerCount;
  }
}
