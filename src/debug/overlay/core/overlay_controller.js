class OverlayController {
  #registry;
  #domAdapter;
  #documentTarget;
  #configSource;
  #data = {};
  #lastHtml = "";
  #updateLoop;
  #viewStateStore;
  #interactionBridge;
  #unsubscribeViewState = null;
  #isStarted = false;
  #onDebugLiveUpdate = (event) => {
    this.#data = event.detail || {};
    this.#domAdapter.show();
  };

  constructor({
    registry,
    domAdapter = new OverlayDomAdapter(),
    documentTarget = document,
    configSource = () => CONFIG,
    updateLoop = null,
    viewStateStore = null,
    interactionBridge = null,
  } = {}) {
    this.#registry = registry;
    this.#domAdapter = domAdapter;
    this.#documentTarget = documentTarget;
    this.#configSource = configSource;
    this.#viewStateStore = viewStateStore;
    this.#interactionBridge = interactionBridge;
    this.#updateLoop =
      updateLoop ||
      new OverlayUpdateLoop({
        callback: () => this.update(),
        intervalMs: Number(configSource()?.debug?.overlayUpdateMs) || 150,
      });
  }

  start() {
    if (this.#isStarted) return;
    this.#isStarted = true;
    this.#domAdapter.init();
    this.#interactionBridge?.attach?.();
    this.#unsubscribeViewState = this.#viewStateStore?.subscribe?.(() => {
      this.#lastHtml = "";
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
    this.#lastHtml = "";
    this.#domAdapter.dispose?.();
  }

  update() {
    const config = this.#configSource();
    if (!config?.debug?.overlay) {
      this.#domAdapter.hide();
      return;
    }

    const html = this.#registry.renderActive(this.#data);
    if (html !== "") {
      if (html !== this.#lastHtml) {
        this.#domAdapter.updateHtml(html);
        this.#lastHtml = html;
      }
      this.#domAdapter.show();
      this.#domAdapter.applyScale();
      return;
    }

    this.#lastHtml = "";
    this.#domAdapter.hide();
  }
}

window.OverlayController = OverlayController;
