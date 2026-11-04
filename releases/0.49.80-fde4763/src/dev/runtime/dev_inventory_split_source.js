// DEV switch for the landscape split inventory (spec 098): CONFIG.debug.inventorySplit, edited live in DevTools.
// Production composes no source, so the split never activates there.
export class DevInventorySplitSource {
  #config;
  #documentRef;
  #listeners;
  #subscribers = new Set();
  #removeConfigListener = null;

  constructor({ config, documentRef, listeners }) {
    this.#config = config;
    this.#documentRef = documentRef;
    this.#listeners = listeners;
  }

  resolve() {
    const settings = this.#config.debug?.inventorySplit;
    return { enabled: settings?.enabled === true, inventoryShare: settings?.inventoryShare,
      defaultSide: settings?.defaultSide };
  }

  subscribe(listener) {
    this.#subscribers.add(listener);
    this.#removeConfigListener ??= this.#listeners.add(this.#documentRef, "config-updated", (event) => {
      const path = event?.detail?.path;
      // A reset or import replaces the whole tree; otherwise only CONFIG.debug edits concern the split.
      if (event?.detail?.resetAll || !Array.isArray(path) || path[1] === undefined || path[1] === "debug") {
        for (const subscriber of [...this.#subscribers]) subscriber();
      }
    });
    return () => this.#subscribers.delete(listener);
  }

  dispose() {
    this.#subscribers.clear();
    this.#listeners.dispose();
    this.#removeConfigListener = null;
  }
}
