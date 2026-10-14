export class OverlaySettingsStore {
  #modules;


  constructor(modules) {
    this.#modules = { ...(modules || {}) };

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
