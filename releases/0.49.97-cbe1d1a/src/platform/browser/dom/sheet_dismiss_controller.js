export class SheetDismissController {
  #uiSurface;
  #dismissDistance;
  #bindings = new WeakMap();

  constructor({ uiSurface = null, dismissDistancePx = 24 } = {}) {
    this.#uiSurface = uiSurface;
    this.#dismissDistance = Math.max(1, Number(dismissDistancePx) || 24);
  }

  attach(handle, { onDismiss, onDrag = null, onDragStart = null, onExpand = null, onTap = onDismiss }) {
    this.detach(handle);
    const state = { pointerId: null, active: false, startX: 0, startY: 0, distance: 0, signedDistance: 0,
      vertical: false, moved: false, suppressUntil: 0 };
    const reset = (resetVisual = true) => {
      const pointerId = state.pointerId;
      state.active = false; state.pointerId = null; state.distance = 0;
      if (resetVisual) onDrag?.(0);
      if (pointerId !== null && handle.hasPointerCapture?.(pointerId)) handle.releasePointerCapture(pointerId);
    };
    const move = event => {
      if (!state.active || event.pointerId !== state.pointerId) return;
      const dx = event.clientX - state.startX, dy = event.clientY - state.startY;
      if (Math.hypot(dx, dy) > 6) state.moved = true;
      state.signedDistance = this.#uiSurface?.physicalToLogicalDelta({ y: dy }).y ?? dy;
      state.vertical = Math.abs(dy) > Math.abs(dx);
      const distance = Math.max(0, state.signedDistance);
      if (state.distance !== distance) { state.distance = distance; onDrag?.(distance); }
      event.preventDefault?.();
    };
    const end = event => {
      if (!state.active || event.pointerId !== state.pointerId) return;
      if (event.type === "pointerup" && event.clientY !== undefined) move(event);
      const dismiss = event.type === "pointerup" && state.moved && state.distance >= this.#dismissDistance;
      const expand = event.type === "pointerup" && state.moved && state.vertical && state.signedDistance <= -this.#dismissDistance;
      if (state.moved || event.type !== "pointerup") state.suppressUntil = Date.now() + 250;
      reset(false);
      if (dismiss) onDismiss();
      else if (expand) onExpand?.();
      onDrag?.(0);
    };
    const handlers = {
      pointerdown: event => {
        if (state.active || event.isPrimary === false || (event.button !== undefined && event.button !== 0)) return;
        state.active = true; state.pointerId = event.pointerId; state.startX = event.clientX; state.startY = event.clientY;
        state.moved = false; state.distance = 0; state.suppressUntil = 0;
        handle.setPointerCapture?.(state.pointerId);
        onDragStart?.();
      },
      pointermove: move, pointerup: end, pointercancel: end, lostpointercapture: end,
      click: event => {
        event.preventDefault?.(); event.stopPropagation?.();
        if (event.detail > 0 && Date.now() <= state.suppressUntil) return;
        onTap();
      },
    };
    for (const [type, handler] of Object.entries(handlers)) handle.addEventListener(type, handler);
    this.#bindings.set(handle, { handlers, reset });
    return () => this.detach(handle);
  }

  detach(handle) {
    const binding = this.#bindings.get(handle);
    if (!binding) return;
    for (const [type, handler] of Object.entries(binding.handlers)) handle.removeEventListener(type, handler);
    binding.reset();
    this.#bindings.delete(handle);
  }
}
