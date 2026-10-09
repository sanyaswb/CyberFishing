import { ConsoleLogger } from "../../platform/browser/diagnostics/console_logger.js";
import { LocalStorageCache } from "../../platform/browser/storage/local_storage_cache.js";
import { GameplayOverrideReader } from "../../dev/runtime/gameplay_override_reader.js";
import { createDevItemCatalog } from "../../dev/data/dev_item_catalog.js";
import { BrowserDebugAdapter } from "../../dev/runtime/browser_debug_adapter.js";
import { BrowserGameLifecycle } from "../../platform/browser/runtime/browser_game_lifecycle.js";
import { CONFIG } from "../../game/config/runtime/game_config.js";
import { ConfigSchemaValidator } from "../../game/config/validation/config_schema_validator.js";
import { ConfigValidationReporter } from "../../dev/diagnostics/config_validation_reporter.js";
import { DebugService } from "../../dev/runtime/debug_service.js";
import { DevFlagsProvider } from "../../dev/runtime/dev_flags_provider.js";
import { DevTools } from "../../dev/tools/dev_tools.js";
import { DevToolsParameterTooltipProvider } from "../../dev/tools/dev_tools_parameter_tooltip_provider.js";
import { DevToolsUI } from "../../dev/tools/dev_tools_ui.js";
import { EventBus } from "../../engine/events/event_bus.js";
import { EventLifecycle } from "../../engine/events/event_lifecycle.js";
import { FISH_DB } from "../../game/config/databases/fish_database.js";
import { FixedCatchFishFactory } from "../../dev/fishing/fixed_catch_fish_factory.js";
import { FixedCatchHook } from "../../dev/fishing/fixed_catch_hook.js";
import { Game } from "../production/game.js";
import { GameCompositionRoot } from "../production/game_composition_root.js";
import { GameDebugFacade } from "../../dev/runtime/game_debug_facade.js";
import { ActiveGameLoopGuard } from "../../platform/browser/runtime/active_game_loop_guard.js";
import { GameVersionBadge } from "../production/game_version_badge.js";
import { HookedFishProfileSynchronizer } from "../../dev/fishing/hooked_fish_profile_synchronizer.js";
import { ITEM_DB } from "../../game/config/databases/item_catalog.js";
import { InputController } from "../../platform/browser/input/input_controller.js";
import { ItemProgressionDebugSnapshotProvider } from "../../dev/items/item_progression_debug_snapshot_provider.js";
import { LocationDebugMapBuilder } from "../../dev/location/location_debug_map_builder.js";
import { LocationDebugRenderFrameBuilder } from "../../dev/location/location_debug_render_frame_builder.js";
import { MemoryLeakWatchdog } from "../../dev/services/memory_leak_watchdog.js";
import { OVERLAY_MODULES } from "../../dev/overlay/config/overlay_modules_config.js";
import { OverlaySettingsStore } from "../../dev/overlay/overlay_settings_store.js";
import { PROJECT_VERSION_CONFIG } from "../../game/presentation/version/project_version.js";
import { ReelRetrieveDiagnostic } from "../../dev/modules/reel_retrieve_diagnostic.js";
import { RenderAllocationDiagnostics } from "../../dev/diagnostics/render_allocation_diagnostics.js";
import { WorldDebugRenderer } from "../../dev/rendering/world_debug_renderer.js";
import { activateBrowserStartupInterface, getBrowserStartupEnvironment, publishBrowserStartupConfig } from "../../platform/browser/runtime/browser_startup_environment.js";
import { createDebugConsoleRuntime } from "./debug_console_bootstrap.js";
import { createDebugOverlayRuntime } from "./debug_overlay_bootstrap.js";
import { createProductionConfigContext } from "../production/game_config_composition.js";

let startup;
// One loop guard per page: a restarted DEV game shares it with the previous one.
let gameLoopGuard;

export function startDevelopmentGame() {
  if (startup) return startup;
  const requested = startGame();
  startup = requested;
  requested.catch(() => { if (startup === requested) startup = null; });
  return requested;
}

async function startGame() {
  const {windowTarget, documentTarget} = getBrowserStartupEnvironment();
  const configRuntime = createProductionConfigContext(config => {
    config.debug.godMode.enabled = true;
    config.debug.fixedCatch.enabled = true;
  });
  publishBrowserStartupConfig(windowTarget, configRuntime, PROJECT_VERSION_CONFIG);
  const disposeInterface = activateBrowserStartupInterface(documentTarget, () => GameVersionBadge.mountById());
  const browserLifecycle = new BrowserGameLifecycle(windowTarget);
  browserLifecycle.cleanupPreviousGame();
  gameLoopGuard ??= new ActiveGameLoopGuard({logger: new ConsoleLogger(), warningTarget: windowTarget});
  const debugModules = {...(CONFIG.debug?.consoleModules || {})};
  const debugModulesSource = () => debugModules;
  const settingsStore = new OverlaySettingsStore(OVERLAY_MODULES);
  // DEV window positions and section states share the game's storage prefix.
  const storageCache = new LocalStorageCache({storage: windowTarget.localStorage, logger: new ConsoleLogger()});
  const godMode = new GameplayOverrideReader(CONFIG);
  const itemCatalog = createDevItemCatalog(ITEM_DB);
  const mapCatalog = CONFIG.locations.map;
  const configValidation = new ConfigValidationReporter({
    createValidator: parameterLabels => new ConfigSchemaValidator({config: configRuntime.runtimeConfig, fishDb: FISH_DB,
      itemDb: itemCatalog, mapDb: mapCatalog, parameterLabels, baseConfig: configRuntime.baseConfig,
      overrideStore: configRuntime.overrideStore, projectVersion: PROJECT_VERSION_CONFIG}),
  });
  let consoleRuntime, overlayRuntime, probe, game, watchdog;
  let gameReady = false;
  let disposed = false;
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    browserLifecycle.removePagehideListener(cleanup);
    watchdog?.dispose();
    probe?.dispose();
    overlayRuntime?.dispose();
    consoleRuntime?.dispose();
    disposeInterface?.();
    if (gameReady) game?.dispose();
    browserLifecycle.clearPublishedHandles(game, watchdog, cleanup);
    startup = null;
  };
  try {
    consoleRuntime = createDebugConsoleRuntime({config: CONFIG, debugModulesSource, documentTarget, windowTarget, logger: windowTarget.console});
    overlayRuntime = createDebugOverlayRuntime({config: CONFIG, baseConfig: configRuntime.baseConfig, settingsStore, documentTarget, windowTarget, storageCache});
    probe = new ReelRetrieveDiagnostic({debugModulesSource});
    const compositionRoot = new GameCompositionRoot(CONFIG, {
      itemDb: itemCatalog,
      loadRandomInventoryId: () => import("../../platform/browser/inventory/random_inventory_id.js"),
      loadBrowserEventTargetAdapter: () => import("../../platform/browser/runtime/browser_event_target_adapter.js"),
      loadBrowserTimeoutScheduler: () => import("../../platform/browser/time/browser_timeout_scheduler.js"),
      loadInventoryAssemblyProfileConfig: () => import("../../game/config/inventory/inventory_composition_config.js"),
      documentTarget, windowTarget, gameLoopGuard,
      createDevFlags: config => new DevFlagsProvider({config, godModeSource: () => godMode, debugModulesSource}),
      createDebugEvents: ({documentTarget: target, isEnabled}) => new BrowserDebugAdapter(target, isEnabled),
      createGameDiagnostics: options => new GameDebugFacade({...options, listeners: new EventLifecycle()}),
      createLocationDebugMapBuilder: options => new LocationDebugMapBuilder(options),
      createItemProgressionDebugSnapshotProvider: options => new ItemProgressionDebugSnapshotProvider(options),
      createHookedFishOverride: ({ config, biteRules, devFlags, ...resolvers }) => new FixedCatchHook({
        config, biteRules, devFlags, fishFactory: new FixedCatchFishFactory(resolvers),
      }),
      createHookedFishProfileSynchronizer: options => new HookedFishProfileSynchronizer(options),
      createDebugService: config => new DebugService(config, debugModulesSource),
      collectFightDiagnostics: true,
      createWorldDebugRenderer: options => new WorldDebugRenderer(options),
      createDevTools: (config, synchronizer, options) => new DevTools(config, synchronizer, {...options, configRuntime, configValidation,
        catalogs: {items: itemCatalog, fishes: FISH_DB, maps: mapCatalog}, settingsStore, debugModulesSource, storageCache,
        createUI: (toggle, liveConfig) => {
          const tooltipProvider = new DevToolsParameterTooltipProvider();
          return {tooltipProvider, ui: new DevToolsUI(toggle, liveConfig, tooltipProvider, storageCache)};
        }}),
      createLocationDebugRenderFrameBuilder: options => new LocationDebugRenderFrameBuilder(options),
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
          managedListeners: EventLifecycle.getActiveListenerCount() + EventBus.getActiveListenerCount() + InputController.getActiveListenerCount()};
      }}) : null;
    watchdog?.start();
    browserLifecycle.publishWatchdog(watchdog);
    if (!started) windowTarget.console.error(new Error("[Bootstrap] CyberFishing game loop did not start."));
    compositionRoot.printStorageUsage();
    return game;
  } catch (error) { cleanup(); throw error; }
}
