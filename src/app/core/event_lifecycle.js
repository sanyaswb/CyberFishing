class EventLifecycle {
  static #activeListenerCount = 0;

  #cleanups = [];

  add(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    EventLifecycle.#activeListenerCount += 1;
    let active = true;
    const cleanup = () => {
      if (!active) return;
      active = false;
      target.removeEventListener(type, handler, options);
      EventLifecycle.#activeListenerCount = Math.max(
        0,
        EventLifecycle.#activeListenerCount - 1,
      );
    };
    this.#cleanups.push(cleanup);
    return cleanup;
  }

  dispose() {
    for (let i = this.#cleanups.length - 1; i >= 0; i--) {
      this.#cleanups[i]();
    }
    this.#cleanups.length = 0;
  }

  static getActiveListenerCount() {
    return EventLifecycle.#activeListenerCount;
  }
}
