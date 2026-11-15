export class OverlaySettingsStore {
  #modules;
  #listeners = new Set();

  constructor(modules) {
    this.#modules = { ...(modules || {}) };
  }

  subscribe(listener) {
    if (typeof listener !== "function") return () => {};
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
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
    if (this.#modules[key] === normalizedValue) return;
    this.#modules[key] = normalizedValue;
    for (const listener of [...this.#listeners]) listener(key, normalizedValue);
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
