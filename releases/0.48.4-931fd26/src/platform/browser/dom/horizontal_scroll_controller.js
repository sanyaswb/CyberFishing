import { nonNegativeFiniteOr } from "../../../engine/math/number_normalization.js";

// Drag-to-scroll with click suppression for pointer drags along one axis: horizontal filter rows (default) and, with
// axis "y", the vertical item list (spec 076). Mouse drags scroll programmatically; touch keeps native panning and
// inertia, and a swipe never activates the card under the finger. With resolveAxis(element) the axis is read at the start
// of every gesture, for a scroller whose layout turns it from a row into a column (spec 142: the auxiliary wells).
export class HorizontalScrollController {
  #axis;
  #resolveAxis;
  #dragThresholdPx;
  #bindings = new WeakMap();
  #uiSurface;
  #manualTouch;
  #getPanConfig;
  #className;
  #dragClassName;
  #onVerticalGesture;
  #nowMs;
  #wheelGestureGapMs;

  constructor({ axis = "x", dragThresholdPx = 6, uiSurface = null, manualTouch = false,
    getPanConfig = null, className = "inventory-horizontal-scroll",
    dragClassName = "inventory-horizontal-scroll--dragging", onVerticalGesture = null,
    nowMs = Date.now, wheelGestureGapMs = 180, resolveAxis = null } = {}) {
    this.#axis = axis === "y" ? "y" : "x";
    this.#resolveAxis = typeof resolveAxis === "function" ? resolveAxis : null;
    this.#dragThresholdPx = Math.max(0, Number(dragThresholdPx) || 0);
    this.#uiSurface = uiSurface;
    this.#manualTouch = manualTouch;
    this.#getPanConfig = getPanConfig;
    this.#className = className;
    this.#dragClassName = dragClassName;
    this.#onVerticalGesture = onVerticalGesture;
    this.#nowMs = nowMs;
    this.#wheelGestureGapMs = nonNegativeFiniteOr(wheelGestureGapMs, 180);
  }

  attach(element) {
    if (!element?.addEventListener) {
      throw new TypeError("HorizontalScrollController requires an element");
    }
    this.detach(element);
    const state = {
      active: false,
      dragging: false,
      pointerId: null,
      startX: 0,
      startY: 0,
      panDistance: 0,
      axis: null,
      startScrollLeft: 0,
      suppressClickUntil: 0,
      touch: false,
      wheelTime: -Infinity,
      wheelDirection: 0,
      scrollAxis: this.#axis,
    };
    const handlers = {
      wheel: (event) => this.#onWheel(element, state, event),
      pointerDown: (event) => this.#onPointerDown(element, state, event),
      pointerMove: (event) => this.#onPointerMove(element, state, event),
      pointerEnd: (event) => {
        // A child card losing capture to this scroller is not the scroller losing its own capture.
        if (event.type === "lostpointercapture" && event.target !== element) return;
        this.#onPointerEnd(element, state, event);
      },
      click: (event) => this.#onClick(state, event),
      dragStart: (event) => event.preventDefault(),
    };
    element.classList?.add(this.#className);
    element.addEventListener("wheel", handlers.wheel, { passive: false });
    element.addEventListener("pointerdown", handlers.pointerDown);
    element.addEventListener("pointermove", handlers.pointerMove);
    element.addEventListener("pointerup", handlers.pointerEnd);
    element.addEventListener("pointercancel", handlers.pointerEnd);
    element.addEventListener("lostpointercapture", handlers.pointerEnd);
    element.addEventListener("click", handlers.click, true);
    element.addEventListener("dragstart", handlers.dragStart);
    this.#bindings.set(element, { ...handlers, state });
    return () => this.detach(element);
  }

  detach(element) {
    const handlers = this.#bindings.get(element);
    if (!handlers) return;
    this.#onPointerEnd(element, handlers.state, { pointerId: handlers.state.pointerId });
    element.removeEventListener("wheel", handlers.wheel);
    element.removeEventListener("pointerdown", handlers.pointerDown);
    element.removeEventListener("pointermove", handlers.pointerMove);
    element.removeEventListener("pointerup", handlers.pointerEnd);
    element.removeEventListener("pointercancel", handlers.pointerEnd);
    element.removeEventListener("lostpointercapture", handlers.pointerEnd);
    element.removeEventListener("click", handlers.click, true);
    element.removeEventListener("dragstart", handlers.dragStart);
    element.classList?.remove(
      this.#className,
      this.#dragClassName,
    );
    this.#bindings.delete(element);
  }

  #onWheel(element, state, event) {
    this.#refreshAxis(element, state);
    // Vertical lists keep the browser's own wheel scrolling.
    if (event?.ctrlKey || state.scrollAxis === "y") return;
    const vertical = Number(event?.deltaY) || 0;
    const horizontal = Number(event?.deltaX) || 0;
    if (this.#onVerticalGesture) {
      if (vertical || horizontal) event.preventDefault?.();
      if (vertical && Math.abs(vertical) >= Math.abs(horizontal)) {
        const now = this.#nowMs();
        const direction = Math.sign(vertical);
        const fresh = direction !== state.wheelDirection || now - state.wheelTime >= this.#wheelGestureGapMs;
        state.wheelTime = now;
        state.wheelDirection = direction;
        if (fresh) this.#onVerticalGesture(vertical);
      }
      return;
    }
    const config = this.#getPanConfig?.();
    const delta = config ? horizontal || vertical : Math.abs(vertical) >= Math.abs(horizontal)
      ? vertical
      : horizontal;
    if (!delta) return;
    const previous = Number(element.scrollLeft) || 0;
    const maximum = this.#maximumScroll(element, state.scrollAxis);
    const mode = Number(event?.deltaMode) || 0;
    let logicalDelta = mode === 1 ? delta * (config ? nonNegativeFiniteOr(config.wheelStepPx, 40) : 16) : mode === 2 ? delta * element.clientWidth :
      (this.#uiSurface?.physicalToLogicalDelta({ x: delta }).x ?? delta);
    if (config) logicalDelta *= nonNegativeFiniteOr(config.sensitivity, 1) * (config.inverted === false ? -1 : 1);
    const next = Math.max(0, Math.min(maximum, previous + logicalDelta));
    if (config) event.preventDefault?.();
    if (next === previous) return;
    element.scrollLeft = next;
    event.preventDefault?.();
  }

  #onPointerDown(element, state, event) {
    if (state.active) return;
    if (event?.isPrimary === false || Number(event?.button) > 0) return;
    this.#refreshAxis(element, state);
    if (this.#maximumScroll(element, state.scrollAxis) <= 0 && !this.#onVerticalGesture) return;
    state.active = true;
    state.touch = event?.pointerType === "touch";
    state.dragging = false;
    state.pointerId = event?.pointerId ?? null;
    state.startX = Number(event?.clientX) || 0;
    state.startY = Number(event?.clientY) || 0;
    state.panDistance = 0;
    state.axis = null;
    state.startScrollLeft = this.#scroll(element, state.scrollAxis);
    state.suppressClickUntil = 0;
    if (this.#manualTouch && state.pointerId !== null) element.setPointerCapture?.(state.pointerId);
  }

  #onPointerMove(element, state, event) {
    if (!state.active || !this.#matchesPointer(state, event)) return;
    const offset = state.scrollAxis === "y"
      ? (Number(event?.clientY) || 0) - state.startY
      : (Number(event?.clientX) || 0) - state.startX;
    // Keep native touch panning and inertia, while suppressing a swipe's accidental click.
    if (state.touch && !this.#manualTouch) {
      if (Math.abs(offset) >= this.#dragThresholdPx) state.suppressClickUntil = Date.now() + 250;
      return;
    }
    const movement = this.#manualTouch
      ? Math.hypot(offset, (Number(event?.clientY) || 0) - state.startY) : Math.abs(offset);
    if (!state.dragging && (this.#manualTouch ? movement <= this.#dragThresholdPx : movement < this.#dragThresholdPx)) return;

    if (!state.dragging) {
      state.dragging = true;
      const vertical = (Number(event?.clientY) || 0) - state.startY;
      state.axis = state.scrollAxis === "x" && this.#onVerticalGesture && Math.abs(vertical) > Math.abs(offset)
        ? "vertical" : "horizontal";
      if (state.axis === "vertical") this.#onVerticalGesture(vertical);
      element.classList?.add(this.#dragClassName);
      if (
        state.pointerId !== null &&
        typeof element.setPointerCapture === "function"
      ) {
        element.setPointerCapture(state.pointerId);
      }
    }

    if (state.axis === "vertical") {
      state.suppressClickUntil = Date.now() + 250;
      event.preventDefault?.();
      return;
    }

    const maximum = this.#maximumScroll(element, state.scrollAxis);
    const logicalOffset = state.scrollAxis === "y"
      ? this.#uiSurface?.physicalToLogicalDelta({ y: offset }).y ?? offset
      : this.#uiSurface?.physicalToLogicalDelta({ x: offset }).x ?? offset;
    const config = this.#getPanConfig?.();
    let next;
    if (config) {
      let distance = logicalOffset * nonNegativeFiniteOr(config.sensitivity, 1) * (config.inverted === false ? 1 : -1);
      const limit = nonNegativeFiniteOr(config.maxDistancePx);
      if (limit > 0) distance = Math.max(-limit, Math.min(limit, distance));
      next = Math.max(0, Math.min(maximum, this.#scroll(element, state.scrollAxis) + distance - state.panDistance));
      state.panDistance = distance;
    } else next = Math.max(0, Math.min(maximum, state.startScrollLeft - logicalOffset));
    if (next !== this.#scroll(element, state.scrollAxis)) this.#setScroll(element, next, state.scrollAxis);
    state.suppressClickUntil = Date.now() + 250;
    event.preventDefault?.();
  }

  #onPointerEnd(element, state, event) {
    if (!state.active || !this.#matchesPointer(state, event)) return;
    if (this.#manualTouch && event?.type === "pointerup" && event.clientX !== undefined) {
      this.#onPointerMove(element, state, event);
    }
    if (this.#manualTouch && event?.type === "pointercancel") state.suppressClickUntil = Date.now() + 250;
    const pointerId = state.pointerId;
    state.active = false;
    state.dragging = false;
    state.pointerId = null;
    element.classList?.remove(this.#dragClassName);
    if (
      pointerId !== null &&
      element.hasPointerCapture?.(pointerId)
    ) {
      element.releasePointerCapture(pointerId);
    }
  }

  #onClick(state, event) {
    if (event?.detail === 0) return;
    if (Date.now() > state.suppressClickUntil) return;
    state.suppressClickUntil = 0;
    event.preventDefault?.();
    event.stopImmediatePropagation?.();
  }

  #matchesPointer(state, event) {
    return state.pointerId === null || event?.pointerId === state.pointerId;
  }

  #refreshAxis(element, state) {
    if (this.#resolveAxis) state.scrollAxis = this.#resolveAxis(element) === "y" ? "y" : "x";
  }

  #scroll(element, axis) {
    return Number(axis === "y" ? element.scrollTop : element.scrollLeft) || 0;
  }

  #setScroll(element, value, axis) {
    if (axis === "y") element.scrollTop = value;
    else element.scrollLeft = value;
  }

  #maximumScroll(element, axis) {
    return axis === "y"
      ? Math.max(0, (Number(element.scrollHeight) || 0) - (Number(element.clientHeight) || 0))
      : Math.max(0, (Number(element.scrollWidth) || 0) - (Number(element.clientWidth) || 0));
  }
}
