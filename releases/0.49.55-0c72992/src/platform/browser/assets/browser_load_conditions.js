// When background loads should wait (spec 047 FR-017, spec 157 D2): a hidden tab, no network, or the browser's
// save-data preference. Loads the player is waiting for are never paused by this. onChange(paused) runs on every change.
export class BrowserLoadConditions {
  #documentRef;
  #windowRef;
  #listeners = new Set();
  #detach = [];
  #paused;

  constructor({ documentRef, windowRef }) {
    this.#documentRef = documentRef;
    this.#windowRef = windowRef;
    this.#paused = this.#read();
    const update = () => {
      const paused = this.#read();
      if (paused === this.#paused) return;
      this.#paused = paused;
      for (const listener of this.#listeners) listener(paused);
    };
    const listen = (target, type) => {
      if (typeof target?.addEventListener !== "function") return;
      target.addEventListener(type, update);
      this.#detach.push(() => target.removeEventListener(type, update));
    };
    listen(documentRef, "visibilitychange");
    listen(windowRef, "online");
    listen(windowRef, "offline");
    listen(windowRef?.navigator?.connection, "change");
  }

  isPaused() {
    return this.#paused;
  }

  subscribe(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  dispose() {
    for (const detach of this.#detach) detach();
    this.#detach.length = 0;
    this.#listeners.clear();
  }

  #read() {
    const navigatorRef = this.#windowRef?.navigator;
    return this.#documentRef?.visibilityState === "hidden" || navigatorRef?.onLine === false
      || navigatorRef?.connection?.saveData === true;
  }
}
