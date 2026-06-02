class OverlayHtmlBuilder {
  formatHeader(title, color = "#00ccff") {
    return `<div style="color: ${color}; margin-bottom: 8px; font-weight: bold; border-bottom: 1px solid #4a5b6c; padding-bottom: 4px; text-transform: uppercase; font-size: 13px;">${title}</div>`;
  }

  metricRow(label, value, options = {}) {
    const metricKey = options.metricKey || label;
    const color = options.color || "#8a9bac";

    return `<div class="debug-overlay-row" data-overlay-metric="${this.escapeAttr(metricKey)}">
      <span class="debug-overlay-label">
        <button
          type="button"
          class="overlay-metric-info-btn"
          data-metric="${this.escapeAttr(metricKey)}"
          title="Пояснити формулу"
          aria-label="Пояснити формулу для ${this.escapeAttr(label)}"
        ></button>
        ${label}:
      </span>
      <span class="debug-overlay-value" style="color:${this.escapeAttr(color)};">${value}</span>
    </div>`;
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

window.OverlayHtmlBuilder = OverlayHtmlBuilder;
