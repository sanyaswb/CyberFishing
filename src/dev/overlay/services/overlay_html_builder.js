export class OverlayHtmlBuilder {
  formatHeader(title, color = "#00ccff") {
    return `<div class="debug-overlay__text debug-overlay__text--custom debug-overlay__heading" style="--debug-overlay-color:${this.escapeAttr(color)};">${this.escapeHtml(title)}</div>`;
  }

  metricRow(label, value, options = {}) {
    const metricKey = options.metricKey || label;
    const color = options.color || "#8a9bac";
    const safeMetricKey = this.escapeAttr(metricKey);
    const safeLabel = this.escapeHtml(label);

    return `<div class="debug-overlay__row" data-overlay-metric="${safeMetricKey}">
      <span
        class="debug-overlay__label debug-overlay__metric-label"
        data-metric="${safeMetricKey}"
        role="button"
        tabindex="0"
        aria-label="Пояснити формулу для ${this.escapeAttr(label)}"
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
