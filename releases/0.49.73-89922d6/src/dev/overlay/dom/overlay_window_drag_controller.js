import { UiEventShield } from "../../../platform/browser/dom/ui_event_shield.js";
import { clampNumber } from "../../../engine/math/number_normalization.js";

export class OverlayWindowDragController {
  #element;
  #config;
  #windowTarget;
  #uiSurface;
  #unsubscribeSurface;
  #id;
  #cache;
  #holdTimer = null;
  #isDragging = false;
  #startX = 0;
  #startY = 0;
  #offsetX = 0;
  #offsetY = 0;
  #pointerId = null;
  #onPointerDown = (event) => this.#handlePointerDown(event);
  #onPointerMove = (event) => this.#handlePointerMove(event);
  #onPointerUp = (event) => this.#handlePointerUp(event);
  #onTouchMove = (event) => this.#handleTouchMove(event);
  #onResize = () => this.clampToViewport();

  constructor({
    element,
    config,
    id = "debug_overlay",
    windowTarget = typeof window !== "undefined" ? window : null,
    cache,
    uiSurface = null,
  } = {}) {
    this.#element = element;
    this.#config = config || {};
    this.#windowTarget = windowTarget;
    this.#id = id;
    this.#cache = cache;
    this.#uiSurface = uiSurface;
    this.#element?.classList?.add?.("draggable-window");
  }

  attach() {
    if (!this.#element) return;
    if (UiEventShield.makeSolid) {
      UiEventShield.makeSolid(this.#element);
    }
    this.#restorePosition();
    this.#element.addEventListener("pointerdown", this.#onPointerDown);
    this.#windowTarget?.addEventListener?.("resize", this.#onResize);
    this.#unsubscribeSurface = this.#uiSurface?.subscribe(this.#onResize);
  }

  detach() {
    if (!this.#element) return;
    this.#clearHoldTimer();
    this.#element.removeEventListener("pointerdown", this.#onPointerDown);
    this.#element.removeEventListener("pointermove", this.#onPointerMove);
    this.#element.removeEventListener("pointerup", this.#onPointerUp);
    this.#element.removeEventListener("pointercancel", this.#onPointerUp);
    this.#element.removeEventListener("touchmove", this.#onTouchMove, { capture: true });
    this.#windowTarget?.removeEventListener?.("touchmove", this.#onTouchMove, { capture: true });
    this.#windowTarget?.removeEventListener?.("resize", this.#onResize);
    this.#unsubscribeSurface?.();
    this.#unsubscribeSurface = null;
    if (this.#pointerId !== null && this.#element.hasPointerCapture?.(this.#pointerId)) {
      this.#element.releasePointerCapture(this.#pointerId);
    }
    this.#pointerId = null;
    this.#isDragging = false;
    this.#element?.classList?.remove?.("draggable-window--dragging");
    if (this.#element?.style) this.#element.style.touchAction = "";
    const content = this.#element?.querySelector?.(".debug-overlay__content");
    if (content?.style) {
      content.style.overflowY = "";
      content.style.touchAction = "";
      content.style.pointerEvents = "";
    }
  }

  isDragging() {
    return this.#isDragging;
  }

  clampToViewport() {
    if (this.#isDragging) return;
    if (!this.#element || this.#element.style.display === "none") return;
    if (!this.#windowTarget) return;

    const origin = this.#uiSurface?.getMetrics();
    const viewportWidth = origin?.physicalWidth ?? this.#windowTarget.innerWidth;
    const viewportHeight = origin?.physicalHeight ?? this.#windowTarget.innerHeight;
    const originX = origin?.originX || 0;
    const originY = origin?.originY || 0;
    const surfaceScale = origin?.scale || 1;

    // TK-185: Constrain overlay maxHeight and maxWidth to available screen dimensions
    const margin = 10;
    const maxPhysicalHeight = Math.max(120, viewportHeight - margin * 2);
    const maxLogicalHeight = maxPhysicalHeight / surfaceScale;
    this.#element.style.maxHeight = `${maxLogicalHeight}px`;

    const maxPhysicalWidth = Math.max(180, viewportWidth - margin * 2);
    const maxLogicalWidth = maxPhysicalWidth / surfaceScale;
    this.#element.style.maxWidth = `${maxLogicalWidth}px`;

    const rect = this.#element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const maxLeft = Math.max(originX + margin, originX + viewportWidth - rect.width - margin);
    const maxTop = Math.max(originY + margin, originY + viewportHeight - rect.height - margin);
    this.#placeVisualAt(
      clampNumber(rect.left, originX + margin, maxLeft),
      clampNumber(rect.top, originY + margin, maxTop),
    );
  }

  #handlePointerDown(event) {
    if (!this.#config.ui?.draggableButtons) return;
    if (!this.#windowTarget) return;
    if (this.#uiSurface && !this.#uiSurface.getMetrics().valid) return;
    if (event.button !== 0 && event.pointerType === "mouse") return;
    if (this.#isInteractiveTarget(event.target)) return;

    event.stopPropagation();
    this.#element.setPointerCapture?.(event.pointerId);
    this.#pointerId = event.pointerId;
    const rect = this.#element.getBoundingClientRect();
    this.#startX = event.clientX;
    this.#startY = event.clientY;
    this.#offsetX = event.clientX - rect.left;
    this.#offsetY = event.clientY - rect.top;
    this.#isDragging = false;

    this.#holdTimer = this.#windowTarget.setTimeout(
      () => this.#startDrag(rect),
      this.#config.ui?.dragHoldTimeMs ?? 800,
    );

    this.#element.addEventListener("pointermove", this.#onPointerMove);
    this.#element.addEventListener("pointerup", this.#onPointerUp);
    this.#element.addEventListener("pointercancel", this.#onPointerUp);
    this.#element.addEventListener("touchmove", this.#onTouchMove, { passive: false, capture: true });
    this.#windowTarget?.addEventListener?.("touchmove", this.#onTouchMove, { passive: false, capture: true });
  }

  #handleTouchMove(event) {
    if (this.#isDragging) {
      if (event.cancelable) event.preventDefault();
      event.stopPropagation();
    }
  }

  #handlePointerMove(event) {
    if (!this.#isDragging) {
      const distance = Math.hypot(
        event.clientX - this.#startX,
        event.clientY - this.#startY,
      );
      if (distance > 18) this.#clearHoldTimer();
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.#updatePosition(event.clientX, event.clientY);
  }

  #handlePointerUp(event) {
    this.#element.releasePointerCapture?.(event.pointerId);
    this.#pointerId = null;
    this.#element.removeEventListener("pointermove", this.#onPointerMove);
    this.#element.removeEventListener("pointerup", this.#onPointerUp);
    this.#element.removeEventListener("pointercancel", this.#onPointerUp);
    this.#element.removeEventListener("touchmove", this.#onTouchMove, { capture: true });
    this.#windowTarget?.removeEventListener?.("touchmove", this.#onTouchMove, { capture: true });
    this.#clearHoldTimer();

    if (!this.#isDragging) return;
    this.#isDragging = false;
    this.#element?.classList?.remove?.("draggable-window--dragging");
    if (this.#element?.style) this.#element.style.touchAction = "";
    const content = this.#element?.querySelector?.(".debug-overlay__content");
    if (content?.style) {
      content.style.overflowY = "";
      content.style.touchAction = "";
      content.style.pointerEvents = "";
    }
    this.clampToViewport();
    this.#savePosition();
  }

  #startDrag(startRect) {
    this.#isDragging = true;
    this.#element?.classList?.add?.("draggable-window--dragging");
    if (this.#element?.style) this.#element.style.touchAction = "none";
    const content = this.#element?.querySelector?.(".debug-overlay__content");
    if (content?.style) {
      content.style.overflowY = "hidden";
      content.style.touchAction = "none";
      content.style.pointerEvents = "none";
    }
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
    const origin = this.#uiSurface?.getMetrics();
    const minLeft = origin?.originX || 0;
    const minTop = origin?.originY || 0;
    const maxLeft = Math.max(minLeft, minLeft + (origin?.physicalWidth ?? this.#windowTarget.innerWidth) - rect.width);
    const maxTop = Math.max(minTop, minTop + (origin?.physicalHeight ?? this.#windowTarget.innerHeight) - rect.height);
    const nextLeft = clampNumber(clientX - this.#offsetX, minLeft, maxLeft);
    const nextTop = clampNumber(clientY - this.#offsetY, minTop, maxTop);
    this.#placeVisualAt(nextLeft, nextTop);
  }

  #placeVisualAt(left, top) {
    const rect = this.#element.getBoundingClientRect();
    const diffX = left - rect.left;
    const diffY = top - rect.top;
    if (Math.abs(diffX) < 0.5 && Math.abs(diffY) < 0.5) return;
    const logicalPoint = this.#uiSurface?.physicalToLogicalPoint({ x: rect.left, y: rect.top });
    const currentLeft = this.#readStylePx("left", logicalPoint?.x ?? rect.left);
    const currentTop = this.#readStylePx("top", logicalPoint?.y ?? rect.top);
    const delta = this.#uiSurface?.physicalToLogicalDelta({ x: diffX, y: diffY });
    this.#element.style.left = `${currentLeft + (delta?.x ?? diffX)}px`;
    this.#element.style.top = `${currentTop + (delta?.y ?? diffY)}px`;
    this.#element.style.right = "auto";
    this.#element.style.bottom = "auto";
  }

  #restorePosition() {
    if (!this.#element) return;
    const savedPosition = this.#cache.get(`drag_pos_${this.#id}`);
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
    if (!this.#element) return;
    const physicalRect = this.#element.getBoundingClientRect();
    const rect = this.#uiSurface?.physicalToLogicalRect(physicalRect) || physicalRect;
    this.#cache.set(`drag_pos_${this.#id}`, {
      left: `${Math.max(0, rect.left)}px`,
      top: `${Math.max(0, rect.top)}px`,
      right: "auto",
      bottom: "auto",
    });
  }

  #isInteractiveTarget(target) {
    return !!target?.closest?.(
      "button,input,select,textarea,summary,[data-overlay-control]",
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
}
