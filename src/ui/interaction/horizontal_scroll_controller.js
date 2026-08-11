class HorizontalScrollController {
  #dragThresholdPx;
  #bindings = new WeakMap();

  constructor({ dragThresholdPx = 6 } = {}) {
    this.#dragThresholdPx = Math.max(0, Number(dragThresholdPx) || 0);
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
      startScrollLeft: 0,
      suppressClickUntil: 0,
    };
    const handlers = {
      wheel: (event) => this.#onWheel(element, event),
      pointerDown: (event) => this.#onPointerDown(element, state, event),
      pointerMove: (event) => this.#onPointerMove(element, state, event),
      pointerEnd: (event) => this.#onPointerEnd(element, state, event),
      click: (event) => this.#onClick(state, event),
    };
    element.classList?.add("inventory-v2-horizontal-scroll");
    element.addEventListener("wheel", handlers.wheel, { passive: false });
    element.addEventListener("pointerdown", handlers.pointerDown);
    element.addEventListener("pointermove", handlers.pointerMove);
    element.addEventListener("pointerup", handlers.pointerEnd);
    element.addEventListener("pointercancel", handlers.pointerEnd);
    element.addEventListener("lostpointercapture", handlers.pointerEnd);
    element.addEventListener("click", handlers.click, true);
    this.#bindings.set(element, handlers);
    return () => this.detach(element);
  }

  detach(element) {
    const handlers = this.#bindings.get(element);
    if (!handlers) return;
    element.removeEventListener("wheel", handlers.wheel);
    element.removeEventListener("pointerdown", handlers.pointerDown);
    element.removeEventListener("pointermove", handlers.pointerMove);
    element.removeEventListener("pointerup", handlers.pointerEnd);
    element.removeEventListener("pointercancel", handlers.pointerEnd);
    element.removeEventListener("lostpointercapture", handlers.pointerEnd);
    element.removeEventListener("click", handlers.click, true);
    element.classList?.remove(
      "inventory-v2-horizontal-scroll",
      "is-horizontal-dragging",
    );
    this.#bindings.delete(element);
  }

  #onWheel(element, event) {
    const vertical = Number(event?.deltaY) || 0;
    const horizontal = Number(event?.deltaX) || 0;
    const delta = Math.abs(vertical) >= Math.abs(horizontal)
      ? vertical
      : horizontal;
    if (!delta) return;
    const previous = Number(element.scrollLeft) || 0;
    const maximum = this.#maximumScrollLeft(element);
    const next = Math.max(0, Math.min(maximum, previous + delta));
    if (next === previous) return;
    element.scrollLeft = next;
    event.preventDefault?.();
  }

  #onPointerDown(element, state, event) {
    if (event?.isPrimary === false || Number(event?.button) > 0) return;
    if (this.#maximumScrollLeft(element) <= 0) return;
    state.active = true;
    state.dragging = false;
    state.pointerId = event?.pointerId ?? null;
    state.startX = Number(event?.clientX) || 0;
    state.startScrollLeft = Number(element.scrollLeft) || 0;
    state.suppressClickUntil = 0;
  }

  #onPointerMove(element, state, event) {
    if (!state.active || !this.#matchesPointer(state, event)) return;
    const offset = (Number(event?.clientX) || 0) - state.startX;
    if (!state.dragging && Math.abs(offset) < this.#dragThresholdPx) return;

    if (!state.dragging) {
      state.dragging = true;
      element.classList?.add("is-horizontal-dragging");
      if (
        state.pointerId !== null &&
        typeof element.setPointerCapture === "function"
      ) {
        element.setPointerCapture(state.pointerId);
      }
    }

    const maximum = this.#maximumScrollLeft(element);
    element.scrollLeft = Math.max(
      0,
      Math.min(maximum, state.startScrollLeft - offset),
    );
    state.suppressClickUntil = Date.now() + 250;
    event.preventDefault?.();
  }

  #onPointerEnd(element, state, event) {
    if (!state.active || !this.#matchesPointer(state, event)) return;
    const pointerId = state.pointerId;
    state.active = false;
    state.dragging = false;
    state.pointerId = null;
    element.classList?.remove("is-horizontal-dragging");
    if (
      pointerId !== null &&
      element.hasPointerCapture?.(pointerId)
    ) {
      element.releasePointerCapture(pointerId);
    }
  }

  #onClick(state, event) {
    if (Date.now() > state.suppressClickUntil) return;
    state.suppressClickUntil = 0;
    event.preventDefault?.();
    event.stopImmediatePropagation?.();
  }

  #matchesPointer(state, event) {
    return state.pointerId === null || event?.pointerId === state.pointerId;
  }

  #maximumScrollLeft(element) {
    return Math.max(
      0,
      (Number(element.scrollWidth) || 0) - (Number(element.clientWidth) || 0),
    );
  }
}

globalThis.HorizontalScrollController = HorizontalScrollController;
