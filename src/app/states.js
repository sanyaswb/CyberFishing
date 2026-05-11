// ---------------------------------------------------------------------------
// JSDoc typedefs — grouped contracts per state. These contracts document the
// actual runtime shape: deps.world / deps.commands / deps.render / deps.rules /
// deps.services. No state receives a `systems` bag.
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} StateWorldQueries
 * @property {(vx: number, vy: number) => object|null} checkWater
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
 */

/**
 * @typedef {Object} StateRenderCommands
 * @property {(renderer: object, bottom: number, state: string, tMeter: object|null, fCond: object|null, startTime: number) => void} drawFishingElements
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
 * @property {StateRenderCommands} render
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
 * @property {CastManager} castManager
 * @property {Array} eatenBaits
 * @property {() => number} getCastStartTime
 * @property {() => boolean} canPlayerCast
 * @property {(marker: object|null) => void} setInvalidCastMarker
 * @property {StateWorldQueries} world
 * @property {StateCommands} commands
 * @property {StateRenderCommands} render
 * @property {StateRules} rules
 * @property {StateServices} services
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
 * @property {StateRenderCommands} render
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
 * @property {StateRenderCommands} render
 * @property {StateRules} rules
 * @property {StateServices} services
 */

/**
 * @typedef {Object} ResultStateDeps
 * @property {UIManager} ui
 * @property {ConfigProvider} config
 * @property {FishingController} fishing
 * @property {InventoryManager} inventory
 * @property {() => { width: number, height: number }} getViewportSize
 * @property {StateCommands} commands
 * @property {StateRenderCommands} render
 * @property {StateRules} rules
 * @property {StateServices} services
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

  draw(renderer, bounds) {
    this.#state?.draw(renderer, bounds);
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
      case "victory":
        return this.#createResultDeps();
      default:
        throw new Error(`Unknown state deps: ${name}`);
    }
  }

  // Shared world-query functions — every state that can cast or aim needs these.
  #worldQueries() {
    return {
      world: {
        checkWater: this.#root.checkWater,
        getDynamicBounds: this.#root.getDynamicBounds,
        getRodVirtualPos: this.#root.getRodVirtualPos,
        getScreenOffsetRatio: this.#root.getScreenOffsetRatio,
      },
    };
  }

  // Shared render + navigation commands available to all fishing states.
  #fishingCommands() {
    return {
      commands: {
        setState: this.#root.setState,
        castLine: this.#root.castLine,
        markInvalidCast: this.#root.markInvalidCast,
        setInvalidCastMarker: this.#root.setInvalidCastMarker,
        panViewport: this.#root.panViewport,
      },
      render: {
        drawFishingElements: this.#root.drawFishingElements,
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
      castManager: root.castManager,
      eatenBaits: root.eatenBaits,
      // FIX: was a stale primitive; now a live getter function
      getCastStartTime: root.getCastStartTime,
      canPlayerCast: root.canPlayerCast,
      setInvalidCastMarker: root.setInvalidCastMarker,
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

  /** @returns {ResultStateDeps} */
  #createResultDeps() {
    const root = this.#root;
    return Object.freeze({
      // Direct subsystem references — result states need very little
      ui: root.ui,
      config: root.config,
      fishing: root.fishing,
      inventory: root.inventory,
      getViewportSize: root.getViewportSize,
      ...this.#fishingCommands(),
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
  draw() {}
  dispose() {}
}

class ScoutingState extends GameState {
  #castAim;
  #pendingCast = null;

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
    this.#castAim.reset();
  }

  exit() {
    this.deps.depthUI.hide();
    this.#castAim.reset();
    this.#pendingCast = null;
  }

  handleInput(input) {
    if (this.#usePowerCasting()) return;

    if (input.clickPos) {
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
        const eq = this.deps.inventory.getEquipped();
        const maxDist = this.deps.rules.equipment.getMaxCastDistance(eq);
        if (maxDist !== Infinity) {
          isInside = vPos.y >= bounds.bottom - maxDist;
        }
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
      this.#updatePowerCasting(dt, bounds, context?.input);
    }

    const eq = this.deps.inventory.getEquipped();
    const canSelectDepth = this.deps.rules.equipment.canSelectDepth(eq);

    if (!this.deps.canPlayerCast() || !canSelectDepth) {
      if (this.deps.depthUI.isActive) {
        this.deps.depthUI.hide();
      }
      this.deps.currentHookDepthRef.set(
        this.deps.config.physics?.defaultDepthNoSinker ?? 0.1,
      );
      return;
    }

    const maxDepth = this.deps.getMaxHookDepth();

    if (!this.deps.depthUI.isActive) {
      this.deps.depthUI.show(
        maxDepth,
        Math.min(this.deps.currentHookDepthRef.get(), maxDepth),
        (d) => this.deps.currentHookDepthRef.set(d),
      );
    } else {
      if (typeof this.deps.depthUI.updateMax === "function") {
        this.deps.depthUI.updateMax(maxDepth);
      }
    }
  }

  draw(renderer, bounds) {
    if (this.#usePowerCasting()) {
      if (!this.deps.isAimingChum()) {
        const visual = this.#castAim.getVisualState();
        if (visual) {
          renderer.drawCastPowerAim(
            this.deps.projector,
            bounds,
            visual,
            this.deps.config.casting,
            this.deps.config.tension,
            this.deps.clock.now,
          );
        }
      }
      return;
    }

    if (!this.deps.isAimingChum()) {
      if (this.deps.config.locations?.showAimingZone !== false) {
        const eq = this.deps.inventory.getEquipped();
        let maxDist = this.deps.rules.equipment.getMaxCastDistance(eq);

        if (maxDist !== Infinity) {
          maxDist = Math.min(maxDist, bounds.bottom - bounds.top);
          renderer.drawAimingZone(
            this.deps.projector,
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
        renderer.drawAimingZone(
          this.deps.projector,
          bounds.bottom,
          this.deps.getChumCastDistance(),
          "chum",
        );
      }
    }
  }

  #updatePowerCasting(dt, bounds, input) {
    if (this.#pendingCast) {
      this.#pendingCast.timer -= dt;
      if (this.#pendingCast.timer <= 0) {
        this.#commitPendingCast();
      }
      return;
    }

    const release = this.#castAim.update(input, bounds, dt, { mode: "rod" });
    if (!release) return;

    const eq = this.deps.inventory.getEquipped();
    const canCastAnywhere =
      this.deps.services.devFlags.isEnabled("infiniteCasting");
    const maxDistance = this.deps.rules.equipment.getMaxCastDistance(eq);
    const accuracyPx =
      Number(eq?.rod?.accuracy) ||
      Number(eq?.rod?.engineStats?.accuracy) ||
      this.deps.config.casting?.rodAccuracyFallbackPx ||
      80;
    const target = this.#castAim.resolveTarget(release, {
      bounds,
      maxDistance,
      accuracyPx,
      canCastAnywhere,
      checkWater: (vx, vy) => this.deps.world.checkWater(vx, vy),
    });

    if (!target?.success) {
      this.deps.commands.markInvalidCast({
        x: release.screenX,
        y: release.screenY,
      });
      return;
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
}

class WaitingState extends GameState {
  /** @param {WaitingStateDeps} deps */
  constructor(deps) {
    super(deps);
  }

  #effectiveInput = { isPulling: false, pullDirection: null };
  #pullDirection = new Vector2(0, 0);
  #baitIds = [];
  #baitTypes = [];

  enter() {
    this.deps.biteSystem.reset();
  }

  handleInput(input) {
    if (input.isDoubleClick) {
      this.deps.commands.setState("scouting");
    }

    const eq = this.deps.inventory.getEquipped();
    const isSpinning = this.deps.rules.equipment.isSpinning(eq);

    if (!isSpinning && input.longPressPos && this.deps.canPlayerCast()) {
      const vPos = this.deps.projector.screenToVirtual(
        input.longPressPos.x,
        input.longPressPos.y,
      );

      const cell = this.deps.world.checkWater(vPos.x, vPos.y);
      const bounds = this.deps.world.getDynamicBounds();

      let maxDist = this.deps.rules.equipment.getMaxCastDistance(eq);
      if (maxDist !== Infinity) {
        maxDist = Math.min(maxDist, bounds.bottom - bounds.top);
      }

      let isInside = true;
      if (maxDist !== Infinity) {
        const virtualLineY = bounds.bottom - maxDist;
        isInside = vPos.y >= virtualLineY;
      }

      if (cell && isInside) {
        this.deps.castManager.registerCast(this.deps.clock.now);
        this.deps.commands.castLine(vPos.x, vPos.y, cell.depth);
      } else {
        this.deps.commands.setInvalidCastMarker({
          x: input.longPressPos.x,
          y: input.longPressPos.y,
          timer: 500,
        });
      }
    }
  }

  update(dt, bounds, envData) {
    const pos = this.deps.float.getPosition();
    this.deps.projector.focusOnVirtualPos(pos.y, dt, 0.05);

    const input = envData.input || this.deps.input.getState();
    const eq = this.deps.inventory.getEquipped();

    const reelPower = eq?.reel ? eq.reel.basePower || 0 : 0;
    const isSpinning = this.deps.rules.equipment.isSpinning(eq);

    const effectiveInput = this.#effectiveInput;
    effectiveInput.isPulling = input.isPulling;
    effectiveInput.pullDirection = input.pullDirection;

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
    const shoreY =
      bounds.bottom -
      (this.deps.config.locations.catchLineOffsetPx || 5) /
        this.deps.projector.getScale();

    if (isSpinning && updatedPos.y >= shoreY) {
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

    let hooked = this.deps.biteSystem.evaluateBite(dt, envData.biteEnv, {
      hookSize: eq?.hooks?.[0]?.level || eq?.baits?.[0]?.level || 1,
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
      const visual = template.visual || {};
      const maxLevel = template.weightConfig?.maxLevel || fixed.level;
      const uniqueLevel = visual.uniqueLevel;
      const isUnique =
        template.isUnique === true ||
        template.unique === true ||
        (Number.isFinite(uniqueLevel) && fixed.level >= uniqueLevel);
      const imagePattern =
        visual.imagePattern ||
        `assets/fish/${template.id}/${template.id}--{level}.webp`;

      hooked = {
        id: template.id,
        name: template.name + " (TEST)",
        physics: template.physics,
        level: fixed.level,
        maxLevel,
        weight: fixed.weight,
        resistance: fixed.resistance,
        biteSequence: chosenSequence,
        imagePath: imagePattern.replace("{level}", fixed.level),
        isUnique,
        isTrophy:
          template.trophyWeightKg !== undefined
            ? fixed.weight >= template.trophyWeightKg
            : false,
        anomaly: template.anomaly || "none",
      };
    }

    if (hooked) {
      this.deps.float.startBite(effectiveInput.isPulling, hooked.biteSequence);
      this.deps.commands.setState("biting", { fish: hooked });
    }
  }

  draw(renderer, bounds) {
    this.deps.render.drawFishingElements(
      renderer,
      bounds.bottom,
      "waiting",
      null,
      null,
      this.deps.getCastStartTime(),
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

    if (!isSpinning && input.longPressPos && this.deps.canPlayerCast()) {
      this.#recastPassiveTackle(input.longPressPos, eq);
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

  #recastPassiveTackle(screenPos, eq) {
    const vPos = this.deps.projector.screenToVirtual(screenPos.x, screenPos.y);
    const cell = this.deps.world.checkWater(vPos.x, vPos.y);
    const bounds = this.deps.world.getDynamicBounds();
    let maxDist = this.deps.rules.equipment.getMaxCastDistance(eq);
    if (maxDist !== Infinity) {
      maxDist = Math.min(maxDist, bounds.bottom - bounds.top);
    }

    let isInside = true;
    if (maxDist !== Infinity) {
      isInside = vPos.y >= bounds.bottom - maxDist;
    }

    this.deps.float.stopBite();
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
    this.deps.commands.setState("waiting");
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

    const reelPower = eq?.reel ? eq.reel.basePower || 0 : 0;

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
    const shoreY =
      bounds.bottom -
      (this.deps.config.locations.catchLineOffsetPx || 5) /
        this.deps.projector.getScale();
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
              this.deps.config.physics,
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

  draw(renderer, bounds) {
    this.deps.render.drawFishingElements(
      renderer,
      bounds.bottom,
      "biting",
      null,
      null,
      this.deps.getCastStartTime(),
    );
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

  enter(data) {
    this.#startTime = this.deps.clock.now;
    this.data = data || {};
    const fishData = this.data.fish;

    const eq = this.deps.inventory.getEquipped();
    this.#hasEquippedNet = !!eq.net;
    this.deps.fishing.consumeFirstBaitForFight(eq);
    this.deps.fight.startFight(fishData, eq);

    const fightContext = this.#fightFrameContext;
    fightContext.floatEntity = this.deps.float;
    fightContext.net = this.deps.net;
    fightContext.fishData = fishData;
    fightContext.getRodVirtualPos = this.#getRodVirtualPos;
    fightContext.getScreenOffsetRatio = this.#getScreenOffsetRatio;
    fightContext.checkWater = this.#checkWater;

    if (this.deps.services.debug.isEnabled()) {
      console.log(
        `%c🎣 КЛЮНУВ: ${fishData.name}!`,
        "color: #00ff00; font-size: 16px; font-weight: bold;",
      );
      console.table({
        "Тип Вудки": eq.rod?.type || "float",
        "Наявність Котушки":
          (eq.rod?.hasReel ?? eq.rod?.engineStats?.hasReel ?? true)
            ? "Є"
            : "Немає (Махова)",
        "Згенерована Вага": fishData.weight.toFixed(3) + " кг",
        "Рівень (Складність)": fishData.level,
        "Базовий Опір": fishData.resistance.toFixed(2),
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
    fightContext.projectorScale = this.deps.projector.getScale();
    fightContext.catchLineOffsetPx =
      this.deps.config.locations.catchLineOffsetPx || 5;

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
    this.deps.holdUI.update(this.deps.fight.getHoldUiState());
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

  draw(renderer, bounds) {
    this.deps.render.drawFishingElements(
      renderer,
      bounds.bottom,
      "playing",
      this.deps.fight.tensionMeter,
      this.deps.fight.fishCondition,
      this.#startTime,
    );
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
    this.#fightFrameContext.reset();
    this.deps.fight.endFight();
  }

  #getRodVirtualPos = (frameBounds) =>
    this.deps.world.getRodVirtualPos(frameBounds);
  #getScreenOffsetRatio = (pos) => this.deps.world.getScreenOffsetRatio(pos);
  #checkWater = (vx, vy) => this.deps.world.checkWater(vx, vy);
}

class FailedState extends GameState {
  /** @param {ResultStateDeps} deps */
  constructor(deps) {
    super(deps);
  }

  enter(data) {
    if (super.enter) super.enter();
    this.deps.ui.updateContinueButtonState(true);

    const eq = this.deps.inventory.getEquipped();
    const reason = data?.reason;

    this.deps.fishing.applyFailureEquipmentLoss(reason, eq);
  }

  exit() {
    this.deps.ui.updateContinueButtonState(false);
  }

  draw(renderer, bounds) {
    this.deps.render.drawFishingElements(
      renderer,
      bounds.bottom,
      "failed",
      null,
      null,
      0,
    );

    renderer.drawGameOver(
      this.deps.getViewportSize().width,
      this.deps.getViewportSize().height,
      this.data.reason,
    );
  }
}

class VictoryState extends GameState {
  /** @param {ResultStateDeps} deps */
  constructor(deps) {
    super(deps);
  }

  enter(data) {
    this.data = data || {};
    this.deps.ui.updateContinueButtonState(false);
  }

  exit() {
    this.deps.ui.updateContinueButtonState(false);
  }

  handleInput(input) {
    if (!input?.clickPos) return;

    const viewport = this.deps.getViewportSize();
    const actions = this.#getVictoryActionRects(viewport);
    const click = input.clickPos;
    const isActionClick =
      this.#isPointInside(click, actions.claim) ||
      this.#isPointInside(click, actions.release);

    if (!isActionClick) return;

    input.clickPos = null;
    this.deps.commands.setState("scouting");
  }

  draw(renderer, bounds) {
    this.deps.render.drawFishingElements(
      renderer,
      bounds.bottom,
      "victory",
      null,
      null,
      0,
    );

    const viewport = this.deps.getViewportSize();
    renderer.drawVictory(
      viewport.width,
      viewport.height,
      this.data.fish,
      this.deps.config.ui?.victory,
    );
  }

  #getVictoryActionRects(viewport) {
    const config = this.deps.config.ui?.victory || {};
    const cfg = {
      panelWidth: 540,
      panelMinHeight: 560,
      viewportMargin: 24,
      panelPadding: 24,
      imageBoxSize: 260,
      statPillHeight: 42,
      buttonWidth: 150,
      buttonHeight: 42,
      buttonGap: 14,
      ...config,
    };
    const margin = Math.max(8, cfg.viewportMargin || 24);
    const maxPanelW = Math.max(260, viewport.width - margin * 2);
    const panelW = Math.min(cfg.panelWidth, maxPanelW);
    const padding = Math.min(cfg.panelPadding, Math.max(14, panelW * 0.06));
    const maxPanelH = Math.max(320, viewport.height - margin * 2);
    const titleH = 46;
    const gap = 16;
    const statH = cfg.statPillHeight;
    const buttonH = cfg.buttonHeight;
    const extraStats = Array.isArray(this.data?.fish?.victoryStats)
      ? this.data.fish.victoryStats
      : [];
    const statItemsLength = 3 + extraStats.length;
    const statColumns = Math.min(3, Math.max(1, statItemsLength));
    const statRows = Math.ceil(statItemsLength / statColumns);
    const pillGap = 8;
    const statBlockH = statRows * statH + (statRows - 1) * pillGap;
    let imageSize = Math.min(
      cfg.imageBoxSize,
      panelW - padding * 2,
      Math.max(140, maxPanelH * 0.46),
    );
    let contentH =
      padding * 2 + titleH + gap + imageSize + gap + statBlockH + gap + buttonH;

    if (contentH > maxPanelH) {
      imageSize = Math.max(120, imageSize - (contentH - maxPanelH));
      contentH =
        padding * 2 +
        titleH +
        gap +
        imageSize +
        gap +
        statBlockH +
        gap +
        buttonH;
    }

    const panelH = Math.min(
      maxPanelH,
      Math.max(contentH, Math.min(cfg.panelMinHeight, maxPanelH)),
    );
    const panelX = (viewport.width - panelW) / 2;
    const panelY = (viewport.height - panelH) / 2;
    const imageY = panelY + padding + titleH + gap;
    const statsY = imageY + imageSize + gap;
    const buttonsY = statsY + statBlockH + gap;
    const buttonW = Math.min(
      cfg.buttonWidth,
      (panelW - padding * 2 - cfg.buttonGap) / 2,
    );
    const buttonsX = panelX + (panelW - buttonW * 2 - cfg.buttonGap) / 2;

    return {
      claim: { x: buttonsX, y: buttonsY, w: buttonW, h: buttonH },
      release: {
        x: buttonsX + buttonW + cfg.buttonGap,
        y: buttonsY,
        w: buttonW,
        h: buttonH,
      },
    };
  }

  #isPointInside(point, rect) {
    return (
      point.x >= rect.x &&
      point.x <= rect.x + rect.w &&
      point.y >= rect.y &&
      point.y <= rect.y + rect.h
    );
  }
}
