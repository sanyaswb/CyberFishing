class GameViewportFacade {
  #world;
  #projector;
  #canvasMetrics;
  #config;
  #biteEnvironmentService;
  #rodVirtualPos = new Vector2(0, 0);
  #screenScratch = new Vector2(0, 0);
  #viewportSize = { width: 0, height: 0 };

  constructor({
    world,
    projector,
    canvasMetrics,
    config,
    biteEnvironmentService,
  }) {
    this.#world = world;
    this.#projector = projector;
    this.#canvasMetrics = canvasMetrics;
    this.#config = config;
    this.#biteEnvironmentService = biteEnvironmentService;
  }

  refreshViewport(recalculateMap = true) {
    this.#world.refreshViewport(recalculateMap);
  }

  refreshLocationConfig(locationsConfig) {
    this.#world.refreshLocationConfig(locationsConfig);
  }

  applyPan(input, stateName, isAimingChum) {
    if (!input.panDeltaX && !input.panDeltaY) return;
    if (stateName !== "scouting" && !isAimingChum) return;
    if (
      this.#config.casting?.enabled !== false &&
      input.pointerDown &&
      (stateName === "scouting" || isAimingChum)
    ) {
      return;
    }
    this.#world.pan(input.panDeltaX, 0);
  }

  getDynamicBounds() {
    return this.#biteEnvironmentService.getDynamicBounds();
  }

  checkWater(vx, vy) {
    return this.#biteEnvironmentService.checkWater(vx, vy);
  }

  getRodVirtualPos(bounds, screenXOverride = null) {
    const rodConfig = this.#config.ui?.rod || {};
    const rodX =
      Number.isFinite(screenXOverride)
        ? screenXOverride
        : rodConfig.x === "center"
          ? this.#canvasMetrics.width / 2
          : Number(rodConfig.x);
    const screenX = Number.isFinite(rodX)
      ? rodX
      : this.#canvasMetrics.width / 2;

    this.#projector.screenToVirtual(screenX, 0, this.#rodVirtualPos);
    this.#rodVirtualPos.y = bounds.bottom;
    return this.#rodVirtualPos;
  }

  getScreenOffsetRatio(floatPos, screenXOverride = null) {
    const sPos = this.#projector.virtualToScreen(
      floatPos.x,
      floatPos.y,
      this.#screenScratch,
    );
    const rodConfig = this.#config.ui?.rod || {};
    const rodX =
      Number.isFinite(screenXOverride)
        ? screenXOverride
        : rodConfig.x === "center"
          ? this.#canvasMetrics.width / 2
          : Number(rodConfig.x);
    const screenX = Number.isFinite(rodX)
      ? rodX
      : this.#canvasMetrics.width / 2;
    const halfWidth = Math.max(1, this.#canvasMetrics.width / 2);
    return Math.min(1, Math.abs(sPos.x - screenX) / halfWidth);
  }

  getViewportSize() {
    this.#viewportSize.width = this.#canvasMetrics.width;
    this.#viewportSize.height = this.#canvasMetrics.height;
    return this.#viewportSize;
  }
}

class GameDebugFacade {
  #devFlags;
  #debugEvents;
  #listeners;
  #documentTarget;

  constructor({ devFlags, debugEvents, listeners, documentTarget }) {
    this.#devFlags = devFlags;
    this.#debugEvents = debugEvents;
    this.#listeners = listeners;
    this.#documentTarget = documentTarget;
  }

  isDebugEnabled() {
    return this.#devFlags.isDebugEnabled();
  }

  emit(type, detail) {
    this.#debugEvents.emit(type, detail);
  }

  on(type, handler) {
    return this.#debugEvents.on(type, handler);
  }

  subscribeConfigUpdated(handler) {
    return this.#listeners.add(this.#documentTarget, "config-updated", handler);
  }

  clear() {
    this.#debugEvents.clear();
  }
}

class GameFishingFacade {
  #inventory;
  #chum;
  #playerCastRules;
  #equipmentRules;
  #config;
  #castService;
  #fishingRenderService;
  #biteEnvironmentService;
  #getCurrentHookDepth;
  #setCurrentHookDepth;
  #setFloat;
  #setCastDistanceRatio;
  #setCastStartTime;
  #setState;

  constructor({
    inventory,
    chum,
    playerCastRules,
    equipmentRules,
    config,
    castService,
    fishingRenderService,
    biteEnvironmentService,
    getCurrentHookDepth,
    setCurrentHookDepth,
    setFloat,
    setCastDistanceRatio,
    setCastStartTime,
    setState,
  }) {
    this.#inventory = inventory;
    this.#chum = chum;
    this.#playerCastRules = playerCastRules;
    this.#equipmentRules = equipmentRules;
    this.#config = config;
    this.#castService = castService;
    this.#fishingRenderService = fishingRenderService;
    this.#biteEnvironmentService = biteEnvironmentService;
    this.#getCurrentHookDepth = getCurrentHookDepth;
    this.#setCurrentHookDepth = setCurrentHookDepth;
    this.#setFloat = setFloat;
    this.#setCastDistanceRatio = setCastDistanceRatio;
    this.#setCastStartTime = setCastStartTime;
    this.#setState = setState;
  }

  castLine(vx, vy, cellDepth, options = {}) {
    const result = this.#castService.cast(vx, vy, cellDepth, {
      equipment: this.#inventory.getEquipped(),
      currentHookDepth: this.#getCurrentHookDepth(),
      rodVirtualPos: options.rodVirtualPos || null,
    });
    if (!result.success) return result;

    this.#setFloat(result.floatEntity);
    this.#setCastDistanceRatio(result.castDistanceRatio);
    this.#setCastStartTime(result.castStartTime);
    this.#setCurrentHookDepth(result.currentHookDepth);
    this.#setState(result.nextState);
    return result;
  }

  drawFishingElements(renderer, bottom, state, tMeter, fCond, startTime) {
    this.#fishingRenderService.draw(
      renderer,
      bottom,
      state,
      tMeter,
      fCond,
      startTime,
    );
  }

  canPlayerCast() {
    const equipment = this.#inventory.getEquipped();
    const activeBoat = this.#chum.getBoats()[0] || null;
    return this.#playerCastRules.canPlayerCast(equipment, activeBoat);
  }

  getMaxHookDepth() {
    return this.#equipmentRules.getMaxHookDepth(
      this.#inventory.getEquipped(),
      this.#config,
    );
  }

  getEnvDataForBite() {
    return this.#biteEnvironmentService.getBiteEnvData();
  }
}

class GameApplication {
  #projector;
  #map;
  #env;
  #input;
  #ui;
  #inventoryUI;
  #chum;
  #bite;
  #inventory;
  #gameStateName = "scouting";
  #canvasMetrics;
  #float;
  #net;
  #castManager;
  #depthUI;
  #timeUI;
  #holdUI;
  #hasEquippedNet = false;
  #location;
  #rng;
  #devFlags;
  #debugEvents;
  #windowTarget;
  #documentTarget;
  #clock = new GameClock();
  #listeners = new EventLifecycle();
  #loop;
  #world;
  #renderSystem;
  #fishingController;
  #chumController;
  #stateMachine;
  #config;
  #composition;
  #debugService;
  #fightService;
  #viewportFacade;
  #debugFacade;
  #equipmentRules;
  #baitRules;
  #fishingFacade;
  #castRodScreenX = null;
  #removeInventoryChangedListener = null;
  // Reusable debug context object — allocated once, never recreated per frame.
  #debugContext;
  #dayOfWeek = new Date().getDay();
  #screenScratch = new Vector2(0, 0);
  #screenScratch2 = new Vector2(0, 0);
  #lastInputState = {
    isPulling: false,
    pullDirection: null,
    panDeltaX: 0,
    panDeltaY: 0,
    swipeDeltaY: 0,
    toggleHold: false,
    pumpAction: false,
    dragIncrease: false,
    dragDecrease: false,
    retrieve: false,
    clickPos: null,
    isDoubleClick: false,
    longPressPos: null,
    pointerDown: false,
    pointerStart: { x: 0, y: 0 },
    pointerCurrent: { x: 0, y: 0 },
    pointerDelta: { x: 0, y: 0 },
    pointerReleased: false,
    pointerRelease: { x: 0, y: 0 },
  };
  #stateUpdateContext = { env: null, biteEnv: null, input: null };
  #biteEnvData = {
    hookDepth: 0,
    bottomDepth: 0,
    lineLength: 0,
    timePhase: "day",
    dayOfWeek: 0,
    zoneBonus: 1,
    chumBonus: 1,
    chumTargets: [],
    isRaining: false,
    isFoggy: false,
    castSpamMultiplier: 1,
  };
  eatenBaits = [];

  invalidCastMarker = null;
  castStartTime = 0;
  castDistanceRatio = 0;
  currentHookDepth = 1.0;
  lastTime = 0;

  constructor({
    canvas,
    canvasMetrics,
    config,
    compositionRoot,
    devFlags,
    audio,
    debugEvents,
    windowTarget,
    documentTarget,
  }) {
    this.#canvasMetrics = canvasMetrics;
    this.#config = new ConfigProvider(config);
    this.#composition = compositionRoot;
    this.#devFlags = devFlags;
    this.#debugEvents = debugEvents;
    this.#windowTarget = windowTarget;
    this.#documentTarget = documentTarget;
    this.#debugFacade = new GameDebugFacade({
      devFlags: this.#devFlags,
      debugEvents: this.#debugEvents,
      listeners: this.#listeners,
      documentTarget: this.#documentTarget,
    });
    const runtime = this.#composition.create(
      canvas,
      this.#canvasMetrics,
      this.#clock,
      this.#debugEvents,
      this.#devFlags,
      audio,
    );
    this.#location = runtime.location;
    this.#rng = runtime.rng;
    this.#projector = runtime.projector;
    this.#map = runtime.map;
    this.#env = runtime.env;
    this.#input = runtime.input;
    this.#ui = runtime.ui;
    this.#inventoryUI = runtime.inventoryUI;
    this.#chum = runtime.chum;
    this.#bite = runtime.bite;
    this.#inventory = runtime.inventory;
    this.#world = runtime.world;
    this.#renderSystem = runtime.renderSystem;
    this.#fishingController = runtime.fishing;
    this.#net = runtime.net;
    this.#castManager = runtime.castManager;
    this.#equipmentRules = runtime.equipmentRules;
    this.#baitRules = runtime.baitRules;
    this.#depthUI = runtime.depthUI;
    this.#timeUI = runtime.timeUI;
    this.#holdUI = runtime.holdUI;
    const appPorts = {
      update: (dt) => {
        this.update(dt);
        this.lastTime = this.#clock.now;
      },
      draw: () => this.draw(),
      getFloat: () => this.#float,
      getNet: () => this.#net,
      getCurrentHookDepth: () => this.currentHookDepth,
      getCastStartTime: () => this.castStartTime,
      getCastDistanceRatio: () => this.castDistanceRatio,
      getDayOfWeek: () => this.#dayOfWeek,
      getChumCastDistance: () => this.chumCastDistance,
      isAimingChum: () => this.isAimingChum,
      eatenBaits: this.eatenBaits,
      currentHookDepthRef: {
        get: () => this.currentHookDepth,
        set: (value) => {
          this.currentHookDepth = value;
        },
      },
      canPlayerCast: () => this.canPlayerCast(),
      getMaxHookDepth: () => this.getMaxHookDepth(),
      checkWater: (vx, vy) => this.checkWater(vx, vy),
      getBiteEnv: () => this.getEnvDataForBite(),
      getDynamicBounds: () => this.getDynamicBounds(),
      getRodVirtualPos: (bounds) => this.getRodVirtualPos(bounds),
      getRodScreenX: () => this.#castRodScreenX,
      getScreenOffsetRatio: (pos) => this.getScreenOffsetRatio(pos),
      setState: (name, data) => this.setState(name, data),
      castLine: (vx, vy, depth, options) =>
        this.castLine(vx, vy, depth, options),
      markInvalidCast: (pos) => this.markInvalidCast(pos),
      showMissingRodInventoryWarning: () =>
        this.#showMissingRodInventoryWarning(),
      showMissingReelInventoryWarning: () =>
        this.#showMissingReelInventoryWarning(),
      showMissingLineInventoryWarning: () =>
        this.#showMissingLineInventoryWarning(),
      setInvalidCastMarker: (marker) => {
        this.invalidCastMarker = marker;
      },
      drawFishingElements: (
        renderer,
        bottom,
        state,
        tMeter,
        fCond,
        startTime,
      ) =>
        this.drawFishingElements(
          renderer,
          bottom,
          state,
          tMeter,
          fCond,
          startTime,
        ),
      isDebugEnabled: () => this.isDebugEnabled(),
      emitDebugEvent: (type, detail) => this.emitDebugEvent(type, detail),
      subscribeConfigUpdated: (handler) => this.subscribeConfigUpdated(handler),
      getViewportSize: () => this.getViewportSize(),
      panViewport: (deltaX) => this.#world.pan(deltaX, 0),
      getInputState: () => this.#lastInputState,
      getGameStateName: () =>
        this.#stateMachine?.currentName || this.#gameStateName,
      onStateChanged: (name) => {
        this.#gameStateName = name;
        if (this.#inventory) this.#inventory.setLock(name !== "scouting");
      },
    };

    const services = this.#composition.createApplicationServices({
      runtime,
      appPorts,
      config: this.#config,
      clock: this.#clock,
      rng: this.#rng,
      devFlags: this.#devFlags,
      audio,
      debugEvents: this.#debugEvents,
      canvasMetrics: this.#canvasMetrics,
      biteEnvData: this.#biteEnvData,
      screenScratch: this.#screenScratch,
      screenScratch2: this.#screenScratch2,
    });

    this.#loop = services.loop;
    this.#fightService = services.fightService;
    this.#debugService = services.debugService;
    this.#chumController = services.chumController;
    this.#stateMachine = services.stateMachine;
    this.#viewportFacade = new GameViewportFacade({
      world: this.#world,
      projector: this.#projector,
      canvasMetrics: this.#canvasMetrics,
      config: this.#config,
      biteEnvironmentService: services.biteEnvironmentService,
    });
    this.#fishingFacade = new GameFishingFacade({
      inventory: this.#inventory,
      chum: this.#chum,
      playerCastRules: runtime.playerCastRules,
      equipmentRules: runtime.equipmentRules,
      config: this.#config,
      castService: services.castService,
      fishingRenderService: services.fishingRenderService,
      biteEnvironmentService: services.biteEnvironmentService,
      getCurrentHookDepth: () => this.currentHookDepth,
      setCurrentHookDepth: (value) => {
        this.currentHookDepth = value;
      },
      setFloat: (floatEntity) => {
        this.#float = floatEntity;
      },
      setCastDistanceRatio: (value) => {
        this.castDistanceRatio = value;
      },
      setCastStartTime: (value) => {
        this.castStartTime = value;
      },
      setState: (name, data) => this.setState(name, data),
    });

    this.#debugContext = this.#createDebugContext();

    this.#rebuildFloat();

    this.#initEvents();
    this.setState("scouting");
  }

  #createDebugContext() {
    return {
      emitDebugEvent: (type, detail) => this.emitDebugEvent(type, detail),
      getEnvSnapshot: () => this.#env?.getSnapshot?.() || {},
      getFloatPosition: () => this.#float?.getPosition?.() || { x: 0, y: 0 },
      getBiteEnv: () => this.getEnvDataForBite(),
      getEquipment: () => this.#inventory?.getEquipped?.() || {},
      getInputState: () => this.#lastInputState,
      getGameStateName: () => this.gameStateName,
      getLiveChances: (biteEnv, options) => {
        const bite = this.#bite;
        return (
          bite?.getLiveChances?.(biteEnv, options) ||
          bite?.getDebugChances?.(biteEnv, options) ||
          bite?.calculateLiveChances?.(biteEnv, options) ||
          bite?.previewChances?.(biteEnv, options) ||
          null
        );
      },
      getChumZones: () =>
        this.#chum?.getChumZones?.() ||
        this.#chum?.getZones?.() ||
        this.#chum?.zones ||
        [],
      getActiveBoat: () => {
        const controllerBoat = this.#chumController?.activeBoat;
        if (controllerBoat) return controllerBoat;
        const boats = this.#chum?.getBoats?.();
        return boats && boats.length > 0 ? boats[0] : null;
      },
      checkWater: (vx, vy) => this.checkWater(vx, vy),
      getChumDataAt: (vx, vy) =>
        this.#chum?.getChumDataAt?.(vx, vy) || { bonus: 1, targets: [] },
      getStateDebugData: () => {
        const state = this.#stateMachine?.currentState;
        return typeof state?.getDebugData === "function"
          ? state.getDebugData()
          : null;
      },
    };
  }

  #handleInventoryChanged(newEq) {
    const netConfig = newEq.net
      ? { ...newEq.net, ...(newEq.net.engineStats || {}) }
      : { active: false, maxWeight: 0, length: 10, chances: [] };

    if (this.#net && typeof this.#net.updateConfig === "function") {
      this.#net.updateConfig(netConfig);
    } else {
      this.#net = new Net(netConfig);
    }

    this.#hasEquippedNet = !!newEq.net;
    this.#chumController?.refreshActiveHandChum();

    if (typeof this.#ui?.updateNetButtonState === "function") {
      this.#ui.updateNetButtonState(this.#hasEquippedNet, false);
    }

    if (this.#depthUI && typeof this.#depthUI.updateMax === "function") {
      this.#depthUI.updateMax(this.getMaxHookDepth());
    }
  }

  #rebuildFloat() {
    const eq = this.#inventory.getEquipped();

    let physicsType = "float";
    let physicsConfig = {};

    if (this.#baitRules.isActiveLure(eq.baits?.[0])) {
      physicsType = this.#baitRules.getPhysicsType(
        eq.baits[0],
        eq.baits[0].type,
      );
      physicsConfig = { ...eq.baits[0] };
    } else if (eq.float) {
      physicsType = "float";
      physicsConfig = { ...eq.float };
    } else if (eq.sinker) {
      physicsType = "float";
      physicsConfig = { ...eq.sinker };
    }

    this.#float = BaitFactory.create(
      physicsType,
      0,
      0,
      physicsConfig,
      eq,
      this.#rng,
    );
  }

  #initEvents() {
    this.#removeInventoryChangedListener?.();
    this.#removeInventoryChangedListener = this.#inventory.onInventoryChanged(
      (detail) => {
        this.#handleInventoryChanged(
          detail?.equipment || this.#inventory.getEquipped(),
        );
      },
    );
    this.#handleInventoryChanged(this.#inventory.getEquipped());

    this.#listeners.add(this.#windowTarget, "resize", () => {
      this.#canvasMetrics.resizeToViewport();
      this.#refreshViewport();
    });

    this.#ui.onNetClick = () => {
      const state = this.#stateMachine?.currentState;
      if (state && typeof state.handleNetClick === "function")
        state.handleNetClick();
    };

    this.#ui.onContinueClick = () => this.setState("scouting");
    this.#refreshViewport();

    this.#debugFacade.subscribeConfigUpdated((e) => {
      if (this.#isItemDatabaseUpdate(e)) {
        this.#handleItemDatabaseUpdate();
      }
      if (this.#isFishDatabaseUpdate(e)) {
        this.#handleFishDatabaseUpdate();
      }
      if (this.#isMapDatabaseUpdate(e)) {
        this.#handleMapDatabaseUpdate();
      }
      if (this.#isLocationsConfigUpdate(e)) {
        this.#viewportFacade.refreshLocationConfig(this.#config.locations);
      }
    });
  }

  #isItemDatabaseUpdate(event) {
    const path = event?.detail?.path;
    return Array.isArray(path) && path[0] === "ITEM_DB";
  }

  #handleItemDatabaseUpdate() {
    this.#inventory?.refreshItemData?.();
    const eq = this.#inventory?.getEquipped?.();
    if (eq) this.#fightService?.syncEquipment(eq);
  }

  #isFishDatabaseUpdate(event) {
    const path = event?.detail?.path;
    return Array.isArray(path) && path[0] === "FISH_DB";
  }

  #handleFishDatabaseUpdate() {
    if (typeof FISH_DB === "undefined") return;
    this.#bite?.setFishDatabase?.(FISH_DB);
  }

  #isMapDatabaseUpdate(event) {
    const path = event?.detail?.path;
    return Array.isArray(path) && path[0] === "MAP_DB";
  }

  #handleMapDatabaseUpdate() {
    this.#viewportFacade.refreshLocationConfig(this.#config.locations);
  }

  #isLocationsConfigUpdate(event) {
    const path = event?.detail?.path;
    if (!Array.isArray(path) || path.length === 0) return false;
    const rootIndex = path[0] === "CONFIG" ? 1 : 0;
    return path[rootIndex] === "locations";
  }

  #refreshViewport(recalculateMap = true) {
    this.#viewportFacade.refreshViewport(recalculateMap);
  }

  setState(name, data = {}) {
    const currentName = this.#stateMachine?.currentName || this.#gameStateName;
    if (this.#shouldConsumeWetFeederChum(currentName, name)) {
      this.#consumeWetFeederChum();
    }
    if (name === "scouting") {
      this.#castRodScreenX = null;
    }
    this.#stateMachine.setState(name, data);
  }

  update(dt) {
    const timeScale = this.#config.debug?.timeScale || 1;
    const input = this.#input.getState();
    this.#lastInputState = input;
    this.#applyViewportPan(input);
    const bounds = this.getDynamicBounds();

    const envSnapshot = this.#world.update(dt, timeScale, bounds);
    this.#castManager.update(dt);
    this.#timeUI.update(envSnapshot.time);
    this.updateChumUI();

    const wasAimingChum = this.isAimingChum;
    if (wasAimingChum) {
      this.handleChumAiming(input, bounds, dt);
      this.#blockFishingInputDuringChumAim(input);
    } else {
      this.handleGlobalBoatControl(input);
      this.#stateMachine.handleInput(input);
    }

    const context = this.#stateUpdateContext;
    context.input = input;
    context.env = this.#env.getPhysicsEnv();
    context.biteEnv = this.getEnvDataForBite();
    this.#stateMachine.update(dt, bounds, context);

    if (this.invalidCastMarker) {
      this.invalidCastMarker.timer -= dt;
      if (this.invalidCastMarker.timer <= 0) this.invalidCastMarker = null;
    }

    // Reuse the pre-built debug context object — no per-frame allocation.
    this.#debugService.update(this.#debugContext);
  }

  #applyViewportPan(input) {
    const stateName = this.#stateMachine?.currentName || this.#gameStateName;
    this.#viewportFacade.applyPan(input, stateName, this.isAimingChum);
  }

  #blockFishingInputDuringChumAim(input) {
    input.isPulling = false;
    input.pullDirection = null;
    input.longPressPos = null;
    input.clickPos = null;
    input.isDoubleClick = false;
  }

  #shouldConsumeWetFeederChum(currentName, nextName) {
    if (
      currentName !== "waiting" &&
      currentName !== "biting" &&
      currentName !== "playing"
    ) {
      return false;
    }
    return (
      nextName === "scouting" ||
      nextName === "victory" ||
      nextName === "failed"
    );
  }

  #consumeWetFeederChum() {
    const eq = this.#inventory?.getEquipped?.();
    const elapsedMs = this.#getFeederChumElapsedMs();
    this.#fishingController?.consumeWetFeederChum?.(eq, elapsedMs);
  }

  #getFeederChumElapsedMs() {
    const timeScale = this.#config.debug?.timeScale || 1;
    return Math.max(0, this.#clock.now - this.castStartTime) * timeScale;
  }

  draw() {
    const b = this.getDynamicBounds();
    const r = this.#renderSystem.drawWorld(
      this.invalidCastMarker,
      this.isDebugEnabled(),
    );

    this.#stateMachine.draw(r, b);
    this.#drawChumAimingRange(r, b);
  }

  #drawChumAimingRange(renderer, bounds) {
    if (!this.isAimingChum) return;

    const eq = this.#inventory.getEquipped();
    const method = eq.delivery ? "boat" : "hand";
    if (method !== "hand") return;

    const visual = this.#chumController.getPowerAimVisualState?.();
    if (visual && this.#config.casting?.enabled !== false) {
      if (this.#config.debug?.casting?.showChumDistanceLine) {
        renderer.drawAimingZone(
          this.#projector,
          bounds.bottom,
          this.chumCastDistance,
          "chum",
        );
      }
      if (this.#config.debug?.casting?.showAccuracyArea) {
        renderer.drawCastAccuracyPreview?.(
          this.#chumController.getPowerAimAccuracyPreview?.(bounds),
          this.#config.debug?.casting,
        );
      }
      renderer.drawCastPowerAim(
        this.#projector,
        bounds,
        visual,
        this.#config.casting,
        this.#config.tension,
        this.#clock.now,
        this.chumCastDistance,
      );
      return;
    }

    if (this.gameStateName === "scouting") return;
    if (this.#config.locations?.showAimingZone === false) return;
    if (this.#config.casting?.enabled !== false) return;

    renderer.drawAimingZone(
      this.#projector,
      bounds.bottom,
      this.chumCastDistance,
      "chum",
    );
  }

  castLine(vx, vy, cellDepth, options = {}) {
    const currentName = this.#stateMachine?.currentName || this.#gameStateName;
    if (
      currentName === "waiting" ||
      currentName === "biting" ||
      currentName === "playing"
    ) {
      this.#consumeWetFeederChum();
    }

    this.#castRodScreenX = Number.isFinite(options.rodScreenX)
      ? options.rodScreenX
      : null;
    const result = this.#fishingFacade.castLine(vx, vy, cellDepth, options);
    if (!result?.success) {
      this.#castRodScreenX = null;
    }
    if (result?.reason === "missing_rod") {
      this.#showMissingRodInventoryWarning();
    } else if (result?.reason === "missing_reel") {
      this.#showMissingReelInventoryWarning();
    }
    return result;
  }

  drawFishingElements(renderer, bottom, state, tMeter, fCond, startTime) {
    this.#fishingFacade.drawFishingElements(
      renderer,
      bottom,
      state,
      tMeter,
      fCond,
      startTime,
    );
  }

  canPlayerCast() {
    return this.#fishingFacade.canPlayerCast();
  }

  getDynamicBounds() {
    return this.#viewportFacade.getDynamicBounds();
  }

  getMaxHookDepth() {
    return this.#fishingFacade.getMaxHookDepth();
  }

  getRodVirtualPos(bounds) {
    return this.#viewportFacade.getRodVirtualPos(bounds, this.#castRodScreenX);
  }

  getScreenOffsetRatio(floatPos) {
    return this.#viewportFacade.getScreenOffsetRatio(
      floatPos,
      this.#castRodScreenX,
    );
  }

  checkWater(vx, vy) {
    return this.#viewportFacade.checkWater(vx, vy);
  }

  getEnvDataForBite() {
    return this.#fishingFacade.getEnvDataForBite();
  }

  updateChumUI() {
    this.#chumController.updateUI();
  }

  handleChumClick() {
    this.#chumController.handleClick();
  }

  toggleChumAim() {
    this.#chumController.toggleAim();
  }

  handleChumAiming(input, bounds, dt = 0) {
    this.#chumController.handleAiming(input, bounds, dt);
  }

  handleGlobalBoatControl(input) {
    this.#chumController.handleGlobalBoatControl(input);
  }

  get isAimingChum() {
    return this.#chumController?.isAiming || false;
  }

  set isAimingChum(value) {
    this.#chumController?.setAiming(value);
  }

  get activeBoat() {
    return this.#chumController?.activeBoat || null;
  }

  set activeBoat(boat) {
    if (this.#chumController) {
      this.#chumController.activeBoat = boat;
    }
  }

  markInvalidCast(p) {
    this.invalidCastMarker = { x: p.x, y: p.y, timer: 500 };
  }

  #showMissingRodInventoryWarning() {
    this.#inventoryUI?.open?.();
    this.#inventoryUI?.showWarning?.("Спочатку споряди вудку для закидання.");
  }

  #showMissingReelInventoryWarning() {
    const eq = this.#inventory?.getEquipped?.();
    const rodName = this.#equipmentRules?.getRodDisplayName?.(eq) || "Ця";
    this.#inventoryUI?.open?.();
    this.#inventoryUI?.showWarning?.(
      `${rodName}: потрібна котушка для закидання.`,
    );
  }

  #showMissingLineInventoryWarning() {
    this.#inventoryUI?.open?.();
    this.#inventoryUI?.showWarning?.("Спочатку споряди ліску для закидання.");
  }

  start() {
    this.#loop.start();
  }

  stop() {
    this.#loop.stop();
  }

  dispose() {
    this.stop();
    this.#stateMachine?.dispose();
    this.#removeInventoryChangedListener?.();
    this.#removeInventoryChangedListener = null;

    this.#input?.dispose?.();
    this.#chum?.dispose?.();
    this.#inventory?.dispose?.();
    if (this.#ui) {
      this.#ui.onNetClick = null;
      this.#ui.onContinueClick = null;
      this.#ui.dispose?.();
    }
    this.#listeners.dispose();
    this.#debugFacade.clear();
  }

  get gameStateName() {
    return this.#stateMachine?.currentName || this.#gameStateName;
  }
  get clock() {
    return this.#clock;
  }
  get rng() {
    return this.#rng;
  }
  get locationId() {
    return this.#location.id;
  }
  get chumCastDistance() {
    return this.#location.chumCastDistance;
  }
  isDebugEnabled() {
    return this.#debugFacade.isDebugEnabled();
  }
  addLifecycleListener(target, type, handler, options) {
    return this.#listeners.add(target, type, handler, options);
  }
  subscribeConfigUpdated(handler) {
    return this.#debugFacade.subscribeConfigUpdated(handler);
  }
  getViewportSize() {
    return this.#viewportFacade.getViewportSize();
  }
  emitDebugEvent(type, detail) {
    this.#debugFacade.emit(type, detail);
  }
  onDebugEvent(type, handler) {
    return this.#debugFacade.on(type, handler);
  }
  get float() {
    return this.#float;
  }
  get castManager() {
    return this.#castManager;
  }
  get fishing() {
    return this.#fishingController;
  }
  get depthUI() {
    return this.#depthUI;
  }
  get holdUI() {
    return this.#holdUI;
  }
  get net() {
    return this.#net;
  }
  get fight() {
    return this.#fightService;
  }
  get config() {
    return this.#config;
  }
}
