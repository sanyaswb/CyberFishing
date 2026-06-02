class OverlayDomAdapter {
  #documentTarget;
  #styleInstaller;
  #container = null;
  #content = null;
  #scale = 1;

  constructor({
    documentTarget = document,
    styleInstaller = new OverlayStyleInstaller(documentTarget),
  } = {}) {
    this.#documentTarget = documentTarget;
    this.#styleInstaller = styleInstaller;
  }

  init() {
    this.#container = this.#documentTarget.createElement("div");
    this.#container.id = "debugOverlay";
    this.#container.className = "debug-overlay";
    this.#container.style.cssText = `
      position: absolute; bottom: 10px; left: 10px;
      background: rgba(11, 21, 32, 0.95); color: #ffffff;
      padding: 15px 15px 50px 15px; font-family: monospace;
      font-size: 14px; border: 1px solid #4a5b6c; border-radius: 8px;
      z-index: 10000; display: none; box-shadow: 0 4px 15px rgba(0,0,0,0.6);
      min-width: 280px; transform-origin: bottom left;
      touch-action: none; pointer-events: all;
    `;

    if (typeof UIUtils !== "undefined" && UIUtils.makeSolid) {
      UIUtils.makeSolid(this.#container);
    }

    this.#content = this.#documentTarget.createElement("div");
    this.#content.className = "debug-overlay-content";
    this.#content.style.pointerEvents = "none";
    this.#container.appendChild(this.#content);

    const controls = new OverlayScaleControls({
      documentTarget: this.#documentTarget,
      onScaleChanged: (scale) => this.setScale(scale),
    });
    this.#container.appendChild(controls.create());
    this.#documentTarget.body.appendChild(this.#container);
    this.#styleInstaller.install();

    if (
      typeof UIDraggableButton !== "undefined" &&
      typeof CONFIG !== "undefined"
    ) {
      new UIDraggableButton(this.#container, null, CONFIG, {
        id: "debug_overlay",
        noTransform: true,
      });
    }
  }

  show() {
    if (this.#container) this.#container.style.display = "block";
  }

  hide() {
    if (this.#container) this.#container.style.display = "none";
  }

  updateHtml(html) {
    if (!this.#content) return;
    this.#content.innerHTML = html;
  }

  setScale(scale) {
    this.#scale = scale;
    this.applyScale();
  }

  applyScale() {
    if (this.#container) {
      this.#container.style.transform = `scale(${this.#scale})`;
    }
  }
}

window.OverlayDomAdapter = OverlayDomAdapter;
