import { EventBus } from "../../engine/events/event_bus.js";

// DEV debug events: an in-page bus plus document CustomEvents for the overlay, sent only while debug is enabled.
// Production composes InactiveDebugEvents (game/application/session) instead.
/** @implements {IDebugEvents} */
export class BrowserDebugAdapter {
  #bus = new EventBus();
  #target;
  #isEnabled;

  constructor(target, isEnabled) {
    this.#target = target;
    this.#isEnabled = isEnabled;
  }

  on(type, handler) {
    return this.#bus.on(type, handler);
  }

  emit(type, detail) {
    if (!this.#isEnabled()) return;
    this.#bus.emit(type, detail);
    this.#target?.dispatchEvent?.(new CustomEvent(type, { detail }));
  }

  clear() {
    this.#bus.clear();
  }
}
