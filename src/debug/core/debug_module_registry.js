class DebugModuleRegistry {
  #modules = new Map();

  register(module) {
    if (!module?.key || typeof module.render !== "function") {
      throw new Error("Debug module must expose key and render(context)");
    }
    this.#modules.set(module.key, module);
  }

  get(key) {
    return this.#modules.get(key) || null;
  }

  keys() {
    return Array.from(this.#modules.keys());
  }

  toLegacyMap() {
    const map = {};
    for (const key of this.keys()) {
      const module = this.get(key);
      map[key] = {
        title: module.title,
        render: (context) => module.render(context),
      };
    }
    return map;
  }
}

window.DebugModuleRegistry = DebugModuleRegistry;
