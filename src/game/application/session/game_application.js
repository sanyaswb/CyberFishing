import { BaitFactory } from "../../domain/tackle/bait_factory.js";
import { Net } from "../../domain/tackle/net.js";
import { ConfigProvider } from "../../config/runtime/config_provider.js";
import { EventLifecycle } from "../../../engine/events/event_lifecycle.js";
import { FishingCastExposureResolver } from "../../domain/fishing/fishing_cast_exposure_resolver.js";
import { GameFishingFacade } from "../fishing/game_fishing_facade.js";
import { InventoryItemLocation } from "../../domain/inventory/inventory_item_location.js";

export class GameApplication {
  #messages;
  #projector;
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
  #castPenalty;
  #depthUI;
  #timeUI;
  #holdUI;
  #hasEquippedNet = false;
  #location;
  #rng;
  #devFlags;
  #runtimeConfig;
  #debugEvents;
  #windowTarget;
  #documentTarget;
  #logger;
  #clock;
  #fishDatabase;
  #castExposureResolver = new FishingCastExposureResolver();
  #listeners = new EventLifecycle();
  #disposed = false;
  #loop;
  #world;
  #renderCoordinator;
  #assetPreloadCoordinator;
  #locationAssetLoader;
  #fishingController;
  #chumController;
  #stateMachine;
  #config;
  #composition;
  #debugService;
  #fightService;
  #viewportFacade;
  #diagnostics;
  #equipmentRules;
  #baitRules;
  #fishingFacade;
  #castRodScreenX = null;
  #removeInventoryChangedListener = null;
  // Reusable debug context object — allocated once, never recreated per frame.
  #debugContext;
  #dayOfWeek = new Date().getDay();
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
    castPowerIncrease: false,
    castPowerDecrease: false,
    aimLeft: false,
    aimRight: false,
    retrieve: false,
    clickPos: null,
    isDoubleClick: false,
    longPressPos: null,
    pointerDown: false,
    pointerStart: { x: 0, y: 0 },
    pointerCurrent: { x: 0, y: 0 },
    pointerDelta: { x: 0, y: 0 },
    pointerGestureId: 0,
    pointerReleased: false,
    pointerReleaseCancelled: false,
    pointerRelease: { x: 0, y: 0 },
    rodControlActive: false,
    rodControlDirectionX: 0,
    rodControlInputRatio: 0,
    rodControlAnchorX: 0,
    rodControlCurrentX: 0,
  };
  #stateUpdateContext = { env: null, biteEnv: null, input: null };
  #biteEnvData = {
    locationId: "",
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
    messages,
    canvas,
    canvasMetrics,
    config,
    compositionRoot,
    devFlags,
    audio,
    debugEvents,
    diagnostics,
    windowTarget,
    documentTarget,
    runtime = null,
    clock,
    fishDatabase,
    logger,
  }) {
    this.#messages = messages;
    this.#clock = clock;
    this.#fishDatabase = fishDatabase;
    this.#logger = logger;
    this.#canvasMetrics = canvasMetrics;
    this.#config = new ConfigProvider(config);
    // The live runtime config the tackle entities read (DEV adapter overrides stay live).
    this.#runtimeConfig = config;
    this.#composition = compositionRoot;
    this.#devFlags = devFlags;
    this.#debugEvents = debugEvents;
    this.#windowTarget = windowTarget;
    this.#documentTarget = documentTarget;
    this.#diagnostics = diagnostics;
    runtime =
      runtime ||
      this.#composition.create(
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
    this.#env = runtime.env;
    this.#input = runtime.input;
    this.#ui = runtime.ui;
    this.#inventoryUI = runtime.inventoryUI;
    this.#chum = runtime.chum;
    this.#bite = runtime.bite;
    this.#inventory = runtime.inventory;
    this.#inventory.setFreshnessExposureProvider((item) => {
      const active = ["waiting", "biting", "playing"].includes(
        this.#stateMachine?.currentName || this.#gameStateName,
      );
      return active && InventoryItemLocation.isAttached(item?.location)
        ? this.#getCastExposureMs()
        : 0;
    });
    this.#world = runtime.world;
    this.#assetPreloadCoordinator = runtime.rendering.assetPreloadCoordinator;
    if (
      !this.#assetPreloadCoordinator ||
      typeof this.#assetPreloadCoordinator.preloadVictoryAssets !== "function"
    ) {
      throw new TypeError("GameApplication requires AssetPreloadCoordinator");
    }
    this.#locationAssetLoader = runtime.rendering.locationAssetLoader;
    if (!this.#locationAssetLoader || typeof this.#locationAssetLoader.load !== "function") {
      throw new TypeError("GameApplication requires LocationAssetLoader");
    }
    this.#fishingController = runtime.fishing;
    this.#net = runtime.net;
    this.#castPenalty = runtime.castPenalty;
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
      getBaseRodVirtualPos: (bounds) => this.getBaseRodVirtualPos(bounds),
      getRodScreenX: () => this.getRodScreenX(),
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
      getInvalidCastMarker: () => this.invalidCastMarker,
      isDebugEnabled: () => this.isDebugEnabled(),
      emitDebugEvent: (type, detail) => this.emitDebugEvent(type, detail),
      subscribeConfigUpdated: (handler) => this.subscribeConfigUpdated(handler),
      getViewportSize: () => this.getViewportSize(),
      panViewport: (deltaX) => this.#world.pan(deltaX, 0),
      getInputState: () => this.#lastInputState,
      getChumPowerAimVisual: () =>
        this.#chumController.getPowerAimVisualState() || null,
      getChumAccuracyPreview: () =>
        this.#chumController.getPowerAimAccuracyPreview(
          this.getDynamicBounds(),
        ) || null,
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
      runtimeConfig: this.#runtimeConfig,
      audio,
      debugEvents: this.#debugEvents,
      canvasMetrics: this.#canvasMetrics,
      biteEnvData: this.#biteEnvData,
    });

    this.#loop = services.loop;
    this.#fightService = services.fightService;
    if (services.debugService != null && typeof services.debugService.update !== "function") {
      throw new TypeError("GameApplication requires optional debugService.update");
    }
    this.#debugService = services.debugService;
    this.#chumController = services.chumController;
    this.#stateMachine = services.stateMachine;
    this.#renderCoordinator = services.renderCoordinator;
    this.#viewportFacade = services.viewportFacade;
    this.#fishingFacade = new GameFishingFacade({
      inventory: this.#inventory,
      chum: this.#chum,
      playerCastRules: runtime.playerCastRules,
      equipmentRules: runtime.equipmentRules,
      config: this.#config,
      castService: services.castService,
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

    this.#debugContext = this.#debugService == null ? null : this.#createDebugContext();

    this.#rebuildFloat();

    this.#initEvents();
    this.setState("scouting");
  }

  #createDebugContext() {
    return {
      emitDebugEvent: (type, detail) => this.emitDebugEvent(type, detail),
      getEnvSnapshot: () => this.#env.getSnapshot() || {},
      getFloatPosition: () => this.#float?.getPosition?.() || { x: 0, y: 0 },
      getBiteEnv: () => this.getEnvDataForBite(),
      getEquipment: () => this.#inventory.getEquipped() || {},
      getInputState: () => this.#lastInputState,
      getGameStateName: () => this.gameStateName,
      getCastExposureMs: () => this.#getCastExposureMs(),
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
        return typeof state?.getDiagnostics === "function"
          ? state.getDiagnostics()
          : null;
      },
    };
  }

  #handleInventoryChanged(newEq) {
    const netConfig = newEq.net
      ? newEq.net.effectiveStats || newEq.net
      : { active: false, maxWeight: 0, length: 10, chances: [] };

    if (this.#net && typeof this.#net.updateConfig === "function") {
      this.#net.updateConfig(netConfig);
    } else {
      this.#net = new Net(
        netConfig,
        this.#config.fightPhysicsConfig?.getDistanceConfig?.() || {},
      );
    }

    this.#hasEquippedNet = !!newEq.net;
    this.#chumController.refreshActiveHandChum();

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
        eq.baits[0].variant || eq.baits[0].itemType,
      );
      physicsConfig = { ...eq.baits[0] };
    } else if (eq.rod?.variant === "feeder" && eq.feederRig) {
      physicsType = "feeder";
      physicsConfig = { ...eq.feederRig };
    } else if (eq.float) {
      physicsType = "float";
      physicsConfig = { ...eq.float };
    }

    this.#float = BaitFactory.create(
      physicsType,
      0,
      0,
      physicsConfig,
      eq,
      this.#rng,
      this.#debugEvents,
      this.#devFlags,
      this.#runtimeConfig,
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

    this.subscribeConfigUpdated((e) => {
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
        this.#reloadLocationConfig().catch((error) => {
          this.#logger.error("[Location] Failed to reload location config", error);
        });
      }
      this.#renderCoordinator.invalidateStyles();
    });
    this.#diagnostics.subscribeHookedFishRuntimeUpdated((e) => {
      this.#handleHookedFishRuntimeUpdate(e);
    });
  }

  #isItemDatabaseUpdate(event) {
    const path = event?.detail?.path;
    return Array.isArray(path) && path[0] === "ITEM_DB";
  }

  #handleItemDatabaseUpdate() {
    this.#inventory.refreshItemData();
    const eq = this.#inventory.getEquipped();
    if (eq) this.#fightService.syncEquipment(eq);
  }

  #isFishDatabaseUpdate(event) {
    const path = event?.detail?.path;
    return Array.isArray(path) && path[0] === "FISH_DB";
  }

  #handleFishDatabaseUpdate() {
    this.#bite.setFishDatabase(this.#fishDatabase);
  }

  #handleHookedFishRuntimeUpdate(event) {
    const fish = event?.detail?.fish;
    if (!fish) return;
    this.#fightService.syncFishRuntime(fish);
  }

  #isMapDatabaseUpdate(event) {
    const path = event?.detail?.path;
    return Array.isArray(path) && path[0] === "MAP_DB";
  }

  #handleMapDatabaseUpdate() {
    this.#reloadLocationConfig().catch((error) => {
      this.#logger.error("[Location] Failed to reload map config", error);
    });
  }

  async #reloadLocationConfig() {
    const locationId = this.#location.id;
    await this.#assetPreloadCoordinator.preloadLocation(locationId);
    const resources = await this.#locationAssetLoader.load(
      locationId,
      this.#location.config,
      this.#config.locations,
    );
    this.#viewportFacade.refreshLocationConfig(this.#config.locations, resources);
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
    const rodWasRetrieved = this.#shouldConsumeWetFeederChum(
      currentName,
      name,
    );
    const retrievalContext = rodWasRetrieved
      ? this.#createRodRetrievalContext()
      : null;
    if (retrievalContext) this.#consumeWetFeederChum(retrievalContext);
    if (name === "scouting") {
      this.#castRodScreenX = null;
    }
    if (name === "playing") {
      this.#preloadFishingAssets(data?.fish || {});
    }
    if (name === "victory") {
      return this.#transitionToVictoryWhenAssetsReady(data, {
        rodRetrievalContext: retrievalContext,
      });
    }
    this.#stateMachine.setState(name, data);
    if (retrievalContext) {
      this.#inventory.handleRodRetrieved(retrievalContext);
    }
  }

  #preloadFishingAssets(fish) {
    this.#assetPreloadCoordinator
      .preloadFishingAssets(this.#inventory.getEquipped(), fish)
      .catch(() => {});
  }

  #transitionToVictoryWhenAssetsReady(
    data,
    { rodRetrievalContext = null } = {},
  ) {
    return this.#assetPreloadCoordinator
      .preloadVictoryAssets(data?.fish || {})
      .then(() => {
        this.#stateMachine.setState("victory", data);
        if (rodRetrievalContext) {
          this.#inventory.handleRodRetrieved(rodRetrievalContext);
        }
      })
      .catch((error) => {
        this.#stateMachine.setState("failed", {
          reason: "asset_load_failed",
          error,
        });
        if (rodRetrievalContext) {
          this.#inventory.handleRodRetrieved(rodRetrievalContext);
        }
      });
  }

  update(dt) {
    const timeScale = this.#config.debug?.timeScale || 1;
    this.#syncDragControlAvailability();
    const input = this.#input.getState();
    this.#lastInputState = input;
    this.#applyViewportPan(input);
    const bounds = this.getDynamicBounds();

    const envSnapshot = this.#world.update(dt, timeScale, bounds);
    this.#castPenalty.update(dt);
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
    this.#inventoryUI.updateDynamicProgression(dt);
    this.#updateRodVisualOffset(dt, input, bounds);

    if (this.invalidCastMarker) {
      this.invalidCastMarker.timer -= dt;
      if (this.invalidCastMarker.timer <= 0) this.invalidCastMarker = null;
    }

    // Reuse the pre-built debug context object — no per-frame allocation.
    this.#debugService?.update(this.#debugContext);
  }

  #syncDragControlAvailability() {
    const eq = this.#inventory.getEquipped() || {};
    const rodAllowsReel = eq.rod?.effectiveStats?.hasReel !== false;
    const reelHasDrag = !!eq.reel && eq.reel.effectiveStats?.hasDrag !== false;
    this.#input.setDragControlEnabled(rodAllowsReel && reelHasDrag);
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

  #consumeWetFeederChum(context = this.#createRodRetrievalContext()) {
    this.#fishingController.consumeWetFeederChum(
      context.equipment,
      context.exposureMs,
    );
  }

  #getCastExposureMs() {
    return this.#castExposureResolver.resolve({
      nowMs: this.#clock.now,
      castStartTimeMs: this.castStartTime,
      timeScale: this.#config.debug?.timeScale || 1,
    });
  }

  #createRodRetrievalContext() {
    const equipment = this.#inventory.getEquipped() || {};
    return Object.freeze({
      equipment,
      exposureMs: this.#getCastExposureMs(),
      exposureToken: `cast:${this.castStartTime}`,
      baitInstanceIds: Object.freeze(
        (equipment.baits || [])
          .filter((bait) => bait?.instanceId)
          .map((bait) => bait.instanceId),
      ),
    });
  }

  draw() {
    this.#renderCoordinator.render();
  }

  castLine(vx, vy, cellDepth, options = {}) {
    const currentName = this.#stateMachine?.currentName || this.#gameStateName;
    if (
      currentName === "waiting" ||
      currentName === "biting" ||
      currentName === "playing"
    ) {
      const retrievalContext = this.#createRodRetrievalContext();
      this.#consumeWetFeederChum(retrievalContext);
      this.#inventory.handleRodRetrieved(retrievalContext);
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
    } else if (result?.reason === "missing_line") {
      this.#showMissingLineInventoryWarning();
    }
    return result;
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

  getBaseRodVirtualPos(bounds) {
    return this.#viewportFacade.getBaseRodVirtualPos(
      bounds,
      this.#castRodScreenX,
    );
  }

  getRodScreenX(bounds = null) {
    return this.#viewportFacade.getRodScreenX(
      this.#castRodScreenX,
      bounds || this.getDynamicBounds(),
    );
  }

  getScreenOffsetRatio(floatPos) {
    return this.#viewportFacade.getScreenOffsetRatio(
      floatPos,
      this.#castRodScreenX,
    );
  }

  #updateRodVisualOffset(dt, input, bounds) {
    const stateName = this.#stateMachine?.currentName || this.#gameStateName;
    const fightDebug = this.#fightService?.tensionMeter?.getFightFrame?.() || {};
    this.#viewportFacade.updateRodVisualOffset({
      dtMs: dt,
      input,
      fightDebug,
      bounds,
      stateName,
    });
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
    this.#chumController.setAiming(value);
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
    this.#inventoryUI.open();
    this.#inventoryUI.showWarning(this.#messages.equipRodToCast);
  }

  #showMissingReelInventoryWarning() {
    const eq = this.#inventory.getEquipped();
    const rodName = this.#equipmentRules.getRodDisplayName(eq) || this.#messages.unnamedRod;
    this.#inventoryUI.open();
    this.#inventoryUI.showWarning(
      this.#messages.rodNeedsReelToCast(rodName),
    );
  }

  #showMissingLineInventoryWarning() {
    this.#inventoryUI.open();
    this.#inventoryUI.showWarning(this.#messages.equipLineToCast);
  }

  start() {
    return this.#loop.start();
  }

  stop() {
    this.#loop?.stop();
  }

  dispose() {
    if (this.#disposed) return;
    this.#disposed = true;
    this.stop();
    this.#stateMachine?.dispose();
    this.#removeInventoryChangedListener?.();
    this.#removeInventoryChangedListener = null;

    this.#input?.dispose?.();
    this.#chumController?.dispose?.();
    this.#chum?.dispose?.();
    this.#inventory?.dispose?.();
    this.#inventoryUI?.dispose?.();
    this.#depthUI?.dispose?.();
    this.#timeUI?.dispose?.();
    this.#holdUI?.dispose?.();
    if (this.#ui) {
      this.#ui.onNetClick = null;
      this.#ui.onContinueClick = null;
      this.#ui.dispose?.();
    }
    this.#listeners.dispose();
    this.#diagnostics.dispose();
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
    return this.#diagnostics.isDebugEnabled();
  }
  subscribeConfigUpdated(handler) {
    // Runtime config edits (DEV tools in practice) arrive as "config-updated" events on the document.
    return this.#listeners.add(this.#documentTarget, "config-updated", handler);
  }
  getViewportSize() {
    return this.#viewportFacade.getViewportSize();
  }
  emitDebugEvent(type, detail) {
    this.#diagnostics.emit(type, detail);
  }
  onDebugEvent(type, handler) {
    return this.#diagnostics.on(type, handler);
  }
  get float() {
    return this.#float;
  }
  get castPenalty() {
    return this.#castPenalty;
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
