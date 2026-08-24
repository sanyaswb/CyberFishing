let activeListenerCount = 0;
const listenersByBus = new WeakMap();

export class EventBus {
  constructor() {
    listenersByBus.set(this, new Map());
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
    if (added) activeListenerCount += 1;
    let active = added;
    return () => {
      if (!active) return false;
      active = false;
      const removed = handlers.delete(handler);
      if (removed) {
        activeListenerCount = Math.max(0, activeListenerCount - 1);
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
      activeListenerCount = Math.max(0, activeListenerCount - handlers.size);
    }
    listeners.clear();
  }

  static getActiveListenerCount() {
    return activeListenerCount;
  }
}
