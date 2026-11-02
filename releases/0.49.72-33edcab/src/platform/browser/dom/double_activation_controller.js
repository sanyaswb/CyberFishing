// Distinguishes single and double activation, including keyboard clicks, without running both actions.
export class DoubleActivationController {
  #timers;
  #now;
  #config;
  #bindings = new WeakMap();
  constructor({ timers, nowMs, config }) { this.#timers = timers; this.#now = nowMs; this.#config = config; }
  attach(node, { onSingle = null, onDouble }) {
    this.detach(node);
    const state = { timer: null, first: null, pointerId: null, x: 0, y: 0, rejected: false };
    const moved = event => Math.hypot(event.clientX - state.x, event.clientY - state.y) > this.#config.moveTolerancePx;
    const handlers = {
      pointerdown: event => {
        if (event.isPrimary === false || (event.button !== undefined && event.button !== 0)) return;
        state.pointerId = event.pointerId; state.x = event.clientX; state.y = event.clientY; state.rejected = false;
      },
      pointermove: event => {
        if (state.pointerId === event.pointerId && moved(event)) { state.rejected = true; this.cancel(node); }
      },
      pointerup: event => {
        if (event.pointerId !== state.pointerId) return;
        if (moved(event)) { state.rejected = true; this.cancel(node); }
        state.pointerId = null;
      },
      pointercancel: () => { state.rejected = true; state.pointerId = null; this.cancel(node); },
      click: event => {
        if (node.disabled || (state.rejected && event.detail !== 0)) return;
        const now = this.#now();
        if (state.first !== null && now - state.first <= this.#config.intervalMs) {
          this.cancel(node); onDouble(); return;
        }
        if (state.first !== null) { this.cancel(node); onSingle?.(); }
        state.first = now;
        state.timer = this.#timers.setTimeout(() => {
          state.first = null; state.timer = null; onSingle?.();
        }, this.#config.intervalMs + 1);
      },
      dblclick: event => event.preventDefault?.(),
    };
    for (const [type, handler] of Object.entries(handlers)) node.addEventListener(type, handler);
    this.#bindings.set(node, { state, handlers });
  }
  cancel(node) {
    const state = this.#bindings.get(node)?.state;
    if (!state) return;
    if (state.timer !== null) this.#timers.clearTimeout(state.timer);
    state.timer = null; state.first = null;
  }
  detach(node) {
    const binding = this.#bindings.get(node);
    if (!binding) return;
    this.cancel(node);
    for (const [type, handler] of Object.entries(binding.handlers)) node.removeEventListener(type, handler);
    this.#bindings.delete(node);
  }
}
