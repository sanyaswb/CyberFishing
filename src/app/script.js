(async function startCyberFishing() {
  window.CYBER_FISHING_GAME_CLEANUP?.();

  const compositionRoot = new GameCompositionRoot(null, {
    documentTarget: CanvasMetricsProvider.getDocumentTarget(),
    windowTarget: window,
    createDevFlags: (config) => new DevFlagsProvider({
      config,
      godModeSource: () => (typeof GodMode !== "undefined" ? GodMode : null),
      debugModulesSource: () => typeof window !== "undefined" ? window.DEBUG_MODULES : null,
    }),
    createWorldDebugRenderer: (options) => new WorldDebugRenderer(options),
    createDevTools: (config, synchronizer, options) => new DevTools(config, synchronizer, {
      configRuntime: CONFIG_RUNTIME_CONTEXT,
      ...options,
    }),
    createLocationDebugRenderFrameBuilder: (options) => new LocationDebugRenderFrameBuilder(options),
    getRenderDiagnostics: () => typeof RenderAllocationDiagnostics !== "undefined" ? RenderAllocationDiagnostics : null,
    isCatchResolutionLogEnabled: () => CanvasMetricsProvider.hasDocumentTarget() &&
      window.DEBUG_MODULES?.catchResolution === true,
  });
  const game = new Game("gameCanvas", compositionRoot);
  window.game = game;
  const started = await game.start();

  const memoryConfig = compositionRoot.getMemoryWatchdogConfig();
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

  compositionRoot.printStorageUsage();
})();
