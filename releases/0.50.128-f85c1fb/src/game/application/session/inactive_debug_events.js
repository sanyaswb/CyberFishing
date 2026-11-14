/**
 * Debug event port used by gameplay systems.
 * @typedef {Object} IDebugEvents
 * @property {(type: string, handler: Function) => Function} on
 * @property {(type: string, payload: object) => void} emit
 * @property {() => void} clear
 */

const unsubscribe = () => false;

// Production implementation: debug events go nowhere. Development startup composes BrowserDebugAdapter instead.
/** @implements {IDebugEvents} */
export class InactiveDebugEvents {
  on() {
    return unsubscribe;
  }

  emit() {}

  clear() {}
}
