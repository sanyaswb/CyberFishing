import { EventBus } from "../../../engine/events/event_bus.js";

/**
 * @typedef {Object} IDebugEvents
 * @property {(type: string, handler: Function) => Function} on
 * @property {(type: string, payload: object) => void} emit
 * @property {() => void} clear
 */
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
