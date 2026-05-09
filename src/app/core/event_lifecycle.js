class EventLifecycle {
  #cleanups = [];

  add(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    let active = true;
    const cleanup = () => {
      if (!active) return;
      active = false;
      target.removeEventListener(type, handler, options);
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
}
