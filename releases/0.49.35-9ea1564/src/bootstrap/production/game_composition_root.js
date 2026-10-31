import { GameRenderComposition } from "./game_render_composition.js";
import { HUD_LABELS } from "../../game/presentation/hud/hud_labels.js";
import { ITEM_PROGRESSION_LABELS } from "../../game/presentation/inventory/item_progression_labels.js";
import { FISHING_MESSAGES } from "../../game/presentation/fishing/fishing_messages.js";
import { FloatWaveRocking } from "../../game/presentation/fishing/float_wave_rocking.js";
import { AlwaysKnownBaitEffectivenessPolicy } from "../../game/domain/items/bait/always_known_bait_effectiveness_policy.js";
import { AssetPreloadCoordinator } from "../../platform/browser/assets/asset_preload_coordinator.js";
import { AuthoredItemRarityStrategy } from "../../game/domain/items/rarity/authored_item_rarity_strategy.js";
import { BaitEffectivenessCatalogResolver } from "../../game/presentation/inventory/bait_effectiveness_catalog_resolver.js";
import { BaitEffectivenessDescriptor } from "../../game/presentation/inventory/bait_effectiveness_descriptor.js";
import { BaitEffectivenessGradePolicy } from "../../game/domain/items/bait/bait_effectiveness_grade_policy.js";
import { BaitEffectivenessResolver } from "../../game/domain/items/bait/bait_effectiveness_resolver.js";
import { BaitFreshnessModifier } from "../../game/domain/items/freshness/bait_freshness_modifier.js";
import { BaitRules } from "../../game/domain/rules/bait_rules.js";
import { BiteRules } from "../../game/domain/rules/bite_rules.js";
import { BoatRules } from "../../game/domain/rules/boat_rules.js";
import { CastRules } from "../../game/domain/rules/cast_rules.js";
import { ChumRules } from "../../game/domain/rules/chum_rules.js";
import { EquipmentRules } from "../../game/domain/rules/equipment_rules.js";
import { PlayerCastRules } from "../../game/domain/rules/player_cast_rules.js";
import { BiteEnvironmentService } from "../../game/application/fishing/bite_environment_service.js";
import { BiteSystem } from "../../game/application/fishing/bite_system.js";
import { CastRodControl } from "../../game/application/fishing/cast_rod_control.js";
import { CastPenalty } from "../../game/application/fishing/cast_penalty.js";
import { BitingState } from "../../game/application/state/biting_state.js";
import { FailedState } from "../../game/application/state/failed_state.js";
import { PlayingState } from "../../game/application/state/playing_state.js";
import { ScoutingState } from "../../game/application/state/scouting_state.js";
import { StateDepsFactory } from "../../game/application/state/state_deps_factory.js";
import { StateMachine } from "../../game/application/state/state_machine.js";
import { VictoryState } from "../../game/application/state/victory_state.js";
import { WaitingState } from "../../game/application/state/waiting_state.js";
import { BrowserAudioAdapter } from "../../platform/browser/runtime/browser_audio_adapter.js";
import { CanvasMetricsProvider } from "../../platform/browser/runtime/canvas_metrics_provider.js";
import { EventLifecycle } from "../../engine/events/event_lifecycle.js";
import { LocalStorageCache } from "../../platform/browser/storage/local_storage_cache.js";
import { Canvas2DSurface } from "../../platform/browser/canvas/canvas_2d_surface.js";
import { CanvasPrimitives } from "../../platform/browser/canvas/canvas_primitives.js";
import { CastDistanceCalculator } from "../../game/domain/casting/cast_distance_calculator.js";
import { composeFishingServices } from "./fishing_services_composition.js";
import { FishingController } from "../../game/application/fishing/fishing_controller.js";
import { ChumController } from "../../game/application/chum/chum_controller.js";
import { ChumControls } from "../../platform/browser/ui/chum_controls.js";
import { ChumService } from "../../game/application/chum/chum_service.js";
import { BoatRoutePlanner } from "../../game/application/chum/boat_route_planner.js";
import { CompositeMetricStrategy } from "../../game/domain/items/progression/composite_metric_strategy.js";
import { ConsoleLogger } from "../../platform/browser/diagnostics/console_logger.js";
import { DegradationColorConfigValidator } from "../../game/presentation/visual/degradation_color_config_validator.js";
import { DegradationColorResolver } from "../../game/presentation/styles/degradation_color_resolver.js";
import { DependencyContractValidator } from "../../engine/di/dependency_contract_validator.js";
import { composeDepthSelector } from "./depth_selector_composition.js";
import { LazyImageWarmUp } from "../../platform/browser/assets/lazy_image_warm_up.js";
import { DerivedStatMetricStrategy } from "../../game/domain/items/progression/derived_stat_metric_strategy.js";
import { EffectiveItemStatsResolver } from "../../game/domain/items/effective_item_stats_resolver.js";
import { EnvironmentSystem } from "../../game/application/world/environment_system.js";
import { composeGameTime } from "./game_time_composition.js";
import { backgroundTimeBlend } from "../../game/domain/time/background_time_blend.js";
import { timeOfDayLayers } from "../../game/presentation/time/time_of_day_layers.js";
import { GameWorld } from "../../game/application/world/game_world.js";
import { LocationWaterMetricResolver } from "../../game/domain/locations/location_water_metric_resolver.js";
import { LocationWaterMetricSource } from "../../game/domain/locations/location_water_metric_source.js";
import { CurrentLocation } from "../../game/application/world/current_location.js";
import { EquipmentService } from "../../game/application/inventory/equipment_service.js";
import { FightAreaStyleResolver } from "../../game/presentation/styles/fight_area_style_resolver.js";
import { FightInputActionComposer } from "../../game/application/input/fight_input_action_composer.js";
import { FightPhysicsConfigAdapter } from "../../game/config/physics/fight_physics_config_adapter.js";
import { FishAnomalyVariantResolver } from "../../game/domain/fish/fish_anomaly_variant_resolver.js";
import { FishRarityResolver } from "../../game/domain/fish/fish_rarity_resolver.js";
import { FishVisualVariantResolver } from "../../game/presentation/fish/fish_visual_variant_resolver.js";
import { FISH_DB } from "../../game/config/databases/fish_database.js";
import { GameApplication } from "../../game/application/session/game_application.js";
import { GameViewportFacade } from "../../game/presentation/viewport/game_viewport_facade.js";
import { RodVisualOffsetSystem } from "../../game/application/fishing/rod_visual_offset_system.js";
import { GameClock } from "../../platform/browser/time/game_clock.js";
import { GameLoop } from "../../platform/browser/runtime/game_loop.js";
import { HoldCharges } from "../../platform/browser/ui/hold_charges.js";
import { HudStyleResolver } from "../../game/presentation/styles/hud_style_resolver.js";
import { ImageAssetProvider } from "../../platform/browser/assets/image_asset_provider.js";
import { InputController } from "../../platform/browser/input/input_controller.js";
import { INVENTORY_RULE_MESSAGES } from "../../game/presentation/inventory/inventory_rule_messages.js";
import { InventoryEventBridge } from "../../game/application/inventory/inventory_event_bridge.js";
import { InventoryRuntimeConfigProvider } from "../../game/application/inventory/inventory_runtime_config_provider.js";
import { ItemDatabase } from "../../game/application/inventory/item_database.js";
import { LineCompatibilityRules } from "../../game/application/inventory/line_compatibility_rules.js";
import { InventoryBalanceParameterResolver } from "../../game/presentation/inventory/inventory_balance_parameter_resolver.js";
import { InventoryUiBootstrap } from "./inventory_ui_bootstrap.js";
import { composeInventorySelector } from "./inventory_selector_composition.js";
import { ITEM_DB } from "../../game/config/databases/item_catalog.js";
import { ItemCapacityResolver } from "../../game/domain/items/progression/item_capacity_resolver.js";
import { ItemCatalogBaselineRegistry } from "../../game/domain/items/progression/item_catalog_baseline_registry.js";
import { ItemConditionDescriptor } from "../../game/presentation/inventory/item_condition_descriptor.js";
import { ItemConditionDomAdapter } from "../../platform/browser/dom/item_condition_dom_adapter.js";
import { ItemConditionResolver } from "../../game/domain/items/condition/item_condition_resolver.js";
import { ItemFreshnessDescriptor } from "../../game/presentation/inventory/item_freshness_descriptor.js";
import { ItemFreshnessResolver } from "../../game/domain/items/freshness/item_freshness_resolver.js";
import { ItemBoundedMetricResolver } from "../../game/domain/items/metrics/item_bounded_metric_resolver.js";
import { DevicePowerService } from "../../game/application/power/device_power_service.js";
import { BrowserPageHideListener } from "../../platform/browser/runtime/browser_page_hide_listener.js";
import { RadioReceiverService } from "../../game/application/radio/radio_receiver_service.js";
import { RadioBrowserStationSource } from "../../platform/browser/radio/radio_browser_station_source.js";
import { BrowserRegionResolver } from "../../platform/browser/radio/browser_region_resolver.js";
import { RadioPreferencesLocalStore } from "../../platform/browser/storage/radio_preferences_local_store.js";
import { SharedAudioContextProvider } from "../../platform/browser/audio/shared_audio_context_provider.js";
import { RadioStreamPlayer } from "../../platform/browser/audio/radio_stream_player.js";
import { RadioEffectsChain } from "../../platform/browser/audio/radio_effects_chain.js";
import { RadioNoiseSource } from "../../platform/browser/audio/radio_noise_source.js";
import { MonotonicIntervalTicker } from "../../platform/browser/time/monotonic_interval_ticker.js";
import { RadioHudIndicator } from "../../platform/browser/ui/radio_hud_indicator.js";
import { RADIO_LABELS } from "../../game/presentation/radio/radio_labels.js";
import { ItemMetricStrategyRegistry } from "../../game/domain/items/progression/item_metric_strategy_registry.js";
import { ItemProgressionConfigValidator } from "../../game/config/validation/item_progression_config_validator.js";
import { ItemProgressionDomAdapter } from "../../platform/browser/dom/item_progression_dom_adapter.js";
import { ItemProgressionResolver } from "../../game/domain/items/progression/item_progression_resolver.js";
import { ItemProgressionVisualResolver } from "../../game/presentation/inventory/item_progression_visual_resolver.js";
import { ItemQualityResolver } from "../../game/presentation/inventory/item_quality_resolver.js";
import { ItemRarityDomAdapter } from "../../platform/browser/dom/item_rarity_dom_adapter.js";
import { ItemRarityResolver } from "../../game/domain/items/rarity/item_rarity_resolver.js";
import { ItemRarityStrategyRegistry } from "../../game/domain/items/rarity/item_rarity_strategy_registry.js";
import { ItemRatingResolver } from "../../game/domain/items/progression/item_rating_resolver.js";
import { ItemRatingTierResolver } from "../../game/domain/items/progression/item_rating_tier_resolver.js";
import { ItemStatOverridePolicy } from "../../game/domain/items/item_stat_override_policy.js";
import { LocationAssetLoader } from "../../platform/browser/location/location_asset_loader.js";
import { LocationMap } from "../../game/domain/locations/location_map.js";
import { Net } from "../../game/domain/tackle/net.js";
import { NumericStatMetricStrategy } from "../../game/domain/items/progression/numeric_stat_metric_strategy.js";
import { OffscreenCanvasFactory } from "../../platform/browser/canvas/offscreen_canvas_factory.js";
import { OutcomeStyleResolver } from "../../game/presentation/styles/outcome_style_resolver.js";
import { createPlayerInventory } from "./player_inventory_composition.js";
import { composeLiveBait } from "./live_bait_composition.js";
import { composeRodAnimation } from "./rod_animation_composition.js";
import { composeBoatAnimation } from "./boat_animation_composition.js";
import { FRAME_PROBE_METHODS, InactiveFrameProbe } from "../../engine/diagnostics/inactive_frame_probe.js";
import { STARTUP_MARKS_METHODS, STARTUP_STAGES } from "../../engine/diagnostics/startup_stages.js";
import { SCENE_LAYER_METHODS } from "../../engine/scene/inactive_scene_layer.js";
import { composeSceneLayer } from "./scene_layer_composition.js";
import { fishDisplayImagePath } from "../../game/presentation/fish/fish_art_variants.js";
import { LiveBaitBaitCandidatePort } from "../../game/application/live_bait/live_bait_bait_candidate_port.js";
import { LiveBaitMotionAdapter } from "../../game/application/live_bait/live_bait_motion_adapter.js";
import { LiveBaitMotionProfileResolver } from "../../game/domain/live_bait/live_bait_motion_profile_resolver.js";
import { RarityAnimationResolver } from "../../game/presentation/screens/rarity_animation_resolver.js";
import { RarityConfigValidator } from "../../game/config/validation/rarity_config_validator.js";
import { RarityVisualResolver } from "../../game/presentation/styles/rarity_visual_resolver.js";
import { ReelRetrieveSpeedCalculator } from "../../game/domain/fishing/reel_retrieve_speed_calculator.js";
import { SeededRng } from "../../engine/random/seeded_rng.js";
import { TargetRangeMetricStrategy } from "../../game/domain/items/progression/target_range_metric_strategy.js";
import { composeTimeDisplay } from "./time_display_composition.js";
import { GameControls } from "../../platform/browser/ui/game_controls.js";
import { FullscreenControl } from "../../platform/browser/ui/fullscreen_control.js";
import { GameStageLayout } from "../../platform/browser/ui/game_stage_layout.js";
import { InventorySplitLayoutPolicy } from "../../game/presentation/viewport/inventory_split_layout_policy.js";
import { InactiveDebugEvents } from "../../game/application/session/inactive_debug_events.js";
import { InactiveGameDiagnostics } from "../../game/application/session/inactive_game_diagnostics.js";
import { VictoryActionGestureResolver } from "../../game/presentation/input/victory_action_gesture_resolver.js";
import { VictoryLayoutResolver } from "../../game/presentation/screens/victory_layout_resolver.js";
import { ViewportProjector } from "../../game/application/viewport/viewport_projector.js";
import { WorldPerspective } from "../../game/domain/locations/world_perspective.js";

export class GameCompositionRoot {
  #config;
  #itemDb;
  #runtimeConfig;
  #createLocationDebugMapBuilder;
  #createItemProgressionDebugSnapshotProvider;
  #createHookedFishOverride;
  #createInventorySplitSource;
  #stageLayout = null;
  #createHookedFishProfileSynchronizer;
  #createDebugService;
  #loadRandomInventoryId;
  #loadBrowserEventTargetAdapter;
  #loadBrowserTimeoutScheduler;
  #loadInventoryAssemblyProfileConfig;
  #documentTarget;
  #windowTarget;
  #gameLoopGuard;
  #listenerCounter;
  #createDevFlags;
  #createDebugEvents;
  #createGameDiagnostics;
  #createDevTools;
  #createTimeDisplay;
  #sessionServices = null;
  // Spec 157 R11: loads that wait until the game is ready (startDeferredAssetLoads), registered during create().
  #deferredAssetLoads = [];
  #deferredAssetLoadsStarted = false;
  // Opens the radio's editor once the inventory UI exists (spec 142: the HUD indicator's tap).
  #radioEditorOpener = null;
  #createRadioEffectTuning = null;
  #getRenderDiagnostics;
  #isCatchResolutionLogEnabled;
  #createFightDiagnosticsBuilder;
  #frameProbe;
  #startupMarks;
  #sceneMode;
  #storageCache;
  #rendering;
  #uiSurface;
  #toolbarMountNode;
  #tackleMountNode;
  #depthMountNode;
  #selectorMountNode;
  constructor(config, {
    createLocationDebugMapBuilder,
    createItemProgressionDebugSnapshotProvider,
    createHookedFishOverride,
    createHookedFishProfileSynchronizer,
    createDebugService,
    itemDb = ITEM_DB,
    loadRandomInventoryId,
    loadBrowserEventTargetAdapter,
    loadBrowserTimeoutScheduler,
    loadInventoryAssemblyProfileConfig,
    documentTarget,
    windowTarget,
    gameLoopGuard,
    listenerCounter = null,
    createDevFlags,
    createDebugEvents,
    createGameDiagnostics,
    createWorldDebugRenderer,
    createDevTools,
    createTimeDisplay,
    createLocationDebugRenderFrameBuilder,
    getRenderDiagnostics,
    isCatchResolutionLogEnabled,
    createFightDiagnosticsBuilder,
    createInventorySplitSource,
    createFrameProbe,
    startupMarks,
    // DEV (TK-098): ({ config }) -> the radio effects' tuning port shown in the radio's editor; absent in production.
    createRadioEffectTuning = null,
    sceneMode = null,
    uiSurface = null,
    toolbarMountNode = null,
    tackleMountNode = toolbarMountNode,
    depthMountNode = tackleMountNode,
    selectorMountNode = toolbarMountNode,
  } = {}) {
    for (const [name, factory] of Object.entries({
      createLocationDebugMapBuilder, createItemProgressionDebugSnapshotProvider, createHookedFishOverride,
      createHookedFishProfileSynchronizer, createDebugService, createWorldDebugRenderer,
      createDevTools, createTimeDisplay, createLocationDebugRenderFrameBuilder, getRenderDiagnostics,
      isCatchResolutionLogEnabled, createDebugEvents, createGameDiagnostics, createFightDiagnosticsBuilder,
      createInventorySplitSource, createFrameProbe, createRadioEffectTuning,
    })) {
      if (factory != null && typeof factory !== "function") {
        throw new TypeError("GameCompositionRoot requires optional callback " + name);
      }
    }
    const worldDebugFactories = [createLocationDebugMapBuilder, createWorldDebugRenderer,
      createLocationDebugRenderFrameBuilder];
    const worldDebugCount = worldDebugFactories.filter(factory => factory != null).length;
    if (worldDebugCount !== 0 && worldDebugCount !== worldDebugFactories.length) {
      throw new TypeError("GameCompositionRoot requires coherent world debug factories");
    }
    if ((createDebugEvents == null) !== (createGameDiagnostics == null)) {
      throw new TypeError("GameCompositionRoot requires coherent diagnostics factories");
    }
    if (createDevTools != null && createHookedFishProfileSynchronizer == null) {
      throw new TypeError("GameCompositionRoot requires hooked fish synchronizer for DEV tools");
    }
    this.#createLocationDebugMapBuilder = createLocationDebugMapBuilder;
    this.#createItemProgressionDebugSnapshotProvider = createItemProgressionDebugSnapshotProvider;
    this.#createHookedFishOverride = createHookedFishOverride;
    // DEV landscape split inventory (spec 098); production passes none and composes no stage.
    this.#createInventorySplitSource = createInventorySplitSource;
    this.#createHookedFishProfileSynchronizer = createHookedFishProfileSynchronizer;
    this.#createDebugService = createDebugService;
    this.#loadRandomInventoryId = loadRandomInventoryId;
    this.#loadBrowserEventTargetAdapter = loadBrowserEventTargetAdapter;
    this.#loadBrowserTimeoutScheduler = loadBrowserTimeoutScheduler;
    this.#loadInventoryAssemblyProfileConfig = loadInventoryAssemblyProfileConfig;
    this.#documentTarget = documentTarget;
    this.#windowTarget = windowTarget;
    this.#gameLoopGuard = gameLoopGuard;
    // DEV memory diagnostics only; production composes no counter.
    this.#listenerCounter = listenerCounter;
    this.#createDevFlags = createDevFlags;
    this.#createDebugEvents = createDebugEvents;
    this.#createGameDiagnostics = createGameDiagnostics;
    this.#createDevTools = createDevTools;
    this.#createRadioEffectTuning = createRadioEffectTuning;
    this.#createTimeDisplay = createTimeDisplay;
    this.#getRenderDiagnostics = getRenderDiagnostics;
    this.#isCatchResolutionLogEnabled = isCatchResolutionLogEnabled;
    this.#createFightDiagnosticsBuilder = createFightDiagnosticsBuilder;
    this.#uiSurface = uiSurface;
    this.#toolbarMountNode = toolbarMountNode;
    this.#tackleMountNode = tackleMountNode;
    this.#depthMountNode = depthMountNode;
    this.#selectorMountNode = selectorMountNode;
    // Frame timing port (spec 101): the DEV FrameProfiler when Development composes one, inactive otherwise.
    this.#frameProbe = createFrameProbe == null ? new InactiveFrameProbe() : createFrameProbe();
    new DependencyContractValidator({ consumer: "GameCompositionRoot" }).requireMethods(
      this.#frameProbe, "frameProbe", FRAME_PROBE_METHODS);
    // Startup stage marks (spec 157 R9): composed by both pages, read by the DEV startup overlay and the measurer.
    this.#startupMarks = startupMarks;
    // WebGL scene mode for this page load (spec 104 D1): DEV's ?scene= value; production reads CONFIG.canvas.scene.
    this.#sceneMode = sceneMode;
    this.#rendering = new GameRenderComposition({
      readRenderDiagnostics: () => this.#readRenderDiagnostics(),
      createOptionalDiagnostic: (factory, name, args, methods) =>
        this.#createOptionalDiagnostic(factory, name, args, methods),
      createWorldDebugRenderer,
      createLocationDebugRenderFrameBuilder,
      frameProbe: this.#frameProbe,
    });
    this.#storageCache = new LocalStorageCache({ storage: windowTarget?.localStorage, logger: new ConsoleLogger() });
    this.#config = config || {};
    this.#itemDb = itemDb;
    this.#runtimeConfig = {};
    for (const key of Object.getOwnPropertyNames(this.#config)) {
      Object.defineProperty(this.#runtimeConfig, key, {
        enumerable: Object.getOwnPropertyDescriptor(this.#config, key).enumerable,
        get: () => this.#config[key],
      });
    }
  }

  getRuntimeConfig() {
    return this.#runtimeConfig;
  }

  printStorageUsage() {
    this.#storageCache.printStorageUsage();
  }

  // Spec 157 R11: called by the page startup once the first frame is drawn; starts each registered load once.
  // A load's failure is its owner's to report; the startup never waits for these loads.
  startDeferredAssetLoads() {
    if (this.#deferredAssetLoadsStarted) return;
    this.#deferredAssetLoadsStarted = true;
    for (const load of this.#deferredAssetLoads) load();
  }

  // Services of the running session that other screens share instead of composing their own (spec 084).
  getSessionServices() {
    if (!this.#sessionServices) throw new Error("GameCompositionRoot.getSessionServices before build");
    return this.#sessionServices;
  }

  getMemoryWatchdogConfig() {
    return this.#config.debug?.memoryWatchdog || {};
  }

  async build(canvasId) {
    const canvas = this.#documentTarget.getElementById(canvasId);
    const stageLayout = this.#createInventorySplitSource == null ? null : new GameStageLayout({
      shell: this.#documentTarget.body, windowRef: this.#windowTarget, uiSurface: this.#uiSurface,
      source: this.#createInventorySplitSource({ documentTarget: this.#documentTarget,
        listeners: new EventLifecycle(this.#listenerCounter) }),
      policy: new InventorySplitLayoutPolicy(), listeners: new EventLifecycle(this.#listenerCounter),
    });
    this.#stageLayout = stageLayout;
    // Logical CSS pixels for the game, a backing store at the device pixel ratio up to the cap (spec 100 D1).
    const resolutionOptions = { devicePixelRatio: () => this.#windowTarget.devicePixelRatio,
      maxPixelRatio: this.#config.canvas?.maxPixelRatio };
    const canvasMetrics = new CanvasMetricsProvider(canvas, stageLayout ? () => stageLayout.getViewport() : null,
      resolutionOptions);
    canvasMetrics.resizeToViewport();
    const devFlags = this.#createDevFlags(this.#config);
    const contracts = new DependencyContractValidator({ consumer: "GameCompositionRoot.build" });
    contracts.requireMethods(devFlags, "devFlags", ["isEnabled", "godModeValue", "isDebugEnabled"]);
    contracts.requireMethods(this.#gameLoopGuard, "gameLoopGuard", ["acquire", "release", "getDiagnostics"]);
    contracts.requireMethods(this.#startupMarks, "startupMarks", STARTUP_MARKS_METHODS);
    if (this.#listenerCounter != null) {
      contracts.requireMethods(this.#listenerCounter, "listenerCounter", ["added", "removed"]);
    }
    const audio = new BrowserAudioAdapter();
    const clock = new GameClock();
    // Debug events and session diagnostics exist only when DEV composes them; production gets inactive ports.
    const debugEvents = this.#createDebugEvents == null
      ? new InactiveDebugEvents()
      : this.#createDebugEvents({ documentTarget: this.#documentTarget, isEnabled: () => devFlags.isDebugEnabled() });
    const diagnostics = this.#createGameDiagnostics == null
      ? new InactiveGameDiagnostics()
      : this.#createGameDiagnostics({ devFlags, debugEvents, documentTarget: this.#documentTarget });
    contracts.requireMethods(debugEvents, "debugEvents", ["on", "emit", "clear"]);
    contracts.requireMethods(diagnostics, "diagnostics",
      ["isDebugEnabled", "emit", "on", "subscribeHookedFishRuntimeUpdated", "dispose"]);
    let runtime;
    try {
      runtime = await this.create(
        canvas,
        canvasMetrics,
        clock,
        debugEvents,
        devFlags,
        audio,
      );
    } catch (error) {
      stageLayout?.dispose();
      throw error;
    }
    if (stageLayout) {
      stageLayout.attachInventory(runtime.inventoryUI);
      runtime.stageLayout = stageLayout;
    }
    return new GameApplication({
      messages: FISHING_MESSAGES,
      canvas,
      canvasMetrics,
      config: this.#runtimeConfig,
      compositionRoot: this,
      devFlags,
      audio,
      debugEvents,
      diagnostics,
      listeners: new EventLifecycle(this.#listenerCounter),
      windowTarget: this.#windowTarget,
      documentTarget: this.#documentTarget,
      runtime,
      clock,
      fishDatabase: FISH_DB,
      logger: new ConsoleLogger(),
    });
  }

  async create(canvas, canvasMetrics, clock, debugEvents, devFlags, audio) {
    // Cold startup owns resources until successful construction transfers them to Application.
    const owned = [];
    const own = value => { if (value != null) owned.push(value); return value; };
    try {

    // The item stat override table reaches the Domain policy only through composition.
    const itemStatOverridePolicy = new ItemStatOverridePolicy({ config: this.#config.itemStatOverrides });
    const effectiveItemStatsResolver = new EffectiveItemStatsResolver({ overridePolicy: itemStatOverridePolicy });
    this.#validateRarityConfiguration();
    this.#validateItemProgressionConfiguration(effectiveItemStatsResolver);
    this.#validateDegradationColorConfiguration();
    const contracts = new DependencyContractValidator({
      stage: "bootstrap",
      consumer: "GameCompositionRoot.create",
    });
    // One image store for the 2D passes and the WebGL scene's textures (spec 105 D2).
    const imageAssets = new ImageAssetProvider();
    contracts.requireMethods(imageAssets, "imageAssets", ["preload", "tryGet"]);
    // Config styles first: the scene and the 2D canvas draw the fight areas with one resolver (spec 107).
    const {
      rarityVisualResolver, degradationColorResolver, hudStyleResolver, fightAreaStyleResolver,
      outcomeStyleResolver,
    } = this.#composeStyleResolvers();
    // The scene layer before the 2D surface: its mode decides whether the 2D canvas is transparent (spec 104 D6).
    const { sceneLayer, sceneRouter, transparentCanvas } = composeSceneLayer({ config: this.#config,
      modeOverride: this.#sceneMode, documentTarget: this.#documentTarget, gameCanvas: canvas, canvasMetrics,
      images: imageAssets, clock, fightAreaStyles: fightAreaStyleResolver, probe: this.#frameProbe,
      logger: new ConsoleLogger() });
    own(sceneLayer);
    contracts.requireMethods(sceneLayer, "sceneLayer", SCENE_LAYER_METHODS);
    const {
      surface, primitives, assetPreloadCoordinator, locationAssetLoader, locationDebugMapBuilder,
    } = this.#composeRenderingInfrastructure({ canvas, canvasMetrics, contracts, transparentCanvas, imageAssets });
    const {
      itemFreshnessResolver, itemChargeResolver, itemRarityResolver, itemProgressionResolver, itemConditionResolver,
      itemProgressionDebugProvider, itemRarityDomAdapter, itemProgressionDomAdapter, itemConditionDomAdapter,
    } = this.#composeItemModels({
      rarityVisualResolver, effectiveItemStatsResolver, contracts, degradationColorResolver,
    });
    const { victoryLayoutResolver, victoryActionGestureResolver } = this.#composeOutcomeInteraction({
      contracts,
    });
    const {
      baitEffectivenessCatalogResolver, hookedFishProfileSynchronizer, fishRarityResolver,
      fishAnomalyVariantResolver, fishVisualVariantResolver, baitEffectivenessResolver,
    } = this.#composeFishModels({ contracts, itemFreshnessResolver });
    const rodAnimation = own(composeRodAnimation({
      windowTarget: this.#windowTarget, documentTarget: this.#documentTarget, config: this.#runtimeConfig,
      scene: { layer: sceneLayer, router: sceneRouter, webgl: transparentCanvas },
    }));
    const boatAnimation = own(composeBoatAnimation({
      windowTarget: this.#windowTarget, documentTarget: this.#documentTarget,
      scene: { layer: sceneLayer, router: sceneRouter, webgl: transparentCanvas },
    }));
    contracts.requireMethods(rodAnimation.controller, "rodAnimation",
      ["setSkin", "advance", "getAnchor", "renderScene", "getStatus", "setSpineEnabled", "getClips", "setClipEnabled",
        "getBones", "setBoneSetup", "exportSkeleton", "dispose"]);
    const { pipeline } = this.#rendering.composePipeline({
      surface, imageAssets, primitives, hudStyleResolver, fightAreaStyleResolver, contracts,
      rarityVisualResolver, rodAnimation: rodAnimation.controller, sceneRouter,
    });
    // The game clock comes before the location: startup loads only the background phase of the current game time
    // (spec 157 R4).
    const gameTimeClock = composeGameTime({
      storage: this.#windowTarget.localStorage,
      now: () => Date.now(),
      initialHours: this.#config.debug?.initialTime,
      timeScale: this.#config.debug?.timeScale || 1,
    });
    const { projector, locId, rng, locationResources, locCfg, location, locationMap, waterMetricSource, getWaterMetric } = await this.#composeLocation({
      assetPreloadCoordinator, locationAssetLoader, startupHours: gameTimeClock.getHours(),
    });
    this.#startupMarks.mark(STARTUP_STAGES.location);
    const {
      inventory, BrowserTimeoutScheduler, castDistanceCalculator, physicsConfig,
    } = await this.#composePlayerInventory({
      own, itemRarityResolver, itemProgressionResolver, itemConditionResolver, itemFreshnessResolver,
      itemChargeResolver, baitEffectivenessCatalogResolver, effectiveItemStatsResolver, itemStatOverridePolicy,
    });
    const liveBait = composeLiveBait({ storage: this.#windowTarget.localStorage,
      config: this.#config.liveBait, fishDb: FISH_DB, rng,
      synchronizeInventory: (items) => inventory.synchronizeAquariumFeed(items) });
    const onFeedStorage = (event) => { if (event.key === "fishing_game_player_inventory_v2") liveBait.synchronizeInventory(); };
    this.#windowTarget.addEventListener("storage", onFeedStorage);
    own({ dispose: () => this.#windowTarget.removeEventListener("storage", onFeedStorage) });
    // A new fishing session has no in-flight cast to own a persisted hook fish.
    liveBait.recoverInterruptedCast();
    const liveBaitCandidate = new LiveBaitBaitCandidatePort(liveBait, FISH_DB);
    const liveBaitMotionProfiles = new LiveBaitMotionProfileResolver(FISH_DB, this.#config.liveBait.motionSourceSpeciesId);
    const createLiveBaitMotion = (speciesId) => {
      const physics = liveBaitMotionProfiles.resolve(speciesId);
      return physics ? new LiveBaitMotionAdapter({ physics, multiplier: this.#config.liveBait.motionMultiplier,
        rng }) : null;
    };
    const { chumConfigObj, eq } = this.#composeChumConfig({ inventory, effectiveItemStatsResolver });
    this.#sessionServices = Object.freeze({ liveBait, gameTime: gameTimeClock });
    // Spec 128: the float's rocking, shared by the render model and the DEV scene section (its live status).
    const floatRocking = new FloatWaveRocking({ getSettings: () => this.#config.canvas?.water });
    const { systems } = this.#composeWorldSystems({
      projector, locId, rng, locationResources, locCfg, locationMap, waterMetricSource, getWaterMetric, own, canvas, hookedFishProfileSynchronizer,
      itemProgressionDebugProvider, itemProgressionResolver, chumConfigObj, debugEvents, devFlags, fishRarityResolver,
      fishAnomalyVariantResolver, fishVisualVariantResolver, baitEffectivenessResolver, inventory, clock,
      gameTimeClock, rodAnimation: rodAnimation.controller, boatAnimation: boatAnimation.controller,
      scene: { layer: sceneLayer, router: sceneRouter, floatRocking },
    });
    this.#composeInventoryUi({
      inventory, systems, own, BrowserTimeoutScheduler, itemRarityDomAdapter, rarityVisualResolver,
      itemProgressionDomAdapter, itemConditionDomAdapter, degradationColorResolver, castDistanceCalculator,
      physicsConfig, liveBait, imageAssets,
    });
    this.#startupMarks.mark(STARTUP_STAGES.inventory);
    const {
      world, fishing, equipment, net, castPenalty, depthUI, timeUI, holdUI, equipmentRules, baitRules,
      castRules, biteRules, chumRules, boatRules, playerCastRules,
    } = this.#composeRulesAndWorld({
      castDistanceCalculator, systems, location, canvasMetrics, clock, devFlags, debugEvents, eq,
      physicsConfig, own, gameTimeClock, imageAssets,
    });
    // Spec 104 D8, spec 105 D2: the scene's warm-up frame and the upload of every background phase of the location
    // happen during loading, not in the first frames of play.
    // Spec 127: the float art (every float's scene image and tip glow) loads and uploads here too; an image that fails
    // to load leaves that float a bar.
    const floatArt = [...new Set(Object.values(this.#itemDb?.floats || {}).flatMap((float) =>
      [float.skin?.scene?.src, float.skin?.scene?.glow?.src]).filter(Boolean))];
    await imageAssets.preload(floatArt.map((src) => ({ id: src, src }))).catch(() => null);
    // Spec 157 R6: last of the deferred loads, the page's lazy UI images (closed inventory, hidden toolbar buttons),
    // one at a time, so opening the inventory finds them in the cache.
    const lazyImages = own(new LazyImageWarmUp({ documentRef: this.#documentTarget }));
    this.#deferredAssetLoads.push(() => { void lazyImages.warm(); });
    await sceneLayer.whenReady();
    sceneLayer.prepare([...Object.values(systems.map.getBackgroundRenderData().assetIds).filter(Boolean), ...floatArt]);
    this.#startupMarks.mark(STARTUP_STAGES.scene);
    return {
      liveBait,
      liveBaitCandidate,
      createLiveBaitMotion,
      location,
      rng,
      projector: systems.projector,
      map: systems.map,
      env: systems.env,
      input: systems.input,
      ui: systems.ui,
      chum: systems.chum,
      devicePower: systems.devicePower,
      radio: systems.radio,
      bite: systems.bite,
      inventory: systems.inventory,
      inventoryUI: systems.inventoryUI,
      keepnetUI: systems.keepnetUI,
      world,
      rendering: {
        surface,
        imageAssets,
        assetPreloadCoordinator,
        locationAssetLoader,
        pipeline,
        sceneLayer,
        sceneRouter,
        locationDebugMapBuilder,
        hudStyleResolver,
        fightAreaStyleResolver,
        outcomeStyleResolver,
        rarityVisualResolver,
        victoryLayoutResolver,
        rodAnimation,
        boatAnimation,
        floatRocking,
      },
      interaction: {
        victoryActionGestureResolver,
      },
      fishRarityResolver,
      itemRarityResolver,
      fishAnomalyVariantResolver,
      fishVisualVariantResolver,
      fishing,
      equipment,
      net,
      castPenalty,
      depthUI,
      timeUI,
      holdUI,
      debugEvents,
      devFlags,
      audio,
      canvasMetrics,
      castDistanceCalculator,
      equipmentRules,
      baitRules,
      castRules,
      biteRules,
      chumRules,
      boatRules,
      playerCastRules,
    };
  
    } catch (error) {
      for (let index = owned.length - 1; index >= 0; index--) {
        try { owned[index].dispose?.(); } catch (cleanupError) { new ConsoleLogger().error(cleanupError); }
      }
      throw error;
    }
}

  // Canvas surface, image assets, offscreen canvases and the location asset loaders.
  #composeRenderingInfrastructure({ canvas, canvasMetrics, contracts, transparentCanvas, imageAssets }) {
    const surface = new Canvas2DSurface(canvas, {
      contextAttributes: { alpha: transparentCanvas },
      resolution: canvasMetrics,
    });
    const primitives = new CanvasPrimitives(surface);
    const canvasFactory = new OffscreenCanvasFactory();
    const assetPreloadCoordinator = new AssetPreloadCoordinator({
      imageAssets,
      resolveFishImage: fishDisplayImagePath,
      locationsConfig: this.#config.locations,
      diagnostics: this.#readRenderDiagnostics(),
    });
    contracts.requireMethods(assetPreloadCoordinator, "assetPreloadCoordinator", [
      "preloadApplicationAssets",
      "preloadLocation",
      "preloadFishingAssets",
      "preloadVictoryAssets",
    ]);
    const locationAssetLoader = new LocationAssetLoader({
      imageAssets,
      canvasFactory,
    });
    contracts.requireMethods(locationAssetLoader, "locationAssetLoader", [
      "load",
    ]);
    const locationDebugMapBuilder = this.#createOptionalDiagnostic(
      this.#createLocationDebugMapBuilder, "locationDebugMapBuilder", [{ canvasFactory }], ["build"],
    );
    return { surface, primitives, assetPreloadCoordinator, locationAssetLoader, locationDebugMapBuilder };
  }

  // Config-driven HUD, fight area, outcome, rarity and degradation styles.
  #composeStyleResolvers() {
    const hudStyleResolver = new HudStyleResolver({
      hudStylesProvider: () => this.#config.ui?.hudStyles || {},
    });
    const fightAreaStyleResolver = new FightAreaStyleResolver({
      configProvider: () => this.#config.ui?.catchZone || {},
    });
    const outcomeStyleResolver = new OutcomeStyleResolver({
      configProvider: () => this.#config.ui?.victory || {},
    });
    const rarityAnimationResolver = new RarityAnimationResolver();
    const rarityVisualResolver = new RarityVisualResolver({
      configProvider: () => this.#config.rarity?.visual || {},
      animationResolver: rarityAnimationResolver,
    });
    const degradationColorResolver = new DegradationColorResolver({
      configProvider: () => this.#config.degradationColors || {},
    });
    return { rarityVisualResolver, degradationColorResolver, hudStyleResolver, fightAreaStyleResolver, outcomeStyleResolver };
  }

  // Item rarity, condition, freshness and progression read models with their DOM adapters.
  #composeItemModels({
    rarityVisualResolver, effectiveItemStatsResolver, contracts, degradationColorResolver,
  }) {
    const itemRarityStrategyRegistry = new ItemRarityStrategyRegistry([
      new AuthoredItemRarityStrategy(),
    ]);
    const itemRarityResolver = new ItemRarityResolver({
      strategyRegistry: itemRarityStrategyRegistry,
    });
    const itemRarityDomAdapter = new ItemRarityDomAdapter({
      visualResolver: rarityVisualResolver,
    });
    const metricCapabilityProvider = (capabilityId) => (item) => {
      const groupId = item?.progressionProfile?.groupId;
      return this.#config.itemProgression?.groups?.[groupId]?.[capabilityId];
    };
    const itemConditionResolver = new ItemConditionResolver({
      profileProvider: metricCapabilityProvider("condition"),
      descriptorFactory: (values) => new ItemConditionDescriptor(values),
    });
    const itemFreshnessResolver = new ItemFreshnessResolver({
      profileProvider: metricCapabilityProvider("freshness"),
      descriptorFactory: (values) => new ItemFreshnessDescriptor(values),
    });
    // Spec 143: a battery's charge, the bounded metric of its "power.battery" group.
    const itemChargeResolver = new ItemBoundedMetricResolver({
      capabilityId: "charge",
      profileProvider: metricCapabilityProvider("charge"),
      descriptorFactory: (values) => new ItemConditionDescriptor(values),
    });
    const itemConditionDomAdapter = new ItemConditionDomAdapter();
    const itemMetricStrategyRegistry = new ItemMetricStrategyRegistry([
      new NumericStatMetricStrategy(),
      new DerivedStatMetricStrategy(),
      new TargetRangeMetricStrategy(),
      new CompositeMetricStrategy(),
    ]);
    const itemCatalogBaselineRegistry = new ItemCatalogBaselineRegistry({
      itemDb: this.#itemDb || {},
      strategyRegistry: itemMetricStrategyRegistry,
      effectiveStatsResolver: effectiveItemStatsResolver,
      logger: new ConsoleLogger(),
    });
    const itemRatingResolver = new ItemRatingResolver({
      strategyRegistry: itemMetricStrategyRegistry,
      baselineRegistry: itemCatalogBaselineRegistry,
    });
    const itemProgressionResolver = new ItemProgressionResolver({
      configProvider: () => this.#config.itemProgression || {},
      ratingResolver: itemRatingResolver,
      ratingTierResolver: new ItemRatingTierResolver(),
      qualityResolver: new ItemQualityResolver(),
      capacityResolver: new ItemCapacityResolver({
        effectiveStatsResolver: effectiveItemStatsResolver,
        messages: INVENTORY_RULE_MESSAGES,
      }),
      baselineRegistry: itemCatalogBaselineRegistry,
      effectiveStatsResolver: effectiveItemStatsResolver,
    });
    const itemProgressionVisualResolver = new ItemProgressionVisualResolver({
      rarityVisualResolver,
    });
    const itemProgressionDomAdapter = new ItemProgressionDomAdapter({
      visualResolver: itemProgressionVisualResolver,
      labels: ITEM_PROGRESSION_LABELS,
    });
    const itemProgressionDebugProvider = this.#createOptionalDiagnostic(
      this.#createItemProgressionDebugSnapshotProvider, "itemProgressionDebugProvider", [{
        itemDb: this.#itemDb || {},
        progressionResolver: itemProgressionResolver,
        effectiveStatsResolver: effectiveItemStatsResolver,
      }], ["getSnapshots"],
    );
    contracts.requireMethods(itemRarityResolver, "itemRarityResolver", [
      "resolve",
    ]);
    contracts.requireMethods(
      degradationColorResolver,
      "degradationColorResolver",
      ["resolvePercent"],
    );
    contracts.requireMethods(itemRarityDomAdapter, "itemRarityDomAdapter", [
      "apply",
      "clear",
    ]);
    contracts.requireMethods(itemConditionResolver, "itemConditionResolver", [
      "resolve",
    ]);
    contracts.requireMethods(itemFreshnessResolver, "itemFreshnessResolver", [
      "resolve",
    ]);
    contracts.requireMethods(
      itemConditionDomAdapter,
      "itemConditionDomAdapter",
      ["apply", "clear"],
    );
    contracts.requireMethods(
      itemProgressionResolver,
      "itemProgressionResolver",
      ["resolve", "invalidate"],
    );
    contracts.requireMethods(
      itemProgressionDomAdapter,
      "itemProgressionDomAdapter",
      ["apply", "clear"],
    );
    return { itemFreshnessResolver, itemChargeResolver, itemRarityResolver, itemProgressionResolver, itemConditionResolver, itemProgressionDebugProvider, itemRarityDomAdapter, itemProgressionDomAdapter, itemConditionDomAdapter };
  }

  // Victory layout and the victory action gesture.
  #composeOutcomeInteraction({ contracts }) {
    const victoryLayoutResolver = new VictoryLayoutResolver({
      diagnostics: this.#readRenderDiagnostics(),
    });
    contracts.requireMethods(victoryLayoutResolver, "victoryLayoutResolver", [
      "resolve",
    ]);
    const victoryActionGestureResolver = new VictoryActionGestureResolver();
    contracts.requireMethods(
      victoryActionGestureResolver,
      "victoryActionGestureResolver",
      ["resolve"],
    );
    return { victoryLayoutResolver, victoryActionGestureResolver };
  }

  // Fish rarity, visual and anomaly variants, bait effectiveness and the DEV hooked fish synchronizer.
  #composeFishModels({ contracts, itemFreshnessResolver }) {
    const fishRarityResolver = new FishRarityResolver(
      this.#config.rarity,
    );
    contracts.requireMethods(fishRarityResolver, "fishRarityResolver", [
      "resolve",
      "resolveLevel",
      "resolveForLevel",
      "resolveRarity",
    ]);
    const fishVisualVariantResolver = new FishVisualVariantResolver({
      noneAnomalyIds: this.#config.rarity?.fish?.noneAnomalyIds,
    });
    const fishAnomalyVariantResolver = new FishAnomalyVariantResolver({
      noneAnomalyId: "none",
    });
    const baitEffectivenessResolver = new BaitEffectivenessResolver({
      gradePolicy: new BaitEffectivenessGradePolicy(),
      knowledgePolicy: new AlwaysKnownBaitEffectivenessPolicy(),
      freshnessResolver: itemFreshnessResolver,
      freshnessModifier: new BaitFreshnessModifier(),
      descriptorFactory: (values) => new BaitEffectivenessDescriptor(values),
    });
    const baitEffectivenessCatalogResolver =
      new BaitEffectivenessCatalogResolver({
        fishDatabase: this.#config.spawns,
        resolver: baitEffectivenessResolver,
      });
    contracts.requireMethods(
      baitEffectivenessResolver,
      "baitEffectivenessResolver",
      ["resolve", "resolveMultiplier", "resolveBestMultiplier", "resolveBestMatch"],
    );
    contracts.requireMethods(
      baitEffectivenessCatalogResolver,
      "baitEffectivenessCatalogResolver",
      ["resolve"],
    );
    const hookedFishProfileSynchronizer = this.#createOptionalDiagnostic(
      this.#createHookedFishProfileSynchronizer, "hookedFishProfileSynchronizer", [{
        fishRarityResolver,
        fishVisualVariantResolver,
      }], ["synchronize"],
    );
    return { baitEffectivenessCatalogResolver, hookedFishProfileSynchronizer, fishRarityResolver, fishAnomalyVariantResolver, fishVisualVariantResolver, baitEffectivenessResolver };
  }


  // Current location, RNG, preloaded location resources and the viewport projector.
  // startupHours: the game time at startup; its background phases (base, and the overlay at dusk or dawn) load before
  // the game starts, the others right after it (spec 157 R4, spec 083 decision 3).
  async #composeLocation({ assetPreloadCoordinator, locationAssetLoader, startupHours }) {
    const location = new CurrentLocation(
      this.#config.locations,
      this.#config.player?.locationId,
    );
    const rng = new SeededRng(
      this.#config.debug?.seed ?? this.#config.rng?.seed,
    );
    const locId = location.id;
    const locCfg = location.config;
    const blend = backgroundTimeBlend(startupHours, { evening: 0, night: 0 });
    const layers = timeOfDayLayers(blend.evening, blend.night, {});
    const phases = [layers.base, layers.overlay].filter(Boolean);
    await assetPreloadCoordinator.preloadLocation(locId, { phases });
    const locationResources = await locationAssetLoader.load(
      locId,
      locCfg,
      this.#config.locations,
      { phases },
    );
    // First of the deferred loads: the other phases; the scene uploads each one in the frame after it arrives.
    this.#deferredAssetLoads.push(() => { void locationResources.loadDeferredBackground(); });
    // Session starts vary even when gameplay uses a fixed seed; sampling never advances gameplay RNG.
    const locationMap = new LocationMap(locId, this.#config.locations, rng, locationResources, { next: () => Math.random() });
    const waterMetricResolver = new LocationWaterMetricResolver({
      pixelsPerMeter: new CastDistanceCalculator(this.#config).pixelsPerMeter, logger: new ConsoleLogger(),
    });
    const waterMetricSource = new LocationWaterMetricSource({ map: locationMap, getLocations: () => this.#config.locations,
      resolver: waterMetricResolver });
    const getWaterMetric = () => waterMetricSource.current();
    const worldPerspective = new WorldPerspective({ getWaterMetric });
    const projector = new ViewportProjector(
      this.#config.locations,
      locId,
      worldPerspective.getPerspective.bind(worldPerspective),
    );
    return { projector, locId, rng, locationResources, locCfg, location, locationMap, waterMetricSource, getWaterMetric };
  }

  // Physics-backed line and cast rules and the player's inventory.
  async #composePlayerInventory({
    own, itemRarityResolver, itemProgressionResolver, itemConditionResolver, itemFreshnessResolver,
    itemChargeResolver, baitEffectivenessCatalogResolver, effectiveItemStatsResolver, itemStatOverridePolicy,
  }) {
    const physicsConfig =
      this.#config.fightPhysicsConfig ||
      new FightPhysicsConfigAdapter(this.#config);
    const castDistanceCalculator = new CastDistanceCalculator(this.#config);
    const lineRules = new LineCompatibilityRules(
      physicsConfig?.getLineConfig?.() || {},
      { messages: INVENTORY_RULE_MESSAGES },
    );
    const runtimeConfigProvider = new InventoryRuntimeConfigProvider(
      this.#runtimeConfig,
      physicsConfig,
    );
    const { createRandomInventoryId } = await this.#loadRandomInventoryId();
    const { BrowserEventTargetAdapter } = await this.#loadBrowserEventTargetAdapter();
    const { BrowserTimeoutScheduler } = await this.#loadBrowserTimeoutScheduler();
    const { getInventoryAssemblyProfileConfig } = await this.#loadInventoryAssemblyProfileConfig();
    const inventory = own(createPlayerInventory({
      itemDB: this.#itemDb,
      playerConfig: this.#config.player,
      events: new InventoryEventBridge(new BrowserEventTargetAdapter(this.#documentTarget)),
      castDistanceCalculator,
      lineRules,
      runtimeConfigProvider,
      itemRarityResolver,
      itemProgressionResolver,
      itemConditionResolver,
      itemFreshnessResolver,
      itemChargeResolver,
      baitEffectivenessCatalogResolver,
      effectiveStatsResolver: effectiveItemStatsResolver,
      itemStatOverridePolicy,
      cache: this.#storageCache,
      assemblyProfileConfig: getInventoryAssemblyProfileConfig(),
      makeRandomId: createRandomInventoryId,
      now: () => Date.now(),
    }));
    return { inventory, BrowserTimeoutScheduler, castDistanceCalculator, physicsConfig };
  }

  // Equipped items at startup and the chum service catalog projected through effective stats.
  #composeChumConfig({ inventory, effectiveItemStatsResolver }) {
    const eq = inventory.getEquipped();
    const chumConfigObj = { baits: {}, deliveryMethods: {} };
    const bootstrapItemDatabase = new ItemDatabase(this.#itemDb);
    const bootstrapStatsResolver = effectiveItemStatsResolver;
    const projectDefinition = (itemId) => {
      const definition = bootstrapItemDatabase.getItemData(itemId);
      if (!definition) return null;
      return {
        ...definition,
        effectiveStats: bootstrapStatsResolver.resolve({ definition }),
      };
    };
    if (this.#itemDb && this.#itemDb.chums) {
      for (const [key, item] of Object.entries(this.#itemDb.chums)) {
        chumConfigObj.baits[key] = projectDefinition(item.id);
      }
    }
    if (this.#itemDb && this.#itemDb.deliveryMethods) {
      const firstBoatKey = Object.keys(this.#itemDb.deliveryMethods)[0];
      if (firstBoatKey) {
        const boatDefinition = this.#itemDb.deliveryMethods[firstBoatKey];
        chumConfigObj.deliveryMethods.boat = projectDefinition(
          boatDefinition.id,
        );
      }
    }
    return { chumConfigObj, eq };
  }

  // Map, environment, input, game controls, device power, chum service and bite system; the inventory reads the boat's
  // charge from the battery in its slot (spec 143).
  #composeWorldSystems({
    projector, locId, rng, locationResources, locCfg, locationMap, waterMetricSource, getWaterMetric, own, canvas, hookedFishProfileSynchronizer,
    itemProgressionDebugProvider, itemProgressionResolver, chumConfigObj, debugEvents, devFlags, fishRarityResolver,
    fishAnomalyVariantResolver, fishVisualVariantResolver, baitEffectivenessResolver, inventory, clock,
    gameTimeClock, rodAnimation, boatAnimation, scene,
  }) {
    const uiLogger = new ConsoleLogger();
    // Spec 143: battery consumption; pending consumption is written when the page hides or closes.
    const devicePower = own(new DevicePowerService({ batteries: inventory, config: () => this.#config.power || {} }));
    own(new BrowserPageHideListener({ documentRef: this.#documentTarget, windowRef: this.#windowTarget,
      onHide: () => devicePower.flush() }));
    const systems = {
      projector,
      devicePower,
      map: locationMap,
      waterMetricSource,
      env: new EnvironmentSystem(
        locCfg,
        this.#config.debug?.initialTime ?? 12,
        rng,
        this.#config.spawns,
        gameTimeClock,
      ),
      input: own(new InputController(canvas, Number(this.#config.ui?.rod?.x) || null, {
        runtimeConfig: this.#runtimeConfig,
        listeners: new EventLifecycle(this.#listenerCounter),
        fightInputActionComposer: new FightInputActionComposer(),
        ...(this.#stageLayout ? { getOriginX: () => this.#stageLayout.originX } : {}),
      })),
      ui: own(new GameControls(
        this.#config,
        this.#createUiLifecycle(own(this.#createOptionalDiagnostic(
          this.#createDevTools, "devTools", [this.#config, hookedFishProfileSynchronizer, {
            itemProgressionDebugProvider,
            itemProgressionResolver,
            // DEV item grant; DevTools exist only in Development, so production never calls it.
            grantCatalogItem: (itemId, quantity) => inventory.grantCatalogItem(itemId, quantity),
            // DEV Spine section (spec 099 Phase 4, spec 150): rod and boat controllers' DEV ports.
            rodSpine: rodAnimation.controller ?? rodAnimation,
            boatSpine: boatAnimation.controller ?? boatAnimation,
            // DEV radio section (spec 142): status and discharging through the ordinary consumption path.
            radio: {
              getStatus: () => systems.radio.getStatus(),
              batteryPercent: () => {
                const batteryId = inventory.getEquipped()?.radioBattery?.instanceId;
                return batteryId ? systems.devicePower.read(batteryId).percent : null;
              },
              discharge: (target) => {
                const equipped = inventory.getEquipped();
                const batteryId = equipped?.radioBattery?.instanceId;
                const stored = batteryId ? inventory.readBattery(batteryId) : null;
                if (!stored) return;
                const units = Math.max(0, (systems.devicePower.read(batteryId).percent - target) / 100 * stored.capacityUnits);
                systems.devicePower.consume({ deviceId: "dev", batteryInstanceId: batteryId, unitsPerSecond: units, seconds: 1 });
                systems.devicePower.flush();
                systems.radio.update();
              },
            },
            // DEV scene section (spec 104 D5): the scene layer's DEV methods and the router's runtime switch.
            scene,
          }], ["dispose"],
        ))),
        { cache: this.#storageCache, labels: HUD_LABELS,
          landingNetArt: this.#itemDb.nets.net_basic.skin.thumbnail,
          fullscreenControl: own(new FullscreenControl({ documentRef: this.#documentTarget,
            mountNode: this.#uiSurface?.mountRoot || this.#documentTarget.body, label: HUD_LABELS.fullscreen,
            onError: error => uiLogger.warn(`Error attempting to enable full-screen mode: ${error.message}`) })),
          mountNode: this.#uiSurface?.mountRoot || this.#documentTarget.body,
          toolbarMountNode: this.#toolbarMountNode || this.#uiSurface?.mountRoot || this.#documentTarget.body,
          netMountNode: this.#tackleMountNode || this.#uiSurface?.mountRoot || this.#documentTarget.body,
          documentRef: this.#documentTarget, frameScheduler: this.#windowTarget },
      )),
      chum: own(new ChumService(locId, chumConfigObj, getWaterMetric, {
        cache: this.#storageCache,
        configEvents: this.#documentTarget,
        rng,
        now: () => clock.realNow,
        gameTime: gameTimeClock,
        legacyTimeScale: this.#config.debug?.timeScale,
        devicePower,
        onBoatReturned: (context) =>
          inventory.handleBoatReturned?.(context),
        // Spec 151: the cargo slot is spent at the drop, a lost boat leaves the inventory with its battery and cargo,
        // and a saved boat is restored from the equipped boat item.
        consumeBoatChum: (slotIndex) => inventory.consumeEquipped(`deliveryChums_${slotIndex}`, 1),
        onBoatLost: ({ rootInstanceId }) => inventory.consumeItem(rootInstanceId, 1),
        isInertialMotion: () => this.#config.ui?.boat?.inertialMotion === true,
        // Spec 154: boat routes on the current map, with the boat physics' water test (GameWorld.checkWater).
        routePlanner: new BoatRoutePlanner({
          getRevision: () => locationMap.getRevision(),
          getCellSize: () => this.#config.locations.cellSize,
          getBounds: () => locationMap.getCastableBoundsVirtual(this.#config.locations.cellSize),
          isWater: (x, y) => !!locationMap.getCellAtVirtualPos(x, y, this.#config.locations.cellSize) &&
            locationMap.isCastableAt(x, y),
        }),
        findBoatItem: (rootInstanceId) => {
          const boatItem = inventory.getEquipped().delivery;
          return boatItem?.instanceId === rootInstanceId ? boatItem : null;
        },
      })),
      bite: new BiteSystem(
        this.#config.spawns,
        this.#config,
        rng,
        debugEvents,
        fishRarityResolver,
        fishAnomalyVariantResolver,
        fishVisualVariantResolver,
        baitEffectivenessResolver,
        devFlags,
      ),
      inventory,
    };
    // Spec 151 D5: the inventory leaves a boat on the water unchanged (its slot, battery and cargo).
    inventory.setBusyDevices({ rootInstanceIds: () => systems.chum.rootInstanceIdsAway() });
    systems.radio = this.#composeRadio({ own, inventory, devicePower, weather: systems.env });
    // A device card's charge is its battery's (null without a battery: no bar); a battery card reads its live charge directly.
    inventory.setDeviceChargeProvider?.((deviceItem) => {
      const batteryId = deviceItem?.itemType === "battery"
        ? deviceItem?.instanceId
        : devicePower.batteryOf(deviceItem?.instanceId);
      if (!batteryId) return null;
      return { current: devicePower.read(batteryId).percent, maximum: 100 };
    });
    return { systems };
  }

  // Spec 142: the field radio receiver (stations, stream player, preferences, region), its HUD indicator under the
  // clock (a tap opens the radio's editor) and the page visibility policy.
  #composeRadio({ own, inventory, devicePower, weather }) {
    const windowRef = this.#windowTarget;
    const config = () => this.#config.radio || {};
    let radio = null;
    // The radio's own random numbers (noise, crackle, dropouts, the record's surface); never the gameplay RNG.
    const seed = new Uint32Array(1);
    windowRef.crypto?.getRandomValues?.(seed);
    const radioRng = new SeededRng(seed[0] || 0x5eed);
    const audioContexts = own(new SharedAudioContextProvider({ windowRef }));
    const player = own(new RadioStreamPlayer({ documentRef: this.#documentTarget, audioContexts, scheduler: windowRef,
      config, onState: (state, info) => radio?.handlePlayerState(state, info),
      effects: new RadioEffectsChain({ config: () => config().effects || {}, rng: radioRng,
        fetchRef: windowRef.fetch ? windowRef.fetch.bind(windowRef) : null }) }));
    const noise = own(new RadioNoiseSource({ audioContexts, getOutput: () => player.output, getGate: () => player.streamGate, rng: radioRng }));
    radio = own(new RadioReceiverService({
      equipment: inventory,
      power: devicePower,
      stations: new RadioBrowserStationSource({ fetchRef: windowRef.fetch.bind(windowRef), config, scheduler: windowRef }),
      player,
      preferences: new RadioPreferencesLocalStore({ cache: this.#storageCache }),
      region: new BrowserRegionResolver({ navigatorRef: windowRef.navigator, config,
        timeZone: () => windowRef.Intl?.DateTimeFormat?.().resolvedOptions?.().timeZone || "" }),
      config,
      secureOnly: windowRef.location?.protocol === "https:",
      weather,
      noise,
      rng: radioRng,
      scheduler: windowRef,
    }));
    own(new MonotonicIntervalTicker({ windowRef, intervalMs: config().tickMs, now: () => windowRef.performance.now(),
      onTick: (seconds) => radio.tick(seconds) }));
    own(new BrowserPageHideListener({ documentRef: this.#documentTarget, windowRef,
      onHide: () => radio.setPageHidden(true), onShow: () => radio.setPageHidden(false) }));
    const removeInventoryListener = inventory.onInventoryChanged(() => radio.update());
    own({ dispose: () => removeInventoryListener?.() });
    radio.update();
    own(new RadioHudIndicator({ documentRef: this.#documentTarget, radio, labels: RADIO_LABELS,
      mountNode: this.#uiSurface?.mountRoot || this.#documentTarget.body,
      onActivate: () => this.#radioEditorOpener?.() }));
    return radio;
  }

  // Inventory UI over the composed facade and item read-model adapters.
  #composeInventoryUi({
    inventory, systems, own, BrowserTimeoutScheduler, itemRarityDomAdapter, rarityVisualResolver,
    itemProgressionDomAdapter, itemConditionDomAdapter, degradationColorResolver, castDistanceCalculator,
    physicsConfig, liveBait, imageAssets,
  }) {
    const inventoryFacade = inventory.inventoryFacade;
    if (!inventoryFacade) {
      throw new Error("Inventory composition is required");
    }
    systems.inventoryUI = own(InventoryUiBootstrap.create({
      facade: inventoryFacade,
      radio: systems.radio,
      // DEV only: the main parameters of the enabled sound effects as sliders (TK-098); null in production.
      radioTuning: this.#createRadioEffectTuning?.({ config: () => this.#config.radio || {} }) || null,
      documentRef: this.#documentTarget,
      mountNode: this.#uiSurface?.mountRoot || this.#documentTarget.body,
      buttonMountNode: this.#toolbarMountNode || this.#uiSurface?.mountRoot || this.#documentTarget.body,
      uiSurface: this.#uiSurface,
      warningTimers: new BrowserTimeoutScheduler(),
      onAction: (action) => inventory.dispatchInventoryAction(action),
      rarityDomAdapter: itemRarityDomAdapter,
      rarityVisualResolver,
      progressionDomAdapter: itemProgressionDomAdapter,
      conditionDomAdapter: itemConditionDomAdapter,
      degradationColorResolver,
      balanceParameterResolver: new InventoryBalanceParameterResolver({
        castDistanceCalculator,
        retrieveSpeedCalculator: new ReelRetrieveSpeedCalculator(),
        reelConfig: physicsConfig?.getReelConfig?.() || {},
        physicsConfig: this.#config.physics,
        debugConfig: this.#config.debug?.inventory,
        rarityVisualResolver,
      }),
    }));
    this.#radioEditorOpener = () => {
      const status = systems.radio?.getStatus?.();
      const needsBatteryFeedback = status?.status === "no-battery" || !systems.radio?.hasPower?.();
      if (needsBatteryFeedback) {
        systems.inventoryUI?.openSlotEditor("radio", {
          feedbackSlotId: "battery",
          tone: "error",
          message: RADIO_LABELS.noPowerWarning,
        });
      } else {
        systems.inventoryUI?.openSlotEditor("radio");
      }
    };
    const keepnetUI = InventoryUiBootstrap.createKeepnet({ documentRef: this.#documentTarget,
      liveBait, inventoryUI: systems.inventoryUI, degradationColorResolver, uiSurface: this.#uiSurface,
      buttonMountNode: this.#toolbarMountNode || this.#uiSurface?.mountRoot || this.#documentTarget.body });
    if (keepnetUI) systems.keepnetUI = own(keepnetUI);
    const selector = own(composeInventorySelector({ documentRef: this.#documentTarget, windowRef: this.#windowTarget,
      uiSurface: this.#uiSurface, mountNode: this.#selectorMountNode || this.#uiSurface?.mountRoot || this.#documentTarget.body,
      inventoryUI: systems.inventoryUI, keepnetUI, config: this.#config, imageAssets, logger: new ConsoleLogger(),
      equipmentSource: inventory }));
    // The selector's artwork waits for the started game (spec 157 R11); its classic buttons stand in until then.
    this.#deferredAssetLoads.push(() => { void selector.loadArtwork(); });
    // Spec 157 TK-174: the classic shortcuts swap their sprite icons for the backpack and keepnet art.
    this.#deferredAssetLoads.push(() => { systems.inventoryUI.showShortcutArtwork(); keepnetUI?.showShortcutArtwork(); });
    // Spec 157 R5: the other keepnet fill stages warm up after the selector artwork the toolbar shows.
    if (keepnetUI) this.#deferredAssetLoads.push(() => { void InventoryUiBootstrap.preloadKeepnetStages(this.#documentTarget); });
    return {  };
  }

  // Gameplay rules, the game world, fishing controller and HUD widgets.
  #composeRulesAndWorld({
    castDistanceCalculator, systems, location, canvasMetrics, clock, devFlags, debugEvents, eq, physicsConfig, gameTimeClock,
    own, imageAssets,
  }) {
    const equipmentRules = new EquipmentRules(castDistanceCalculator, this.#config, INVENTORY_RULE_MESSAGES);
    const baitRules = new BaitRules();
    const castRules = new CastRules(equipmentRules);
    const biteRules = new BiteRules(baitRules);
    const chumRules = new ChumRules();
    const boatRules = new BoatRules();
    const playerCastRules = new PlayerCastRules(boatRules, equipmentRules);
    const world = new GameWorld({
      map: systems.map,
      env: systems.env,
      chum: systems.chum,
      projector: systems.projector,
      location,
      canvasMetrics,
      clock,
      locationConfig: this.#config.locations,
      waterMetricSource: systems.waterMetricSource,
      isZoneMotionPaused: () => devFlags.isEnabled("pauseDynamicZones"),
    });
    const equipment = new EquipmentService(systems.inventory);
    const fishing = new FishingController({
      inventory: systems.inventory,
      equipment,
      devFlags,
      equipmentRules,
      baitRules,
      debugEvents,
      logger: new ConsoleLogger(),
    });
    const net = new Net(
      eq.net || { active: false, maxWeight: 0, length: 10 },
      physicsConfig?.getDistanceConfig?.() || {},
    );
    const castPenalty = new CastPenalty();
    const mountNode = this.#uiSurface?.mountRoot || this.#documentTarget.body;
    const depthUI = own(composeDepthSelector({ documentRef: this.#documentTarget,
      mountNode: this.#depthMountNode || mountNode, uiSurface: this.#uiSurface, itemDb: this.#itemDb, imageAssets,
      deferLoad: (load) => this.#deferredAssetLoads.push(load) }));
    const timeUI = own(this.#createTimeDisplay
      ? this.#createTimeDisplay({ documentRef: this.#documentTarget, mount: mountNode, clock: gameTimeClock })
      : composeTimeDisplay({ documentRef: this.#documentTarget, mount: mountNode, clock: gameTimeClock }));
    const holdUI = own(new HoldCharges({ labels: HUD_LABELS, documentRef: this.#documentTarget, mountNode }));
    return { world, fishing, equipment, net, castPenalty, depthUI, timeUI, holdUI, equipmentRules, baitRules, castRules, biteRules, chumRules, boatRules, playerCastRules };
  }

  createApplicationServices({
    runtime,
    appPorts,
    config,
    clock,
    rng,
    devFlags,
    runtimeConfig,
    audio,
    debugEvents,
    canvasMetrics,
    biteEnvData,
  }) {
    // Cold startup owns resources until successful construction transfers them to Application.
    const owned = [];
    const own = value => { if (value != null) owned.push(value); return value; };
    try {

    const contracts = new DependencyContractValidator({
      stage: "bootstrap",
      consumer: "GameCompositionRoot.createApplicationServices",
    });
    const { fightService, castService, debugService } = this.#composeFishingServices({
      config, rng, clock, runtime, appPorts, debugEvents, devFlags, runtimeConfig,
    });

    const { biteEnvironmentService } = this.#composeBiteEnvironment({
      runtime, appPorts, clock, biteEnvData, config,
    });

    const castRodControl = new CastRodControl({ config, projector: runtime.projector, canvasMetrics,
      getBaseRodVirtualPos: appPorts.getBaseRodVirtualPos });
    const { stateMachine, stateDepsFactory } = this.#composeStateMachine({
      runtime, config, devFlags, audio, fightService, appPorts, rng, clock, own, castRodControl,
    });

    const { chumController } = this.#composeChumController({ own, runtime, clock, config, rng, appPorts });

    const { frameBuilder } = this.#rendering.composeFrameBuilders({
      runtime, config, canvasMetrics, appPorts, clock, contracts, fightService, devFlags,
    });
    const { renderCoordinator } = this.#rendering.composeCoordinator({
      stateMachine, frameBuilder, runtime, appPorts, contracts,
    });

    const loop = new GameLoop(
      clock,
      (dt) => appPorts.update(dt),
      () => appPorts.draw(),
      this.#gameLoopGuard,
      this.#frameProbe,
    );

    const viewportFacade = new GameViewportFacade({
      rodVisualOffsetSystem: new RodVisualOffsetSystem(),
      world: runtime.world,
      projector: runtime.projector,
      canvasMetrics,
      config,
      biteEnvironmentService,
      getCastRodScreenX: () => castRodControl.getScreenX(),
    });

    return {
      castService,
      castRodControl,
      fightService,
      debugService,
      biteEnvironmentService,
      viewportFacade,
      stateDepsFactory,
      stateMachine,
      chumController,
      renderCoordinator,
      loop,
      debugEvents,
    };
  
    } catch (error) {
      for (let index = owned.length - 1; index >= 0; index--) {
        try { owned[index].dispose?.(); } catch (cleanupError) { new ConsoleLogger().error(cleanupError); }
      }
      throw error;
    }
}

  // Casting and fight services and the optional DEV debug service.
  #composeFishingServices({ config, rng, clock, runtime, appPorts, debugEvents, devFlags, runtimeConfig }) {
    const { castService, fightService } = composeFishingServices({
      config,
      rng,
      clock,
      stepClock: () => clock.highResolutionNow(),
      devFlags,
      runtimeConfig,
      equipmentRules: runtime.equipmentRules,
      baitRules: runtime.baitRules,
      castDistanceCalculator: runtime.castDistanceCalculator,
      getRodVirtualPos: appPorts.getRodVirtualPos,
      getDynamicBounds: appPorts.getDynamicBounds,
      getWaterMetric: appPorts.getWaterMetric,
      castReadinessEvaluator: (equipment) =>
        runtime.inventory.evaluateCastReadiness?.(equipment),
      debugEvents,
      catchResolutionLogger: new ConsoleLogger(),
      fightLogger: new ConsoleLogger(),
      isCatchResolutionLogEnabled: this.#isCatchResolutionLogEnabled,
      // The DEV fight snapshot exists only when Development startup composes its builder.
      fightDiagnosticsBuilder: this.#createFightDiagnosticsBuilder == null ? null : this.#createFightDiagnosticsBuilder(),
    });

    const debugService = this.#createOptionalDiagnostic(
      this.#createDebugService, "debugService", [config], ["update"],
    );
    return { fightService, castService, debugService };
  }

  // Bite environment queries over the world, location and live bite data.
  #composeBiteEnvironment({ runtime, appPorts, clock, biteEnvData, config }) {
    const biteEnvironmentService = new BiteEnvironmentService({
      world: runtime.world,
      env: runtime.env,
      chum: runtime.chum,
      inventory: runtime.inventory,
      floatRef: appPorts.getFloat,
      clock,
      castPenalty: runtime.castPenalty,
      equipmentRules: runtime.equipmentRules,
      getCurrentHookDepth: appPorts.getCurrentHookDepth,
      getCastStartTime: appPorts.getCastStartTime,
      getDayOfWeek: appPorts.getDayOfWeek,
      getTimeScale: () => config.debug?.timeScale || 1,
      getGameStateName: appPorts.getGameStateName,
      consumeExpiredFeederChum: (eq) =>
        runtime.fishing.consumeExpiredFeederChum(eq),
      biteEnvData,
    });
    return { biteEnvironmentService };
  }

  // Game states with their dependency factory.
  #composeStateMachine({ runtime, config, devFlags, audio, fightService, appPorts, rng, clock, own, castRodControl }) {
    const stateFactoryRoot = {
      logger: new ConsoleLogger(),
      inventory: runtime.inventory,
      input: runtime.input,
      projector: runtime.projector,
      bite: runtime.bite,
      castRodControl,
      ui: runtime.ui,
      config,
      equipmentRules: runtime.equipmentRules,
      baitRules: runtime.baitRules,
      castRules: runtime.castRules,
      biteRules: runtime.biteRules,
      chumRules: runtime.chumRules,
      boatRules: runtime.boatRules,
      playerCastRules: runtime.playerCastRules,
      devFlags,
      audio,
      depthUI: runtime.depthUI,
      holdUI: runtime.holdUI,
      fishing: runtime.fishing,
      fight: fightService,
      netRef: appPorts.getNet,
      rng,
      clock,
      castPenalty: runtime.castPenalty,
      getCastStartTime: appPorts.getCastStartTime,
      getChumCastDistance: appPorts.getChumCastDistance,
      isAimingChum: appPorts.isAimingChum,
      eatenBaits: appPorts.eatenBaits,
      currentHookDepthRef: appPorts.currentHookDepthRef,
      floatRef: appPorts.getFloat,
      canPlayerCast: appPorts.canPlayerCast,
      getMaxHookDepth: appPorts.getMaxHookDepth,
      checkWater: appPorts.checkWater,
      getBiteEnv: appPorts.getBiteEnv,
      getDynamicBounds: appPorts.getDynamicBounds,
      getWaterMetric: appPorts.getWaterMetric,
      getRodVirtualPos: appPorts.getRodVirtualPos,
      getScreenOffsetRatio: appPorts.getScreenOffsetRatio,
      victoryLayoutResolver: runtime.rendering.victoryLayoutResolver,
      victoryActionGestureResolver:
        runtime.interaction.victoryActionGestureResolver,
      liveBait: runtime.liveBait,
      onCatchResult: (result) => runtime.keepnetUI?.showCatchResult(result),
      liveBaitCandidate: runtime.liveBaitCandidate,
      getLiveBaitMotion: appPorts.getLiveBaitMotion,
      hookedFishOverride: this.#createOptionalDiagnostic(
        this.#createHookedFishOverride, "hookedFishOverride", [{
          config,
          biteRules: runtime.biteRules,
          devFlags,
          fishRarityResolver: runtime.fishRarityResolver,
          fishAnomalyVariantResolver: runtime.fishAnomalyVariantResolver,
          fishVisualVariantResolver: runtime.fishVisualVariantResolver,
        }], ["apply"],
      ),
      setState: appPorts.setState,
      castLine: appPorts.castLine,
      markInvalidCast: appPorts.markInvalidCast,
      showMissingRodInventoryWarning: appPorts.showMissingRodInventoryWarning,
      showMissingReelInventoryWarning: appPorts.showMissingReelInventoryWarning,
      showMissingLineInventoryWarning: appPorts.showMissingLineInventoryWarning,
      setInvalidCastMarker: appPorts.setInvalidCastMarker,
      panViewport: appPorts.panViewport,
      isDebugEnabled: appPorts.isDebugEnabled,
      emitDebugEvent: appPorts.emitDebugEvent,
      subscribeConfigUpdated: appPorts.subscribeConfigUpdated,
      getViewportSize: appPorts.getViewportSize,
    };

    const stateDepsFactory = new StateDepsFactory(stateFactoryRoot);
    const stateMachine = own(new StateMachine({
      stateRegistry: (name) => {
        const states = {
          scouting: ScoutingState,
          waiting: WaitingState,
          biting: BitingState,
          playing: PlayingState,
          failed: FailedState,
          victory: VictoryState,
        };
        const StateClass = states[name];
        if (!StateClass) throw new Error(`Unknown game state: ${name}`);
        return new StateClass(stateDepsFactory.create(name));
      },
      // Spec 142 stage 5: the radio gets quieter during a bite (its «Тихіше при кльові» switch).
      onStateChanged: (name) => {
        appPorts.onStateChanged(name);
        runtime.radio.setBiting(name === "biting");
      },
    }));
    return { stateMachine, stateDepsFactory };
  }

  // Chum and bait boat control with its HUD button.
  #composeChumController({ own, runtime, clock, config, rng, appPorts }) {
    const chumController = own(new ChumController({
      messages: FISHING_MESSAGES,
      inventory: runtime.inventory,
      chum: runtime.chum,
      projector: runtime.projector,
      inventoryUI: runtime.inventoryUI,
      fishing: runtime.fishing,
      location: runtime.location,
      clock,
      config,
      rng,
      getViewportSize: appPorts.getViewportSize,
      panViewport: appPorts.panViewport,
      depthUI: runtime.depthUI,
      getDynamicBounds: appPorts.getDynamicBounds,
      getWaterMetric: appPorts.getWaterMetric,
      getRodVirtualPos: appPorts.getRodVirtualPos,
      checkWater: appPorts.checkWater,
      markInvalidCast: appPorts.markInvalidCast,
      canPlayerCast: appPorts.canPlayerCast,
      getGameStateName: appPorts.getGameStateName,
      devicePower: runtime.devicePower,
      createUi: (onClick) => new ChumControls(onClick, { labels: HUD_LABELS,
        documentRef: this.#documentTarget, mountNode: this.#toolbarMountNode || this.#uiSurface?.mountRoot || this.#documentTarget.body }),
      chumRules: runtime.chumRules,
      boatRules: runtime.boatRules,
    }));
    return { chumController };
  }




  #validateRarityConfiguration() {
    new RarityConfigValidator().assertValid({
      rarityConfig: this.#config.rarity,
      fishDb: this.#config.spawns?.fishes || [],
      itemDb: this.#itemDb || {},
      mapDb: this.#config.locations?.map || {},
    });
  }

  #validateItemProgressionConfiguration(effectiveStatsResolver) {
    new ItemProgressionConfigValidator({ effectiveStatsResolver }).assertValid({
      progressionConfig: this.#config.itemProgression,
      itemDb: this.#itemDb || {},
    });
  }

  #validateDegradationColorConfiguration() {
    new DegradationColorConfigValidator().assertValid(
      this.#config.degradationColors,
    );
  }

  #createOptionalDiagnostic(factory, name, args, methods) {
    if (factory == null) return null;
    const value = factory.apply(this, args);
    return new DependencyContractValidator({ consumer: "GameCompositionRoot" })
      .requireMethods(value, name, methods);
  }

  #readRenderDiagnostics() {
    const diagnostics = this.#getRenderDiagnostics?.();
    if (diagnostics != null) {
      new DependencyContractValidator({ consumer: "GameCompositionRoot" }).requireMethods(
        diagnostics, "renderDiagnostics", ["recordAssetRequestCreated", "recordVictoryLayoutCreated",
          "recordRenderPassCreated", "recordFrameCreated", "recordBufferGrowth"],
      );
    }
    return diagnostics;
  }

  #createUiLifecycle(devTools) {
    return devTools == null ? null : { dispose: () => devTools?.dispose?.() };
  }

}
