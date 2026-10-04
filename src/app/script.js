(async function startCyberFishing() {
  const { BrowserGameLifecycle } = await import("../platform/browser/runtime/browser_game_lifecycle.js");
  const browserLifecycle = new BrowserGameLifecycle(window);
  browserLifecycle.cleanupPreviousGame();

  const compositionRoot = new GameCompositionRoot(CONFIG, {
    loadRandomInventoryId: () => import("../platform/browser/inventory/random_inventory_id.js"),
    loadBrowserEventTargetAdapter: () => import("../platform/browser/runtime/legacy_runtime_adapters.js"),
    loadBrowserTimeoutScheduler: () => import("../platform/browser/time/browser_timeout_scheduler.js"),
    loadInventoryAssemblyProfileConfig: () => import("../game/config/inventory/inventory_composition_config.js"),
    documentTarget: CanvasMetricsProvider.getDocumentTarget(),
    windowTarget: window,
    createDevFlags: (config) => new DevFlagsProvider({
      config,
      godModeSource: () => (typeof GodMode !== "undefined" ? GodMode : null),
      debugModulesSource: () => typeof window !== "undefined" ? window.DEBUG_MODULES : null,
    }),
    createLocationDebugMapBuilder: (options) => new LocationDebugMapBuilder(options),
    createItemProgressionDebugSnapshotProvider: (options) => new ItemProgressionDebugSnapshotProvider(options),
    createFixedCatchFishFactory: (options) => new FixedCatchFishFactory(options),
    createHookedFishProfileSynchronizer: (options) => new HookedFishProfileSynchronizer(options),
    createDebugService: (config) => new DebugService(config),
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
  browserLifecycle.publishGame(game);
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
  browserLifecycle.publishWatchdog(watchdog);

  let disposed = false;
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    browserLifecycle.removePagehideListener(cleanup);
    watchdog?.dispose();
    game.dispose();
    browserLifecycle.clearPublishedHandles(game, watchdog);
  };

  browserLifecycle.installPagehideCleanup(cleanup);

  if (!started) {
    console.error(
      new Error("[Bootstrap] CyberFishing game loop did not start."),
    );
  }

  compositionRoot.printStorageUsage();
})();
