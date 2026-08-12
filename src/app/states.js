// ---------------------------------------------------------------------------
// JSDoc typedefs — grouped contracts per state. These contracts document the
// actual runtime shape: deps.world / deps.commands / deps.rules /
// deps.services. No state receives a `systems` bag.
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} StateWorldQueries
 * @property {(vx: number, vy: number) => object|null} checkWater
 * @property {() => object} getBiteEnv
 * @property {() => object} getDynamicBounds
 * @property {(bounds: object) => Vector2} getRodVirtualPos
 * @property {(pos: object) => number} getScreenOffsetRatio
 */

/**
 * @typedef {Object} StateCommands
 * @property {(name: string, data?: object) => void} setState
 * @property {(vx: number, vy: number, depth: number, options?: object) => void} castLine
 * @property {(pos: object) => void} markInvalidCast
 * @property {(marker: object|null) => void} setInvalidCastMarker
 * @property {(deltaX: number) => void} panViewport
 * @property {() => void} showMissingRodInventoryWarning
 */

/**
 * @typedef {Object} StateRules
 * @property {EquipmentRules} equipment
 * @property {BaitRules} bait
 * @property {CastRules} cast
 * @property {BiteRules} bite
 * @property {ChumRules} chum
 * @property {BoatRules} boat
 * @property {PlayerCastRules} playerCast
 */

/**
 * @typedef {Object} StateServices
 * @property {IDevFlagsProvider} devFlags
 * @property {IAudioService} audio
 * @property {{ isEnabled: () => boolean, emit: (type: string, detail: object) => void }} debug
 */

/**
 * @typedef {Object} ScoutingStateDeps
 * @property {InventoryManager} inventory
 * @property {UIManager} ui
 * @property {ConfigProvider} config
 * @property {ViewportProjector} projector
 * @property {ConfigProvider} config
 * @property {DepthSelectorUI} depthUI
 * @property {SeededRng} rng
 * @property {GameClock} clock
 * @property {() => boolean} canPlayerCast
 * @property {() => number} getMaxHookDepth
 * @property {() => number} getChumCastDistance
 * @property {() => { width: number, height: number }} getViewportSize
 * @property {() => boolean} isAimingChum
 * @property {{ get: () => number, set: (v: number) => void }} currentHookDepthRef
 * @property {StateWorldQueries} world
 * @property {StateCommands} commands
 * @property {StateRules} rules
 * @property {StateServices} services
 */

/**
 * @typedef {Object} WaitingStateDeps
 * @property {InventoryManager} inventory
 * @property {InputManager} input
 * @property {ViewportProjector} projector
 * @property {BiteSystem} biteSystem
 * @property {FishingController} fishing
 * @property {() => object} floatRef
 * @property {object} float
 * @property {ConfigProvider} config
 * @property {GameClock} clock
 * @property {SeededRng} rng
 * @property {CastManager} castManager
 * @property {Array} eatenBaits
 * @property {() => number} getCastStartTime
 * @property {() => boolean} canPlayerCast
 * @property {(marker: object|null) => void} setInvalidCastMarker
 * @property {() => { width: number, height: number }} getViewportSize
 * @property {StateWorldQueries} world
 * @property {StateCommands} commands
 * @property {StateRules} rules
 * @property {StateServices} services
 * @property {FixedCatchFishFactory} fixedCatchFishFactory
 */

/**
 * @typedef {Object} BitingStateDeps
 * @property {InventoryManager} inventory
 * @property {InputManager} input
 * @property {ViewportProjector} projector
 * @property {BiteSystem} biteSystem
 * @property {FishingController} fishing
 * @property {() => object} floatRef
 * @property {object} float
 * @property {SeededRng} rng
 * @property {ConfigProvider} config
 * @property {() => number} getCastStartTime
 * @property {() => boolean} canPlayerCast
 * @property {StateWorldQueries} world
 * @property {StateCommands} commands
 * @property {StateRules} rules
 * @property {StateServices} services
 */

/**
 * @typedef {Object} PlayingStateDeps
 * @property {InventoryManager} inventory
 * @property {InputManager} input
 * @property {ViewportProjector} projector
 * @property {UIManager} ui
 * @property {HoldChargesUI} holdUI
 * @property {DepthSelectorUI} depthUI
 * @property {FightService} fight
 * @property {() => Net} netRef
 * @property {Net} net
 * @property {SeededRng} rng
 * @property {GameClock} clock
 * @property {ConfigProvider} config
 * @property {() => object} floatRef
 * @property {object} float
 * @property {FishingController} fishing
 * @property {(handler: Function) => Function} subscribeConfigUpdated
 * @property {() => boolean} isDebugEnabled
 * @property {(type: string, detail: object) => void} emitDebugEvent
 * @property {StateWorldQueries} world
 * @property {StateCommands} commands
 * @property {StateRules} rules
 * @property {StateServices} services
 */

/**
 * @typedef {Object} FailedStateDeps
 * @property {UIManager} ui
 * @property {FishingController} fishing
 * @property {InventoryManager} inventory
 */

/**
 * @typedef {Object} VictoryStateDeps
 * @property {UIManager} ui
 * @property {InputManager} input
 * @property {ConfigProvider} config
 * @property {() => { width: number, height: number }} getViewportSize
 * @property {VictoryLayoutResolver} victoryLayoutResolver
 * @property {VictoryActionGestureResolver} victoryActionGestureResolver
 * @property {{ setState: (name: string, data?: object) => void }} commands
 */

class StateMachine {
  #state = null;
  #stateName = "";
  #stateInstances = {};
  #pendingState = null;
  #isTransitioning = false;
  #stateRegistry;
  #onStateChanged;

  constructor({ stateRegistry, onStateChanged }) {
    this.#stateRegistry = stateRegistry;
    this.#onStateChanged = onStateChanged;
  }

  setState(name, data = {}) {
    if (this.#isTransitioning) {
      this.#pendingState = { name, data };
      return;
    }

    this.#isTransitioning = true;
    let next = { name, data };

    try {
      while (next) {
        this.#pendingState = null;
        if (this.#state) this.#state.exit();
        this.#stateName = next.name;
        this.#onStateChanged?.(next.name);
        this.#state = this.#getStateInstance(next.name);
        this.#state.enter(next.data);
        next = this.#pendingState;
      }
    } finally {
      this.#isTransitioning = false;
    }
  }

  #getStateInstance(name) {
    if (this.#stateInstances[name]) return this.#stateInstances[name];
    const state = this.#stateRegistry(name);
    this.#stateInstances[name] = state;
    return state;
  }

  handleInput(input) {
    this.#state?.handleInput(input);
  }

  update(dt, bounds, context) {
    this.#state?.update(dt, bounds, context);
  }

  getRenderState(target, bounds) {
    this.#state?.getRenderState(target, bounds);
  }

  dispose() {
    if (this.#state) this.#state.exit();
    for (const state of Object.values(this.#stateInstances)) {
      state.dispose?.();
    }
  }

  get currentName() {
    return this.#stateName;
  }

  get currentState() {
    return this.#state;
  }
}

class StateDepsFactory {
  #root;
  constructor(root) {
    this.#root = root;
  }

  create(name) {
    switch (name) {
      case "scouting":
        return this.#createScoutingDeps();
      case "waiting":
        return this.#createWaitingDeps();
      case "biting":
        return this.#createBitingDeps();
      case "playing":
        return this.#createPlayingDeps();
      case "failed":
        return this.#createFailedDeps();
      case "victory":
        return this.#createVictoryDeps();
      default:
        throw new Error(`Unknown state deps: ${name}`);
    }
  }

  // Shared world-query functions — every state that can cast or aim needs these.
  #worldQueries() {
    return {
      world: {
        checkWater: this.#root.checkWater,
        getBiteEnv: this.#root.getBiteEnv,
        getDynamicBounds: this.#root.getDynamicBounds,
        getRodVirtualPos: this.#root.getRodVirtualPos,
        getScreenOffsetRatio: this.#root.getScreenOffsetRatio,
      },
    };
  }

  // Shared navigation commands available to all fishing states.
  #fishingCommands() {
    return {
      commands: {
        setState: this.#root.setState,
        castLine: this.#root.castLine,
        markInvalidCast: this.#root.markInvalidCast,
        setInvalidCastMarker: this.#root.setInvalidCastMarker,
        panViewport: this.#root.panViewport,
        showMissingRodInventoryWarning:
          this.#root.showMissingRodInventoryWarning,
        showMissingReelInventoryWarning:
          this.#root.showMissingReelInventoryWarning,
        showMissingLineInventoryWarning:
          this.#root.showMissingLineInventoryWarning,
      },
      rules: {
        equipment: this.#root.equipmentRules,
        bait: this.#root.baitRules,
        cast: this.#root.castRules,
        bite: this.#root.biteRules,
        chum: this.#root.chumRules,
        boat: this.#root.boatRules,
        playerCast: this.#root.playerCastRules,
      },
      services: {
        devFlags: this.#root.devFlags,
        audio: this.#root.audio,
        debug: {
          isEnabled: this.#root.isDebugEnabled,
          emit: this.#root.emitDebugEvent,
        },
      },
    };
  }

  /** @returns {ScoutingStateDeps} */
  #createScoutingDeps() {
    return Object.freeze({
      // Direct subsystem references — no `systems` bag
      inventory: this.#root.inventory,
      ui: this.#root.ui,
      projector: this.#root.projector,
      config: this.#root.config,
      depthUI: this.#root.depthUI,
      rng: this.#root.rng,
      clock: this.#root.clock,
      canPlayerCast: this.#root.canPlayerCast,
      getMaxHookDepth: this.#root.getMaxHookDepth,
      getViewportSize: this.#root.getViewportSize,
      // Live getter — value can change at runtime
      getChumCastDistance: this.#root.getChumCastDistance,
      isAimingChum: this.#root.isAimingChum,
      currentHookDepthRef: this.#root.currentHookDepthRef,
      ...this.#worldQueries(),
      ...this.#fishingCommands(),
    });
  }

  /** @returns {WaitingStateDeps} */
  #createWaitingDeps() {
    const root = this.#root;
    return Object.freeze({
      // Direct subsystem references
      inventory: root.inventory,
      input: root.input,
      projector: root.projector,
      biteSystem: root.bite,
      fishing: root.fishing,
      floatRef: root.floatRef,
      get float() {
        return this.floatRef();
      },
      config: root.config,
      clock: root.clock,
      rng: root.rng,
      castManager: root.castManager,
      eatenBaits: root.eatenBaits,
      // FIX: was a stale primitive; now a live getter function
      getCastStartTime: root.getCastStartTime,
      canPlayerCast: root.canPlayerCast,
      setInvalidCastMarker: root.setInvalidCastMarker,
      getViewportSize: root.getViewportSize,
      fixedCatchFishFactory: root.fixedCatchFishFactory,
      ...this.#worldQueries(),
      ...this.#fishingCommands(),
    });
  }

  /** @returns {BitingStateDeps} */
  #createBitingDeps() {
    const root = this.#root;
    return Object.freeze({
      // Direct subsystem references
      inventory: root.inventory,
      input: root.input,
      projector: root.projector,
      biteSystem: root.bite,
      fishing: root.fishing,
      floatRef: root.floatRef,
      get float() {
        return this.floatRef();
      },
      rng: root.rng,
      config: root.config,
      // FIX: was a stale primitive; now a live getter function
      getCastStartTime: root.getCastStartTime,
      canPlayerCast: root.canPlayerCast,
      ...this.#worldQueries(),
      ...this.#fishingCommands(),
    });
  }

  /** @returns {PlayingStateDeps} */
  #createPlayingDeps() {
    const root = this.#root;
    return Object.freeze({
      // Direct subsystem references
      inventory: root.inventory,
      input: root.input,
      projector: root.projector,
      ui: root.ui,
      holdUI: root.holdUI,
      depthUI: root.depthUI,
      fight: root.fight,
      netRef: root.netRef,
      get net() {
        return this.netRef();
      },
      rng: root.rng,
      clock: root.clock,
      config: root.config,
      floatRef: root.floatRef,
      get float() {
        return this.floatRef();
      },
      fishing: root.fishing,
      subscribeConfigUpdated: root.subscribeConfigUpdated,
      isDebugEnabled: root.isDebugEnabled,
      emitDebugEvent: root.emitDebugEvent,
      ...this.#worldQueries(),
      ...this.#fishingCommands(),
    });
  }

  /** @returns {FailedStateDeps} */
  #createFailedDeps() {
    const root = this.#root;
    return Object.freeze({
      ui: root.ui,
      fishing: root.fishing,
      inventory: root.inventory,
    });
  }

  /** @returns {VictoryStateDeps} */
  #createVictoryDeps() {
    const root = this.#root;
    return Object.freeze({
      ui: root.ui,
      input: root.input,
      config: root.config,
      getViewportSize: root.getViewportSize,
      victoryLayoutResolver: root.victoryLayoutResolver,
      victoryActionGestureResolver: root.victoryActionGestureResolver,
      commands: Object.freeze({
        setState: root.setState,
      }),
    });
  }
}

class GameState {
  constructor(deps, data = {}) {
    this.deps = deps;
    this.data = data;
  }
  enter() {}
  exit() {}
  handleInput() {}
  update() {}
  getRenderState() {}
  dispose() {}

  getSelectedHookDepthMeters() {
    return this.deps.currentHookDepthRef?.get?.() ?? null;
  }

  getEffectiveCastDistance(
    equipment,
    fallback = Infinity,
    castPowerCoefficient = null,
  ) {
    return this.deps.rules.equipment.getEffectiveCastDistance(
      equipment,
      fallback,
      castPowerCoefficient,
      this.getSelectedHookDepthMeters(),
    );
  }
}

class ScoutingState extends GameState {
  #castAim;
  #pendingCast = null;
  #missingRodWarnedForPress = false;
  #missingReelWarnedForPress = false;
  #missingLineWarnedForPress = false;
  #isUiDimmed = false;

  /** @param {ScoutingStateDeps} deps */
  constructor(deps) {
    super(deps);
    this.#castAim = new CastPowerAim({
      config: deps.config,
      projector: deps.projector,
      getViewportSize: deps.getViewportSize,
      panViewport: deps.commands.panViewport,
      rng: deps.rng,
    });
  }

  enter() {
    const eq = this.deps.inventory.getEquipped();
    const hasNet = !!eq.net;
    this.deps.ui.updateNetButtonState(hasNet, false);
    this.#pendingCast = null;
    this.#missingRodWarnedForPress = false;
    this.#missingReelWarnedForPress = false;
    this.#missingLineWarnedForPress = false;
    this.#castAim.reset();
    this.#setUiDimmed(false);
  }

  exit() {
    this.deps.depthUI.hide();
    this.#castAim.reset();
    this.#pendingCast = null;
    this.#missingRodWarnedForPress = false;
    this.#missingReelWarnedForPress = false;
    this.#missingLineWarnedForPress = false;
    this.#setUiDimmed(false);
  }

  handleInput(input) {
    if (this.#usePowerCasting()) return;

    if (input.clickPos) {
      const eq = this.deps.inventory.getEquipped();
      if (!this.#canStartRodCast(eq)) {
        if (!eq?.rod) {
          this.deps.commands.showMissingRodInventoryWarning?.();
        } else if (
          this.deps.rules.equipment.requiresReel(eq) &&
          !eq?.reel
        ) {
          this.deps.commands.showMissingReelInventoryWarning?.();
        } else {
          this.deps.commands.showMissingLineInventoryWarning?.();
        }
        return;
      }

      const vPos = this.deps.projector.screenToVirtual(
        input.clickPos.x,
        input.clickPos.y,
      );
      let cell = this.deps.world.checkWater(vPos.x, vPos.y);
      const bounds = this.deps.world.getDynamicBounds();

      const canCastAnywhere =
        this.deps.services.devFlags.isEnabled("infiniteCasting");

      if (canCastAnywhere) {
        if (!cell) cell = { depth: 2.0 };
      }

      let isInside = true;
      if (!canCastAnywhere) {
        isInside = this.deps.rules.cast.canCastAt(
          vPos.x,
          vPos.y,
          eq,
          bounds,
          this.deps.world.getRodVirtualPos(bounds),
          this.getSelectedHookDepthMeters(),
        );
      }

      if ((cell && isInside) || canCastAnywhere) {
        this.deps.commands.castLine(vPos.x, vPos.y, cell.depth);
      } else {
        this.deps.commands.markInvalidCast(input.clickPos);
      }
    }
  }

  update(dt, bounds, context) {
    this.deps.projector.focusOnVirtualPos(bounds.bottom - 200, dt, 0.03);

    if (!this.deps.isAimingChum() && this.#usePowerCasting()) {
      const didCast = this.#updatePowerCasting(dt, bounds, context?.input);
      if (didCast) return;
    }

    const eq = this.deps.inventory.getEquipped();
    const canSelectDepth = this.deps.rules.equipment.canSelectDepth(eq);

    if (!this.deps.canPlayerCast() || !canSelectDepth) {
      if (this.deps.depthUI.isActive) {
        this.deps.depthUI.hide();
      }
      this.deps.currentHookDepthRef.set(
        this.deps.config.fightPhysicsConfig?.getLureRetrieveConfig?.()
          ?.defaultSurfaceDepthMeters ??
          0.1,
      );
      return;
    }

    const maxDepth = this.deps.getMaxHookDepth();

    if (!this.deps.depthUI.isActive) {
      this.deps.depthUI.show(
        maxDepth,
        Math.min(this.deps.currentHookDepthRef.get(), maxDepth),
        (d) => {
          this.deps.currentHookDepthRef.set(d);
          this.#syncDepthCastDistance(eq, bounds);
        },
      );
    } else {
      if (typeof this.deps.depthUI.updateMax === "function") {
        this.deps.depthUI.updateMax(maxDepth);
      }
    }
    this.#syncDepthCastDistance(eq, bounds);
  }

  getRenderState(target, bounds) {
    target.stateName = "scouting";
    if (this.#usePowerCasting()) {
      if (!this.deps.isAimingChum()) {
        const visual = this.#castAim.getVisualState();
        if (visual) {
          const eq = this.deps.inventory.getEquipped();
          const maxDistance = this.getEffectiveCastDistance(eq);
          this.#populateAccuracyPreview(
            target,
            bounds,
            this.#castAim,
            visual,
          );
          this.#populatePowerAim(target, bounds, visual, maxDistance);
        }
      }
      return;
    }

    if (!this.deps.isAimingChum()) {
      if (this.deps.config.locations?.showAimingZone !== false) {
        const eq = this.deps.inventory.getEquipped();
        let maxDist = this.getEffectiveCastDistance(eq);

        if (maxDist !== Infinity) {
          maxDist = Math.min(maxDist, bounds.bottom - bounds.top);
          this.#populateAimingZone(
            target,
            bounds.bottom,
            maxDist,
            "rod",
          );
        }
      }
    } else {
      const eq = this.deps.inventory.getEquipped();
      const method = eq.delivery ? "boat" : "hand";

      if (
        method === "hand" &&
        this.deps.config.locations?.showAimingZone !== false
      ) {
        this.#populateAimingZone(
          target,
          bounds.bottom,
          this.deps.getChumCastDistance(),
          "chum",
        );
      }
    }
  }

  #updatePowerCasting(dt, bounds, input) {
    const wantsRodAim = !!(input?.pointerDown || input?.isPulling);

    if (!wantsRodAim) {
      this.#missingRodWarnedForPress = false;
      this.#missingReelWarnedForPress = false;
      this.#missingLineWarnedForPress = false;
    }

    const eq = this.deps.inventory.getEquipped();
    if (wantsRodAim && !this.#canStartRodCast(eq)) {
      this.#castAim.reset();
      this.#pendingCast = null;
      this.#setUiDimmed(false);
      if (!eq?.rod && !this.#missingRodWarnedForPress) {
        this.deps.commands.showMissingRodInventoryWarning?.();
        this.#missingRodWarnedForPress = true;
      } else if (
        eq?.rod &&
        this.deps.rules.equipment.requiresReel(eq) &&
        !eq?.reel &&
        !this.#missingReelWarnedForPress
      ) {
        this.deps.commands.showMissingReelInventoryWarning?.();
        this.#missingReelWarnedForPress = true;
      } else if (
        eq?.rod &&
        !this.deps.rules.equipment.hasEquippedLine(eq) &&
        !this.#missingLineWarnedForPress
      ) {
        this.deps.commands.showMissingLineInventoryWarning?.();
        this.#missingLineWarnedForPress = true;
      }
      return false;
    }

    if (this.#pendingCast) {
      this.#setUiDimmed(false);
      this.#pendingCast.timer -= dt;
      if (this.#pendingCast.timer <= 0) {
        this.#commitPendingCast();
        return true;
      }
      return false;
    }

    const release = this.#castAim.update(input, bounds, dt, { mode: "rod" });
    this.#setUiDimmed(!!this.#castAim.getVisualState());
    if (!release) return false;
    this.#setUiDimmed(false);

    if (this.#isCancelledRelease(release)) {
      this.#castAim.reset();
      this.#pendingCast = null;
      this.deps.commands.setState("scouting");
      return true;
    }

    const canCastAnywhere =
      this.deps.services.devFlags.isEnabled("infiniteCasting");
    const maxDistance = this.getEffectiveCastDistance(eq);
    const accuracyPx =
      Number(eq?.rod?.effectiveStats?.accuracy) ||
      this.deps.config.casting?.rodAccuracyFallbackPx ||
      80;
    const accuracyPercent = this.#getRodAccuracyPercent(eq);
    const accuracyMultiplier = this.#getRodAccuracyMultiplier(eq);
    const target = this.#castAim.resolveTarget(release, {
      bounds,
      maxDistance,
      accuracyPx,
      accuracyPercent,
      accuracyMultiplier,
      canCastAnywhere,
      checkWater: (vx, vy) => this.deps.world.checkWater(vx, vy),
    });

    if (!target?.success) {
      this.deps.commands.markInvalidCast({
        x: release.screenX,
        y: release.screenY,
      });
      return false;
    }

    this.#pendingCast = {
      timer: target.travelDelayMs,
      x: target.x,
      y: target.y,
      depth: target.depth,
      originVirtualX: target.originVirtualX,
      originVirtualY: target.originVirtualY,
      rodScreenX: target.rodScreenX,
    };
    return false;
  }

  #commitPendingCast() {
    const cast = this.#pendingCast;
    if (!cast) return;
    this.#pendingCast = null;
    this.deps.commands.castLine(cast.x, cast.y, cast.depth, {
      rodVirtualPos: {
        x: cast.originVirtualX,
        y: cast.originVirtualY,
      },
      rodScreenX: cast.rodScreenX,
    });
  }

  #usePowerCasting() {
    return this.deps.config.casting?.enabled !== false;
  }

  #canStartRodCast(eq) {
    const readiness = this.deps.inventory.evaluateCastReadiness?.(eq);
    if (typeof readiness?.canCast === "boolean") return readiness.canCast;
    if (!eq?.rod) return false;
    if (this.deps.rules.equipment.requiresReel(eq) && !eq.reel) return false;
    return this.deps.rules.equipment.hasEquippedLine(eq);
  }

  #isCancelledRelease(release) {
    const threshold = this.deps.config.casting?.cancelPowerThreshold ?? 0;
    return release.power <= threshold;
  }

  #setUiDimmed(isDimmed) {
    if (this.#isUiDimmed === isDimmed) return;

    this.#isUiDimmed = isDimmed;
    document.body.classList.toggle("scouting-pointer-hold", isDimmed);

    if (isDimmed) {
      document.body.classList.remove("scouting-pointer-release");
      return;
    }

    document.body.classList.add("scouting-pointer-release");
    requestAnimationFrame(() => {
      document.body.classList.remove("scouting-pointer-release");
    });
  }

  #populateAccuracyPreview(target, bounds, aim, visual) {
    if (!this.deps.config.debug?.casting?.showAccuracyArea) return;
    const eq = this.deps.inventory.getEquipped();
    const maxDistance = this.getEffectiveCastDistance(eq);
    const accuracyPx =
      Number(eq?.rod?.effectiveStats?.accuracy) ||
      this.deps.config.casting?.rodAccuracyFallbackPx ||
      80;
    const preview = aim.getAccuracyPreview(
      bounds,
      maxDistance,
      accuracyPx,
      this.#getRodAccuracyPercent(eq),
      this.#getRodAccuracyMultiplier(eq),
    );
    target.casting.accuracyPreview = preview;
  }

  #populatePowerAim(target, bounds, visual, maxDistance) {
    target.casting.visible = true;
    target.casting.powerVisible = true;
    target.casting.visual = visual;
    target.casting.bounds = bounds;
    target.casting.maxDistance = maxDistance;
    target.casting.nowMs = this.deps.clock.now;
  }

  #syncDepthCastDistance(eq, bounds) {
    if (!this.deps.depthUI?.isActive) return;

    const info = this.deps.rules.equipment.getCastDistanceInfo(
      eq,
      1,
      this.getSelectedHookDepthMeters(),
    );
    const pixelsPerMeter = Math.max(1, Number(info.pixelsPerMeter) || 1);
    const locationLimitPx = Math.max(0, bounds.bottom - bounds.top);
    const availablePx = Math.min(info.maxDistancePx, locationLimitPx);
    const fullLinePx = Math.min(
      info.lineLengthMeters * pixelsPerMeter,
      locationLimitPx,
    );

    this.deps.depthUI.updateCastDistance?.({
      availableMeters: availablePx / pixelsPerMeter,
      maximumMeters: fullLinePx / pixelsPerMeter,
      visible: info.isFloatDepthLimited,
    });
  }

  #populateAimingZone(target, bottom, maxDistance, mode) {
    target.casting.visible = true;
    target.casting.zoneVisible = true;
    target.casting.virtualBottomY = bottom;
    target.casting.maxDistance = maxDistance;
    target.casting.mode = mode;
  }

  #getRodAccuracyPercent(eq) {
    return (
      Number(eq?.rod?.effectiveStats?.accuracyPercent) ||
      this.deps.config.casting?.accuracyDistancePercent ||
      null
    );
  }

  #getRodAccuracyMultiplier(eq) {
    return (
      Number(eq?.rod?.effectiveStats?.accuracyMultiplier) ||
      this.deps.config.casting?.accuracyDistanceMultiplier ||
      1
    );
  }
}

class WaitingState extends GameState {
  /** @param {WaitingStateDeps} deps */
  constructor(deps) {
    super(deps);
    this.#recastAim = new CastPowerAim({
      config: deps.config,
      projector: deps.projector,
      getViewportSize: deps.getViewportSize,
      panViewport: deps.commands.panViewport,
      rng: deps.rng,
    });
    this.#landingPolicyResolver = new LandingPolicyResolver();
    this.#idleRetrievePolicyResolver = new IdleRetrievePolicyResolver();
  }

  #effectiveInput = {
    isPulling: false,
    pullDirection: null,
    idleRetrieveParams: null,
  };
  #pullDirection = new Vector2(0, 0);
  #baitIds = [];
  #baitTypes = [];
  #recastAim;
  #landingPolicyResolver;
  #idleRetrievePolicyResolver;
  #isRecastAiming = false;
  #pendingRecast = null;

  enter() {
    this.deps.biteSystem.reset();
    this.#resetRecastAim();
  }

  exit() {
    this.#resetRecastAim();
  }

  handleInput(input) {
    if (input.isDoubleClick) {
      this.deps.commands.setState("scouting");
      this.#resetRecastAim();
      return;
    }

    const eq = this.deps.inventory.getEquipped();

    if (input.longPressPos && this.deps.canPlayerCast()) {
      if (this.#usePowerCasting()) {
        this.#isRecastAiming = true;
        input.longPressPos = null;
        return;
      }

      this.#legacyRecast(input.longPressPos, eq);
      input.longPressPos = null;
    }
  }

  update(dt, bounds, envData) {
    const pos = this.deps.float.getPosition();
    this.deps.projector.focusOnVirtualPos(pos.y, dt, 0.05);

    const input = envData.input || this.deps.input.getState();
    const eq = this.deps.inventory.getEquipped();
    this.#updatePowerRecast(dt, bounds, input, eq);

    const reelPower = eq?.reel?.effectiveStats?.basePower || 0;
    const isSpinning = this.deps.rules.equipment.isSpinning(eq);

    const effectiveInput = this.#effectiveInput;
    effectiveInput.isPulling = this.#isRecastAiming ? false : input.isPulling;
    effectiveInput.pullDirection = input.pullDirection;
    effectiveInput.idleRetrieveParams = effectiveInput.isPulling
      ? this.#getIdleRetrieveParams(eq)
      : null;

    let pullDirection = null;
    if (effectiveInput.isPulling) {
      const rodPos = this.deps.world.getRodVirtualPos(bounds);
      pullDirection = this.#pullDirection
        .set(rodPos.x - pos.x, rodPos.y - pos.y)
        .normalize();
    }

    this.deps.float.update(
      bounds,
      dt,
      envData.env,
      (vx, vy) => this.deps.world.checkWater(vx, vy),
      effectiveInput,
      reelPower,
      pullDirection,
    );

    const updatedPos = this.deps.float.getPosition();

    if (this.#isEmptyTackleLandingComplete(updatedPos, bounds, eq, isSpinning)) {
      this.deps.commands.setState("scouting");
      return;
    }

    const baitIds = this.#baitIds;
    const baitTypes = this.#baitTypes;
    baitIds.length = 0;
    baitTypes.length = 0;

    this.deps.fishing.collectAvailableBaits(
      eq,
      this.deps.eatenBaits,
      baitIds,
      baitTypes,
    );

    const biteEnv =
      typeof this.deps.world.getBiteEnv === "function"
        ? this.deps.world.getBiteEnv()
        : envData.biteEnv;

    let hooked = this.deps.biteSystem.evaluateBite(dt, biteEnv, {
      hookSize:
        eq?.hooks?.[0]?.effectiveStats?.equipmentPowerLevel ||
        eq?.baits?.[0]?.effectiveStats?.equipmentPowerLevel ||
        1,
      baits: baitIds,
      baitTypes: baitTypes,
      isPulling: effectiveInput.isPulling,
    });

    if (hooked && this.deps.config.debug?.fixedCatch?.enabled) {
      const fixed = this.deps.config.debug.fixedCatch;
      const template =
        this.deps.config.spawns.fishes.find((f) => f.id === fixed.fishId) ||
        this.deps.config.spawns.fishes[0];

      const chosenSequence = this.deps.rules.bite.selectBiteSequence(
        template,
        baitTypes,
      );
      hooked = this.deps.fixedCatchFishFactory.create({
        template,
        weightKg: fixed.weight,
        biteSequence: chosenSequence,
        anomalyChanceOverride: this.deps.services.devFlags.isEnabled(
          "forceAnomalyChance",
        )
          ? 1
          : null,
        locationId: biteEnv?.locationId || "",
      });
    }

    if (hooked) {
      this.deps.float.startBite(effectiveInput.isPulling, hooked.biteSequence);
      this.deps.commands.setState("biting", { fish: hooked });
    }
  }

  getRenderState(target, bounds) {
    target.stateName = "waiting";
    target.fishing.visible = true;
    target.fishing.state = "waiting";
    target.fishing.bottom = bounds.bottom;
    target.fishing.startTime = this.deps.getCastStartTime();
    const visual = this.#recastAim.getVisualState();
    if (visual) {
      const eq = this.deps.inventory.getEquipped();
      const maxDistance = this.getEffectiveCastDistance(eq);
      this.#populateRecastAccuracyPreview(target, bounds);
      target.casting.visible = true;
      target.casting.powerVisible = true;
      target.casting.visual = visual;
      target.casting.bounds = bounds;
      target.casting.maxDistance = maxDistance;
      target.casting.nowMs = this.deps.clock.now;
    }
  }

  #updatePowerRecast(dt, bounds, input, eq) {
    if (this.#pendingRecast) {
      this.#pendingRecast.timer -= dt;
      if (this.#pendingRecast.timer <= 0) {
        this.#commitPendingRecast();
      }
      return;
    }

    if (!this.#isRecastAiming) return;

    const release = this.#recastAim.update(input, bounds, dt, { mode: "rod" });
    if (!release) return;

    if (this.#isCancelledRelease(release)) {
      this.#resetRecastAim();
      this.deps.commands.setState("scouting");
      return;
    }

    const canCastAnywhere =
      this.deps.services.devFlags.isEnabled("infiniteCasting");
    const maxDistance = this.getEffectiveCastDistance(eq);
    const accuracyPx =
      Number(eq?.rod?.effectiveStats?.accuracy) ||
      this.deps.config.casting?.rodAccuracyFallbackPx ||
      80;
    const accuracyPercent = this.#getRodAccuracyPercent(eq);
    const accuracyMultiplier = this.#getRodAccuracyMultiplier(eq);
    const target = this.#recastAim.resolveTarget(release, {
      bounds,
      maxDistance,
      accuracyPx,
      accuracyPercent,
      accuracyMultiplier,
      canCastAnywhere,
      checkWater: (vx, vy) => this.deps.world.checkWater(vx, vy),
    });

    this.#isRecastAiming = false;

    if (!target?.success) {
      this.deps.commands.setInvalidCastMarker({
        x: release.screenX,
        y: release.screenY,
        timer: 500,
      });
      return;
    }

    this.#pendingRecast = {
      timer: target.travelDelayMs,
      x: target.x,
      y: target.y,
      depth: target.depth,
      originVirtualX: target.originVirtualX,
      originVirtualY: target.originVirtualY,
      rodScreenX: target.rodScreenX,
    };
  }

  #commitPendingRecast() {
    const cast = this.#pendingRecast;
    if (!cast) return;
    this.#pendingRecast = null;
    this.deps.castManager.registerCast(this.deps.clock.now);
    this.deps.commands.castLine(cast.x, cast.y, cast.depth, {
      rodVirtualPos: {
        x: cast.originVirtualX,
        y: cast.originVirtualY,
      },
      rodScreenX: cast.rodScreenX,
    });
  }

  #legacyRecast(screenPos, eq) {
    const vPos = this.deps.projector.screenToVirtual(screenPos.x, screenPos.y);
    const cell = this.deps.world.checkWater(vPos.x, vPos.y);
    const bounds = this.deps.world.getDynamicBounds();

    const isInside = this.deps.rules.cast.canCastAt(
      vPos.x,
      vPos.y,
      eq,
      bounds,
      this.deps.world.getRodVirtualPos(bounds),
    );

    if (cell && isInside) {
      this.deps.castManager.registerCast(this.deps.clock.now);
      this.deps.commands.castLine(vPos.x, vPos.y, cell.depth);
      return;
    }

    this.deps.commands.setInvalidCastMarker({
      x: screenPos.x,
      y: screenPos.y,
      timer: 500,
    });
  }

  #resetRecastAim() {
    this.#isRecastAiming = false;
    this.#pendingRecast = null;
    this.#recastAim?.reset();
  }

  #usePowerCasting() {
    return this.deps.config.casting?.enabled !== false;
  }

  #isCancelledRelease(release) {
    const threshold = this.deps.config.casting?.cancelPowerThreshold ?? 0;
    return release.power <= threshold;
  }

  #isEmptyTackleLandingComplete(position, bounds, eq, isSpinning) {
    const landingDistanceMeters = this.#getLandingDistanceMeters(eq);
    if (landingDistanceMeters <= 0) return false;

    const rodPos = this.deps.world.getRodVirtualPos(bounds);
    const pixelsPerMeter =
      Math.max(
        1,
        Number(this.deps.config.fightPhysicsConfig?.getPixelsPerMeter?.()) ||
          50,
      );
    const distanceMeters =
      Math.hypot(position.x - rodPos.x, position.y - rodPos.y) / pixelsPerMeter;

    if (distanceMeters <= landingDistanceMeters + 0.001) return true;

    if (!isSpinning) return false;

    return position.y >= bounds.bottom;
  }

  #getLandingDistanceMeters(eq) {
    const policy = this.#landingPolicyResolver.resolve({
      rod: eq?.rod,
      reel: eq?.reel,
    });
    return policy.getLandingDistanceMeters({
      rod: eq?.rod,
      reel: eq?.reel,
      config: this.deps.config,
    });
  }

  #getIdleRetrieveParams(eq) {
    const policy = this.#idleRetrievePolicyResolver.resolve({
      rod: eq?.rod,
      reel: eq?.reel,
    });
    return policy.getRetrieveParams({
      rod: eq?.rod,
      reel: eq?.reel,
      config: this.deps.config,
    });
  }

  #populateRecastAccuracyPreview(target, bounds) {
    if (!this.deps.config.debug?.casting?.showAccuracyArea) return;
    const eq = this.deps.inventory.getEquipped();
    const maxDistance = this.getEffectiveCastDistance(eq);
    const accuracyPx =
      Number(eq?.rod?.effectiveStats?.accuracy) ||
      this.deps.config.casting?.rodAccuracyFallbackPx ||
      80;
    const preview = this.#recastAim.getAccuracyPreview(
      bounds,
      maxDistance,
      accuracyPx,
      this.#getRodAccuracyPercent(eq),
      this.#getRodAccuracyMultiplier(eq),
    );
    target.casting.accuracyPreview = preview;
  }

  #getRodAccuracyPercent(eq) {
    return (
      Number(eq?.rod?.effectiveStats?.accuracyPercent) ||
      this.deps.config.casting?.accuracyDistancePercent ||
      null
    );
  }

  #getRodAccuracyMultiplier(eq) {
    return (
      Number(eq?.rod?.effectiveStats?.accuracyMultiplier) ||
      this.deps.config.casting?.accuracyDistanceMultiplier ||
      1
    );
  }
}

class BitingState extends GameState {
  /** @param {BitingStateDeps} deps */
  constructor(deps) {
    super(deps);
  }

  #feederAudioPlayer;
  #lastStepId = -1;
  #ringQueue = [];
  #ringHead = 0;
  #stepTimeElapsed = 0;
  #normalRingAccumulator = 0;
  #guaranteedRingAccumulator = 0;
  #pullDirection = new Vector2(0, 0);

  enter(data) {
    if (super.enter) super.enter();

    this.fish = data.fish;

    this.#lastStepId = -1;
    this.#ringQueue.length = 0;
    this.#ringHead = 0;
    this.#stepTimeElapsed = 0;
    this.#normalRingAccumulator = 0;
    this.#guaranteedRingAccumulator = 0;

    const eq = this.deps.inventory.getEquipped();
    if (
      this.deps.rules.equipment.isFeeder(eq) &&
      this.deps.config.ui?.audio?.feederBite
    ) {
      const src = this.deps.config.ui.audio.feederBite;
      if (!this.#feederAudioPlayer || this.#feederAudioPlayer.src !== src) {
        this.#feederAudioPlayer?.dispose();
        this.#feederAudioPlayer = this.deps.services.audio.createPlayer(src);
      }
      this.#feederAudioPlayer.warm().catch(() => {});
    } else {
      this.#feederAudioPlayer?.dispose();
      this.#feederAudioPlayer = null;
    }
  }

  exit() {
    this.#ringQueue.length = 0;
    this.#ringHead = 0;
    this.#stepTimeElapsed = 0;
  }

  handleInput(input) {
    const eq = this.deps.inventory.getEquipped();
    const isSpinning = this.deps.rules.equipment.isSpinning(eq);

    if (input.isDoubleClick) {
      this.deps.float.stopBite();
      this.deps.commands.setState("scouting");
      return;
    }

    const isPassiveStrikeInput = input.isPulling || input.clickPos;
    if (isPassiveStrikeInput && !isSpinning) {
      if (!this.deps.canPlayerCast()) return;

      const isGuaranteed = this.deps.float.isGuaranteedBite();
      if (!isGuaranteed) {
        input.clickPos = null;
        this.deps.float.stopBite();
        this.deps.commands.setState("waiting");
        return;
      }

      const success = this.deps.rng.chance(0.99);

      if (success) {
        input.clickPos = null;
        this.deps.float.hook();
        if (
          this.deps.biteSystem &&
          typeof this.deps.biteSystem.hookFish === "function"
        ) {
          this.deps.biteSystem.hookFish();
        }
        this.deps.commands.setState("playing", { fish: this.fish });
      } else {
        input.clickPos = null;
        this.deps.float.stopBite();
        this.deps.commands.setState("waiting");
      }
    }
  }

  update(dt, bounds, envData) {
    this.deps.float.updateBite(dt, (vx, vy) =>
      this.deps.world.checkWater(vx, vy),
    );

    const input = envData.input || this.deps.input.getState();
    const pos = this.deps.float.getPosition();
    this.deps.projector.focusOnVirtualPos(pos.y, dt, 0.05);

    const eq = this.deps.inventory.getEquipped();
    const isSpinning = this.deps.rules.equipment.isSpinning(eq);

    const reelPower = eq?.reel?.effectiveStats?.basePower || 0;

    let pullDirection = null;
    if (input.isPulling) {
      const rodPos = this.deps.world.getRodVirtualPos(bounds);
      pullDirection = this.#pullDirection
        .set(rodPos.x - pos.x, rodPos.y - pos.y)
        .normalize();
    }

    this.deps.float.update(
      bounds,
      dt,
      envData.env,
      (vx, vy) => this.deps.world.checkWater(vx, vy),
      input,
      reelPower,
      pullDirection,
    );

    const stepInfo = this.deps.float.getBiteStepInfo?.();
    if (isSpinning && stepInfo && stepInfo.isGuaranteed && input.isPulling) {
      this.deps.float.hook();
      if (
        this.deps.biteSystem &&
        typeof this.deps.biteSystem.hookFish === "function"
      ) {
        this.deps.biteSystem.hookFish();
      }
      this.deps.commands.setState("playing", { fish: this.fish });
      return;
    }

    if (!this.deps.float.isBiting()) {
      this.deps.commands.setState("waiting");
      return;
    }

    const updatedPos = this.deps.float.getPosition();
    const shoreY = bounds.bottom;
    if (isSpinning && updatedPos.y >= shoreY) {
      this.deps.float.stopBite();
      this.deps.commands.setState("scouting");
      return;
    }

    if (stepInfo) {
      if (stepInfo.id !== this.#lastStepId) {
        this.#lastStepId = stepInfo.id;

        if (stepInfo.isAction) {
          if (
            this.deps.fishing.tryConsumeBaitDuringBite(
              eq,
              stepInfo,
              this.deps.rng,
              {
                baitLossChance:
                  this.deps.config.fightPhysicsConfig
                    ?.getBaitLossChanceConfig?.() || {},
              },
            )
          ) {
            this.deps.float.stopBite();
            this.deps.commands.setState("waiting");
            return;
          }

          if (this.#feederAudioPlayer) {
            this.#scheduleRings(stepInfo);
          }
        }
      }

      if (this.#feederAudioPlayer) {
        this.#processRingQueue(dt);
      }
    }
  }

  #scheduleRings(stepInfo) {
    this.#ringQueue.length = 0;
    this.#ringHead = 0;
    this.#stepTimeElapsed = 0;

    const cfg = this.deps.config.feederConfig || {
      volumeNormal: 0.4,
      volumeGuaranteed: 1.0,
      normalRings: [1, 1],
      guaranteedRings: [2, 3],
    };

    if (!stepInfo.isGuaranteed) {
      const ringCount = this.#resolveRingCount(
        cfg.normalRings,
        [1, 1],
        "normal",
      );
      this.#queueRings(ringCount, stepInfo.duration, cfg.volumeNormal);
      return;
    }

    const ringCount = this.#resolveRingCount(
      cfg.guaranteedRings,
      [2, 3],
      "guaranteed",
    );
    this.#queueRings(ringCount, stepInfo.duration, cfg.volumeGuaranteed);
  }

  #queueRings(ringCount, duration, volume) {
    if (ringCount <= 0) return;

    const interval = duration / ringCount;
    for (let i = 0; i < ringCount; i++) {
      this.#ringQueue.push({
        startAt: i * interval,
        volume,
      });
    }
  }

  #resolveRingCount(value, fallback, mode) {
    const range = this.#normalizeRingRange(value, fallback);
    const min = range[0];
    const max = range[1];

    if (min >= 1 && max >= 1 && Number.isInteger(min) && Number.isInteger(max))
      return this.deps.rng.int(min, max);

    const rate = min === max ? min : this.deps.rng.range(min, max);
    if (rate <= 0) return 0;

    const whole = Math.floor(rate);
    const fraction = rate - whole;
    let count = whole;

    if (fraction > 0) {
      if (mode === "guaranteed") {
        this.#guaranteedRingAccumulator += fraction;
        const extra = Math.floor(this.#guaranteedRingAccumulator);
        this.#guaranteedRingAccumulator -= extra;
        count += extra;
      } else {
        this.#normalRingAccumulator += fraction;
        const extra = Math.floor(this.#normalRingAccumulator);
        this.#normalRingAccumulator -= extra;
        count += extra;
      }
    }

    return count;
  }

  #normalizeRingRange(value, fallback) {
    const source = Array.isArray(value) ? value : [value, value];
    const fallbackSource = Array.isArray(fallback)
      ? fallback
      : [fallback, fallback];
    let min = Number(source[0]);
    let max = Number(source[1] ?? source[0]);

    if (!Number.isFinite(min)) min = Number(fallbackSource[0]) || 0;
    if (!Number.isFinite(max)) {
      max = Number(fallbackSource[1] ?? fallbackSource[0]) || min;
    }
    if (max < min) {
      const tmp = min;
      min = max;
      max = tmp;
    }

    return [Math.max(0, min), Math.max(0, max)];
  }

  #processRingQueue(dt) {
    if (this.#ringHead >= this.#ringQueue.length) return;

    this.#stepTimeElapsed += dt;

    while (
      this.#ringHead < this.#ringQueue.length &&
      this.#stepTimeElapsed >= this.#ringQueue[this.#ringHead].startAt
    ) {
      const currentRing = this.#ringQueue[this.#ringHead++];
      this.#playSound(currentRing.volume);
    }

    if (this.#ringHead >= this.#ringQueue.length) {
      this.#ringQueue.length = 0;
      this.#ringHead = 0;
    }
  }

  #playSound(volume) {
    this.#feederAudioPlayer?.play(volume);
  }

  dispose() {
    this.#feederAudioPlayer?.dispose();
    this.#feederAudioPlayer = null;
  }

  getRenderState(target, bounds) {
    target.stateName = "biting";
    target.fishing.visible = true;
    target.fishing.state = "biting";
    target.fishing.bottom = bounds.bottom;
    target.fishing.startTime = this.deps.getCastStartTime();
  }
}

class PlayingState extends GameState {
  /** @param {PlayingStateDeps} deps */
  constructor(deps) {
    super(deps);
  }

  #isNetReady = false;
  #startTime = 0;
  #hasEquippedNet = false;
  #onConfigUpdateBind;
  #removeConfigUpdateListener = null;
  #fightFrameContext = new MutableFightFrameContext();
  #rodControlCastAnchor = null;

  enter(data) {
    this.#startTime = this.deps.clock.now;
    this.data = data || {};
    this.deps.depthUI?.hide?.();
    const fishData = this.data.fish;
    this.#rodControlCastAnchor = null;

    const eq = this.deps.inventory.getEquipped();
    this.#hasEquippedNet = !!eq.net;
    this.deps.fishing.consumeFirstBaitForFight(eq);
    this.deps.fight.startFight(fishData, eq, {
      selectedDepthMeters: this.getSelectedHookDepthMeters(),
    });

    const fightContext = this.#fightFrameContext;
    fightContext.floatEntity = this.deps.float;
    fightContext.net = this.deps.net;
    fightContext.fishData = fishData;
    fightContext.getRodVirtualPos = this.#getRodVirtualPos;
    fightContext.getBaseRodVirtualPos = this.#getBaseRodVirtualPos;
    fightContext.rodControlCastAnchor = null;
    fightContext.getScreenOffsetRatio = this.#getScreenOffsetRatio;
    fightContext.checkWater = this.#checkWater;

    if (this.deps.services.debug.isEnabled()) {
      console.log(
        `%c🎣 КЛЮНУВ: ${fishData.name}!`,
        "color: #00ff00; font-size: 16px; font-weight: bold;",
      );
      console.table({
        "Тип Вудки": eq.rod?.variant || "float",
        "Наявність Котушки":
          (eq.rod?.effectiveStats?.hasReel ?? true)
            ? "Є"
            : "Немає (Махова)",
        "Згенерована Вага": fishData.weight.toFixed(3) + " кг",
        "Рівень (Складність)": fishData.level,
      });

      this.deps.services.debug.emit("debug-fish-hooked", {
        fish: fishData,
        eq,
      });
    }

    this.#onConfigUpdateBind = () =>
      this.deps.fight.syncEquipment(this.deps.inventory.getEquipped());
    this.#removeConfigUpdateListener?.();
    this.#removeConfigUpdateListener = this.deps.subscribeConfigUpdated(
      this.#onConfigUpdateBind,
    );
  }

  update(dt, bounds, envData) {
    const floatPos = this.deps.float.getPosition();
    this.deps.projector.focusOnVirtualPos(floatPos.y, dt, 0.05);
    const input = envData.input || this.deps.input.getState();
    const fightContext = this.#fightFrameContext;
    fightContext.floatEntity = this.deps.float;
    fightContext.bounds = bounds;
    fightContext.input = input;
    fightContext.env = envData.env;
    fightContext.fishData = this.data.fish;
    fightContext.rodControlCastAnchor =
      this.#getRodControlCastAnchor(bounds);

    const result = this.deps.fight.updateFight(dt, fightContext);
    if (result.transition) {
      this.deps.commands.setState(
        result.transition.name,
        result.transition.data,
      );
      return;
    }

    const updatedPos = this.deps.float.getPosition();
    this.#isNetReady = this.deps.net.isFloatInZone(floatPos.y, bounds.bottom);
    this.deps.ui.updateNetButtonState(this.#hasEquippedNet, this.#isNetReady);

    if (updatedPos.y >= bounds.bottom) return;
    this.deps.holdUI.update(null);
  }

  handleNetClick() {
    if (!this.#isNetReady) return;
    const netResult = this.deps.fight.handleNetAttempt(
      this.deps.net,
      this.deps.rng,
      this.data.fish,
    );

    this.deps.services.debug.emit("netCatchRoll", {
      chance: netResult.chance,
      roll: netResult.roll,
      success: netResult.success,
    });

    this.deps.commands.setState(
      netResult.transition.name,
      netResult.transition.data,
    );
  }

  handleInput(input) {
    const eq = this.deps.inventory.getEquipped();
    const result = this.deps.fight.handlePlayerInput(input, eq);
    if (result.consumedSwipe && input.swipeDeltaY)
      this.deps.input.consumeSwipe();
  }

  getRenderState(target, bounds) {
    target.stateName = "playing";
    target.fishing.visible = true;
    target.fishing.state = "playing";
    target.fishing.bottom = bounds.bottom;
    target.fishing.startTime = this.#startTime;
    target.fishing.tensionMeter = this.deps.fight.tensionMeter;
    target.fishing.fishCondition = this.deps.fight.fishCondition;
  }

  getDebugData() {
    const bounds = this.deps.world.getDynamicBounds();
    const floatEntity = this.deps.float;
    const floatPos = floatEntity.getPosition();

    return {
      ...this.deps.fight.getDebugData({
        floatEntity,
        boundaries: bounds,
        rodPos: this.deps.world.getRodVirtualPos(bounds),
        screenOffset: this.deps.world.getScreenOffsetRatio(floatPos),
        equipment: this.deps.inventory.getEquipped(),
      }),
      hookedFish: this.data.fish,
    };
  }

  exit() {
    this.deps.holdUI.update(null);
    this.deps.ui.hideNetButton();
    this.#removeConfigUpdateListener?.();
    this.#removeConfigUpdateListener = null;
    this.#rodControlCastAnchor = null;
    this.#fightFrameContext.reset();
    this.deps.fight.endFight();
  }

  #getRodControlCastAnchor(frameBounds) {
    if (this.#rodControlCastAnchor) return this.#rodControlCastAnchor;
    const base = this.#getBaseRodVirtualPos(frameBounds);
    this.#rodControlCastAnchor = Object.freeze({
      x: Number(base?.x) || 0,
      y: Number(base?.y) || 0,
    });
    return this.#rodControlCastAnchor;
  }

  #getRodVirtualPos = (frameBounds) =>
    this.deps.world.getRodVirtualPos(frameBounds);
  #getBaseRodVirtualPos = (frameBounds) =>
    this.deps.world.getBaseRodVirtualPos?.(frameBounds) ||
    this.deps.world.getRodVirtualPos(frameBounds);
  #getScreenOffsetRatio = (pos) => this.deps.world.getScreenOffsetRatio(pos);
  #checkWater = (vx, vy) => this.deps.world.checkWater(vx, vy);
}

class FailedState extends GameState {
  /** @param {FailedStateDeps} deps */
  constructor(deps) {
    super(deps);
  }

  enter(data) {
    if (super.enter) super.enter();
    this.data = data || {};
    this.deps.ui.updateContinueButtonState(true);

    const eq = this.deps.inventory.getEquipped();
    const reason = this.data?.reason;

    this.deps.fishing.applyFailureEquipmentLoss(reason, eq, this.data?.failure || this.data || {});
  }

  exit() {
    this.deps.ui.updateContinueButtonState(false);
  }

  getRenderState(target, bounds) {
    target.stateName = "failed";
    target.fishing.visible = true;
    target.fishing.state = "failed";
    target.fishing.bottom = bounds.bottom;
    target.fishing.startTime = 0;
    target.outcome.visible = true;
    target.outcome.mode = "failed";
    target.outcome.reason = this.data.reason;
  }
}

class VictoryState extends GameState {
  #entryPointerGestureId = 0;

  /** @param {VictoryStateDeps} deps */
  constructor(deps) {
    super(deps);
  }

  enter(data) {
    this.data = data || {};
    this.#entryPointerGestureId = this.deps.input.getPointerGestureId();
    this.deps.ui.updateContinueButtonState(false);
    this.deps.ui.setOutcomeOverlayActive(true);
  }

  exit() {
    this.deps.ui.updateContinueButtonState(false);
    this.deps.ui.setOutcomeOverlayActive(false);
  }

  handleInput(input) {
    if (!input?.pointerReleased) return;

    const viewport = this.deps.getViewportSize();
    const fish = this.data.fish || {};
    const extraStats = Array.isArray(fish.victoryStats)
      ? fish.victoryStats.length
      : 0;
    const actions = this.deps.victoryLayoutResolver.resolve({
      width: viewport.width,
      height: viewport.height,
      config: this.deps.config.ui?.victory || {},
      statCount: 3 + extraStats,
    });
    const action = this.deps.victoryActionGestureResolver.resolve({
      input,
      entryGestureId: this.#entryPointerGestureId,
      actions,
    });
    if (!action) return;

    input.pointerReleased = false;
    this.deps.commands.setState("scouting");
  }

  getRenderState(target, bounds) {
    target.stateName = "victory";
    target.fishing.visible = true;
    target.fishing.state = "victory";
    target.fishing.bottom = bounds.bottom;
    target.fishing.startTime = 0;
    target.outcome.visible = true;
    target.outcome.mode = "victory";
    target.outcome.fish = this.data.fish || {};
  }
}
