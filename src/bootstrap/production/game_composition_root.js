import { GameRenderComposition } from "./game_render_composition.js";
import { HUD_LABELS } from "../../game/presentation/hud/hud_labels.js";
import { ITEM_PROGRESSION_LABELS } from "../../game/presentation/inventory/item_progression_labels.js";
import { FISHING_MESSAGES } from "../../game/presentation/fishing/fishing_messages.js";
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
import { CastService } from "../../game/application/fishing/cast_service.js";
import { CatchResolutionService } from "../../game/application/fishing/catch_resolution_service.js";
import { FightService } from "../../game/application/fishing/fight_service.js";
import { FightSessionFactory } from "../../game/application/fishing/fight_session_factory.js";
import { FishingController } from "../../game/application/fishing/fishing_controller.js";
import { ChumController } from "../../game/application/chum/chum_controller.js";
import { ChumControls } from "../../platform/browser/ui/chum_controls.js";
import { ChumService } from "../../game/application/chum/chum_service.js";
import { CompositeMetricStrategy } from "../../game/domain/items/progression/composite_metric_strategy.js";
import { ConsoleLogger } from "../../platform/browser/diagnostics/console_logger.js";
import { DegradationColorConfigValidator } from "../../game/presentation/visual/degradation_color_config_validator.js";
import { DegradationColorResolver } from "../../game/presentation/styles/degradation_color_resolver.js";
import { DependencyContractValidator } from "../../engine/di/dependency_contract_validator.js";
import { DepthSelector } from "../../platform/browser/ui/depth_selector.js";
import { DerivedStatMetricStrategy } from "../../game/domain/items/progression/derived_stat_metric_strategy.js";
import { EffectiveItemStatsResolver } from "../../game/domain/items/effective_item_stats_resolver.js";
import { EnvironmentSystem } from "../../game/application/world/environment_system.js";
import { GameWorld } from "../../game/application/world/game_world.js";
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
import { ITEM_DB } from "../../game/config/databases/item_catalog.js";
import { ItemCapacityResolver } from "../../game/domain/items/progression/item_capacity_resolver.js";
import { ItemCatalogBaselineRegistry } from "../../game/domain/items/progression/item_catalog_baseline_registry.js";
import { ItemConditionDescriptor } from "../../game/presentation/inventory/item_condition_descriptor.js";
import { ItemConditionDomAdapter } from "../../platform/browser/dom/item_condition_dom_adapter.js";
import { ItemConditionResolver } from "../../game/domain/items/condition/item_condition_resolver.js";
import { ItemFreshnessDescriptor } from "../../game/presentation/inventory/item_freshness_descriptor.js";
import { ItemFreshnessResolver } from "../../game/domain/items/freshness/item_freshness_resolver.js";
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
import { RarityAnimationResolver } from "../../game/presentation/screens/rarity_animation_resolver.js";
import { RarityConfigValidator } from "../../game/config/validation/rarity_config_validator.js";
import { RarityVisualResolver } from "../../game/presentation/styles/rarity_visual_resolver.js";
import { ReelRetrieveSpeedCalculator } from "../../game/domain/fishing/reel_retrieve_speed_calculator.js";
import { SeededRng } from "../../engine/random/seeded_rng.js";
import { TargetRangeMetricStrategy } from "../../game/domain/items/progression/target_range_metric_strategy.js";
import { TimeDisplay } from "../../platform/browser/ui/time_display.js";
import { GameControls } from "../../platform/browser/ui/game_controls.js";
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
  #getRenderDiagnostics;
  #isCatchResolutionLogEnabled;
  #collectFightDiagnostics;
  #storageCache;
  #rendering;
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
    createLocationDebugRenderFrameBuilder,
    getRenderDiagnostics,
    isCatchResolutionLogEnabled,
    collectFightDiagnostics = false,
  } = {}) {
    for (const [name, factory] of Object.entries({
      createLocationDebugMapBuilder, createItemProgressionDebugSnapshotProvider, createHookedFishOverride,
      createHookedFishProfileSynchronizer, createDebugService, createWorldDebugRenderer,
      createDevTools, createLocationDebugRenderFrameBuilder, getRenderDiagnostics,
      isCatchResolutionLogEnabled, createDebugEvents, createGameDiagnostics,
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
    this.#getRenderDiagnostics = getRenderDiagnostics;
    this.#isCatchResolutionLogEnabled = isCatchResolutionLogEnabled;
    this.#collectFightDiagnostics = collectFightDiagnostics === true;
    this.#rendering = new GameRenderComposition({
      readRenderDiagnostics: () => this.#readRenderDiagnostics(),
      createOptionalDiagnostic: (factory, name, args, methods) =>
        this.#createOptionalDiagnostic(factory, name, args, methods),
      createWorldDebugRenderer,
      createLocationDebugRenderFrameBuilder,
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

  getMemoryWatchdogConfig() {
    return this.#config.debug?.memoryWatchdog || {};
  }

  async build(canvasId) {
    const canvas = this.#documentTarget.getElementById(canvasId);
    const canvasMetrics = new CanvasMetricsProvider(canvas);
    canvasMetrics.resizeToViewport();
    const devFlags = this.#createDevFlags(this.#config);
    const contracts = new DependencyContractValidator({ consumer: "GameCompositionRoot.build" });
    contracts.requireMethods(devFlags, "devFlags", ["isEnabled", "godModeValue", "isDebugEnabled"]);
    contracts.requireMethods(this.#gameLoopGuard, "gameLoopGuard", ["acquire", "release", "getDiagnostics"]);
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
    const runtime = await this.create(
      canvas,
      canvasMetrics,
      clock,
      debugEvents,
      devFlags,
      audio,
    );
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
    const {
      surface, imageAssets, primitives, assetPreloadCoordinator, locationAssetLoader, locationDebugMapBuilder,
    } = this.#composeRenderingInfrastructure({ canvas, contracts });
    const {
      rarityVisualResolver, degradationColorResolver, hudStyleResolver, fightAreaStyleResolver,
      outcomeStyleResolver,
    } = this.#composeStyleResolvers();
    const {
      itemFreshnessResolver, itemRarityResolver, itemProgressionResolver, itemConditionResolver,
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
    const { pipeline } = this.#rendering.composePipeline({
      surface, imageAssets, primitives, hudStyleResolver, fightAreaStyleResolver, contracts,
      rarityVisualResolver,
    });
    const { projector, locId, rng, locationResources, locCfg, location } = await this.#composeLocation({
      assetPreloadCoordinator, locationAssetLoader,
    });
    const {
      inventory, BrowserTimeoutScheduler, castDistanceCalculator, physicsConfig,
    } = await this.#composePlayerInventory({
      own, itemRarityResolver, itemProgressionResolver, itemConditionResolver, itemFreshnessResolver,
      baitEffectivenessCatalogResolver, effectiveItemStatsResolver, itemStatOverridePolicy,
    });
    const { chumConfigObj, eq } = this.#composeChumConfig({ inventory, effectiveItemStatsResolver });
    const { systems } = this.#composeWorldSystems({
      projector, locId, rng, locationResources, locCfg, own, canvas, hookedFishProfileSynchronizer,
      itemProgressionDebugProvider, itemProgressionResolver, chumConfigObj, debugEvents, devFlags, fishRarityResolver,
      fishAnomalyVariantResolver, fishVisualVariantResolver, baitEffectivenessResolver, inventory, clock,
    });
    this.#composeInventoryUi({
      inventory, systems, own, BrowserTimeoutScheduler, itemRarityDomAdapter, rarityVisualResolver,
      itemProgressionDomAdapter, itemConditionDomAdapter, degradationColorResolver, castDistanceCalculator,
      physicsConfig,
    });
    const {
      world, fishing, equipment, net, castPenalty, depthUI, timeUI, holdUI, equipmentRules, baitRules,
      castRules, biteRules, chumRules, boatRules, playerCastRules,
    } = this.#composeRulesAndWorld({
      castDistanceCalculator, systems, location, canvasMetrics, clock, devFlags, debugEvents, eq,
      physicsConfig, own,
    });
    return {
      location,
      rng,
      projector: systems.projector,
      map: systems.map,
      env: systems.env,
      input: systems.input,
      ui: systems.ui,
      chum: systems.chum,
      bite: systems.bite,
      inventory: systems.inventory,
      inventoryUI: systems.inventoryUI,
      world,
      rendering: {
        imageAssets,
        assetPreloadCoordinator,
        locationAssetLoader,
        pipeline,
        locationDebugMapBuilder,
        hudStyleResolver,
        fightAreaStyleResolver,
        outcomeStyleResolver,
        rarityVisualResolver,
        victoryLayoutResolver,
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
  #composeRenderingInfrastructure({ canvas, contracts }) {
    const surface = new Canvas2DSurface(canvas, {
      contextAttributes: { alpha: false },
    });
    const primitives = new CanvasPrimitives(surface);
    const imageAssets = new ImageAssetProvider();
    contracts.requireMethods(imageAssets, "imageAssets", ["preload", "tryGet"]);
    const canvasFactory = new OffscreenCanvasFactory();
    const assetPreloadCoordinator = new AssetPreloadCoordinator({
      imageAssets,
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
    return { surface, imageAssets, primitives, assetPreloadCoordinator, locationAssetLoader, locationDebugMapBuilder };
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
    return { itemFreshnessResolver, itemRarityResolver, itemProgressionResolver, itemConditionResolver, itemProgressionDebugProvider, itemRarityDomAdapter, itemProgressionDomAdapter, itemConditionDomAdapter };
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
  async #composeLocation({ assetPreloadCoordinator, locationAssetLoader }) {
    const location = new CurrentLocation(
      this.#config.locations,
      this.#config.player?.locationId,
    );
    const rng = new SeededRng(
      this.#config.debug?.seed ?? this.#config.rng?.seed,
    );
    const locId = location.id;
    const locCfg = location.config;
    await assetPreloadCoordinator.preloadLocation(locId);
    const locationResources = await locationAssetLoader.load(
      locId,
      locCfg,
      this.#config.locations,
    );
    const worldPerspective = new WorldPerspective(this.#config.locations, locId);
    const projector = new ViewportProjector(
      this.#config.locations,
      locId,
      worldPerspective.getPerspective.bind(worldPerspective),
    );
    return { projector, locId, rng, locationResources, locCfg, location };
  }

  // Physics-backed line and cast rules and the player's inventory.
  async #composePlayerInventory({
    own, itemRarityResolver, itemProgressionResolver, itemConditionResolver, itemFreshnessResolver,
    baitEffectivenessCatalogResolver, effectiveItemStatsResolver, itemStatOverridePolicy,
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

  // Map, environment, input, game controls, chum service and bite system; the inventory reads boat charge from the chum service.
  #composeWorldSystems({
    projector, locId, rng, locationResources, locCfg, own, canvas, hookedFishProfileSynchronizer,
    itemProgressionDebugProvider, itemProgressionResolver, chumConfigObj, debugEvents, devFlags, fishRarityResolver,
    fishAnomalyVariantResolver, fishVisualVariantResolver, baitEffectivenessResolver, inventory, clock,
  }) {
    const systems = {
      projector,
      map: new LocationMap(
        locId,
        this.#config.locations,
        rng,
        locationResources,
        () => new Date(),
      ),
      env: new EnvironmentSystem(
        locCfg,
        this.#config.debug?.initialTime ?? 12,
        rng,
        this.#config.spawns,
      ),
      input: own(new InputController(canvas, Number(this.#config.ui?.rod?.x) || null, {
        runtimeConfig: this.#runtimeConfig,
        listeners: new EventLifecycle(this.#listenerCounter),
        fightInputActionComposer: new FightInputActionComposer(),
      })),
      ui: own(new GameControls(
        this.#config,
        this.#createUiLifecycle(own(this.#createOptionalDiagnostic(
          this.#createDevTools, "devTools", [this.#config, hookedFishProfileSynchronizer, {
            itemProgressionDebugProvider,
            itemProgressionResolver,
          }], ["dispose"],
        ))),
        { cache: this.#storageCache, labels: HUD_LABELS, logger: new ConsoleLogger() },
      )),
      chum: own(new ChumService(locId, chumConfigObj, projector, {
        cache: this.#storageCache,
        configEvents: this.#documentTarget,
        rng,
        now: () => clock.realNow,
        onBoatReturned: (context) =>
          inventory.handleBoatReturned?.(context),
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
    inventory.setBoatChargeProvider?.((boatItem) => {
      const current = systems.chum.getBoatEnergy();
      const upgradeLevel = Number(
        boatItem?.effectiveStats?.upgradeLevel,
      ) || 1;
      const statsByLevel =
        boatItem?.effectiveStats?.statsByLevel || {};
      const levelStats =
        statsByLevel[upgradeLevel] || statsByLevel[1] || {};
      return {
        current,
        maximum: Number(
          boatItem?.effectiveStats?.maxEnergy ??
            levelStats.maxEnergy,
        ),
      };
    });
    return { systems };
  }

  // Inventory UI over the composed facade and item read-model adapters.
  #composeInventoryUi({
    inventory, systems, own, BrowserTimeoutScheduler, itemRarityDomAdapter, rarityVisualResolver,
    itemProgressionDomAdapter, itemConditionDomAdapter, degradationColorResolver, castDistanceCalculator,
    physicsConfig,
  }) {
    const inventoryFacade = inventory.inventoryFacade;
    if (!inventoryFacade) {
      throw new Error("Inventory composition is required");
    }
    systems.inventoryUI = own(InventoryUiBootstrap.create({
      facade: inventoryFacade,
      documentRef: this.#documentTarget,
      mountNode: this.#documentTarget?.body,
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
    return {  };
  }

  // Gameplay rules, the game world, fishing controller and HUD widgets.
  #composeRulesAndWorld({
    castDistanceCalculator, systems, location, canvasMetrics, clock, devFlags, debugEvents, eq, physicsConfig,
    own,
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
    const depthUI = own(new DepthSelector({ labels: HUD_LABELS }));
    const timeUI = own(new TimeDisplay());
    const holdUI = own(new HoldCharges({ labels: HUD_LABELS }));
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

    const { stateMachine, stateDepsFactory } = this.#composeStateMachine({
      runtime, config, devFlags, audio, fightService, appPorts, rng, clock, own,
    });

    const { chumController } = this.#composeChumController({ own, runtime, clock, config, rng, appPorts });

    const { frameBuilder } = this.#rendering.composeFrameBuilders({
      runtime, config, canvasMetrics, appPorts, clock, contracts, fightService,
    });
    const { renderCoordinator } = this.#rendering.composeCoordinator({
      stateMachine, frameBuilder, runtime, appPorts, contracts,
    });

    const loop = new GameLoop(
      clock,
      (dt) => appPorts.update(dt),
      () => appPorts.draw(),
      this.#gameLoopGuard,
    );

    const viewportFacade = new GameViewportFacade({
      world: runtime.world,
      projector: runtime.projector,
      canvasMetrics,
      config,
      biteEnvironmentService,
    });

    return {
      castService,
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
    const castService = new CastService({
      messages: FISHING_MESSAGES,
      config,
      rng,
      clock,
      equipmentRules: runtime.equipmentRules,
      baitRules: runtime.baitRules,
      getRodVirtualPos: appPorts.getRodVirtualPos,
      getDynamicBounds: appPorts.getDynamicBounds,
      debugEvents,
      devFlags,
      runtimeConfig,
      castReadinessEvaluator: (equipment) =>
        runtime.inventory.evaluateCastReadiness?.(equipment),
    });

    const fightService = new FightService({
      config,
      rng,
      devFlags,
      catchResolver: new CatchResolutionService({
        logger: new ConsoleLogger(),
        isLogEnabled: this.#isCatchResolutionLogEnabled,
      }),
      fightSessionFactory: new FightSessionFactory({
        config,
        rng,
        devFlags,
        runtimeConfig,
        castDistanceCalculator: runtime.castDistanceCalculator,
        logger: new ConsoleLogger(),
        stepClock: () => clock.highResolutionNow(),
        fightDiagnostics: this.#collectFightDiagnostics,
      }),
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
  #composeStateMachine({ runtime, config, devFlags, audio, fightService, appPorts, rng, clock, own }) {
    const stateFactoryRoot = {
      logger: new ConsoleLogger(),
      inventory: runtime.inventory,
      input: runtime.input,
      projector: runtime.projector,
      bite: runtime.bite,
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
      getRodVirtualPos: appPorts.getRodVirtualPos,
      getScreenOffsetRatio: appPorts.getScreenOffsetRatio,
      victoryLayoutResolver: runtime.rendering.victoryLayoutResolver,
      victoryActionGestureResolver:
        runtime.interaction.victoryActionGestureResolver,
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
      onStateChanged: appPorts.onStateChanged,
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
      getRodVirtualPos: appPorts.getRodVirtualPos,
      checkWater: appPorts.checkWater,
      markInvalidCast: appPorts.markInvalidCast,
      canPlayerCast: appPorts.canPlayerCast,
      getGameStateName: appPorts.getGameStateName,
      createUi: (onClick) => new ChumControls(onClick),
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
