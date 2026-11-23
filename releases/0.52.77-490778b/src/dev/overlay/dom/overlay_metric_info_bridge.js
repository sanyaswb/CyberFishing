// A metric's name in a DEV overlay explains the metric when clicked or activated from the keyboard. Metric rows have no
// underline or tooltip (owner, TK-217). TK-396 (spec 186 Q2, owner: «підказка під рядком»): the press opens or closes
// the metric's hint under its row (OverlayMetricHints: what it is, the formula, the parameters now, DevTools buttons)
// — a phone has no console — and the console still gets the full explanation with the live snapshot.
export class OverlayMetricInfoBridge {
  #catalog;
  #inspector;
  #hints;
  #documentTarget;
  #eventTarget;
  #isStarted = false;
  #onDebugLiveUpdate = (event) => {
    this.#inspector.updateLiveData(event.detail || {});
  };
  #onClick = (event) => this.#handleClick(event);
  #onKeyDown = (event) => this.#handleKeyDown(event);

  // documentTarget: the page (its live debug updates); eventTarget: the overlay windows' mount (clicks on metric names).
  constructor({ catalog, inspector, hints, documentTarget, eventTarget }) {
    for (const [name, value] of [["documentTarget", documentTarget], ["eventTarget", eventTarget]]) {
      if (typeof value?.addEventListener !== "function") throw new TypeError(`OverlayMetricInfoBridge requires ${name}`);
    }
    if (typeof hints?.toggle !== "function") throw new TypeError("OverlayMetricInfoBridge requires hints");
    this.#catalog = catalog;
    this.#inspector = inspector;
    this.#hints = hints;
    this.#documentTarget = documentTarget;
    this.#eventTarget = eventTarget;
  }

  start() {
    if (this.#isStarted) return;
    this.#isStarted = true;
    this.#documentTarget.addEventListener("debug-live-update", this.#onDebugLiveUpdate);
    this.#eventTarget.addEventListener("click", this.#onClick, true);
    this.#eventTarget.addEventListener("keydown", this.#onKeyDown, true);
  }

  stop() {
    if (!this.#isStarted) return;
    this.#isStarted = false;
    this.#documentTarget.removeEventListener("debug-live-update", this.#onDebugLiveUpdate);
    this.#eventTarget.removeEventListener("click", this.#onClick, true);
    this.#eventTarget.removeEventListener("keydown", this.#onKeyDown, true);
  }

  dispose() {
    this.stop();
    this.#catalog.dispose();
  }

  #handleClick(event) {
    const label = this.#findMetricLabel(event.target);
    if (!label || label.closest("summary")) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    this.#explain(label);
  }

  #handleKeyDown(event) {
    if (event.key !== "Enter" && event.key !== " ") return;
    const label = this.#findMetricLabel(event.target);
    if (!label || label.closest("summary")) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    this.#explain(label);
  }

  #findMetricLabel(target) {
    return target?.closest?.(".debug-overlay__metric-label") || null;
  }

  // A metric the catalog does not explain stays a plain name (no hint, nothing in the console).
  #explain(labelElement) {
    const label = labelElement.dataset.metric || "metric";
    const entry = this.#catalog.getEntry(label);
    if (!entry) return;
    const row = labelElement.closest(".debug-overlay__row");
    const value = row?.querySelector(".debug-overlay__value")?.textContent?.trim() || "";
    this.#inspector.inspect({ label, displayedValue: value, entry });
    this.#hints.toggle(label);
  }
}
