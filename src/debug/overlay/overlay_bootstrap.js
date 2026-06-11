(function bootstrapDebugOverlay() {
  if (typeof document === "undefined") return;
  if (window.CYBER_FISHING_DEBUG_OVERLAY) return;

  const settingsStore = window.OverlaySettingsStore;
  const htmlBuilder = new OverlayHtmlBuilder();
  const moduleOptions = { settingsStore, htmlBuilder };
  const registry = new OverlayModuleRegistry();
  registry.registerMany([
    new EchoModule(moduleOptions),
    new ChancesDetailModule(moduleOptions),
    new BehaviorModule(moduleOptions),
    new FishPowerModule(moduleOptions),
    new FishStatesModule(moduleOptions),
    new DebuffsModule(moduleOptions),
    new FightPhysicsOverlayModule(moduleOptions),
    new PlayerMaxModule(moduleOptions),
    new LiveForcesModule(moduleOptions),
    new ChumOverlayModule(moduleOptions),
    new WorstCaseModule({
      ...moduleOptions,
      selector: new WorstCaseForceDebugSelector({ configSource: () => CONFIG }),
    }),
  ]);

  const controller = new OverlayController({
    registry,
    domAdapter: new OverlayDomAdapter(),
    documentTarget: document,
    configSource: () => CONFIG,
  });
  controller.start();

  const metricInfoBridge = new OverlayMetricInfoBridge();
  metricInfoBridge.start();

  window.CYBER_FISHING_DEBUG_OVERLAY = controller;
  window.CYBER_FISHING_OVERLAY_METRIC_INFO = metricInfoBridge;

  window.addEventListener(
    "pagehide",
    () => {
      metricInfoBridge.dispose();
      controller.dispose();
      window.CYBER_FISHING_OVERLAY_METRIC_INFO = null;
      window.CYBER_FISHING_DEBUG_OVERLAY = null;
    },
    { once: true },
  );
})();
