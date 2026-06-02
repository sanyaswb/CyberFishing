class OverlaySettingsStore {
  #modules;

  constructor(modules = OVERLAY_MODULES) {
    this.#modules = modules;
  }

  isEnabled(key) {
    return !!this.#modules[key];
  }

  setEnabled(key, value) {
    if (!Object.prototype.hasOwnProperty.call(this.#modules, key)) return;
    this.#modules[key] = !!value;
  }

  getAll() {
    return this.#modules;
  }

  anyEnabled(keys) {
    return keys.some((key) => this.isEnabled(key));
  }
}

window.OverlaySettingsStore = new OverlaySettingsStore(OVERLAY_MODULES);
window.OverlaySettingsStoreClass = OverlaySettingsStore;
