// Drives the registered overlay modules, giving each active module its own lazy-created window adapter.
// TK-395 (spec 186 D5): every collaborator comes from the composition (no global document, no optional calls).
export class OverlayController {
  #registry;
  #createWindowAdapter;
  #documentTarget;
  #configSource;
  #data = {};
  #windows = new Map();
  #createdCount = 0;
  #updateLoop;
  #viewStateStore;
  #interactionBridge;
  #unsubscribeViewState = null;
  #isStarted = false;
  #htmlBuilder;
  // TK-391: the last error each failing module showed (logged once per new cause).
  #errors = new Map();
  #onDebugLiveUpdate = (event) => {
    this.#data = event.detail || {};
  };

  constructor({
    registry,
    createWindowAdapter,
    documentTarget,
    configSource,
    updateLoop,
    viewStateStore,
    interactionBridge,
    // OverlayHtmlBuilder: the error block of a module that failed to draw (TK-391).
    htmlBuilder,
  }) {
    if (typeof createWindowAdapter !== "function") {
      throw new TypeError("OverlayController requires createWindowAdapter");
    }
    if (typeof htmlBuilder?.errorBlock !== "function") throw new TypeError("OverlayController requires htmlBuilder");
    if (typeof configSource !== "function") throw new TypeError("OverlayController requires configSource");
    for (const [name, value, method] of [["documentTarget", documentTarget, "addEventListener"],
      ["updateLoop", updateLoop, "start"], ["viewStateStore", viewStateStore, "subscribe"],
      ["interactionBridge", interactionBridge, "attachRoot"]]) {
      if (typeof value?.[method] !== "function") throw new TypeError(`OverlayController requires ${name}`);
    }
    this.#htmlBuilder = htmlBuilder;
    this.#registry = registry;
    this.#createWindowAdapter = createWindowAdapter;
    this.#documentTarget = documentTarget;
    this.#configSource = configSource;
    this.#viewStateStore = viewStateStore;
    this.#interactionBridge = interactionBridge;
    this.#updateLoop = updateLoop;
  }

  start() {
    if (this.#isStarted) return;
    this.#isStarted = true;
    this.#interactionBridge.attach();
    this.#unsubscribeViewState = this.#viewStateStore.subscribe(() => {
      for (const entry of this.#windows.values()) entry.lastHtml = "";
      this.update();
    });
    this.#documentTarget.addEventListener(
      "debug-live-update",
      this.#onDebugLiveUpdate,
    );
    this.#updateLoop.start();
  }

  stop() {
    if (!this.#isStarted) return;
    this.#isStarted = false;
    this.#updateLoop.stop();
    this.#interactionBridge.detach();
    this.#unsubscribeViewState?.();
    this.#unsubscribeViewState = null;
    this.#documentTarget.removeEventListener(
      "debug-live-update",
      this.#onDebugLiveUpdate,
    );
  }

  dispose() {
    this.stop();
    this.#data = {};
    for (const entry of this.#windows.values()) {
      entry.adapter.dispose();
    }
    this.#windows.clear();
    this.#createdCount = 0;
  }

  update() {
    const config = this.#configSource();
    if (!config?.debug?.overlay) {
      this.#hideAll();
      return;
    }

    for (const module of this.#registry.getModules()) {
      const existing = this.#windows.get(module);
      const html = this.#renderModule(module);
      if (html === null) {
        existing?.adapter.hide();
        continue;
      }
      if (html === "") {
        existing?.adapter.hide();
        continue;
      }

      const entry = existing || this.#createEntry(module);
      if (html !== entry.lastHtml) {
        entry.adapter.updateHtml(html);
        entry.lastHtml = html;
      }
      entry.adapter.show();
    }
  }

  // TK-391 (R29, spec 186 D1): the module's HTML, null while it is off. A module that throws shows its error in its own
  // window (the owner on a phone has no console) and the modules after it still update; the console gets each new
  // cause once, not every 150 ms.
  #renderModule(module) {
    try {
      const html = module.isActive(this.#data) ? module.render(this.#data) : null;
      this.#errors.delete(module);
      return html;
    } catch (error) {
      const message = String(error?.message ?? error);
      if (this.#errors.get(module) !== message) {
        this.#errors.set(module, message);
        console.error(`[Overlay] the module «${module.key}» failed to draw`, error);
      }
      return this.#htmlBuilder.errorBlock(`Модуль «${module.key}» не намалювався`, message);
    }
  }

  #createEntry(module) {
    const slot = this.#createdCount++;
    const adapter = this.#createWindowAdapter(module, slot, {
      onClose: () => this.#closeModule(module),
    });
    adapter.init();
    this.#interactionBridge.attachRoot(adapter.getRootElement());
    const entry = { adapter, lastHtml: "" };
    this.#windows.set(module, entry);
    return entry;
  }

  #closeModule(module) {
    module.close();
    this.#windows.get(module)?.adapter.hide();
    this.update();
  }

  #hideAll() {
    for (const entry of this.#windows.values()) {
      entry.adapter.hide();
    }
  }
}
