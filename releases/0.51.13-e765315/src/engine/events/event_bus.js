const listenersByBus = new WeakMap();

// In-page publish/subscribe. An optional listener counter (DEV diagnostics) sees every subscription and removal.
export class EventBus {
  #listenerCounter;

  constructor(listenerCounter = null) {
    listenersByBus.set(this, new Map());
    this.#listenerCounter = listenerCounter;
  }

  on(type, handler) {
    const listeners = listenersByBus.get(this);
    let handlers = listeners.get(type);
    if (!handlers) {
      handlers = new Set();
      listeners.set(type, handlers);
    }
    const added = !handlers.has(handler);
    handlers.add(handler);
    if (added) this.#listenerCounter?.added();
    let active = added;
    return () => {
      if (!active) return false;
      active = false;
      const removed = handlers.delete(handler);
      if (removed) {
        this.#listenerCounter?.removed();
      }
      if (handlers.size === 0) listeners.delete(type);
      return removed;
    };
  }

  emit(type, payload) {
    const handlers = listenersByBus.get(this).get(type);
    if (!handlers) return;

    for (const handler of handlers) {
      handler(payload);
    }
  }

  clear() {
    const listeners = listenersByBus.get(this);
    for (const handlers of listeners.values()) {
      this.#listenerCounter?.removed(handlers.size);
    }
    listeners.clear();
  }
}
