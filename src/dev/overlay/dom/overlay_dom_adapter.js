import { UiEventShield } from "../../../platform/browser/dom/ui_event_shield.js";

export class OverlayDomAdapter {
  #documentTarget;
  #createScaleControls;
  #createDragController;
  #container = null;
  #content = null;
  #dragController = null;
  #scale = 1;

  constructor({
    documentTarget = document,
    createScaleControls,
    createDragController,
  } = {}) {
    this.#documentTarget = documentTarget;
    this.#createScaleControls = createScaleControls;
    this.#createDragController = createDragController;
  }

  init() {
    if (this.#container?.isConnected) return;

    this.#container = this.#documentTarget.createElement("div");
    this.#container.id = "debugOverlay";
    this.#container.className = "debug-overlay";

    if (UiEventShield.makeSolid) {
      UiEventShield.makeSolid(this.#container);
    }

    this.#content = this.#documentTarget.createElement("div");
    this.#content.className = "debug-overlay__content";
    this.#container.appendChild(this.#content);

    const controls = this.#createScaleControls({
      documentTarget: this.#documentTarget,
      onScaleChanged: (scale) => this.setScale(scale),
    });
    this.#container.appendChild(controls.create());
    this.#documentTarget.body.appendChild(this.#container);

    this.#dragController = this.#createDragController(this.#container);
    this.#dragController.attach();
  }

  show() {
    if (!this.#container) return;
    if (this.#container.style.display === "block") return;
    this.#container.style.display = "block";
    this.#clampWhenStable();
  }

  hide() {
    if (this.#container) this.#container.style.display = "none";
  }

  updateHtml(html) {
    if (!this.#content) return;
    this.#content.innerHTML = html;
    this.#clampWhenStable();
  }

  getRootElement() {
    return this.#container;
  }

  setScale(scale) {
    this.#scale = scale;
    this.applyScale();
  }

  applyScale() {
    if (this.#container) {
      this.#container.style.transform = `scale(${this.#scale})`;
      this.#clampWhenStable();
    }
  }

  #clampWhenStable() {
    if (this.#dragController?.isDragging?.()) return;
    this.#dragController?.clampToViewport?.();
  }

  dispose() {
    this.#dragController?.detach?.();
    this.#container?.remove();
    this.#container = null;
    this.#content = null;
    this.#dragController = null;
  }
}
