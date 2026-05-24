class ResolvedConfigProvider {
  constructor(baseConfig, overrideStore = null) {
    this.baseConfig = baseConfig || {};
    this.overrideStore = overrideStore || new ConfigOverrideStore();
  }

  get(path, fallbackValue = undefined) {
    const normalized = this.#normalizePath(path);
    if (this.overrideStore.has(normalized)) return this.overrideStore.get(normalized);
    return this.getBase(normalized, fallbackValue);
  }

  getBase(path, fallbackValue = undefined) {
    const result = this.#readPath(this.baseConfig, path);
    return result.found ? result.value : fallbackValue;
  }

  getOverride(path) {
    return this.overrideStore.get(path);
  }

  hasOverride(path) {
    return this.overrideStore.has(path);
  }

  setOverride(path, value) {
    this.overrideStore.set(path, value);
  }

  resetOverride(path) {
    this.overrideStore.remove(path);
  }

  resetAllOverrides() {
    this.overrideStore.clear();
  }

  exportOverrides() {
    return this.overrideStore.toJSON();
  }

  importOverrides(data) {
    this.overrideStore.loadFromJSON(data);
  }

  #readPath(root, path) {
    const parts = Array.isArray(path) ? path : this.#normalizePath(path).split(".").filter(Boolean);
    let current = root;
    for (const part of parts) {
      if (current == null || !Object.prototype.hasOwnProperty.call(current, part)) {
        return { found: false, value: undefined };
      }
      current = current[part];
    }
    return { found: true, value: current };
  }

  #normalizePath(path) {
    if (Array.isArray(path)) return path.map(String).join(".");
    return String(path || "").trim();
  }
}
