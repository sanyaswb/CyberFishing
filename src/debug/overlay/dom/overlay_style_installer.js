class OverlayStyleInstaller {
  #documentTarget;

  constructor(documentTarget = document) {
    this.#documentTarget = documentTarget;
  }

  install() {
    if (this.#documentTarget.getElementById("debug-overlay-styles")) return;

    const style = this.#documentTarget.createElement("style");
    style.id = "debug-overlay-styles";
    style.textContent = `
      .debug-overlay-row {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 2px;
        font-size: 12px;
      }
      .debug-overlay-label {
        display: inline-flex;
        align-items: center;
        min-height: 16px;
        line-height: 1.2;
      }
      .debug-overlay-value {
        font-weight: bold;
        text-align: right;
      }

      .debug-overlay-tab-row {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin: 4px 0 6px;
        pointer-events: auto;
      }
      .debug-overlay-tab {
        font: inherit;
        font-size: 11px;
        padding: 2px 6px;
        border: 1px solid rgba(255, 255, 255, 0.25);
        border-radius: 4px;
        background: rgba(255, 255, 255, 0.08);
        color: inherit;
        cursor: pointer;
        pointer-events: auto;
        touch-action: manipulation;
      }
      .debug-overlay-tab:hover,
      .debug-overlay-tab:focus-visible {
        background: rgba(120, 190, 255, 0.16);
        border-color: rgba(120, 190, 255, 0.45);
        outline: none;
      }
      .debug-overlay-tab--active {
        background: rgba(120, 190, 255, 0.22);
        border-color: rgba(120, 190, 255, 0.65);
      }
      .overlay-metric-label {
        cursor: help;
        pointer-events: auto;
        touch-action: manipulation;
        text-decoration: underline dotted rgba(115, 194, 251, 0.55);
        text-underline-offset: 2px;
        border-radius: 3px;
        outline: none;
        transition: background 80ms ease, color 80ms ease;
      }
      .overlay-metric-label:hover,
      .overlay-metric-label:focus-visible {
        color: #ffffff;
        background: rgba(115, 194, 251, 0.16);
      }
      .overlay-metric-label-active,
      .overlay-metric-label:active {
        color: #ffffff;
        background: rgba(255, 255, 255, 0.2);
      }
    `;
    this.#documentTarget.head.appendChild(style);
  }
}

window.OverlayStyleInstaller = OverlayStyleInstaller;
