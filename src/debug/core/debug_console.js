class DebugConsole {
  #context;
  #registry;
  #debugModulesSource;
  #pendingModules = new Set();

  constructor({
    context = new DebugContext(),
    registry = new DebugModuleRegistry(),
    debugModulesSource = () => window.DEBUG_MODULES || {},
  } = {}) {
    this.#context = context;
    this.#registry = registry;
    this.#debugModulesSource = debugModulesSource;
  }

  setLiveData(detail) {
    this.#context.setLiveData(detail);
    if (this.#pendingModules.size === 0) return;

    for (const moduleName of this.#pendingModules) {
      this.printModule(moduleName, { reason: "live snapshot" });
    }
    this.#pendingModules.clear();
  }

  setFightData(detail) {
    this.#context.setFightData(detail);
  }

  setNetRoll(detail) {
    this.#context.setNetRoll(detail);
  }

  printModule(moduleName, meta = {}) {
    const module = this.#registry.get(moduleName);
    if (!module) {
      console.warn(`[DEBUG] Unknown console module: ${moduleName}`);
      return;
    }

    const reason = meta.reason ? ` / ${meta.reason}` : "";
    console.group(
      `%c[DEBUG:${moduleName}] ${module.title} (${this.#context.gameState}${reason})`,
      "color: #b066ff; font-weight: bold;",
    );
    module.render(this.#context.toRenderPayload());
    console.groupEnd();
  }

  requestModule(moduleName, meta = {}) {
    if (!this.#context.live) this.#pendingModules.add(moduleName);
    this.printModule(moduleName, meta);
  }

  printEnabled(meta = {}) {
    const modules = this.#debugModulesSource() || {};
    for (const moduleName of Object.keys(modules)) {
      if (!modules[moduleName]) continue;
      const module = this.#registry.get(moduleName);
      if (
        meta.reason === "fish hooked" &&
        module?.printOnFishHooked === false
      ) {
        continue;
      }
      this.printModule(moduleName, meta);
    }
  }
}

window.DebugConsoleClass = DebugConsole;
