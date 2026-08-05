class DevToolsControlBindingRegistry {
  #bindingsByPath = new Map();

  register(path, applyValue) {
    if (typeof applyValue !== "function") return;
    const key = this.#normalizePath(path);
    if (!key) return;

    const bindings = this.#bindingsByPath.get(key) || [];
    bindings.push(applyValue);
    this.#bindingsByPath.set(key, bindings);
  }

  sync(path, value) {
    const bindings = this.#bindingsByPath.get(this.#normalizePath(path)) || [];
    for (const applyValue of bindings) applyValue(value);
  }

  clear() {
    this.#bindingsByPath.clear();
  }

  #normalizePath(path) {
    if (Array.isArray(path)) return path.map(String).join(".");
    return String(path || "").trim();
  }
}

window.DevToolsControlBindingRegistry = DevToolsControlBindingRegistry;
