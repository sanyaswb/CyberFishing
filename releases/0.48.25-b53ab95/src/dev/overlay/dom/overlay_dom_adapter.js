import { UiEventShield } from "../../../platform/browser/dom/ui_event_shield.js";

// The window's size factor at start (owner, 2026-10-18: 1.5 times smaller than full size); − / + change it.
const DEFAULT_SCALE = 2 / 3;

// The DEV overlay window. Its scale is the --debug-overlay-scale property: CSS zooms the content and the − / + buttons
// with it and scales the window's padding, so the window's box is what is seen (dragging and clamping need no
// transform correction) and its width follows the content.
export class OverlayDomAdapter {
  #documentTarget;
  #mountNode;
  #createScaleControls;
  #createDragController;
  #container = null;
  #content = null;
  #dragController = null;
  #scale;

  constructor({
    documentTarget = document,
    mountNode = documentTarget.body,
    createScaleControls,
    createDragController,
    scale = DEFAULT_SCALE,
  } = {}) {
    this.#scale = scale;
    this.#documentTarget = documentTarget;
    this.#mountNode = mountNode;
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
      scale: this.#scale,
      onScaleChanged: (scale) => this.setScale(scale),
    });
    this.#container.appendChild(controls.create());
    this.#container.style.setProperty("--debug-overlay-scale", String(this.#scale));
    this.#mountNode.appendChild(this.#container);

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
      this.#container.style.setProperty("--debug-overlay-scale", String(this.#scale));
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
