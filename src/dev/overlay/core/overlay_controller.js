// Drives the registered overlay modules, giving each active module its own lazy-created window adapter.
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
  #onDebugLiveUpdate = (event) => {
    this.#data = event.detail || {};
  };

  constructor({
    registry,
    createWindowAdapter,
    documentTarget = document,
    configSource,
    updateLoop = null,
    viewStateStore = null,
    interactionBridge = null,
  } = {}) {
    if (typeof createWindowAdapter !== "function") {
      throw new TypeError("OverlayController requires createWindowAdapter");
    }
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
    this.#interactionBridge?.attach?.();
    this.#unsubscribeViewState = this.#viewStateStore?.subscribe?.(() => {
      for (const entry of this.#windows.values()) entry.lastHtml = "";
      this.update();
    }) || null;
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
    this.#interactionBridge?.detach?.();
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
      entry.adapter.dispose?.();
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
      if (!module.isActive(this.#data)) {
        existing?.adapter.hide();
        continue;
      }

      const html = module.render(this.#data);
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

  #createEntry(module) {
    const slot = this.#createdCount++;
    const adapter = this.#createWindowAdapter(module, slot);
    adapter.init();
    const root = adapter.getRootElement?.();
    if (root) this.#interactionBridge?.attachRoot?.(root);
    const entry = { adapter, lastHtml: "" };
    this.#windows.set(module, entry);
    return entry;
  }

  #hideAll() {
    for (const entry of this.#windows.values()) {
      entry.adapter.hide();
    }
  }
}
