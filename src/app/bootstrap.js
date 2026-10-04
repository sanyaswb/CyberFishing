class GameCompositionRoot {
  #config;
  #runtimeConfig;
  #documentTarget;
  #windowTarget;
  #createDevFlags;
  #createWorldDebugRenderer;
  #createDevTools;
  #createLocationDebugRenderFrameBuilder;
  #getRenderDiagnostics;
  #isCatchResolutionLogEnabled;
  constructor(config = null, {
    documentTarget,
    windowTarget,
    createDevFlags,
    createWorldDebugRenderer,
    createDevTools,
    createLocationDebugRenderFrameBuilder,
    getRenderDiagnostics,
    isCatchResolutionLogEnabled,
  } = {}) {
    this.#documentTarget = documentTarget;
    this.#windowTarget = windowTarget;
    this.#createDevFlags = createDevFlags;
    this.#createWorldDebugRenderer = createWorldDebugRenderer;
    this.#createDevTools = createDevTools;
    this.#createLocationDebugRenderFrameBuilder = createLocationDebugRenderFrameBuilder;
    this.#getRenderDiagnostics = getRenderDiagnostics;
    this.#isCatchResolutionLogEnabled = isCatchResolutionLogEnabled;
    this.#config = config || (typeof CONFIG !== "undefined" ? CONFIG : {});
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
      diagnostics: this.#getRenderDiagnostics(),
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
    const locationDebugMapBuilder = new LocationDebugMapBuilder({
      canvasFactory,
    });
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
      itemDb: typeof ITEM_DB !== "undefined" ? ITEM_DB : {},
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
    const itemProgressionDebugProvider =
      new ItemProgressionDebugSnapshotProvider({
        itemDb: typeof ITEM_DB !== "undefined" ? ITEM_DB : {},
        progressionResolver: itemProgressionResolver,
        effectiveStatsResolver: effectiveItemStatsResolver,
      });
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
      diagnostics: this.#getRenderDiagnostics(),
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
    const fixedCatchFishFactory = new FixedCatchFishFactory({
      fishRarityResolver,
      fishAnomalyVariantResolver,
      fishVisualVariantResolver,
    });
    const hookedFishProfileSynchronizer =
      new HookedFishProfileSynchronizer({
        fishRarityResolver,
        fishVisualVariantResolver,
      });
    const hudBarRenderer = new HudBarRenderer(surface);
    const worldSceneRenderer = new WorldSceneRenderer({
      surface,
      assets: imageAssets,
    });
    const worldDebugRenderer = this.#createWorldDebugRenderer({ surface });
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
      worldDebugRenderer,
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
      diagnostics: this.#getRenderDiagnostics(),
      passes: RenderOrder.createPassList({
        world: new WorldRenderPass({
          components: [
            new RenderComponent({
              id: "world-background",
              order: RenderOrder.values.BACKGROUND,
              renderer: worldSceneRenderer,
              selectModel: (frame) => frame.world,
            }),
            new RenderComponent({
              id: "world-debug",
              order: RenderOrder.values.WORLD_DEBUG,
              renderer: worldDebugRenderer,
              selectModel: (frame) => frame.world,
            }),
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
    const { createRandomInventoryId } = await import("../platform/browser/inventory/random_inventory_id.js");
    const { BrowserEventTargetAdapter } = await import("../platform/browser/runtime/legacy_runtime_adapters.js");
    const { BrowserTimeoutScheduler } = await import("../platform/browser/time/browser_timeout_scheduler.js");
    const { getInventoryAssemblyProfileConfig } = await import("../game/config/inventory/inventory_composition_config.js");
    const inventory = new InventoryManager(
      ITEM_DB,
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
    );
    const eq = inventory.getEquipped();
    const chumConfigObj = { baits: {}, deliveryMethods: {} };
    const bootstrapItemDatabase = new ItemDatabase(ITEM_DB);
    const bootstrapStatsResolver = effectiveItemStatsResolver;
    const projectDefinition = (itemId) => {
      const definition = bootstrapItemDatabase.getItemData(itemId);
      if (!definition) return null;
      return {
        ...definition,
        effectiveStats: bootstrapStatsResolver.resolve({ definition }),
      };
    };
    if (typeof ITEM_DB !== "undefined" && ITEM_DB.chums) {
      for (const [key, item] of Object.entries(ITEM_DB.chums)) {
        chumConfigObj.baits[key] = projectDefinition(item.id);
      }
    }
    if (typeof ITEM_DB !== "undefined" && ITEM_DB.deliveryMethods) {
      const firstBoatKey = Object.keys(ITEM_DB.deliveryMethods)[0];
      if (firstBoatKey) {
        const boatDefinition = ITEM_DB.deliveryMethods[firstBoatKey];
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
      input: new InputManager(canvas, Number(this.#config.ui?.rod?.x) || null, {
        runtimeConfig: this.#runtimeConfig,
        fightInputActionComposer: typeof FightInputActionComposer !== "undefined" ? new FightInputActionComposer() : null,
      }),
      ui: new UIManager(
        this.#config,
        this.#createUiLifecycle(this.#createDevTools(this.#config, hookedFishProfileSynchronizer, {
          itemProgressionDebugProvider,
          itemProgressionResolver,
        })),
        { cache: CacheManager },
      ),
      chum: new ChumManager(locId, chumConfigObj, projector, {
        cache: CacheManager,
        configEvents: this.#documentTarget,
        rng,
        now: () => clock.realNow,
        onBoatReturned: (context) =>
          inventory.handleBoatReturned?.(context),
      }),
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
    systems.inventoryUI = InventoryV2Bootstrap.create({
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
    });
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
    const depthUI = new DepthSelectorUI();
    const timeUI = new TimeDisplayUI();
    const holdUI = new HoldChargesUI();
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

    const debugService = new DebugService(config);

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
    const stateMachine = new StateMachine({
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
    });

    const chumController = new ChumController({
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
    });

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
      debugBuilder: this.#createLocationDebugRenderFrameBuilder({
        map: runtime.map,
        projector: runtime.projector,
        config,
        debugMapBuilder: runtime.rendering.locationDebugMapBuilder,
      }),
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
        diagnostics: this.#getRenderDiagnostics(),
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
      itemDb: typeof ITEM_DB !== "undefined" ? ITEM_DB : {},
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
      itemDb: typeof ITEM_DB !== "undefined" ? ITEM_DB : {},
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
  #createUiLifecycle(devTools) {
    return { dispose: () => devTools?.dispose?.() };
  }

}
