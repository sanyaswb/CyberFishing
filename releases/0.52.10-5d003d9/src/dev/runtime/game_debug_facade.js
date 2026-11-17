// DEV session diagnostics: debug switch and events, plus the DEV tools' hooked-fish updates.
// Production composes InactiveGameDiagnostics (game/application/session) instead.
/** @implements {IGameDiagnostics} */
export class GameDebugFacade {
  #devFlags;
  #debugEvents;
  #listeners;
  #documentTarget;

  constructor({ devFlags, debugEvents, listeners, documentTarget }) {
    this.#devFlags = devFlags;
    this.#debugEvents = debugEvents;
    this.#listeners = listeners;
    this.#documentTarget = documentTarget;
  }

  isDebugEnabled() {
    return this.#devFlags.isDebugEnabled();
  }

  emit(type, detail) {
    this.#debugEvents.emit(type, detail);
  }

  on(type, handler) {
    return this.#debugEvents.on(type, handler);
  }

  subscribeHookedFishRuntimeUpdated(handler) {
    return this.#listeners.add(
      this.#documentTarget,
      "debug-hooked-fish-updated",
      handler,
    );
  }

  dispose() {
    this.#listeners.dispose();
    this.#debugEvents.clear();
  }
}
