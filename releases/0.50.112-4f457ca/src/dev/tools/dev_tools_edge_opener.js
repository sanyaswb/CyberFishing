// Logical pixels a finger travels right from the edge before the panel opens.
const SWIPE_PX = 24;
// How long the mouse rests at the edge before the panel opens: long enough to ignore a pointer sweeping past the edge
// (reaching for a zone at the map's left edge), short enough to feel immediate (the common "edge reveal" pattern).
const DWELL_MS = 150;

// A strip along the left screen edge that opens the DevTools panel while the zone editor hides its button (TK-053):
// - the mouse reaching the edge and resting there DWELL_MS (moving inside the strip with no button held), or a mouse
//   press on it, or a finger swiping right from it (TK-274.1: the owner's «доторкання курсором» is the cursor reaching
//   the edge, not a click);
// - never while a zone editor gesture is going on (isBlocked(): a zone dragged, zones drawn, a mask painted) or with a
//   button held; merely hovering zones is not a gesture. A pointer captured by the editor sends the strip no events.
// dev-tools.css shows the strip only under body.game-shell--zone-editor; it sits under the panel in DOM order.
export class DevToolsEdgeOpener {
  #element;
  #open;
  #isBlocked;
  #timers;
  #swipe = null;
  #dwell = null;
  #listeners;

  // open(): opens the panel (no-op when it is open already); isBlocked(): a zone editor gesture is going on; timers:
  // { set(callback, ms) → id, clear(id) } (the browser's timers by default).
  constructor({ documentRef, mountNode, open, isBlocked = () => false,
    timers = { set: (callback, ms) => setTimeout(callback, ms), clear: (id) => clearTimeout(id) } }) {
    if (typeof open !== "function") throw new TypeError("DevToolsEdgeOpener requires open");
    this.#open = open;
    this.#isBlocked = isBlocked;
    this.#timers = timers;
    const element = documentRef.createElement("div");
    element.className = "devtools__edge";
    element.setAttribute?.("aria-hidden", "true");
    this.#listeners = [
      ["pointerdown", event => this.#down(event)],
      ["pointermove", event => this.#move(event)],
      ["pointerleave", () => this.#cancelDwell()],
      ["pointerup", () => { this.#swipe = null; }],
      ["pointercancel", () => { this.#swipe = null; this.#cancelDwell(); }],
    ];
    for (const [type, listener] of this.#listeners) element.addEventListener(type, listener);
    mountNode.appendChild(element);
    this.#element = element;
  }

  dispose() {
    const element = this.#element;
    if (!element) return;
    this.#cancelDwell();
    for (const [type, listener] of this.#listeners) element.removeEventListener?.(type, listener);
    element.remove?.();
    this.#element = null;
    this.#swipe = null;
  }

  #down(event) {
    event.preventDefault?.();
    this.#cancelDwell();
    if (this.#isBlocked()) return;
    if (event.pointerType === "mouse") { this.#open(); return; }
    this.#element.setPointerCapture?.(event.pointerId);
    this.#swipe = { pointerId: event.pointerId, x: event.clientX };
  }

  #move(event) {
    if (event.pointerType === "mouse") { this.#rest(event); return; }
    const swipe = this.#swipe;
    if (!swipe || event.pointerId !== swipe.pointerId || event.clientX - swipe.x < SWIPE_PX) return;
    this.#swipe = null;
    this.#element.releasePointerCapture?.(event.pointerId);
    if (!this.#isBlocked()) this.#open();
  }

  // The mouse moving at the edge with no button held starts the dwell; a held button or a gesture stops it.
  #rest(event) {
    if (event.buttons || this.#isBlocked()) { this.#cancelDwell(); return; }
    if (this.#dwell !== null) return;
    this.#dwell = this.#timers.set(() => {
      this.#dwell = null;
      if (this.#element && !this.#isBlocked()) this.#open();
    }, DWELL_MS);
  }

  #cancelDwell() {
    if (this.#dwell === null) return;
    this.#timers.clear(this.#dwell);
    this.#dwell = null;
  }
}
