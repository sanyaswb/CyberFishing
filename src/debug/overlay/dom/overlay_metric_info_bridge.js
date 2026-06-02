class OverlayMetricInfoBridge {
  #catalog;
  #inspector;
  #documentTarget;
  #isStarted = false;

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
    const target = content || this.#documentTarget;
    target.addEventListener("pointerover", (event) => this.#handleHover(event), true);
    target.addEventListener("focusin", (event) => this.#handleHover(event), true);
    target.addEventListener("click", (event) => this.#handleClick(event), true);
    target.addEventListener("keydown", (event) => this.#handleKeyDown(event), true);
  }

  #listenForDebugData() {
    this.#documentTarget.addEventListener("debug-live-update", (event) => {
      this.#inspector.updateLiveData(event.detail || {});
    });
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
