class DebugEventBinder {
  #documentTarget;
  #console;
  #debugModulesSource;
  #biteTickLogger;
  #biteSequenceLogger;
  #cleanups = [];
  #isBound = false;

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
    if (!this.#documentTarget || !this.#console || this.#isBound) return this;
    this.#isBound = true;

    this.#listen("debug-live-update", (event) => {
      this.#console.setLiveData(event.detail);
    });

    this.#listen("debug-module-toggled", (event) => {
      const { module, enabled } = event.detail || {};
      if (enabled) this.#console.requestModule(module, { reason: "enabled" });
    });

    this.#listen("config-updated", (event) => {
      this.#handleConfigUpdated(event.detail?.path || []);
    });

    this.#listen("debug-fish-hooked", (event) => {
      this.#console.setFightData(event.detail);
      this.#console.printEnabled({ reason: "fish hooked" });
    });

    this.#listen("debug-bite-tick", (event) => {
      this.#biteTickLogger?.print(event.detail);
    });

    this.#listen("debug-bite-sequence", (event) => {
      this.#biteSequenceLogger?.print(event.detail);
    });

    this.#listen("netCatchRoll", (event) => {
      this.#console.setNetRoll(event.detail);
      if (!this.#debugModulesSource().net) return;
      const { chance, roll, success } = event.detail;
      console.log(
        `[NET] Attempt: chance ${chance}%, roll ${roll.toFixed(1)}, success ${success}`,
      );
      this.#console.printModule("net", { reason: "net roll" });
    });
    return this;
  }

  dispose() {
    for (let i = this.#cleanups.length - 1; i >= 0; i--) {
      this.#cleanups[i]();
    }
    this.#cleanups.length = 0;
    this.#isBound = false;
  }

  #listen(type, handler) {
    this.#documentTarget.addEventListener(type, handler);
    this.#cleanups.push(() =>
      this.#documentTarget.removeEventListener(type, handler),
    );
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
