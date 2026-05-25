(function patchOverlayMetricInfoDesktopInteraction() {
  if (typeof OverlayMetricInfoBridge === "undefined") return;

  const originalHandlePointerDown = OverlayMetricInfoBridge.prototype.handlePointerDown;

  OverlayMetricInfoBridge.prototype.handlePointerDown = function handlePointerDown(event) {
    const button = event.target.closest?.(".overlay-metric-info-btn");
    if (!button) {
      if (typeof originalHandlePointerDown === "function") {
        originalHandlePointerDown.call(this, event);
      }
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();

    if (button.dataset.pointerHandled === "1") return;
    button.dataset.pointerHandled = "1";
    window.setTimeout(() => {
      if (button.isConnected) delete button.dataset.pointerHandled;
    }, 240);

    this.inspectButton(button);
  };

  OverlayMetricInfoBridge.prototype.handleClick = function handleClick(event) {
    const button = event.target.closest?.(".overlay-metric-info-btn");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
  };

  OverlayMetricInfoBridge.prototype.inspectButton = function inspectButton(button) {
    const row = button.closest("div[style*='justify-content:space-between']");
    const label = button.dataset.metric || "metric";
    const value = row?.querySelector("span:last-child")?.textContent?.trim() || "";
    const entry = this.catalog.getEntry(label);

    button.classList.add("overlay-metric-info-btn-active");
    window.setTimeout(() => {
      if (button.isConnected) button.classList.remove("overlay-metric-info-btn-active");
    }, 180);

    this.inspector.inspect({ label, displayedValue: value, entry });
  };

  const style = document.createElement("style");
  style.id = "overlay-metric-info-desktop-fix-styles";
  style.textContent = `
    .overlay-metric-linked-label {
      position: relative;
      min-height: 16px;
      line-height: 1.2;
    }
    .overlay-metric-info-btn {
      width: 14px !important;
      height: 14px !important;
      min-width: 14px !important;
      flex: 0 0 14px !important;
      box-sizing: border-box !important;
      transform: translateZ(0);
      transition: none !important;
      outline: none !important;
      -webkit-tap-highlight-color: transparent;
    }
    .overlay-metric-info-btn:hover {
      background: rgba(115, 194, 251, 0.12) !important;
      border-color: rgba(115, 194, 251, 0.9) !important;
      box-shadow: 0 0 5px rgba(115, 194, 251, 0.35) !important;
    }
    .overlay-metric-info-btn-active,
    .overlay-metric-info-btn:active {
      background: rgba(255, 255, 255, 0.85) !important;
      border-color: #ffffff !important;
      box-shadow: 0 0 8px rgba(255, 255, 255, 0.9) !important;
    }
  `;
  document.head.appendChild(style);
})();
