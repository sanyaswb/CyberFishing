export class StateDepsFactory {
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
        logger: this.#root.logger,
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
      castPenalty: root.castPenalty,
      eatenBaits: root.eatenBaits,
      // Live getter: the value changes during the fight
      getCastStartTime: root.getCastStartTime,
      canPlayerCast: root.canPlayerCast,
      setInvalidCastMarker: root.setInvalidCastMarker,
      getViewportSize: root.getViewportSize,
      hookedFishOverride: root.hookedFishOverride,
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
      // Live getter: the value changes during the fight
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
