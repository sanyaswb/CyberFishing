class OverlayWindowDragController {
  #element;
  #config;
  #windowTarget;
  #id;
  #holdTimer = null;
  #isDragging = false;
  #startX = 0;
  #startY = 0;
  #offsetX = 0;
  #offsetY = 0;
  #onPointerDown = (event) => this.#handlePointerDown(event);
  #onPointerMove = (event) => this.#handlePointerMove(event);
  #onPointerUp = (event) => this.#handlePointerUp(event);
  #onResize = () => this.clampToViewport();

  constructor({
    element,
    config = typeof CONFIG !== "undefined" ? CONFIG : {},
    id = "debug_overlay",
    windowTarget = typeof window !== "undefined" ? window : null,
  } = {}) {
    this.#element = element;
    this.#config = config || {};
    this.#windowTarget = windowTarget;
    this.#id = id;
  }

  attach() {
    if (!this.#element) return;
    if (typeof UIUtils !== "undefined" && UIUtils.makeSolid) {
      UIUtils.makeSolid(this.#element);
    }
    this.#restorePosition();
    this.#element.addEventListener("pointerdown", this.#onPointerDown);
    this.#windowTarget?.addEventListener?.("resize", this.#onResize);
  }

  detach() {
    if (!this.#element) return;
    this.#clearHoldTimer();
    this.#element.removeEventListener("pointerdown", this.#onPointerDown);
    this.#element.removeEventListener("pointermove", this.#onPointerMove);
    this.#element.removeEventListener("pointerup", this.#onPointerUp);
    this.#element.removeEventListener("pointercancel", this.#onPointerUp);
    this.#windowTarget?.removeEventListener?.("resize", this.#onResize);
  }

  isDragging() {
    return this.#isDragging;
  }

  clampToViewport() {
    if (this.#isDragging) return;
    if (!this.#element || this.#element.style.display === "none") return;
    if (!this.#windowTarget) return;
    const rect = this.#element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const maxLeft = Math.max(0, this.#windowTarget.innerWidth - rect.width);
    const maxTop = Math.max(0, this.#windowTarget.innerHeight - rect.height);
    this.#placeVisualAt(
      this.#clamp(rect.left, 0, maxLeft),
      this.#clamp(rect.top, 0, maxTop),
    );
  }

  #handlePointerDown(event) {
    if (!this.#config.ui?.draggableButtons) return;
    if (!this.#windowTarget) return;
    if (event.button !== 0 && event.pointerType === "mouse") return;
    if (this.#isInteractiveTarget(event.target)) return;

    event.stopPropagation();
    this.#element.setPointerCapture?.(event.pointerId);
    const rect = this.#element.getBoundingClientRect();
    this.#startX = event.clientX;
    this.#startY = event.clientY;
    this.#offsetX = event.clientX - rect.left;
    this.#offsetY = event.clientY - rect.top;
    this.#isDragging = false;

    this.#holdTimer = this.#windowTarget.setTimeout(
      () => this.#startDrag(rect),
      this.#config.ui?.dragHoldTimeMs || 1500,
    );

    this.#element.addEventListener("pointermove", this.#onPointerMove);
    this.#element.addEventListener("pointerup", this.#onPointerUp);
    this.#element.addEventListener("pointercancel", this.#onPointerUp);
  }

  #handlePointerMove(event) {
    if (!this.#isDragging) {
      const distance = Math.hypot(
        event.clientX - this.#startX,
        event.clientY - this.#startY,
      );
      if (distance > 10) this.#clearHoldTimer();
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.#updatePosition(event.clientX, event.clientY);
  }

  #handlePointerUp(event) {
    this.#element.releasePointerCapture?.(event.pointerId);
    this.#element.removeEventListener("pointermove", this.#onPointerMove);
    this.#element.removeEventListener("pointerup", this.#onPointerUp);
    this.#element.removeEventListener("pointercancel", this.#onPointerUp);
    this.#clearHoldTimer();

    if (!this.#isDragging) return;
    this.#isDragging = false;
    this.clampToViewport();
    this.#savePosition();
  }

  #startDrag(startRect) {
    this.#isDragging = true;
    this.#element.style.position = "absolute";
    this.#element.style.margin = "0";
    this.#element.style.right = "auto";
    this.#element.style.bottom = "auto";
    this.#placeVisualAt(startRect.left, startRect.top);
    this.#updatePosition(this.#startX, this.#startY);
  }

  #updatePosition(clientX, clientY) {
    const rect = this.#element.getBoundingClientRect();
    if (!this.#windowTarget) return;
    const maxLeft = Math.max(0, this.#windowTarget.innerWidth - rect.width);
    const maxTop = Math.max(0, this.#windowTarget.innerHeight - rect.height);
    const nextLeft = this.#clamp(clientX - this.#offsetX, 0, maxLeft);
    const nextTop = this.#clamp(clientY - this.#offsetY, 0, maxTop);
    this.#placeVisualAt(nextLeft, nextTop);
  }

  #placeVisualAt(left, top) {
    const rect = this.#element.getBoundingClientRect();
    const currentLeft = this.#readStylePx("left", rect.left);
    const currentTop = this.#readStylePx("top", rect.top);
    this.#element.style.left = `${currentLeft + left - rect.left}px`;
    this.#element.style.top = `${currentTop + top - rect.top}px`;
    this.#element.style.right = "auto";
    this.#element.style.bottom = "auto";
  }

  #restorePosition() {
    if (typeof CacheManager === "undefined" || !this.#element) return;
    const savedPosition = CacheManager.get(`drag_pos_${this.#id}`);
    if (!savedPosition) return;

    this.#element.style.position = "absolute";
    this.#element.style.margin = "0";
    this.#element.style.transition = "none";
    this.#element.style.left = savedPosition.x ?? savedPosition.left ?? "auto";
    this.#element.style.top = savedPosition.y ?? savedPosition.top ?? "auto";
    this.#element.style.right = savedPosition.right ?? "auto";
    this.#element.style.bottom = savedPosition.bottom ?? "auto";
  }

  #savePosition() {
    if (typeof CacheManager === "undefined" || !this.#element) return;
    const rect = this.#element.getBoundingClientRect();
    CacheManager.set(`drag_pos_${this.#id}`, {
      left: `${Math.max(0, rect.left)}px`,
      top: `${Math.max(0, rect.top)}px`,
      right: "auto",
      bottom: "auto",
    });
  }

  #isInteractiveTarget(target) {
    return !!target?.closest?.(
      "button,input,select,textarea,[data-overlay-control],.overlay-metric-label",
    );
  }

  #clearHoldTimer() {
    if (!this.#holdTimer) return;
    this.#windowTarget?.clearTimeout?.(this.#holdTimer);
    this.#holdTimer = null;
  }

  #readStylePx(property, fallback) {
    const value = Number.parseFloat(this.#element.style[property]);
    return Number.isFinite(value) ? value : fallback;
  }

  #clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || 0));
  }
}

window.OverlayWindowDragController = OverlayWindowDragController;
