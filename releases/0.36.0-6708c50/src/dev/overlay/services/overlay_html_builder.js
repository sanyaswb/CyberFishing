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
        title="${this.escapeAttr(label)}"
        aria-label="Пояснити формулу для ${this.escapeAttr(label)}"
      >${safeLabel}:</span>
      <span class="debug-overlay__value debug-overlay__text debug-overlay__text--custom" style="--debug-overlay-color:${this.escapeAttr(color)};">${value}</span>
    </div>`;
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
