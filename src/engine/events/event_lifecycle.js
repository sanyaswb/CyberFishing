const cleanupsByLifecycle = new WeakMap();

// Registers DOM-style listeners and removes them together. An optional listener counter (DEV diagnostics) sees
// every add and remove.
export class EventLifecycle {
  #listenerCounter;

  constructor(listenerCounter = null) {
    cleanupsByLifecycle.set(this, []);
    this.#listenerCounter = listenerCounter;
  }

  add(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    this.#listenerCounter?.added();
    let active = true;
    const cleanup = () => {
      if (!active) return;
      active = false;
      target.removeEventListener(type, handler, options);
      this.#listenerCounter?.removed();
    };
    cleanupsByLifecycle.get(this).push(cleanup);
    return cleanup;
  }

  dispose() {
    const cleanups = cleanupsByLifecycle.get(this);
    for (let index = cleanups.length - 1; index >= 0; index -= 1) {
      cleanups[index]();
    }
    cleanups.length = 0;
  }
}
