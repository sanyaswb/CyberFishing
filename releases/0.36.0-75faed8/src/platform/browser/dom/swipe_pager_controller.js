// Horizontal swipe between the pages of a pager (spec 075). While a pointer drags it writes only the transient
// position, in pages, to --inventory-pager-position on the viewport; on release it settles on a page and reports it.
// Vertical gestures stay with the browser (the viewport uses touch-action: pan-y). A finished drag suppresses the
// click that would otherwise activate the card under the pointer.
export class SwipePagerController {
  static #DRAGGING = "inventory-pager__viewport--dragging";
  #thresholdPx;
  #commitShare;
  #clickSuppressionMs;
  #nowMs;
  #bindings = new WeakMap();

  constructor({ thresholdPx = 8, commitShare = 0.2, clickSuppressionMs = 400, nowMs = Date.now } = {}) {
    this.#thresholdPx = thresholdPx;
    this.#commitShare = commitShare;
    this.#clickSuppressionMs = clickSuppressionMs;
    this.#nowMs = nowMs;
  }

  attach(viewport, { pageCount, getIndex, onSelect }) {
    this.detach(viewport);
    const options = { pageCount, getIndex, onSelect };
    const state = { pointerId: null, startX: 0, startY: 0, width: 0, dragging: false, suppressClickUntil: -Infinity };
    const handlers = {
      pointerdown: (event) => this.#down(viewport, state, event),
      pointermove: (event) => this.#move(viewport, state, options, event),
      pointerup: (event) => this.#end(viewport, state, options, event),
      pointercancel: (event) => this.#end(viewport, state, options, event),
      // A card losing its capture to the viewport bubbles here too; only the viewport's own loss ends the drag.
      lostpointercapture: (event) => { if (event.target === viewport) this.#end(viewport, state, options, event); },
    };
    const click = (event) => this.#click(state, event);
    for (const [type, handler] of Object.entries(handlers)) viewport.addEventListener(type, handler);
    viewport.addEventListener("click", click, true);
    this.#bindings.set(viewport, { handlers, click });
  }

  detach(viewport) {
    const binding = this.#bindings.get(viewport);
    if (!binding) return;
    for (const [type, handler] of Object.entries(binding.handlers)) viewport.removeEventListener(type, handler);
    viewport.removeEventListener("click", binding.click, true);
    this.#bindings.delete(viewport);
  }

  #down(viewport, state, event) {
    if (state.pointerId !== null || (event.pointerType === "mouse" && event.button !== 0)) return;
    state.pointerId = event.pointerId;
    state.startX = event.clientX;
    state.startY = event.clientY;
    state.width = viewport.getBoundingClientRect().width;
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
      viewport.classList.add(SwipePagerController.#DRAGGING);
    }
    const position = Math.min(options.pageCount - 1, Math.max(0, options.getIndex() - dx / state.width));
    viewport.style.setProperty("--inventory-pager-position", String(position));
  }

  #end(viewport, state, options, event) {
    if (event.pointerId !== state.pointerId) return;
    state.pointerId = null;
    if (!state.dragging) return;
    state.dragging = false;
    viewport.classList.remove(SwipePagerController.#DRAGGING);
    viewport.style.removeProperty("--inventory-pager-position");
    state.suppressClickUntil = this.#nowMs() + this.#clickSuppressionMs;
    const dx = event.clientX - state.startX;
    const index = options.getIndex();
    const step = event.type === "pointerup" && Math.abs(dx) >= state.width * this.#commitShare ? Math.sign(-dx) : 0;
    const next = Math.min(options.pageCount - 1, Math.max(0, index + step));
    if (next !== index) options.onSelect(next);
  }

  #click(state, event) {
    if (this.#nowMs() > state.suppressClickUntil) return;
    state.suppressClickUntil = -Infinity;
    event.preventDefault();
    event.stopPropagation();
  }
}
