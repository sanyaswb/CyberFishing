let activeListenerCount = 0;
const cleanupsByLifecycle = new WeakMap();

export class EventLifecycle {
  constructor() {
    cleanupsByLifecycle.set(this, []);
  }

  add(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    activeListenerCount += 1;
    let active = true;
    const cleanup = () => {
      if (!active) return;
      active = false;
      target.removeEventListener(type, handler, options);
      activeListenerCount = Math.max(0, activeListenerCount - 1);
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

  static getActiveListenerCount() {
    return activeListenerCount;
  }
}
