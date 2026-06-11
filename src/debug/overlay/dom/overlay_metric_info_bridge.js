class OverlayMetricInfoBridge {
  #catalog;
  #inspector;
  #documentTarget;
  #isStarted = false;
  #eventTarget = null;
  #onDebugLiveUpdate = (event) => {
    this.#inspector.updateLiveData(event.detail || {});
  };
  #onPointerOver = (event) => this.#handleHover(event);
  #onFocusIn = (event) => this.#handleHover(event);
  #onClick = (event) => this.#handleClick(event);
  #onKeyDown = (event) => this.#handleKeyDown(event);

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
    if (this.#isStarted) return;
    this.#isStarted = true;
    this.#listenForDebugData();
    const content = this.#documentTarget.querySelector(".debug-overlay-content");
    this.#eventTarget = content || this.#documentTarget;
    this.#eventTarget.addEventListener("pointerover", this.#onPointerOver, true);
    this.#eventTarget.addEventListener("focusin", this.#onFocusIn, true);
    this.#eventTarget.addEventListener("click", this.#onClick, true);
    this.#eventTarget.addEventListener("keydown", this.#onKeyDown, true);
  }

  stop() {
    if (!this.#isStarted) return;
    this.#isStarted = false;
    this.#documentTarget.removeEventListener(
      "debug-live-update",
      this.#onDebugLiveUpdate,
    );
    this.#eventTarget?.removeEventListener(
      "pointerover",
      this.#onPointerOver,
      true,
    );
    this.#eventTarget?.removeEventListener(
      "focusin",
      this.#onFocusIn,
      true,
    );
    this.#eventTarget?.removeEventListener("click", this.#onClick, true);
    this.#eventTarget?.removeEventListener("keydown", this.#onKeyDown, true);
    this.#eventTarget = null;
  }

  dispose() {
    this.stop();
  }

  #listenForDebugData() {
    this.#documentTarget.addEventListener(
      "debug-live-update",
      this.#onDebugLiveUpdate,
    );
  }

  #handleHover(event) {
    const label = this.#findMetricLabel(event.target);
    if (!label) return;
    this.#applyTooltip(label);
  }

  #handleClick(event) {
    const label = this.#findMetricLabel(event.target);
    if (!label) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    this.#inspectLabel(label);
  }

  #handleKeyDown(event) {
    if (event.key !== "Enter" && event.key !== " ") return;
    const label = this.#findMetricLabel(event.target);
    if (!label) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    this.#inspectLabel(label);
  }

  #findMetricLabel(target) {
    return target?.closest?.(".overlay-metric-label") || null;
  }

  #applyTooltip(labelElement) {
    const metricLabel = labelElement.dataset.metric || "metric";
    const entry = this.#catalog.getEntry(metricLabel);
    labelElement.title = this.#buildTooltip(metricLabel, entry);
  }

  #inspectLabel(labelElement) {
    const row = labelElement.closest(".debug-overlay-row");
    const label = labelElement.dataset.metric || "metric";
    const value =
      row?.querySelector(".debug-overlay-value")?.textContent?.trim() || "";
    const entry = this.#catalog.getEntry(label);

    labelElement.classList.add("overlay-metric-label-active");
    window.setTimeout(() => {
      if (labelElement.isConnected) {
        labelElement.classList.remove("overlay-metric-label-active");
      }
    }, 180);

    this.#inspector.inspect({ label, displayedValue: value, entry });
  }

  #buildTooltip(label, entry) {
    if (!entry) {
      return `${label}\nОпис для цієї overlay-метрики ще не додано.`;
    }

    const lines = [String(label)];
    if (entry.description) lines.push(entry.description);
    if (entry.formula) lines.push(`Formula: ${entry.formula}`);
    return lines.join("\n");
  }
}

window.OverlayMetricInfoBridge = OverlayMetricInfoBridge;
