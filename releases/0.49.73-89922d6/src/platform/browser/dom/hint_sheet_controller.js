// Responsive transient-notice input, timers and sheet motion. The renderer owns markup and the visible message.
export class HintSheetController {
  #timers;
  #surface;
  #config;
  #motionPreference;
  #inlineDurationMs;
  #bindings = new WeakMap();

  constructor({ timers, uiSurface = null, config, motionPreference = null, inlineDurationMs = config.durationMs }) {
    this.#timers = timers;
    this.#surface = uiSurface;
    this.#config = config;
    this.#motionPreference = motionPreference;
    this.#inlineDurationMs = inlineDurationMs;
  }

  attach(node, { text, close, handle, onDismiss, onLayoutChange = null }) {
    this.dispose(node);
    const state = { node, text, handle, onDismiss, onLayoutChange, sheet: null, timer: null, pointerId: null, height: 0, x: 0, y: 0,
      distance: 0, moved: false, scrolling: false, scrollTop: 0, suppressed: false, revision: 0 };
    const stop = event => event.stopPropagation?.();
    const handlers = {
      pointerdown: event => {
        stop(event);
        if (!state.sheet) return;
        if (state.pointerId !== null || event.isPrimary === false || (event.button !== undefined && event.button !== 0)) return;
        this.#clear(state);
        state.pointerId = event.pointerId;
        state.x = event.clientX; state.y = event.clientY;
        state.height = node.getBoundingClientRect().height;
        state.distance = 0; state.moved = false; state.scrolling = false;
        state.scrollTop = text.scrollTop || 0;
        state.fromText = event.target === text || text.contains?.(event.target);
        state.fromControl = close?.contains(event.target) || handle?.contains(event.target);
        node.setPointerCapture?.(event.pointerId);
      },
      pointermove: event => {
        stop(event);
        if (event.pointerId !== state.pointerId) return;
        const dx = event.clientX - state.x, dy = event.clientY - state.y;
        if (!state.moved) {
          if (Math.abs(dy) <= this.#config.dragThresholdPx || Math.abs(dy) <= Math.abs(dx)) return;
          state.moved = true;
          state.scrolling = state.fromText && (state.scrollTop > 0 || dy < 0);
          node.setPointerCapture?.(event.pointerId);
          node.classList.add("ui-hint--dragging");
        }
        const logical = this.#surface?.physicalToLogicalDelta({ y: dy }).y ?? dy;
        if (state.scrolling) text.scrollTop = Math.max(0, state.scrollTop - logical);
        else {
          state.distance = Math.max(0, dy);
          node.style.setProperty("--ui-hint-drag-y", `${Math.max(0, logical)}px`);
        }
        event.preventDefault?.();
      },
      pointerup: event => {
        stop(event);
        if (event.pointerId !== state.pointerId) return;
        handlers.pointermove(event);
        const dismiss = state.moved && !state.scrolling && state.height > 0 &&
          state.distance >= state.height * this.#config.dismissShare;
        const controlTap = state.fromControl && !state.moved &&
          Math.hypot(event.clientX - state.x, event.clientY - state.y) <= this.#config.dragThresholdPx;
        state.suppressed = state.moved || controlTap;
        this.#release(state);
        if (dismiss) this.#dismiss(state);
        else if (controlTap) state.onDismiss();
        else this.#arm(state);
      },
      pointercancel: event => {
        stop(event);
        if (event.pointerId !== state.pointerId) return;
        state.suppressed = true;
        this.#release(state); this.#arm(state);
      },
      lostpointercapture: event => {
        if (event.target === node && event.pointerId === state.pointerId) handlers.pointercancel(event);
      },
      click: stop,
      mousedown: stop, mouseup: stop,
      keydown: event => { if (event.key === "Escape") { stop(event); event.preventDefault?.(); onDismiss(); } },
      wheel: stop, dblclick: stop, touchstart: stop, touchmove: stop, touchend: stop,
    };
    state.clickGuard = event => {
        if (state.suppressed && event.detail !== 0) {
          state.suppressed = false; event.preventDefault?.(); event.stopImmediatePropagation?.();
        }
    };
    for (const [type, handler] of Object.entries(handlers)) node.addEventListener(type, handler);
    node.addEventListener("click", state.clickGuard, true);
    state.handlers = handlers;
    this.#bindings.set(node, state);
    this.#syncLayout(state);
    state.unsubscribe = this.#surface?.subscribe?.(() => this.#syncLayout(state));
  }

  show(node) {
    const state = this.#bindings.get(node);
    if (!state) return;
    this.#syncLayout(state);
    this.#clear(state); this.#release(state);
    state.suppressed = false;
    node.classList.remove("ui-hint--closing");
    this.#arm(state);
  }

  hide(node) {
    const state = this.#bindings.get(node);
    if (!state) return;
    this.#clear(state); this.#release(state);
    node.classList.remove("ui-hint--closing");
  }

  dispose(node) {
    const state = this.#bindings.get(node);
    if (!state) return;
    state.unsubscribe?.();
    this.hide(node);
    for (const [type, handler] of Object.entries(state.handlers)) node.removeEventListener(type, handler);
    node.removeEventListener("click", state.clickGuard, true);
    this.#bindings.delete(node);
  }

  #syncLayout(state) {
    const width = this.#surface?.getMetrics?.()?.logicalWidth;
    const sheet = width > 0 && width <= this.#config.sheetMaxWidth;
    if (state.sheet === sheet) return;
    this.#clear(state); this.#release(state);
    state.suppressed = false;
    state.node.classList.remove("ui-hint--closing");
    state.sheet = sheet;
    state.node.classList.toggle("ui-hint--sheet", sheet);
    state.handle.hidden = !sheet;
    state.onLayoutChange?.(sheet);
    if (!state.node.hidden) this.#arm(state);
  }

  #clear(state) {
    state.revision++;
    if (state.timer !== null) this.#timers.clearTimeout(state.timer);
    state.timer = null;
  }

  #arm(state) {
    this.#clear(state);
    const revision = state.revision;
    state.timer = this.#timers.setTimeout(() => {
      if (state.revision !== revision) return;
      state.timer = null; this.#dismiss(state);
    }, state.sheet ? this.#config.durationMs : this.#inlineDurationMs);
  }

  #dismiss(state) {
    this.#clear(state);
    if (!state.sheet || this.#motionPreference?.matches) { state.onDismiss(); return; }
    state.node.classList.add("ui-hint--closing");
    const revision = state.revision;
    state.timer = this.#timers.setTimeout(() => {
      if (state.revision !== revision) return;
      state.timer = null; state.onDismiss();
    }, this.#config.closeDurationMs);
  }

  #release(state) {
    const pointerId = state.pointerId;
    state.pointerId = null;
    state.node.classList.remove("ui-hint--dragging");
    state.node.style.removeProperty("--ui-hint-drag-y");
    if (pointerId !== null && state.node.hasPointerCapture?.(pointerId)) state.node.releasePointerCapture(pointerId);
  }
}
