export class OverlayHtmlBuilder {
  #metricCatalog;
  #metricHints;

  // metricCatalog: OverlayMetricCatalog (getEntry(label)) or null; metricHints: OverlayMetricHints or null.
  // TK-396 (spec 186 Q2): a metric the catalog explains is a control with the link look (TK-309); a press opens its
  // hint under the row (OverlayMetricHints), and the hint's buttons open its parameters in DevTools.
  constructor({ metricCatalog = null, metricHints = null } = {}) {
    this.#metricCatalog = metricCatalog;
    this.#metricHints = metricHints;
  }

  formatHeader(title, color = "#00ccff") {
    return `<div class="debug-overlay__text debug-overlay__text--custom debug-overlay__heading" style="--debug-overlay-color:${this.escapeAttr(color)};">${this.escapeHtml(title)}</div>`;
  }

  // TK-391 (R29): what a window shows when its module failed to draw: the title, the cause, that the rest works.
  errorBlock(title, message) {
    return this.formatHeader(title, "#ff4444")
      + `<div class="debug-overlay__line debug-overlay__text debug-overlay__text--danger">${this.escapeHtml(message)}</div>`
      + "<div class=\"debug-overlay__note debug-overlay__text debug-overlay__text--muted\">"
      + "Решта overlay працює; деталі — у консолі.</div>";
  }

  metricRow(label, value, options = {}) {
    const metricKey = options.metricKey || label;
    const color = options.color || "#8a9bac";
    const safeMetricKey = this.escapeAttr(metricKey);
    const safeLabel = this.escapeHtml(label);
    const valueHtml = `<span class="debug-overlay__value debug-overlay__text debug-overlay__text--custom" style="--debug-overlay-color:${this.escapeAttr(color)};">${value}</span>`;
    // A metric the catalog does not explain reads like a plain row.
    if (!this.#metricCatalog?.getEntry(metricKey)) {
      return `<div class="debug-overlay__row" data-overlay-metric="${safeMetricKey}">`
        + `<span class="debug-overlay__label debug-overlay__metric-label" data-metric="${safeMetricKey}">${safeLabel}:</span>`
        + `${valueHtml}</div>`;
    }
    // TK-309 / TK-396: data-overlay-control keeps a press on it from dragging the window; as a release control the
    // interaction bridge leaves the click to OverlayMetricInfoBridge, which opens or closes the hint.
    const open = this.#metricHints?.isOpen(metricKey) === true;
    const row = `<div class="debug-overlay__row" data-overlay-metric="${safeMetricKey}">`
      + `<span class="debug-overlay__label debug-overlay__metric-label debug-overlay__metric-label--link"`
      + ` data-overlay-control="metric" data-overlay-activate="release" data-metric="${safeMetricKey}" role="button"`
      + ` tabindex="0" aria-expanded="${open}" aria-label="Пояснення метрики ${this.escapeAttr(label)}">${safeLabel}:</span>`
      + `${valueHtml}</div>`;
    return open ? row + this.#metricHints.render(metricKey, this) : row;
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
