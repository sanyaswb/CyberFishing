class OverlayController {
  #registry;
  #domAdapter;
  #documentTarget;
  #configSource;
  #data = {};
  #lastHtml = "";
  #updateLoop;

  constructor({
    registry,
    domAdapter = new OverlayDomAdapter(),
    documentTarget = document,
    configSource = () => CONFIG,
    updateLoop = null,
  } = {}) {
    this.#registry = registry;
    this.#domAdapter = domAdapter;
    this.#documentTarget = documentTarget;
    this.#configSource = configSource;
    this.#updateLoop =
      updateLoop ||
      new OverlayUpdateLoop({
        callback: () => this.update(),
        intervalMs: Number(configSource()?.debug?.overlayUpdateMs) || 150,
      });
  }

  start() {
    this.#domAdapter.init();
    this.#documentTarget.addEventListener("debug-live-update", (event) => {
      this.#data = event.detail || {};
      this.#domAdapter.show();
    });
    this.#updateLoop.start();
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
