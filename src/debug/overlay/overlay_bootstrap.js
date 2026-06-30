(function bootstrapDebugOverlay() {
  if (typeof document === "undefined") return;
  if (window.CYBER_FISHING_DEBUG_OVERLAY) return;

  const settingsStore = window.OverlaySettingsStore;
  const htmlBuilder = new OverlayHtmlBuilder();
  const viewStateStore = new OverlayViewStateStore({
    fishStatesDirectionMode: "away",
    fishStateForceDetails: {
      active: false,
      force: false,
      speed: false,
      weight: false,
    },
  });
  const moduleOptions = {
    settingsStore,
    htmlBuilder,
    viewStateStore,
    configSource: () => CONFIG,
  };
  const registry = new OverlayModuleRegistry();
  registry.registerMany([
    new EchoModule(moduleOptions),
    new ChancesDetailModule(moduleOptions),
    new BehaviorModule(moduleOptions),
    new FishBalanceModule(moduleOptions),
    new FishSummaryOverlayModule(moduleOptions),
    new FishCurrentForceOverlayModule(moduleOptions),
    new FishDebuffsSummaryOverlayModule(moduleOptions),
    new FightSummaryOverlayModule(moduleOptions),
    new LineAndDragSummaryOverlayModule(moduleOptions),
    new RodControlSummaryOverlayModule(moduleOptions),
    new FishMovementSummaryOverlayModule(moduleOptions),
    new FishPowerModule(moduleOptions),
    new DebuffsModule(moduleOptions),
    new FightPhysicsOverlayModule(moduleOptions),
    new PlayerMaxModule(moduleOptions),
    new LiveForcesModule(moduleOptions),
    new ChumOverlayModule(moduleOptions),
    new StaminaBalanceOverlayModule(moduleOptions),
    new WorstCaseModule({
      ...moduleOptions,
      selector: new WorstCaseForceDebugSelector({ configSource: () => CONFIG }),
    }),
  ]);

  const domAdapter = new OverlayDomAdapter();
  const interactionBridge = new OverlayInteractionBridge({
    rootElementProvider: () => domAdapter.getRootElement(),
    viewStateStore,
  });

  const controller = new OverlayController({
    registry,
    domAdapter,
    documentTarget: document,
    configSource: () => CONFIG,
    viewStateStore,
    interactionBridge,
  });
  controller.start();

  const metricInfoBridge = new OverlayMetricInfoBridge();
  metricInfoBridge.start();

  window.CYBER_FISHING_DEBUG_OVERLAY = controller;
  window.CYBER_FISHING_OVERLAY_VIEW_STATE = viewStateStore;
  window.CYBER_FISHING_OVERLAY_METRIC_INFO = metricInfoBridge;

  window.addEventListener(
    "pagehide",
    () => {
      metricInfoBridge.dispose();
      controller.dispose();
      window.CYBER_FISHING_OVERLAY_METRIC_INFO = null;
      window.CYBER_FISHING_OVERLAY_VIEW_STATE = null;
      window.CYBER_FISHING_DEBUG_OVERLAY = null;
    },
    { once: true },
  );
})();
