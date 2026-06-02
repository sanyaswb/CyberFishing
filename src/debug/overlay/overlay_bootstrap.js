(function bootstrapDebugOverlay() {
  if (typeof document === "undefined") return;

  const settingsStore = window.OverlaySettingsStore;
  const registry = new OverlayModuleRegistry();
  registry.registerMany([
    new EchoModule({ settingsStore }),
    new ChancesDetailModule({ settingsStore }),
    new BehaviorModule({ settingsStore }),
    new FishPowerModule({ settingsStore }),
    new FishStatesModule({ settingsStore }),
    new DebuffsModule({ settingsStore }),
    new FightPhysicsOverlayModule({ settingsStore }),
    new PlayerMaxModule({ settingsStore }),
    new LiveForcesModule({ settingsStore }),
    new ChumOverlayModule({ settingsStore }),
    new WorstCaseModule({ settingsStore }),
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
})();
