// The DevTools roots a metric's parameter can be opened in (TK-309).
const REVEALABLE_ROOTS = Object.freeze(["CONFIG.", "HOOKED_FISH.", "ITEM_DB.", "FISH_DB.", "MAP_DB."]);

export class OverlayHtmlBuilder {
  #metricCatalog;

  // metricCatalog: OverlayMetricCatalog (getEntry(label) -> { paths }) or null; TK-309: a metric whose catalog entry
  // names parameters gets the weather module's link look and opens the first of them in DevTools.
  constructor({ metricCatalog = null } = {}) {
    this.#metricCatalog = metricCatalog;
  }

  formatHeader(title, color = "#00ccff") {
    return `<div class="debug-overlay__text debug-overlay__text--custom debug-overlay__heading" style="--debug-overlay-color:${this.escapeAttr(color)};">${this.escapeHtml(title)}</div>`;
  }

  metricRow(label, value, options = {}) {
    const metricKey = options.metricKey || label;
    const color = options.color || "#8a9bac";
    const safeMetricKey = this.escapeAttr(metricKey);
    const safeLabel = this.escapeHtml(label);
    const paths = this.#revealablePaths(metricKey);
    // TK-309: a link like the weather module's (opens the parameter in DevTools and still writes the formula to the
    // console); data-overlay-control keeps a press on it from dragging the window, and as a release control the
    // interaction bridge leaves the click to OverlayMetricInfoBridge.
    const link = paths.length
      ? ` debug-overlay__metric-label--link" data-overlay-control="metric" data-overlay-activate="release" data-devtools-paths="${this.escapeAttr(paths.join("|"))}`
      : "";
    const action = paths.length ? "Відкрити параметр у DevTools і пояснити формулу для" : "Пояснити формулу для";

    return `<div class="debug-overlay__row" data-overlay-metric="${safeMetricKey}">
      <span
        class="debug-overlay__label debug-overlay__metric-label${link}"
        data-metric="${safeMetricKey}"
        role="button"
        tabindex="0"
        aria-label="${action} ${this.escapeAttr(label)}"
      >${safeLabel}:</span>
      <span class="debug-overlay__value debug-overlay__text debug-overlay__text--custom" style="--debug-overlay-color:${this.escapeAttr(color)};">${value}</span>
    </div>`;
  }

  // A row that only reads: no explanation on hover, focus or click unless label contains devLink / devtoolsPath.
  plainRow(label, value, options = {}) {
    const color = options.color || "#8a9bac";
    const labelHtml = options.labelHtml != null
      ? String(options.labelHtml)
      : options.devtoolsPath
        ? this.devLink(label, options.devtoolsPath)
        : this.escapeHtml(label);
    return `<div class="debug-overlay__row" data-overlay-metric="${this.escapeAttr(options.metricKey || label)}">`
      + `<span class="debug-overlay__label">${labelHtml}:</span>`
      + `<span class="debug-overlay__value debug-overlay__text debug-overlay__text--custom" style="--debug-overlay-color:${this.escapeAttr(color)};">${value}</span>`
      + "</div>";
  }

  // Hyperlink inside any overlay text/label that opens DevTools, expands ancestors and highlights the target parameter.
  devLink(label, devtoolsPath, { extraClass = "" } = {}) {
    const path = Array.isArray(devtoolsPath)
      ? devtoolsPath.map(String).join(".")
      : String(devtoolsPath || "");
    const safeText = this.escapeHtml(label);
    if (!path) return safeText;
    const className = extraClass
      ? `debug-overlay__dev-link ${this.escapeAttr(extraClass)}`
      : "debug-overlay__dev-link";
    return `<button type="button" class="${className}" data-overlay-control="devtools-link"`
      + ` data-overlay-activate="release" data-devtools-path="${this.escapeAttr(path)}">${safeText}</button>`;
  }

  // The catalog's parameters of a metric that DevTools can show, in the catalog's order (state-specific ones skipped).
  #revealablePaths(metricKey) {
    const paths = this.#metricCatalog?.getEntry(metricKey)?.paths;
    if (!Array.isArray(paths)) return [];
    return paths.filter((path) => typeof path === "string" && !path.includes("<")
      && REVEALABLE_ROOTS.some((root) => path.startsWith(root)));
  }

  escapeHtml(value) {
    return this.escapeAttr(value);
  }

  escapeAttr(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  getStateColor(state) {
    const colors = {
      dash: "#ff4444",
      lastdash: "#ff00ff",
      panic: "#ff0055",
      megadash: "#ff2222",
      surrender: "#888888",
      swim: "#ffaa00",
      rest: "#00ff80",
      idle: "#00ccff",
    };
    return colors[state?.toLowerCase()] || "#8a9bac";
  }
}
