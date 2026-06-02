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
