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
    const inventory = new InventoryManager(ITEM_DB, this.#config.player);
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
      renderer: new Renderer(canvas),
      projector,
      map: new LocationMap(locId, this.#config.locations, rng),
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
      bite: new BiteSystem(this.#config.spawns, this.#config, rng),
      inventory,
    };
    systems.inventoryUI = new InventoryUI(systems.inventory);
    const equipmentRules = new EquipmentRules();
    const baitRules = new BaitRules();
    const castRules = new CastRules(equipmentRules);
    const biteRules = new BiteRules(baitRules);
    const chumRules = new ChumRules();
    const boatRules = new BoatRules();
    const playerCastRules = new PlayerCastRules(boatRules);
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
    const renderSystem = new RenderSystem({
      renderer: systems.renderer,
      map: systems.map,
      projector: systems.projector,
      chum: systems.chum,
      renderConfig: this.#config,
      locationConfig: this.#config.locations,
    });
    const equipment = new EquipmentService(systems.inventory);
    const fishing = new FishingController({
      inventory: systems.inventory,
      equipment,
      devFlags,
      equipmentRules,
      baitRules,
    });
    const net = new Net(eq.net || { active: false, maxWeight: 0, length: 10 });
    const castManager = new CastManager();
    const depthUI = new DepthSelectorUI();
    const timeUI = new TimeDisplayUI();
    const holdUI = new HoldChargesUI();
    return {
      location,
      rng,
      renderer: systems.renderer,
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
      renderSystem,
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
    screenScratch,
    screenScratch2,
  }) {
    const castService = new CastService({
      config,
      rng,
      clock,
      equipmentRules: runtime.equipmentRules,
      baitRules: runtime.baitRules,
      getRodVirtualPos: appPorts.getRodVirtualPos,
      getDynamicBounds: appPorts.getDynamicBounds,
    });

    const fightService = new FightService({
      config,
      rng,
      fightSessionFactory: new FightSessionFactory({ config, rng }),
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

    const fishingRenderService = new FishingRenderService({
      inventory: runtime.inventory,
      input: runtime.input,
      projector: runtime.projector,
      canvasMetrics,
      clock,
      config,
      equipmentRules: runtime.equipmentRules,
      baitRules: runtime.baitRules,
      getFloat: appPorts.getFloat,
      getNet: appPorts.getNet,
      getInputState: appPorts.getInputState,
      getRodScreenX: appPorts.getRodScreenX,
      getCastDistanceRatio: appPorts.getCastDistanceRatio,
      getCurrentHookDepth: appPorts.getCurrentHookDepth,
      scratch: screenScratch,
      scratch2: screenScratch2,
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
      getDynamicBounds: appPorts.getDynamicBounds,
      getRodVirtualPos: appPorts.getRodVirtualPos,
      getScreenOffsetRatio: appPorts.getScreenOffsetRatio,
      setState: appPorts.setState,
      castLine: appPorts.castLine,
      markInvalidCast: appPorts.markInvalidCast,
      setInvalidCastMarker: appPorts.setInvalidCastMarker,
      panViewport: appPorts.panViewport,
      drawFishingElements: appPorts.drawFishingElements,
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
      fishingRenderService,
      stateDepsFactory,
      stateMachine,
      chumController,
      loop,
      debugEvents,
    };
  }
}
