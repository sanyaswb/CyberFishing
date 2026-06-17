class GameCompositionRoot {
  #config;
  constructor(config = null) {
    this.#config = config || (typeof CONFIG !== "undefined" ? CONFIG : {});
  }

  build(canvasId) {
    const canvas = document.getElementById(canvasId);
    const canvasMetrics = new CanvasMetricsProvider(canvas);
    canvasMetrics.resizeToViewport();
    const devFlags = new DevFlagsProvider({ config: this.#config });
    const audio = new BrowserAudioAdapter();
    const debugEvents = new BrowserDebugAdapter(document, () =>
      devFlags.isDebugEnabled(),
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
    });
  }

  create(canvas, canvasMetrics, clock, debugEvents, devFlags, audio) {
    const surface = new Canvas2DSurface(canvas, {
      contextAttributes: { alpha: false },
    });
    const primitives = new CanvasPrimitives(surface);
    const imageAssets = new ImageAssetProvider();
    const hudStyleResolver = new HudStyleResolver({
      hudStylesProvider: () => this.#config.ui?.hudStyles || {},
    });
    const fightAreaStyleResolver = new FightAreaStyleResolver({
      configProvider: () => this.#config.ui?.catchZone || {},
    });
    const outcomeStyleResolver = new OutcomeStyleResolver({
      configProvider: () => this.#config.ui?.victory || {},
    });
    const victoryLayoutResolver = new VictoryLayoutResolver();
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
    const fishingSceneRenderer = new FishingSceneRenderer({
      fightAreaRenderer,
      rodLineRenderer: new RodLineRenderer({ surface }),
      floatRenderer: new FloatRenderer({ surface }),
    });
    const fightHudRenderer = new FightHudRenderer({
      statusBarsRenderer: new FightStatusBarsRenderer({
        surface,
        hudBarRenderer,
        styleResolver: hudStyleResolver,
      }),
      holdChargesRenderer: new HoldChargesRenderer({ surface }),
    });
    const pipeline = new GameRenderPipeline({
      passes: RenderOrder.createPassList({
        world: new WorldRenderPass({
          sceneRenderer: worldSceneRenderer,
          debugRenderer: worldDebugRenderer,
          boatChumRenderer,
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
            themeResolver: new VictoryThemeResolver(),
          }),
        }),
      }),
    });
    const location = new LocationManager(
      this.#config.locations,
      this.#config.player?.locationId,
    );
    const rng = new SeededRng(
      this.#config.debug?.seed ?? this.#config.rng?.seed,
    );
    const locId = location.id;
    const locCfg = location.config;
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
    const inventory = new InventoryManager(
      ITEM_DB,
      this.#config.player,
      undefined,
      castDistanceCalculator,
      lineRules,
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
        imageAssets,
      ),
      env: new EnvironmentSystem(
        locCfg,
        this.#config.debug?.initialTime ?? 12,
        rng,
        this.#config.spawns,
      ),
      input: new InputManager(canvas, Number(this.#config.ui?.rod?.x) || null),
      ui: new UIManager(this.#config),
      chum: new ChumManager(locId, chumConfigObj, projector, {
        rng,
        now: () => clock.realNow,
      }),
      bite: new BiteSystem(this.#config.spawns, this.#config, rng, debugEvents),
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
        pipeline,
        hudStyleResolver,
        fightAreaStyleResolver,
        outcomeStyleResolver,
        victoryLayoutResolver,
      },
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
      },
    });

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
}
