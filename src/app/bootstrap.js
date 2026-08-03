class GameCompositionRoot {
  #config;
  constructor(config = null) {
    this.#config = config || (typeof CONFIG !== "undefined" ? CONFIG : {});
  }

  async build(canvasId) {
    const canvas = document.getElementById(canvasId);
    const canvasMetrics = new CanvasMetricsProvider(canvas);
    canvasMetrics.resizeToViewport();
    const devFlags = new DevFlagsProvider({ config: this.#config });
    const audio = new BrowserAudioAdapter();
    const clock = new GameClock();
    const debugEvents = new BrowserDebugAdapter(document, () =>
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
      config: this.#config,
      compositionRoot: this,
      devFlags,
      audio,
      debugEvents,
      windowTarget: window,
      documentTarget: document,
      runtime,
      clock,
    });
  }

  async create(canvas, canvasMetrics, clock, debugEvents, devFlags, audio) {
    this.#validateRarityConfiguration();
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
    const victoryLayoutResolver = new VictoryLayoutResolver();
    contracts.requireMethods(victoryLayoutResolver, "victoryLayoutResolver", [
      "resolve",
    ]);
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
    const fixedCatchFishFactory = new FixedCatchFishFactory({
      fishRarityResolver,
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
    const worldDebugRenderer = new WorldDebugRenderer({ surface });
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
    );
    const runtimeConfigProvider = new InventoryRuntimeConfigProvider(
      this.#config,
      physicsConfig,
    );
    const inventory = new InventoryManager(
      ITEM_DB,
      this.#config.player,
      undefined,
      castDistanceCalculator,
      lineRules,
      runtimeConfigProvider,
    );
    const eq = inventory.getEquipped();
    const chumConfigObj = { baits: {}, deliveryMethods: {} };
    if (typeof ITEM_DB !== "undefined" && ITEM_DB.chums) {
      for (const [key, item] of Object.entries(ITEM_DB.chums)) {
        chumConfigObj.baits[key] = { ...item, ...(item.engineStats || {}) };
      }
    }
    if (typeof ITEM_DB !== "undefined" && ITEM_DB.deliveryMethods) {
      const firstBoatKey = Object.keys(ITEM_DB.deliveryMethods)[0];
      if (firstBoatKey) {
        const b = ITEM_DB.deliveryMethods[firstBoatKey];
        chumConfigObj.deliveryMethods.boat = { ...b, ...(b.engineStats || {}) };
      }
    }
    const systems = {
      projector,
      map: new LocationMap(
        locId,
        this.#config.locations,
        rng,
        locationResources,
      ),
      env: new EnvironmentSystem(
        locCfg,
        this.#config.debug?.initialTime ?? 12,
        rng,
        this.#config.spawns,
      ),
      input: new InputManager(canvas, Number(this.#config.ui?.rod?.x) || null),
      ui: new UIManager(
        this.#config,
        new DevTools(this.#config, hookedFishProfileSynchronizer),
      ),
      chum: new ChumManager(locId, chumConfigObj, projector, {
        rng,
        now: () => clock.realNow,
      }),
      bite: new BiteSystem(
        this.#config.spawns,
        this.#config,
        rng,
        debugEvents,
        fishRarityResolver,
        fishAnomalyVariantResolver,
        fishVisualVariantResolver,
      ),
      inventory,
    };
    systems.inventoryUI = new InventoryUI(systems.inventory);
    const equipmentRules = new EquipmentRules(castDistanceCalculator);
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
      fishRarityResolver,
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
    });

    const fightService = new FightService({
      config,
      rng,
      devFlags,
      fightSessionFactory: new FightSessionFactory({
        config,
        rng,
        devFlags,
        castDistanceCalculator: runtime.castDistanceCalculator,
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
      fixedCatchFishFactory: runtime.fixedCatchFishFactory,
      setState: appPorts.setState,
      castLine: appPorts.castLine,
      markInvalidCast: appPorts.markInvalidCast,
      showMissingRodInventoryWarning: appPorts.showMissingRodInventoryWarning,
      showMissingReelInventoryWarning: appPorts.showMissingReelInventoryWarning,
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
      debugBuilder: new LocationDebugRenderFrameBuilder({
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
    });
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
      frameBuffer: new RenderFrameBuffer(),
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
      mapDb: this.#config.locations?.map || {},
    });
  }

  #validateFrameBuilderContracts(contracts, builders) {
    const names = Object.keys(builders);
    for (let index = 0; index < names.length; index += 1) {
      const name = names[index];
      contracts.requireMethods(builders[name], name, ["buildInto"]);
    }
  }
}
