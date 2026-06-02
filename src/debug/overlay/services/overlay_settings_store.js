class OverlaySettingsStore {
  #modules;
  #legacyModules;

  constructor(modules = OVERLAY_MODULES) {
    this.#modules = { ...(modules || {}) };
    this.#legacyModules = modules || null;
  }

  isEnabled(key) {
    return !!this.#modules[key];
  }

  has(key) {
    return Object.prototype.hasOwnProperty.call(this.#modules, key);
  }

  setEnabled(key, value) {
    if (!this.has(key)) return;
    const normalizedValue = !!value;
    this.#modules[key] = normalizedValue;

    // Legacy compatibility only. The store remains the source of truth, but old
    // debug code that still reads window.OVERLAY_MODULES will see current values.
    if (this.#legacyModules) {
      this.#legacyModules[key] = normalizedValue;
    }
  }

  keys() {
    return Object.keys(this.#modules);
  }

  getSnapshot() {
    return { ...this.#modules };
  }

  getAll() {
    return this.getSnapshot();
  }

  anyEnabled(keys) {
    return keys.some((key) => this.isEnabled(key));
  }

  toJSON() {
    return this.getSnapshot();
  }
}

window.OverlaySettingsStore = new OverlaySettingsStore(OVERLAY_MODULES);
window.OverlaySettingsStoreClass = OverlaySettingsStore;
