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
        gap: 5px;
        min-height: 16px;
        line-height: 1.2;
      }
      .debug-overlay-value {
        font-weight: bold;
        text-align: right;
      }
      .overlay-metric-info-btn {
        width: 14px;
        height: 14px;
        min-width: 14px;
        flex: 0 0 14px;
        box-sizing: border-box;
        padding: 0;
        border-radius: 4px;
        border: 1px solid rgba(115, 194, 251, 0.9);
        background: rgba(115, 194, 251, 0.12);
        box-shadow: 0 0 5px rgba(115, 194, 251, 0.35);
        cursor: pointer;
        pointer-events: auto;
        touch-action: none;
        transform: translateZ(0);
        transition: none;
        outline: none;
        -webkit-tap-highlight-color: transparent;
      }
      .overlay-metric-info-btn:hover {
        background: rgba(115, 194, 251, 0.12);
        border-color: rgba(115, 194, 251, 0.9);
        box-shadow: 0 0 5px rgba(115, 194, 251, 0.35);
      }
      .overlay-metric-info-btn-active,
      .overlay-metric-info-btn:active {
        background: rgba(255, 255, 255, 0.85);
        border-color: #ffffff;
        box-shadow: 0 0 8px rgba(255, 255, 255, 0.9);
      }
    `;
    this.#documentTarget.head.appendChild(style);
  }
}

window.OverlayStyleInstaller = OverlayStyleInstaller;
