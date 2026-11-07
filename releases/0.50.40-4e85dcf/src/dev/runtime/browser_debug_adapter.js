// DEV debug events: an in-page bus plus document CustomEvents for the overlay, sent only while debug is enabled.
// Production composes InactiveDebugEvents (game/application/session) instead.
// TK-252: the live update also goes out while its reader asks for it (the open DevTools panel), debug switches off.
const LIVE_UPDATE_EVENT = "debug-live-update";

/** @implements {IDebugEvents} */
export class BrowserDebugAdapter {
  #bus;
  #target;
  #isEnabled;
  #isLiveDataRequested;

  constructor(target, isEnabled, bus, isLiveDataRequested = null) {
    this.#target = target;
    this.#isEnabled = isEnabled;
    this.#bus = bus;
    this.#isLiveDataRequested = isLiveDataRequested;
  }

  on(type, handler) {
    return this.#bus.on(type, handler);
  }

  emit(type, detail) {
    if (!this.#isEnabled() && !(type === LIVE_UPDATE_EVENT && this.#isLiveDataRequested?.() === true)) return;
    this.#bus.emit(type, detail);
    this.#target?.dispatchEvent?.(new CustomEvent(type, { detail }));
  }

  clear() {
    this.#bus.clear();
  }
}
