// Logical pixels a finger travels right from the edge before the panel opens.
const SWIPE_PX = 24;

// A thin strip along the left screen edge that opens the DevTools panel while the zone editor hides its button
// (TK-053): a mouse pointer entering it with no button held, a mouse press on it, or a finger swiping right from it.
// dev-tools.css shows the strip only under body.game-shell--zone-editor; it sits under the panel in DOM order.
export class DevToolsEdgeOpener {
  #element;
  #open;
  #swipe = null;
  #listeners;

  // open(): opens the panel (no-op when it is open already).
  constructor({ documentRef, mountNode, open }) {
    if (typeof open !== "function") throw new TypeError("DevToolsEdgeOpener requires open");
    this.#open = open;
    const element = documentRef.createElement("div");
    element.className = "devtools__edge";
    element.setAttribute?.("aria-hidden", "true");
    this.#listeners = [
      ["pointerenter", event => { if (event.pointerType === "mouse" && !event.buttons) this.#open(); }],
      ["pointerdown", event => this.#down(event)],
      ["pointermove", event => this.#move(event)],
      ["pointerup", () => { this.#swipe = null; }],
      ["pointercancel", () => { this.#swipe = null; }],
    ];
    for (const [type, listener] of this.#listeners) element.addEventListener(type, listener);
    mountNode.appendChild(element);
    this.#element = element;
  }

  dispose() {
    const element = this.#element;
    if (!element) return;
    for (const [type, listener] of this.#listeners) element.removeEventListener?.(type, listener);
    element.remove?.();
    this.#element = null;
    this.#swipe = null;
  }

  #down(event) {
    event.preventDefault?.();
    if (event.pointerType === "mouse") { this.#open(); return; }
    this.#element.setPointerCapture?.(event.pointerId);
    this.#swipe = { pointerId: event.pointerId, x: event.clientX };
  }

  #move(event) {
    const swipe = this.#swipe;
    if (!swipe || event.pointerId !== swipe.pointerId || event.clientX - swipe.x < SWIPE_PX) return;
    this.#swipe = null;
    this.#element.releasePointerCapture?.(event.pointerId);
    this.#open();
  }
}
