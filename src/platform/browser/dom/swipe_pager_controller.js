// Horizontal swipe between the pages of a pager (spec 075). While a pointer drags it writes only the transient
// position, in pages, to its position property on the viewport; on release it settles on a page and reports it.
// Vertical gestures stay with the browser (the viewport uses touch-action: pan-y). A finished drag suppresses the
// click that would otherwise activate the card under the pointer. isEnabled lets CSS decide where swipes work, and a
// swipe past the first or last page goes to onEdge, so pagers can chain (spec 087).
export class SwipePagerController {
  #thresholdPx;
  #commitShare;
  #clickSuppressionMs;
  #nowMs;
  #isEnabled;
  #positionProperty;
  #draggingClassName;
  #bindings = new WeakMap();

  constructor({ thresholdPx = 8, commitShare = 0.2, clickSuppressionMs = 400, nowMs = Date.now, isEnabled = () => true,
    positionProperty = "--inventory-pager-position", draggingClassName = "inventory-pager__viewport--dragging" } = {}) {
    this.#thresholdPx = thresholdPx;
    this.#commitShare = commitShare;
    this.#clickSuppressionMs = clickSuppressionMs;
    this.#nowMs = nowMs;
    this.#isEnabled = isEnabled;
    this.#positionProperty = positionProperty;
    this.#draggingClassName = draggingClassName;
  }

  // ignoreSelector: gestures that start inside a matching element belong to a nested pager or scroller.
  attach(viewport, { pageCount, getIndex, onSelect, onEdge = null, ignoreSelector = "", getGestureSurface = null }) {
    this.detach(viewport);
    const options = { pageCount, getIndex, onSelect, onEdge, ignoreSelector, getGestureSurface };
    const state = { pointerId: null, startX: 0, startY: 0, width: 0, surface: null, dragging: false, suppressClickUntil: -Infinity };
    const handlers = {
      pointerdown: (event) => this.#down(viewport, state, options, event),
      pointermove: (event) => this.#move(viewport, state, options, event),
      pointerup: (event) => this.#end(viewport, state, options, event),
      pointercancel: (event) => this.#end(viewport, state, options, event),
      dragstart: (event) => event.preventDefault(),
      // A card losing its capture to the viewport bubbles here too; only the viewport's own loss ends the drag.
      lostpointercapture: (event) => { if (event.target === viewport) this.#end(viewport, state, options, event); },
    };
    const click = (event) => this.#click(state, event);
    for (const [type, handler] of Object.entries(handlers)) viewport.addEventListener(type, handler);
    viewport.addEventListener("click", click, true);
    this.#bindings.set(viewport, { handlers, click, state });
  }

  detach(viewport) {
    const binding = this.#bindings.get(viewport);
    if (!binding) return;
    for (const [type, handler] of Object.entries(binding.handlers)) viewport.removeEventListener(type, handler);
    viewport.removeEventListener("click", binding.click, true);
    this.#reset(viewport, binding.state);
    this.#bindings.delete(viewport);
  }

  #down(viewport, state, options, event) {
    if (state.pointerId !== null || (event.pointerType === "mouse" && event.button !== 0)) return;
    if (options.ignoreSelector && event.target.closest(options.ignoreSelector)) return;
    if (!this.#isEnabled(viewport)) return;
    state.pointerId = event.pointerId;
    state.startX = event.clientX;
    state.startY = event.clientY;
    state.surface = options.getGestureSurface?.(event.target) || viewport;
    state.width = state.surface.getBoundingClientRect().width;
    state.dragging = false;
  }

  #move(viewport, state, options, event) {
    if (event.pointerId !== state.pointerId) return;
    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;
    if (!state.dragging) {
      if (Math.abs(dy) > this.#thresholdPx && Math.abs(dy) >= Math.abs(dx)) {
        state.pointerId = null;
        return;
      }
      if (Math.abs(dx) <= this.#thresholdPx || !(state.width > 0)) return;
      state.dragging = true;
      viewport.setPointerCapture(event.pointerId);
      viewport.classList.add(this.#draggingClassName);
    }
    if (!this.#positionProperty) return;
    const position = Math.min(options.pageCount - 1, Math.max(0, options.getIndex() - dx / state.width));
    viewport.style.setProperty(this.#positionProperty, String(position));
  }

  #end(viewport, state, options, event) {
    if (event.pointerId !== state.pointerId) return;
    const dragging = state.dragging;
    const surface = state.surface || viewport;
    this.#reset(viewport, state);
    if (!dragging) return;
    state.suppressClickUntil = this.#nowMs() + this.#clickSuppressionMs;
    const dx = event.clientX - state.startX;
    const sameWidth = surface.getBoundingClientRect().width === state.width;
    const step = event.type === "pointerup" && sameWidth && Math.abs(dx) >= state.width * this.#commitShare ? Math.sign(-dx) : 0;
    if (!step) return;
    const next = options.getIndex() + step;
    if (next >= 0 && next < options.pageCount) options.onSelect(next);
    else options.onEdge?.(step);
  }

  #reset(viewport, state) {
    const pointerId = state.pointerId;
    state.pointerId = null;
    state.dragging = false;
    state.surface = null;
    viewport.classList.remove(this.#draggingClassName);
    if (this.#positionProperty) viewport.style.removeProperty(this.#positionProperty);
    if (pointerId !== null && viewport.hasPointerCapture?.(pointerId)) viewport.releasePointerCapture(pointerId);
  }

  #click(state, event) {
    if (this.#nowMs() > state.suppressClickUntil) return;
    state.suppressClickUntil = -Infinity;
    event.preventDefault();
    event.stopPropagation();
  }
}
