// A metric's name in a DEV overlay writes its formula to the console when clicked or activated from the keyboard. Metric
// rows have no underline, hover or tooltip on any device (owner, TK-217).
export class OverlayMetricInfoBridge {
  #catalog;
  #inspector;
  #documentTarget;
  #isStarted = false;
  #eventTarget = null;
  #onDebugLiveUpdate = (event) => {
    this.#inspector.updateLiveData(event.detail || {});
  };
  #onClick = (event) => this.#handleClick(event);
  #onKeyDown = (event) => this.#handleKeyDown(event);

  constructor({
    catalog,
    inspector,
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
    const content = this.#documentTarget.querySelector(".debug-overlay__content");
    this.#eventTarget = content || this.#documentTarget;
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
    this.#eventTarget?.removeEventListener("click", this.#onClick, true);
    this.#eventTarget?.removeEventListener("keydown", this.#onKeyDown, true);
    this.#eventTarget = null;
  }

  dispose() {
    this.stop();
    this.#catalog.dispose?.();
  }

  #listenForDebugData() {
    this.#documentTarget.addEventListener(
      "debug-live-update",
      this.#onDebugLiveUpdate,
    );
  }

  #handleClick(event) {
    const label = this.#findMetricLabel(event.target);
    if (!label || label.closest("summary")) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    this.#inspectLabel(label);
  }

  #handleKeyDown(event) {
    if (event.key !== "Enter" && event.key !== " ") return;
    const label = this.#findMetricLabel(event.target);
    if (!label || label.closest("summary")) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    this.#inspectLabel(label);
  }

  #findMetricLabel(target) {
    return target?.closest?.(".debug-overlay__metric-label") || null;
  }

  #inspectLabel(labelElement) {
    const row = labelElement.closest(".debug-overlay__row");
    const label = labelElement.dataset.metric || "metric";
    const value =
      row?.querySelector(".debug-overlay__value")?.textContent?.trim() || "";
    const entry = this.#catalog.getEntry(label);
    this.#inspector.inspect({ label, displayedValue: value, entry });
  }
}
