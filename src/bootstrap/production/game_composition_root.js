import { AlwaysKnownBaitEffectivenessPolicy } from "../../game/domain/items/bait/bait_effectiveness_knowledge_policy.js";
import { AssetPreloadCoordinator } from "../../platform/browser/assets/asset_preload_coordinator.js";
import { AuthoredItemRarityStrategy } from "../../game/domain/items/rarity/authored_item_rarity_strategy.js";
import { BaitEffectivenessCatalogResolver } from "../../game/presentation/inventory/bait_effectiveness_catalog_resolver.js";
import { BaitEffectivenessDescriptor } from "../../game/presentation/inventory/bait_effectiveness_descriptor.js";
import { BaitEffectivenessGradePolicy } from "../../game/domain/items/bait/bait_effectiveness_grade_policy.js";
import { BaitEffectivenessResolver } from "../../game/domain/items/bait/bait_effectiveness_resolver.js";
import { BaitFreshnessModifier } from "../../game/domain/items/freshness/bait_freshness_modifier.js";
import { BaitRules, BiteRules, BoatRules, CastRules, ChumRules, EquipmentRules, PlayerCastRules } from "../../game/domain/rules/gameplay_rules.js";
import { BiteEnvironmentService } from "../../game/application/fishing/bite_environment_service.js";
import { BiteSystem, CastManager } from "../../game/application/fishing/bite_service.js";
import { BitingState, FailedState, PlayingState, ScoutingState, StateDepsFactory, StateMachine, VictoryState, WaitingState } from "../../game/application/state/game_state_machine.js";
import { BoatChumRenderer } from "../../game/presentation/world/boat_chum_renderer.js";
import { BoatChumRenderFrameBuilder } from "../../game/presentation/rendering/boat_chum_render_frame_builder.js";
import { BrowserAudioAdapter, BrowserDebugAdapter, CanvasMetricsProvider } from "../../platform/browser/runtime/legacy_runtime_adapters.js";
import { CacheManager } from "../../platform/browser/storage/cache_manager.js";
import { Canvas2DSurface } from "../../platform/browser/canvas/canvas_2d_surface.js";
import { CanvasPrimitives } from "../../platform/browser/canvas/canvas_primitives.js";
import { CastDistanceCalculator } from "../../game/domain/casting/cast_distance_calculator.js";
import { CastingRenderFrameBuilder } from "../../game/presentation/rendering/casting_render_frame_builder.js";
import { CastingRenderPass } from "../../game/presentation/rendering/casting_render_pass.js";
import { CastSceneRenderer } from "../../game/presentation/casting/cast_scene_renderer.js";
import { CastService, CatchResolutionService, FightService, FightSessionFactory, FishingController } from "../../game/application/fishing/fishing_runtime_services.js";
import { ChumController } from "./chum_feature_bootstrap.js";
import { ChumManager } from "../../game/application/chum/chum_service.js";
import { CompositeMetricStrategy } from "../../game/domain/items/progression/composite_metric_strategy.js";
import { ConsoleLogger } from "../../platform/browser/diagnostics/console_logger.js";
import { DegradationColorConfigValidator } from "../../game/presentation/visual/degradation_color_config_validator.js";
import { DegradationColorResolver } from "../../game/presentation/styles/degradation_color_resolver.js";
import { DependencyContractValidator } from "../../engine/di/dependency_contract_validator.js";
import { DepthSelectorUI } from "../../platform/browser/ui/depth_selector.js";
import { DerivedStatMetricStrategy } from "../../game/domain/items/progression/derived_stat_metric_strategy.js";
import { EffectiveItemStatsResolver } from "../../game/domain/items/effective_item_stats_resolver.js";
import { EnvironmentSystem, GameWorld, LocationManager } from "../../game/application/world/game_world_service.js";
import { EquipmentService } from "../../game/application/inventory/equipment_service.js";
import { FightAreaRenderer } from "../../game/presentation/fishing/fight_area_renderer.js";
import { FightAreaRenderFrameBuilder } from "../../game/presentation/rendering/fight_area_render_frame_builder.js";
import { FightAreaStyleResolver } from "../../game/presentation/styles/fight_area_style_resolver.js";
import { FightHudFrameBuilder } from "../../game/presentation/hud/fight_hud_frame_builder.js";
import { FightHudRenderer } from "../../game/presentation/hud/fight_hud_renderer.js";
import { FightInputActionComposer } from "../../game/application/input/fight_input_action_composer.js";
import { FightPhysicsConfigAdapter } from "../../game/config/physics/fight_physics_config_adapter.js";
import { FightStatusBarsRenderer } from "../../game/presentation/hud/fight_status_bars_renderer.js";
import { FishAnomalyVariantResolver } from "../../game/domain/fish/fish_anomaly_variant_resolver.js";
import { FishingEquipmentRenderModelBuilder } from "../../game/presentation/fishing/fishing_equipment_render_model_builder.js";
import { FishingRenderFrameBuilder } from "../../game/presentation/rendering/fishing_render_frame_builder.js";
import { FishingRenderPass } from "../../game/presentation/rendering/fishing_render_pass.js";
import { FishingSceneRenderer } from "../../game/presentation/fishing/fishing_scene_renderer.js";
import { FishRarityResolver } from "../../game/domain/fish/fish_rarity_resolver.js";
import { FishVisualVariantResolver } from "../../game/presentation/fish/fish_visual_variant_resolver.js";
import { FloatRenderer } from "../../game/presentation/fishing/float_renderer.js";
import { GameApplication } from "./game_application.js";
import { GameClock } from "../../platform/browser/time/game_clock.js";
import { GameLoop } from "../../platform/browser/runtime/game_loop.js";
import { GameOverRenderer } from "../../game/presentation/screens/game_over_renderer.js";
import { GameRenderCoordinator } from "../../game/presentation/rendering/game_render_coordinator.js";
import { GameRenderFrameBuilder } from "../../game/presentation/rendering/game_render_frame_builder.js";
import { GameRenderPipeline } from "../../game/presentation/rendering/game_render_pipeline.js";
import { HoldChargesRenderer } from "../../game/presentation/hud/hold_charges_renderer.js";
import { HoldChargesUI } from "../../platform/browser/ui/hold_charges.js";
import { HudBarRenderer } from "../../game/presentation/hud/hud_bar_renderer.js";
import { HudRenderPass } from "../../game/presentation/rendering/hud_render_pass.js";
import { HudStyleResolver } from "../../game/presentation/styles/hud_style_resolver.js";
import { ImageAssetProvider } from "../../platform/browser/assets/image_asset_provider.js";
import { InputManager } from "../../platform/browser/input/input_manager.js";
import { INVENTORY_RULE_MESSAGES } from "../../game/presentation/inventory/inventory_rule_messages.js";
import { InventoryEventBridge, InventoryManager, InventoryRuntimeConfigProvider, ItemDatabase, LineCompatibilityRules } from "../../game/application/inventory/legacy_inventory_system.js";
import { InventoryItemViewFactory } from "../../game/presentation/inventory/inventory_item_view_factory.js";
import { InventoryV2ActionType } from "../../game/presentation/inventory/inventory_view_model.js";
import { InventoryV2BalanceParameterResolver } from "../../game/presentation/inventory/inventory_balance_parameter_resolver.js";
import { InventoryV2Bootstrap } from "./inventory_ui_bootstrap.js";
import { InventoryV2CompositionRoot } from "./inventory_composition_root.js";
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
import { LandingAreaRenderFrameBuilder } from "../../game/presentation/rendering/landing_area_render_frame_builder.js";
import { LandingPolicyResolver } from "../../game/domain/fishing/landing_policy.js";
import { LineVisualStateController } from "../../game/presentation/fishing/line_visual_state_controller.js";
import { LocationAssetLoader } from "../../platform/browser/location/location_asset_loader.js";
import { LocationMap } from "../../game/domain/locations/location_world.js";
import { Net } from "../../game/domain/tackle/tackle.js";
import { NumericStatMetricStrategy } from "../../game/domain/items/progression/numeric_stat_metric_strategy.js";
import { OffscreenCanvasFactory } from "../../platform/browser/canvas/offscreen_canvas_factory.js";
import { OutcomeRenderFrameBuilder } from "../../game/presentation/screens/outcome_render_frame_builder.js";
import { OutcomeRenderPass } from "../../game/presentation/rendering/outcome_render_pass.js";
import { OutcomeStyleResolver } from "../../game/presentation/styles/outcome_style_resolver.js";
import { PlayerPressureFatigueIndicatorRenderer } from "../../game/presentation/hud/player_pressure_fatigue_indicator_renderer.js";
import { PoleFightSectorGeometry } from "../../game/domain/fishing/pole_fight_sector_geometry.js";
import { RarityAnimationResolver } from "../../game/presentation/screens/rarity_animation_resolver.js";
import { RarityConfigValidator } from "../../game/config/validation/rarity_config_validator.js";
import { RarityVisualResolver } from "../../game/presentation/styles/rarity_visual_resolver.js";
import { ReelRetrieveSpeedCalculator } from "../../game/domain/fishing/reel_retrieve_speed_calculator.js";
import { RenderComponent } from "../../engine/rendering/render_component.js";
import { RenderFrameBuffer } from "../../game/presentation/rendering/render_frame_buffer.js";
import { RenderOrder } from "../../game/presentation/rendering/game_render_order.js";
import { RodLineRenderer } from "../../game/presentation/fishing/rod_line_renderer.js";
import { SeededRng } from "../../engine/random/seeded_rng.js";
import { SLOT_CONFIG } from "../../game/config/runtime/game_config.js";
import { StarRatingRenderer } from "../../game/presentation/screens/star_rating_renderer.js";
import { TargetRangeMetricStrategy } from "../../game/domain/items/progression/target_range_metric_strategy.js";
import { TimeDisplayUI } from "../../platform/browser/ui/time_display.js";
import { UIManager } from "../../platform/browser/ui/game_controls.js";
import { VictoryActionGestureResolver } from "../../game/presentation/input/victory_action_gesture_resolver.js";
import { VictoryLayoutResolver } from "../../game/presentation/screens/victory_layout_resolver.js";
import { VictoryRenderer } from "../../game/presentation/screens/victory_renderer.js";
import { VictoryThemeResolver } from "../../game/presentation/screens/victory_theme_resolver.js";
import { ViewportProjector } from "../../game/application/viewport/viewport_projector.js";
import { WorldRenderFrameBuilder } from "../../game/presentation/rendering/world_render_frame_builder.js";
import { WorldRenderPass } from "../../game/presentation/rendering/world_render_pass.js";
import { WorldSceneRenderer } from "../../game/presentation/world/world_scene_renderer.js";

export class GameCompositionRoot {
  #config;
  #itemDb;
  #runtimeConfig;
  #createLocationDebugMapBuilder;
  #createItemProgressionDebugSnapshotProvider;
  #createFixedCatchFishFactory;
  #createHookedFishProfileSynchronizer;
  #createDebugService;
  #loadRandomInventoryId;
  #loadBrowserEventTargetAdapter;
  #loadBrowserTimeoutScheduler;
  #loadInventoryAssemblyProfileConfig;
  #documentTarget;
  #windowTarget;
  #createDevFlags;
  #createWorldDebugRenderer;
  #createDevTools;
  #createLocationDebugRenderFrameBuilder;
  #getRenderDiagnostics;
  #isCatchResolutionLogEnabled;
  constructor(config, {
    createLocationDebugMapBuilder,
    createItemProgressionDebugSnapshotProvider,
    createFixedCatchFishFactory,
    createHookedFishProfileSynchronizer,
    createDebugService,
    itemDb = ITEM_DB,
    loadRandomInventoryId,
    loadBrowserEventTargetAdapter,
    loadBrowserTimeoutScheduler,
    loadInventoryAssemblyProfileConfig,
    documentTarget,
    windowTarget,
    createDevFlags,
    createWorldDebugRenderer,
    createDevTools,
    createLocationDebugRenderFrameBuilder,
    getRenderDiagnostics,
    isCatchResolutionLogEnabled,
  } = {}) {
    for (const [name, factory] of Object.entries({
      createLocationDebugMapBuilder, createItemProgressionDebugSnapshotProvider,
      createHookedFishProfileSynchronizer, createDebugService, createWorldDebugRenderer,
      createDevTools, createLocationDebugRenderFrameBuilder, getRenderDiagnostics,
      isCatchResolutionLogEnabled,
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
    if (createDevTools != null && createHookedFishProfileSynchronizer == null) {
      throw new TypeError("GameCompositionRoot requires hooked fish synchronizer for DEV tools");
    }
    this.#createLocationDebugMapBuilder = createLocationDebugMapBuilder;
    this.#createItemProgressionDebugSnapshotProvider = createItemProgressionDebugSnapshotProvider;
    this.#createFixedCatchFishFactory = createFixedCatchFishFactory;
    this.#createHookedFishProfileSynchronizer = createHookedFishProfileSynchronizer;
    this.#createDebugService = createDebugService;
    this.#loadRandomInventoryId = loadRandomInventoryId;
    this.#loadBrowserEventTargetAdapter = loadBrowserEventTargetAdapter;
    this.#loadBrowserTimeoutScheduler = loadBrowserTimeoutScheduler;
    this.#loadInventoryAssemblyProfileConfig = loadInventoryAssemblyProfileConfig;
    this.#documentTarget = documentTarget;
    this.#windowTarget = windowTarget;
    this.#createDevFlags = createDevFlags;
    this.#createWorldDebugRenderer = createWorldDebugRenderer;
    this.#createDevTools = createDevTools;
    this.#createLocationDebugRenderFrameBuilder = createLocationDebugRenderFrameBuilder;
    this.#getRenderDiagnostics = getRenderDiagnostics;
    this.#isCatchResolutionLogEnabled = isCatchResolutionLogEnabled;
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
    if (typeof CacheManager !== "undefined" && CacheManager.printStorageUsage) CacheManager.printStorageUsage();
  }

  getMemoryWatchdogConfig() {
    return this.#config.debug?.memoryWatchdog || {};
  }

  async build(canvasId) {
    const canvas = this.#documentTarget.getElementById(canvasId);
    const canvasMetrics = new CanvasMetricsProvider(canvas);
    canvasMetrics.resizeToViewport();
    const devFlags = this.#createDevFlags(this.#config);
    new DependencyContractValidator({ consumer: "GameCompositionRoot.build" }).requireMethods(
      devFlags, "devFlags", ["isEnabled", "godModeValue", "isDebugEnabled"],
    );
    const audio = new BrowserAudioAdapter();
    const clock = new GameClock();
    const debugEvents = new BrowserDebugAdapter(this.#documentTarget, () =>
      devFlags.isDebugEnabled(),
    );
    const runtime = await this.create(
      canvas,
      canvasMetrics,
      clock,
      debugEvents,
      devFlags,
      audio,
    );
    return new GameApplication({
      canvas,
      canvasMetrics,
      config: this.#runtimeConfig,
      compositionRoot: this,
      devFlags,
      audio,
      debugEvents,
      windowTarget: this.#windowTarget,
      documentTarget: this.#documentTarget,
      runtime,
      clock,
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
      degradationColorResolver,
    });
    const itemProgressionDomAdapter = new ItemProgressionDomAdapter({
      visualResolver: itemProgressionVisualResolver,
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
      ["apply", "appendTooltip", "updateCapacity", "clear"],
    );
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
    const fixedCatchFishFactory = this.#createFixedCatchFishFactory({
      fishRarityResolver,
      fishAnomalyVariantResolver,
      fishVisualVariantResolver,
    });
    contracts.requireMethods(fixedCatchFishFactory, "fixedCatchFishFactory", ["create"]);
    const hookedFishProfileSynchronizer = this.#createOptionalDiagnostic(
      this.#createHookedFishProfileSynchronizer, "hookedFishProfileSynchronizer", [{
        fishRarityResolver,
        fishVisualVariantResolver,
      }], ["synchronize"],
    );
    const hudBarRenderer = new HudBarRenderer(surface);
    const worldSceneRenderer = new WorldSceneRenderer({
      surface,
      assets: imageAssets,
    });
    const worldDebugRenderer = this.#createOptionalDiagnostic(
      this.#createWorldDebugRenderer, "worldDebugRenderer", [{ surface }], ["render"],
    );
    const boatChumRenderer = new BoatChumRenderer({
      surface,
      primitives,
    });
    const castSceneRenderer = new CastSceneRenderer({
      surface,
      primitives,
      hudBarRenderer,
      hudStyleResolver,
    });
    const fightAreaRenderer = new FightAreaRenderer({
      surface,
      primitives,
      styleResolver: fightAreaStyleResolver,
    });
    const rodLineRenderer = new RodLineRenderer({ surface });
    const floatRenderer = new FloatRenderer({ surface });
    const fishingSceneRenderer = new FishingSceneRenderer({
      components: [
        new RenderComponent({
          id: "fight-area",
          order: RenderOrder.values.FIGHT_AREAS,
          renderer: fightAreaRenderer,
          selectModel: (model) => model.fightAreas,
        }),
        new RenderComponent({
          id: "rod-line",
          order: RenderOrder.values.FISHING_EQUIPMENT,
          renderer: rodLineRenderer,
          selectModel: (model) => model.rodLine,
        }),
        new RenderComponent({
          id: "float",
          order: RenderOrder.values.FISHING_EQUIPMENT + 1,
          renderer: floatRenderer,
          selectModel: (model) => model.float,
        }),
      ],
    });
    const statusBarsRenderer = new FightStatusBarsRenderer({
      surface,
      hudBarRenderer,
      styleResolver: hudStyleResolver,
    });
    const holdChargesRenderer = new HoldChargesRenderer({ surface });
    const playerPressureFatigueIndicatorRenderer =
      new PlayerPressureFatigueIndicatorRenderer({ surface });
    const fightHudRenderer = new FightHudRenderer({
      components: [
        new RenderComponent({
          id: "status-bars",
          order: RenderOrder.values.HUD,
          renderer: statusBarsRenderer,
          selectModel: (model) => model,
        }),
        new RenderComponent({
          id: "hold-charges",
          order: RenderOrder.values.HUD + 1,
          renderer: holdChargesRenderer,
          selectModel: (model) => model.holdCharges,
        }),
        new RenderComponent({
          id: "player-pressure-fatigue",
          order: RenderOrder.values.HUD + 2,
          renderer: playerPressureFatigueIndicatorRenderer,
          selectModel: (model) => model.playerPressureFatigue,
        }),
      ],
    });
    const invalidCastMarkerRenderer = {
      render: (model) => worldSceneRenderer.renderInvalidCastMarker(model),
    };
    this.#validateRenderContracts(contracts, {
      worldSceneRenderer,
      ...(worldDebugRenderer == null ? {} : { worldDebugRenderer }),
      boatChumRenderer,
      castSceneRenderer,
      fightAreaRenderer,
      rodLineRenderer,
      floatRenderer,
      fishingSceneRenderer,
      statusBarsRenderer,
      holdChargesRenderer,
      fightHudRenderer,
      invalidCastMarkerRenderer,
    });
    const pipeline = new GameRenderPipeline({
      diagnostics: this.#readRenderDiagnostics(),
      passes: RenderOrder.createPassList({
        world: new WorldRenderPass({
          components: [
            new RenderComponent({
              id: "world-background",
              order: RenderOrder.values.BACKGROUND,
              renderer: worldSceneRenderer,
              selectModel: (frame) => frame.world,
            }),
            ...(worldDebugRenderer == null ? [] : [new RenderComponent({
              id: "world-debug",
              order: RenderOrder.values.WORLD_DEBUG,
              renderer: worldDebugRenderer,
              selectModel: (frame) => frame.world,
            })]),
            new RenderComponent({
              id: "boat-chum",
              order: RenderOrder.values.WORLD_ENTITIES,
              renderer: boatChumRenderer,
              selectModel: (frame) => frame.world,
            }),
            new RenderComponent({
              id: "invalid-cast-marker",
              order: RenderOrder.values.WORLD_ENTITIES + 1,
              renderer: invalidCastMarkerRenderer,
              selectModel: (frame) => frame.world.invalidCastMarker,
            }),
          ],
        }),
        casting: new CastingRenderPass({ renderer: castSceneRenderer }),
        fishing: new FishingRenderPass({ renderer: fishingSceneRenderer }),
        hud: new HudRenderPass({ renderer: fightHudRenderer }),
        outcome: new OutcomeRenderPass({
          gameOverRenderer: new GameOverRenderer({ surface }),
          victoryRenderer: new VictoryRenderer({
            surface,
            primitives,
            assets: imageAssets,
            themeResolver: new VictoryThemeResolver({
              rarityVisualResolver,
            }),
            starRatingRenderer: new StarRatingRenderer({
              surface,
              primitives,
            }),
          }),
        }),
      }),
    });
    contracts.requireMethods(pipeline, "rendering.pipeline", [
      "render",
      "getPassCount",
      "copyPassIdsInto",
    ]);
    const location = new LocationManager(
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
    const projector = new ViewportProjector(this.#config.locations, locId);
    const physicsConfig =
      this.#config.fightPhysicsConfig ||
      (typeof FightPhysicsConfigAdapter !== "undefined"
        ? new FightPhysicsConfigAdapter(this.#config)
        : null);
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
    const inventory = own(new InventoryManager(
      this.#itemDb,
      this.#config.player,
      new InventoryEventBridge(new BrowserEventTargetAdapter(this.#documentTarget)),
      castDistanceCalculator,
      lineRules,
      runtimeConfigProvider,
      itemRarityResolver,
      undefined,
      itemProgressionResolver,
      undefined,
      itemConditionResolver,
      itemFreshnessResolver,
      baitEffectivenessCatalogResolver,
      effectiveItemStatsResolver,
      itemStatOverridePolicy,
      CacheManager,
      {
        slotConfig: SLOT_CONFIG,
        createItemViewFactory: (options) => new InventoryItemViewFactory(options),
        composeInventoryV2: (options) => InventoryV2CompositionRoot.compose({
          ...options,
          assemblyProfileConfig: getInventoryAssemblyProfileConfig(),
        }),
        actions: InventoryV2ActionType,
        makeRandomId: createRandomInventoryId,
        now: () => Date.now(),
      },
    ));
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
      input: own(new InputManager(canvas, Number(this.#config.ui?.rod?.x) || null, {
        runtimeConfig: this.#runtimeConfig,
        fightInputActionComposer: typeof FightInputActionComposer !== "undefined" ? new FightInputActionComposer() : null,
      })),
      ui: own(new UIManager(
        this.#config,
        this.#createUiLifecycle(own(this.#createOptionalDiagnostic(
          this.#createDevTools, "devTools", [this.#config, hookedFishProfileSynchronizer, {
            itemProgressionDebugProvider,
            itemProgressionResolver,
          }], ["dispose"],
        ))),
        { cache: CacheManager },
      )),
      chum: own(new ChumManager(locId, chumConfigObj, projector, {
        cache: CacheManager,
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
    const inventoryV2Facade = inventory.inventoryV2Facade;
    if (!inventoryV2Facade) {
      throw new Error("Inventory V2 composition is required");
    }
    systems.inventoryUI = own(InventoryV2Bootstrap.create({
      facade: inventoryV2Facade,
      documentRef: this.#documentTarget,
      mountNode: this.#documentTarget?.body,
      warningTimers: new BrowserTimeoutScheduler(),
      onAction: (action) => inventory.dispatchInventoryV2Action(action),
      rarityDomAdapter: itemRarityDomAdapter,
      rarityVisualResolver,
      progressionDomAdapter: itemProgressionDomAdapter,
      conditionDomAdapter: itemConditionDomAdapter,
      degradationColorResolver,
      balanceParameterResolver: new InventoryV2BalanceParameterResolver({
        castDistanceCalculator,
        retrieveSpeedCalculator: new ReelRetrieveSpeedCalculator(),
        reelConfig: physicsConfig?.getReelConfig?.() || {},
        physicsConfig: this.#config.physics,
        debugConfig: this.#config.debug?.inventory,
        rarityVisualResolver,
      }),
    }));
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
    const castManager = new CastManager();
    const depthUI = own(new DepthSelectorUI());
    const timeUI = own(new TimeDisplayUI());
    const holdUI = own(new HoldChargesUI());
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
      fixedCatchFishFactory,
      fishing,
      equipment,
      net,
      castManager,
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
    const castService = new CastService({
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
      }),
    });

    const debugService = this.#createOptionalDiagnostic(
      this.#createDebugService, "debugService", [config], ["update"],
    );

    const biteEnvironmentService = new BiteEnvironmentService({
      world: runtime.world,
      env: runtime.env,
      chum: runtime.chum,
      inventory: runtime.inventory,
      floatRef: appPorts.getFloat,
      clock,
      castManager: runtime.castManager,
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
      castManager: runtime.castManager,
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
      fixedCatchFishFactory: runtime.fixedCatchFishFactory,
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

    const chumController = own(new ChumController({
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
      chumRules: runtime.chumRules,
      boatRules: runtime.boatRules,
    }));

    const worldBuilder = new WorldRenderFrameBuilder({
      map: runtime.map,
      projector: runtime.projector,
      config,
      canvasMetrics,
      locationId: runtime.location.id,
      boatChumBuilder: new BoatChumRenderFrameBuilder({
        chum: runtime.chum,
        projector: runtime.projector,
        config,
      }),
      debugBuilder: this.#createOptionalDiagnostic(
        this.#createLocationDebugRenderFrameBuilder, "locationDebugRenderFrameBuilder", [{
          map: runtime.map,
          projector: runtime.projector,
          config,
          debugMapBuilder: runtime.rendering.locationDebugMapBuilder,
        }], ["buildInto"],
      ),
    });
    const castingBuilder = new CastingRenderFrameBuilder({
      projector: runtime.projector,
      config,
      canvasMetrics,
      hudStyleResolver: runtime.rendering.hudStyleResolver,
      chumSource: {
        isAiming: appPorts.isAimingChum,
        getEquipment: () => runtime.inventory.getEquipped(),
        getGameStateName: appPorts.getGameStateName,
        getCastDistance: appPorts.getChumCastDistance,
        getPowerAimVisual: appPorts.getChumPowerAimVisual,
        getAccuracyPreview: appPorts.getChumAccuracyPreview,
        getBounds: appPorts.getDynamicBounds,
        getNow: () => clock.now,
      },
    });
    const fightAreaBuilder = new FightAreaRenderFrameBuilder({
      projector: runtime.projector,
      config,
      canvasMetrics,
      getRodScreenX: appPorts.getRodScreenX,
      landingAreaBuilder: new LandingAreaRenderFrameBuilder({
        projector: runtime.projector,
        config,
        canvasMetrics,
        getNet: appPorts.getNet,
        getRodScreenX: appPorts.getRodScreenX,
        landingPolicyResolver: new LandingPolicyResolver(),
      }),
      sectorGeometry: new PoleFightSectorGeometry(),
    });
    const hudBuilder = new FightHudFrameBuilder({
      config,
      canvasMetrics,
    });
    const fishingBuilder = new FishingRenderFrameBuilder({
      inventory: runtime.inventory,
      projector: runtime.projector,
      canvasMetrics,
      clock,
      config,
      equipmentRules: runtime.equipmentRules,
      baitRules: runtime.baitRules,
      getFloat: appPorts.getFloat,
      getInputState: appPorts.getInputState,
      getCastDistanceRatio: appPorts.getCastDistanceRatio,
      getCurrentHookDepth: appPorts.getCurrentHookDepth,
      getHoldState: () => fightService.getHoldUiState(),
      lineVisualState: new LineVisualStateController(),
      fightAreaBuilder,
      hudBuilder,
      equipmentModelBuilder: new FishingEquipmentRenderModelBuilder({
        projector: runtime.projector,
        canvasMetrics,
        clock,
        config,
        getRodScreenX: appPorts.getRodScreenX,
      }),
    });
    const outcomeBuilder = new OutcomeRenderFrameBuilder({
      canvasMetrics,
      clock,
      styleResolver: runtime.rendering.outcomeStyleResolver,
      layoutResolver: runtime.rendering.victoryLayoutResolver,
      assetIdForSource: (source, namespace) => ImageAssetProvider.assetIdForSource(source, namespace),
    });
    runtime.inventory.setLineCapacityStateProvider?.(
      () => fightService.getLineCapacityState(),
    );
    const frameBuilder = new GameRenderFrameBuilder({
      canvasMetrics,
      projector: runtime.projector,
      worldBuilder,
      castingBuilder,
      fishingBuilder,
      outcomeBuilder,
    });
    this.#validateFrameBuilderContracts(contracts, {
      worldBuilder,
      castingBuilder,
      fightAreaBuilder,
      hudBuilder,
      fishingBuilder,
      outcomeBuilder,
      frameBuilder,
    });
    const renderCoordinator = new GameRenderCoordinator({
      stateMachine,
      frameBuffer: new RenderFrameBuffer({
        diagnostics: this.#readRenderDiagnostics(),
      }),
      frameBuilder,
      pipeline: runtime.rendering.pipeline,
      getBounds: appPorts.getDynamicBounds,
      getInvalidCastMarker: appPorts.getInvalidCastMarker,
      isDebugEnabled: appPorts.isDebugEnabled,
      invalidateStyles: () => {
        runtime.rendering.hudStyleResolver.invalidate();
        runtime.rendering.fightAreaStyleResolver.invalidate();
        runtime.rendering.outcomeStyleResolver.invalidate();
        runtime.rendering.rarityVisualResolver.invalidate();
      },
    });
    contracts.requireMethods(renderCoordinator, "renderCoordinator", [
      "render",
      "invalidateStyles",
    ]);

    const loop = new GameLoop(
      clock,
      (dt) => appPorts.update(dt),
      () => appPorts.draw(),
    );

    return {
      castService,
      fightService,
      debugService,
      biteEnvironmentService,
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

  #validateRenderContracts(contracts, renderers) {
    const names = Object.keys(renderers);
    for (let index = 0; index < names.length; index += 1) {
      const name = names[index];
      contracts.requireMethods(renderers[name], name, ["render"]);
    }
  }

  #validateRarityConfiguration() {
    if (typeof RarityConfigValidator === "undefined") {
      throw new Error("RarityConfigValidator must be loaded before startup");
    }
    new RarityConfigValidator().assertValid({
      rarityConfig: this.#config.rarity,
      fishDb: this.#config.spawns?.fishes || [],
      itemDb: this.#itemDb || {},
      mapDb: this.#config.locations?.map || {},
    });
  }

  #validateItemProgressionConfiguration(effectiveStatsResolver) {
    if (typeof ItemProgressionConfigValidator === "undefined") {
      throw new Error(
        "ItemProgressionConfigValidator must be loaded before startup",
      );
    }
    new ItemProgressionConfigValidator({ effectiveStatsResolver }).assertValid({
      progressionConfig: this.#config.itemProgression,
      itemDb: this.#itemDb || {},
    });
  }

  #validateDegradationColorConfiguration() {
    if (typeof DegradationColorConfigValidator === "undefined") {
      throw new Error(
        "DegradationColorConfigValidator must be loaded before startup",
      );
    }
    new DegradationColorConfigValidator().assertValid(
      this.#config.degradationColors,
    );
  }

  #validateFrameBuilderContracts(contracts, builders) {
    const names = Object.keys(builders);
    for (let index = 0; index < names.length; index += 1) {
      const name = names[index];
      contracts.requireMethods(builders[name], name, ["buildInto"]);
    }
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
