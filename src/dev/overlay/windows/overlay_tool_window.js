import { UiEventShield } from "../../../platform/browser/dom/ui_event_shield.js";

// The window's size factor at start, as the main overlay window (owner, 2026-10-18).
const DEFAULT_SCALE = 2 / 3;
const MIN_SAVED_SCALE = 0.3;
const MAX_SAVED_SCALE = 3.0;

// A separate DEV overlay window with DOM content (spec 168 D1): a top scale slider, title, scrolling body that the
// owner fills, and long-press dragging as the main overlay windows, with its own saved position (the drag controller's
// id). modifier: the window's own modifier class (its default place on the screen).
export class OverlayToolWindow {
  #documentTarget;
  #mountNode;
  #title;
  #modifier;
  #createScaleControls;
  #createDragController;
  #cache;
  #scaleStorageKey;
  #scale;
  #container = null;
  #body = null;
  #scaleControls = null;
  #dragController = null;
  #sizeObserver = null;

  constructor({
    documentTarget,
    mountNode,
    title,
    modifier,
    createScaleControls,
    createDragController,
    scale = DEFAULT_SCALE,
    cache = null,
    scaleStorageKey = "",
  }) {
    this.#documentTarget = documentTarget;
    this.#mountNode = mountNode;
    this.#title = title;
    this.#modifier = modifier;
    this.#createScaleControls = createScaleControls;
    this.#createDragController = createDragController;
    this.#cache = cache;
    this.#scaleStorageKey = String(scaleStorageKey || "");
    const saved = this.#scaleStorageKey ? Number(cache?.get?.(this.#scaleStorageKey)) : NaN;
    this.#scale = Number.isFinite(saved) && saved >= MIN_SAVED_SCALE && saved <= MAX_SAVED_SCALE ? saved : scale;
  }

  get body() {
    this.#init();
    return this.#body;
  }

  get visible() {
    return this.#container?.style.display === "flex";
  }

  show() {
    this.#init();
    if (this.visible) return;
    this.#container.style.display = "flex";
    this.#dragController?.clampToViewport?.();
  }

  hide() {
    if (this.#container) this.#container.style.display = "none";
  }

  dispose() {
    this.#sizeObserver?.disconnect();
    this.#sizeObserver = null;
    this.#scaleControls?.dispose?.();
    this.#scaleControls = null;
    this.#dragController?.detach?.();
    this.#dragController = null;
    this.#container?.remove();
    this.#container = null;
    this.#body = null;
  }

  #init() {
    if (this.#container) return;
    const container = this.#documentTarget.createElement("div");
    container.className = `debug-overlay debug-overlay--tool ${this.#modifier}`;
    UiEventShield.makeSolid?.(container);
    const title = this.#documentTarget.createElement("div");
    title.className = "debug-overlay__title";
    title.textContent = this.#title;
    this.#body = this.#documentTarget.createElement("div");
    this.#body.className = "debug-overlay__content";
    this.#scaleControls = this.#createScaleControls({
      documentTarget: this.#documentTarget,
      scale: this.#scale,
      onScaleChanged: (scale) => this.#setScale(scale),
      onScaleCommitted: (scale) => this.#saveScale(scale),
    });
    container.append(this.#scaleControls.create(), title, this.#body);
    container.style.setProperty("--debug-overlay-scale", String(this.#scale));
    container.style.display = "none";
    this.#mountNode.appendChild(container);
    this.#container = container;
    this.#dragController = this.#createDragController(container);
    this.#dragController.attach();
    const ResizeObserverClass = this.#documentTarget.defaultView?.ResizeObserver;
    if (typeof ResizeObserverClass === "function") {
      this.#sizeObserver = new ResizeObserverClass(() => {
        if (!this.#dragController?.isDragging?.()) this.#dragController?.clampToViewport?.();
      });
      this.#sizeObserver.observe(container);
    }
  }

  #setScale(scale) {
    this.#scale = scale;
    const zoom = () => this.#container.style.setProperty("--debug-overlay-scale", String(scale));
    if (this.#dragController?.keepPosition) this.#dragController.keepPosition(zoom);
    else zoom();
    this.#dragController?.clampToViewport?.();
  }

  #saveScale(scale) {
    if (this.#scaleStorageKey) this.#cache?.set?.(this.#scaleStorageKey, scale);
  }
}
