export class BrowserGameLifecycle {
  #target;

  constructor(windowTarget) {
    this.#target = windowTarget;
  }

  cleanupPreviousGame() {
    this.#target.CYBER_FISHING_GAME_CLEANUP?.();
  }

  publishGame(game) {
    this.#target.game = game;
  }

  publishWatchdog(watchdog) {
    this.#target.CYBER_FISHING_MEMORY_WATCHDOG = watchdog;
    this.#target.getCyberFishingMemoryReport = () => watchdog?.getReport() || null;
  }

  removePagehideListener(cleanup) {
    this.#target.removeEventListener("pagehide", cleanup);
  }

  clearPublishedHandles(game, watchdog, cleanup = null) {
    if (this.#target.game === game) this.#target.game = null;
    if (this.#target.CYBER_FISHING_MEMORY_WATCHDOG === watchdog) {
      this.#target.CYBER_FISHING_MEMORY_WATCHDOG = null;
      this.#target.getCyberFishingMemoryReport = null;
    }
    if (cleanup && this.#target.CYBER_FISHING_GAME_CLEANUP === cleanup)
      this.#target.CYBER_FISHING_GAME_CLEANUP = null;
  }

  installPagehideCleanup(cleanup) {
    this.#target.CYBER_FISHING_GAME_CLEANUP = cleanup;
    this.#target.addEventListener("pagehide", cleanup, { once: true });
  }
}
