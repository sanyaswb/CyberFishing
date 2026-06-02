class OverlayModuleRegistry {
  #modules = [];

  register(module) {
    if (!module || typeof module.isActive !== "function" || typeof module.render !== "function") {
      throw new Error("Overlay module must implement isActive(data) and render(data).");
    }
    this.#modules.push(module);
  }

  registerMany(modules) {
    modules.forEach((module) => this.register(module));
  }

  renderActive(data) {
    return this.#modules
      .filter((module) => module.isActive(data))
      .map((module) => module.render(data))
      .join("");
  }
}

window.OverlayModuleRegistry = OverlayModuleRegistry;
