/**
 * Session diagnostics port.
 * @typedef {Object} IGameDiagnostics
 * @property {() => boolean} isDebugEnabled
 * @property {(type: string, detail: object) => void} emit
 * @property {(type: string, handler: Function) => Function} on
 * @property {(handler: Function) => Function} subscribeHookedFishRuntimeUpdated
 * @property {() => void} dispose
 */

const unsubscribe = () => false;
const removeListener = () => {};

// Production implementation: debug is off and DEV hooks never fire. Development startup composes GameDebugFacade.
/** @implements {IGameDiagnostics} */
export class InactiveGameDiagnostics {
  isDebugEnabled() {
    return false;
  }

  emit() {}

  on() {
    return unsubscribe;
  }

  subscribeHookedFishRuntimeUpdated() {
    return removeListener;
  }

  dispose() {}
}
