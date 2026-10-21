import { ConsoleLogger } from "../../platform/browser/diagnostics/console_logger.js";
import { LocalStorageCache } from "../../platform/browser/storage/local_storage_cache.js";
import { WaterMetric } from "../../game/domain/locations/water_metric.js";
import { GameplayOverrideReader } from "../../dev/runtime/gameplay_override_reader.js";
import { BrowserDebugAdapter } from "../../dev/runtime/browser_debug_adapter.js";
import { BrowserGameLifecycle } from "../../platform/browser/runtime/browser_game_lifecycle.js";
import { CONFIG } from "../../game/config/runtime/game_config.js";
import { composeDevConfigValidation } from "./dev_config_validation_composition.js";
import { DebugService } from "../../dev/runtime/debug_service.js";
import { DevFlagsProvider } from "../../dev/runtime/dev_flags_provider.js";
import { DevInventorySplitSource } from "../../dev/runtime/dev_inventory_split_source.js";
import { DevTools } from "../../dev/tools/dev_tools.js";
import { DevToolsParameterTooltipProvider } from "../../dev/tools/dev_tools_parameter_tooltip_provider.js";
import { DevToolsUI } from "../../dev/tools/dev_tools_ui.js";
import { EventBus } from "../../engine/events/event_bus.js";
import { EventLifecycle } from "../../engine/events/event_lifecycle.js";
import { FISH_DB } from "../../game/config/databases/fish_database.js";
import { FightDiagnosticsSnapshotBuilder } from "../../dev/fishing/fight_diagnostics_snapshot_builder.js";
import { FixedCatchFishFactory } from "../../dev/fishing/fixed_catch_fish_factory.js";
import { FixedCatchHook } from "../../dev/fishing/fixed_catch_hook.js";
import { Game } from "../production/game.js";
import { GameCompositionRoot } from "../production/game_composition_root.js";
import { GameDebugFacade } from "../../dev/runtime/game_debug_facade.js";
import { ActiveGameLoopGuard } from "../../platform/browser/runtime/active_game_loop_guard.js";
import { GameVersionBadge } from "../production/game_version_badge.js";
import { GameToolbar } from "../../platform/browser/ui/game_toolbar.js";
import { HookedFishProfileSynchronizer } from "../../dev/fishing/hooked_fish_profile_synchronizer.js";
import { ITEM_DB } from "../../game/config/databases/item_catalog.js";
import { ItemProgressionDebugSnapshotProvider } from "../../dev/items/item_progression_debug_snapshot_provider.js";
import { LocationDebugMapBuilder } from "../../dev/location/location_debug_map_builder.js";
import { ZoneEditorState } from "../../dev/location/zone_editor_state.js";
import { ZoneEditorGeometryBuilder } from "../../dev/location/zone_editor_geometry_builder.js";
import { LocationDebugRenderFrameBuilder } from "../../dev/location/location_debug_render_frame_builder.js";
import { ManagedListenerCounter } from "../../dev/services/managed_listener_counter.js";
import { MemoryLeakWatchdog } from "../../dev/services/memory_leak_watchdog.js";
import { OVERLAY_MODULES } from "../../dev/overlay/config/overlay_modules_config.js";
import { OverlaySettingsStore } from "../../dev/overlay/overlay_settings_store.js";
import { PROJECT_VERSION_CONFIG } from "../../game/presentation/version/project_version.js";
import { RenderAllocationDiagnostics } from "../../dev/diagnostics/render_allocation_diagnostics.js";
import { WorldDebugRenderer } from "../../dev/rendering/world_debug_renderer.js";
import { activateBrowserStartupInterface, getBrowserStartupEnvironment, publishBrowserStartupConfig } from "../../platform/browser/runtime/browser_startup_environment.js";
import { createDebugConsoleRuntime } from "./debug_console_bootstrap.js";
import { createDebugOverlayRuntime } from "./debug_overlay_bootstrap.js";
import { createProductionConfigContext } from "../production/game_config_composition.js";
import { EmbeddedPageOverlay } from "../../platform/browser/ui/embedded_page_overlay.js";
import { UiSurfaceAdapter } from "../../platform/browser/dom/ui_surface_adapter.js";
import { UI_CATALOG_LABELS } from "../../dev/ui_catalog/ui_catalog_definitions.js";
import { composeDevTimeDisplay } from "./dev_time_composition.js";
import { ScreenHost } from "../../engine/screens/screen_host.js";
import { createDevHouseScreenFactory } from "./dev_house_screen_composition.js";
import { FrameProfiler } from "../../dev/diagnostics/frame_profiler.js";

let startup;
// One loop guard and one listener counter per page: a restarted DEV game shares them with the previous one.
let gameLoopGuard;
let listenerCounter;

export function startDevelopmentGame() {
  if (startup) return startup;
  const requested = startGame();
  startup = requested;
  requested.catch((error) => {
    if (startup === requested) startup = null;
    new ConsoleLogger().error("[Bootstrap] CyberFishing DEV startup failed.", error);
  });
  return requested;
}

async function startGame() {
  const {windowTarget, documentTarget} = getBrowserStartupEnvironment();
  // DEV page switches: ?screen=house opens the House after startup; ?scene=webgl|canvas picks the scene mode (spec 104).
  const pageParams = new windowTarget.URLSearchParams(windowTarget.location.search);
  const configRuntime = createProductionConfigContext(config => {
    config.debug.godMode.enabled = true;
    config.debug.fixedCatch.enabled = true;
    config.liveBait = { ...config.liveBait, visual: { ...config.liveBait.visual, showZone: true } };
  });
  publishBrowserStartupConfig(windowTarget, configRuntime, PROJECT_VERSION_CONFIG);
  const disposeInterface = activateBrowserStartupInterface(documentTarget, () => GameVersionBadge.mountById());
  const browserLifecycle = new BrowserGameLifecycle(windowTarget);
  browserLifecycle.cleanupPreviousGame();
  const uiSurface = new UiSurfaceAdapter({ hostElement: documentTarget.body,
    documentRef: documentTarget, windowRef: windowTarget, viewport: true });
  const badge = documentTarget.getElementById("gameVersionBadge");
  const toolbar = new GameToolbar({ documentRef: documentTarget, mountNode: uiSurface.mountRoot, versionBadge: badge });
  const developmentMount = documentTarget.createElement("div");
  developmentMount.className = "game-shell__dev-ui";
  uiSurface.portalRoot.appendChild(developmentMount);
  gameLoopGuard ??= new ActiveGameLoopGuard({logger: new ConsoleLogger(), warningTarget: windowTarget});
  listenerCounter ??= new ManagedListenerCounter();
  const debugModules = {...(CONFIG.debug?.consoleModules || {})};
  const debugModulesSource = () => debugModules;
  const settingsStore = new OverlaySettingsStore(OVERLAY_MODULES);
  // Spec 101: one DEV frame profiler for the game loop, the render passes, the Spine rod and the overlay.
  const frameProfiler = new FrameProfiler();
  const readRenderInfo = () => {
    const canvas = documentTarget.getElementById("gameCanvas");
    if (!canvas) return null;
    const cssWidth = Number.parseFloat(canvas.style.width) || canvas.width || 1;
    const memory = windowTarget.performance?.memory;
    return { backingWidth: canvas.width, backingHeight: canvas.height, pixelRatio: Number((canvas.width / cssWidth).toFixed(2)),
      memoryMb: memory ? memory.usedJSHeapSize / 1048576 : null };
  };
  // DEV window positions and section states share the game's storage prefix.
  const storageCache = new LocalStorageCache({storage: windowTarget.localStorage, logger: new ConsoleLogger()});
  const godMode = new GameplayOverrideReader(CONFIG);
  const itemCatalog = ITEM_DB;
  const zoneEditorState = new ZoneEditorState();
  const mapCatalog = CONFIG.locations.map;
  const configValidation = composeDevConfigValidation({configRuntime, itemCatalog});
  let consoleRuntime, overlayRuntime, game, watchdog;
  let readLocationMetric = null;
  let timeControl = null;
  let devTools = null;
  let compositionRoot = null;
  let catalogTimeSnapshot = null;
  const resumeGame = () => { void game?.start().catch((error) => windowTarget.console.error(error)); };
  // The UI catalog stays a separate DEV page in an overlay frame.
  const pageOverlay = new EmbeddedPageOverlay({ documentRef: documentTarget, windowTarget,
    src: "ui-catalog.html?embedded=1", title: UI_CATALOG_LABELS.pageTitle,
    onEnter: () => { game?.stop(); catalogTimeSnapshot = timeControl?.suspend(); },
    onExit: () => { timeControl?.resume(catalogTimeSnapshot); catalogTimeSnapshot = null; resumeGame(); } });
  // The House is a screen of this page (spec 084), composed over the session's live bait and clock.
  const screens = new ScreenHost({ base: { suspend: () => game?.stop(), resume: resumeGame }, factories: {
    house: createDevHouseScreenFactory({ documentTarget, windowTarget, uiSurface, config: CONFIG,
      getSessionServices: () => compositionRoot.getSessionServices(), getGameTimeControl: () => timeControl,
      getDevTools: () => devTools }),
  } });
  const openHouse = () => screens.open("house").catch((error) => windowTarget.console.error(error));
  let gameReady = false;
  let disposed = false;
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    browserLifecycle.removePagehideListener(cleanup);
    screens.dispose();
    pageOverlay.dispose();
    watchdog?.dispose();
    overlayRuntime?.dispose();
    frameProfiler.dispose();
    consoleRuntime?.dispose();
    disposeInterface?.();
    if (gameReady) game?.dispose();
    toolbar.dispose();
    uiSurface.dispose();
    browserLifecycle.clearPublishedHandles(game, watchdog, cleanup);
    startup = null;
  };
  try {
    consoleRuntime = createDebugConsoleRuntime({config: CONFIG, debugModulesSource, documentTarget, windowTarget,
      logger: windowTarget.console, getWaterMetric: () => readLocationMetric?.() });
    overlayRuntime = createDebugOverlayRuntime({config: CONFIG, baseConfig: configRuntime.baseConfig, settingsStore, documentTarget, windowTarget, storageCache, uiSurface, mountNode: developmentMount,
      frameProfiler, readRenderInfo});
    compositionRoot = new GameCompositionRoot(CONFIG, {
      itemDb: itemCatalog,
      loadRandomInventoryId: () => import("../../platform/browser/inventory/random_inventory_id.js"),
      loadBrowserEventTargetAdapter: () => import("../../platform/browser/runtime/browser_event_target_adapter.js"),
      loadBrowserTimeoutScheduler: () => import("../../platform/browser/time/browser_timeout_scheduler.js"),
      loadInventoryAssemblyProfileConfig: () => import("../../game/config/inventory/inventory_composition_config.js"),
      documentTarget, windowTarget, gameLoopGuard, listenerCounter,
      uiSurface,
      toolbarMountNode: toolbar.element,
      tackleMountNode: toolbar.tackleMountNode,
      depthMountNode: toolbar.depthMountNode,
      selectorMountNode: toolbar.selectorMountNode,
      createDevFlags: config => new DevFlagsProvider({config, godModeSource: () => godMode, debugModulesSource}),
      createFrameProbe: () => frameProfiler,
      sceneMode: pageParams.get("scene"),
      createInventorySplitSource: ({documentTarget: target, listeners}) =>
        new DevInventorySplitSource({config: CONFIG, documentRef: target, listeners}),
      createDebugEvents: ({documentTarget: target, isEnabled}) => new BrowserDebugAdapter(target, isEnabled, new EventBus(listenerCounter)),
      createGameDiagnostics: options => new GameDebugFacade({...options, listeners: new EventLifecycle(listenerCounter)}),
      createLocationDebugMapBuilder: options => new LocationDebugMapBuilder(options),
      createItemProgressionDebugSnapshotProvider: options => new ItemProgressionDebugSnapshotProvider(options),
      createHookedFishOverride: ({ config, biteRules, devFlags, ...resolvers }) => new FixedCatchHook({
        config, biteRules, devFlags, fishFactory: new FixedCatchFishFactory(resolvers),
      }),
      createHookedFishProfileSynchronizer: options => new HookedFishProfileSynchronizer(options),
      createDebugService: config => new DebugService(config, debugModulesSource),
      createFightDiagnosticsBuilder: () => new FightDiagnosticsSnapshotBuilder(),
      createWorldDebugRenderer: options => new WorldDebugRenderer(options),
      createDevTools: (config, synchronizer, options) => devTools = new DevTools(config, synchronizer, {...options, configRuntime, configValidation, zoneEditorState,
        createWaterMetric: options => WaterMetric.illustrated(options),
        getWaterMetric: () => readLocationMetric?.() ?? null,
        openHouse,
        openUiCatalog: () => pageOverlay.open(),
        catalogs: {items: itemCatalog, fishes: FISH_DB, maps: mapCatalog}, settingsStore, debugModulesSource, storageCache,
        createUI: (toggle, liveConfig) => {
          const tooltipProvider = new DevToolsParameterTooltipProvider();
          return {tooltipProvider, ui: new DevToolsUI(toggle, liveConfig, tooltipProvider, storageCache, uiSurface, developmentMount)};
        }}),
      createTimeDisplay: options => {
        timeControl = composeDevTimeDisplay({ ...options, config: CONFIG, uiSurface });
        return timeControl;
      },
      createLocationDebugRenderFrameBuilder: options => {
        readLocationMetric = options.getWaterMetric;
        return new LocationDebugRenderFrameBuilder({ ...options,
          zoneEditor: new ZoneEditorGeometryBuilder({ ...options, state: zoneEditorState }) });
      },
      getRenderDiagnostics: () => RenderAllocationDiagnostics,
      isCatchResolutionLogEnabled: () => debugModules.catchResolution === true,
    });
    game = new Game("gameCanvas", compositionRoot);
    browserLifecycle.publishGame(game);
    browserLifecycle.installPagehideCleanup(cleanup);
    await game.ready;
    gameReady = true;
    if (disposed) { game.dispose(); return game; }
    const started = await game.start();
    if (disposed) return game;
    const memoryConfig = compositionRoot.getMemoryWatchdogConfig();
    watchdog = memoryConfig.enabled === true ? new MemoryLeakWatchdog({intervalMs: memoryConfig.intervalMs,
      maxSamples: memoryConfig.maxSamples, minTrendSamples: memoryConfig.minTrendSamples, thresholds: memoryConfig.thresholds,
      metricsProvider: () => {
        const loop = gameLoopGuard.getDiagnostics();
        return {activeGameLoops: loop.activeCount, duplicateLoopStarts: loop.duplicateStartAttempts,
          managedListeners: listenerCounter.getActiveCount()};
      }}) : null;
    watchdog?.start();
    browserLifecycle.publishWatchdog(watchdog);
    if (!started) windowTarget.console.error(new Error("[Bootstrap] CyberFishing game loop did not start."));
    if (pageParams.get("screen") === "house") openHouse();
    compositionRoot.printStorageUsage();
    return game;
  } catch (error) { cleanup(); throw error; }
}
