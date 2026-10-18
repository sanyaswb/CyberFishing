export class DevToolsControlBindingRegistry {
  #bindingsByPath = new Map();

  register(path, applyValue, element = null) {
    if (typeof applyValue !== "function") return;
    const key = this.#normalizePath(path);
    if (!key) return;

    const bindings = this.#bindingsByPath.get(key) || [];
    bindings.push({ applyValue, element });
    this.#bindingsByPath.set(key, bindings);
  }

  sync(path, value) {
    const bindings = this.#bindingsByPath.get(this.#normalizePath(path)) || [];
    for (const binding of bindings) binding.applyValue(value);
  }

  releaseWithin(container) {
    for (const [path, bindings] of this.#bindingsByPath) {
      const retained = bindings.filter(binding => !binding.element || !container.contains(binding.element));
      if (retained.length) this.#bindingsByPath.set(path, retained);
      else this.#bindingsByPath.delete(path);
    }
  }

  clear() {
    this.#bindingsByPath.clear();
  }

  #normalizePath(path) {
    if (Array.isArray(path)) return path.map(String).join(".");
    return String(path || "").trim();
  }
}
