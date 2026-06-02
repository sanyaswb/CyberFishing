class DebugEventBinder {
  #documentTarget;
  #console;
  #debugModulesSource;
  #biteTickLogger;
  #biteSequenceLogger;

  constructor({
    documentTarget = typeof document !== "undefined" ? document : null,
    debugConsole,
    debugModulesSource = () => window.DEBUG_MODULES || {},
    biteTickLogger = null,
    biteSequenceLogger = null,
  } = {}) {
    this.#documentTarget = documentTarget;
    this.#console = debugConsole;
    this.#debugModulesSource = debugModulesSource;
    this.#biteTickLogger = biteTickLogger;
    this.#biteSequenceLogger = biteSequenceLogger;
  }

  bind() {
    if (!this.#documentTarget || !this.#console) return;

    this.#documentTarget.addEventListener("debug-live-update", (event) => {
      this.#console.setLiveData(event.detail);
    });

    this.#documentTarget.addEventListener("debug-module-toggled", (event) => {
      const { module, enabled } = event.detail || {};
      if (enabled) this.#console.requestModule(module, { reason: "enabled" });
    });

    this.#documentTarget.addEventListener("config-updated", (event) => {
      this.#handleConfigUpdated(event.detail?.path || []);
    });

    this.#documentTarget.addEventListener("debug-fish-hooked", (event) => {
      this.#console.setFightData(event.detail);
      this.#console.printEnabled({ reason: "fish hooked" });
    });

    this.#documentTarget.addEventListener("debug-bite-tick", (event) => {
      this.#biteTickLogger?.print(event.detail);
    });

    this.#documentTarget.addEventListener("debug-bite-sequence", (event) => {
      this.#biteSequenceLogger?.print(event.detail);
    });

    this.#documentTarget.addEventListener("netCatchRoll", (event) => {
      this.#console.setNetRoll(event.detail);
      if (!this.#debugModulesSource().net) return;
      const { chance, roll, success } = event.detail;
      console.log(
        `[NET] Attempt: chance ${chance}%, roll ${roll.toFixed(1)}, success ${success}`,
      );
      this.#console.printModule("net", { reason: "net roll" });
    });
  }

  #handleConfigUpdated(path) {
    const root = path[0];
    const second = path[1];
    const debugModules = this.#debugModulesSource();
    if (root === "CONFIG" && second === "locations" && debugModules.map) {
      this.#console.printModule("map", { reason: "config updated" });
    }
    if (root === "CONFIG" && second === "casting" && debugModules.map) {
      this.#console.printModule("map", { reason: "config updated" });
    }
  }
}

window.DebugEventBinder = DebugEventBinder;
