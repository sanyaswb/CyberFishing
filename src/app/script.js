(async function startCyberFishing() {
  window.CYBER_FISHING_GAME_CLEANUP?.();

  const game = new Game("gameCanvas");
  window.game = game;
  const started = await game.start();

  const memoryConfig = CONFIG.debug?.memoryWatchdog || {};
  const watchdog =
    memoryConfig.enabled === true &&
    typeof MemoryLeakWatchdog !== "undefined"
      ? new MemoryLeakWatchdog({
          intervalMs: memoryConfig.intervalMs,
          maxSamples: memoryConfig.maxSamples,
          minTrendSamples: memoryConfig.minTrendSamples,
          thresholds: memoryConfig.thresholds,
          metricsProvider: () => {
            const loop = GameLoop.getDiagnostics();
            return {
              activeGameLoops: loop.activeCount,
              duplicateLoopStarts: loop.duplicateStartAttempts,
              managedListeners:
                EventLifecycle.getActiveListenerCount() +
                EventBus.getActiveListenerCount() +
                InputManager.getActiveListenerCount(),
            };
          },
        })
      : null;

  watchdog?.start();
  window.CYBER_FISHING_MEMORY_WATCHDOG = watchdog;
  window.getCyberFishingMemoryReport = () => watchdog?.getReport() || null;

  let disposed = false;
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    window.removeEventListener("pagehide", cleanup);
    watchdog?.dispose();
    game.dispose();
    if (window.game === game) window.game = null;
    if (window.CYBER_FISHING_MEMORY_WATCHDOG === watchdog) {
      window.CYBER_FISHING_MEMORY_WATCHDOG = null;
    }
  };

  window.CYBER_FISHING_GAME_CLEANUP = cleanup;
  window.addEventListener("pagehide", cleanup, { once: true });

  if (!started) {
    console.error(
      new Error("[Bootstrap] CyberFishing game loop did not start."),
    );
  }

  if (typeof CacheManager !== "undefined" && CacheManager.printStorageUsage) {
    CacheManager.printStorageUsage();
  }
})();
