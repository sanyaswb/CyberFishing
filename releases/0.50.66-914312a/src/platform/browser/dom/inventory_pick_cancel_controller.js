// Delegated cancellation of the active pick; does not change filled-item long-press actions.
export class InventoryPickCancelController {
  #timers;
  #holdMs;
  #tolerance;
  #reset = null;
  #dispose = null;
  constructor({ timers, holdMs, moveTolerancePx }) {
    this.#timers = timers; this.#holdMs = holdMs; this.#tolerance = moveTolerancePx;
  }
  attach(root, { onCancel, windowRef }) {
    this.dispose();
    let press = null, timer = null, suppressClick = false;
    const activeTarget = target => {
      for (let node = target; node && node !== root; node = node.parentNode) {
        if (node.classList?.contains("inventory-slot--highlighted") ||
            node.classList?.contains("inventory-editor-tabs__tab--highlighted") ||
            node.classList?.contains("inventory-toggle__item--highlighted")) return true;
      }
      return false;
    };
    const reset = () => {
      if (timer !== null) this.#timers.clearTimeout(timer);
      timer = null; press = null;
    };
    this.#reset = reset;
    const stop = event => { event.preventDefault(); event.stopImmediatePropagation?.(); event.stopPropagation(); };
    const handlers = {
      pointerdown: event => {
        if (event.isPrimary === false || press) return;
        suppressClick = false;
        if (!activeTarget(event.target)) return;
        if (event.button === 2) { reset(); stop(event); onCancel(); return; }
        if (event.button !== undefined && event.button !== 0) return;
        press = { id: event.pointerId, x: event.clientX, y: event.clientY, target: event.target };
        timer = this.#timers.setTimeout(() => {
          const target = press?.target;
          reset();
          if (!target || !root.contains(target) || !activeTarget(target)) return;
          suppressClick = true; onCancel();
        }, this.#holdMs);
      },
      pointermove: event => {
        if (press?.id === event.pointerId && Math.hypot(event.clientX - press.x, event.clientY - press.y) > this.#tolerance) reset();
      },
      pointerup: event => { if (press?.id === event.pointerId) reset(); },
      pointercancel: reset,
      lostpointercapture: reset,
      click: event => { if (suppressClick) { suppressClick = false; if (event.detail !== 0) stop(event); } },
      contextmenu: event => { if (activeTarget(event.target)) { reset(); stop(event); onCancel(); } },
    };
    for (const [type, handler] of Object.entries(handlers)) root.addEventListener(type, handler, true);
    for (const type of ["blur", "resize", "pagehide"]) windowRef?.addEventListener?.(type, reset);
    const documentRef = root.ownerDocument || root.document;
    documentRef?.addEventListener?.("visibilitychange", reset);
    this.#dispose = () => {
      reset();
      for (const [type, handler] of Object.entries(handlers)) root.removeEventListener(type, handler, true);
      for (const type of ["blur", "resize", "pagehide"]) windowRef?.removeEventListener?.(type, reset);
      documentRef?.removeEventListener?.("visibilitychange", reset);
    };
  }
  cancel() { this.#reset?.(); }
  dispose() { this.#dispose?.(); this.#dispose = null; this.#reset = null; }
}
