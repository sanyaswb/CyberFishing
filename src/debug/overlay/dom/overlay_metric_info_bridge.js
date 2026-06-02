class OverlayMetricInfoBridge {
  #catalog;
  #inspector;
  #documentTarget;

  constructor({
    catalog = new OverlayMetricCatalog(),
    inspector = new OverlayConsoleMetricInspector(),
    documentTarget = document,
  } = {}) {
    this.#catalog = catalog;
    this.#inspector = inspector;
    this.#documentTarget = documentTarget;
  }

  start() {
    this.#listenForDebugData();
    const content = this.#documentTarget.querySelector(".debug-overlay-content");
    const target = content || this.#documentTarget;
    target.addEventListener(
      "pointerdown",
      (event) => this.#handlePointerDown(event),
      true,
    );
    target.addEventListener("click", (event) => this.#handleClick(event), true);
  }

  #listenForDebugData() {
    this.#documentTarget.addEventListener("debug-live-update", (event) => {
      this.#inspector.updateLiveData(event.detail || {});
    });
  }

  #handlePointerDown(event) {
    const button = event.target.closest?.(".overlay-metric-info-btn");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    this.#inspectButton(button);
  }

  #handleClick(event) {
    const button = event.target.closest?.(".overlay-metric-info-btn");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
  }

  #inspectButton(button) {
    const row = button.closest(".debug-overlay-row");
    const label = button.dataset.metric || "metric";
    const value =
      row?.querySelector(".debug-overlay-value")?.textContent?.trim() || "";
    const entry = this.#catalog.getEntry(label);
    button.classList.add("overlay-metric-info-btn-active");
    window.setTimeout(() => {
      if (button.isConnected) {
        button.classList.remove("overlay-metric-info-btn-active");
      }
    }, 180);
    this.#inspector.inspect({ label, displayedValue: value, entry });
  }
}

window.OverlayMetricInfoBridge = OverlayMetricInfoBridge;
