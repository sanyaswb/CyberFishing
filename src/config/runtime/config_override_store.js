class ConfigOverrideStore {
  #overrides = new Map();

  set(path, value) {
    const key = this.#normalizePath(path);
    if (!key) return;
    this.#overrides.set(key, this.#clone(value));
  }

  get(path, fallbackValue = undefined) {
    const key = this.#normalizePath(path);
    return this.#overrides.has(key) ? this.#clone(this.#overrides.get(key)) : fallbackValue;
  }

  has(path) {
    return this.#overrides.has(this.#normalizePath(path));
  }

  remove(path) {
    this.#overrides.delete(this.#normalizePath(path));
  }

  clear() {
    this.#overrides.clear();
  }

  entries() {
    return [...this.#overrides.entries()].map(([path, value]) => [path, this.#clone(value)]);
  }

  toJSON() {
    return Object.fromEntries(this.entries());
  }

  loadFromJSON(data = {}) {
    this.clear();
    const source = typeof data === "string" ? JSON.parse(data) : data;
    for (const [path, value] of Object.entries(source || {})) {
      this.set(path, value);
    }
  }

  #normalizePath(path) {
    if (Array.isArray(path)) return path.map(String).join(".");
    return String(path || "").trim();
  }

  #clone(value) {
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }
}
