class FightPhysicsSystem {
  #config;
  #physicsConfig;
  #velocityScratch = new Vector2(0, 0);
  #radialTargetVelocity = new Vector2(0, 0);
  #waterProbePoint = { x: 0, y: 0 };
  #recoverableLineCalculator = new RecoverableLineCalculator();
  #looseLineCalculator = new LooseLineCalculator();
  #rodStrokeTracker = new RodStrokeTracker();
  #rodStrokeDistanceTracker =
    typeof RodStrokeDistanceTracker !== "undefined"
      ? new RodStrokeDistanceTracker()
      : null;
  #playerPullMotionSmoother = new PlayerPullMotionSmoother();
  #reelHoldRecoverySystem = new ReelHoldRecoverySystem();
  #recoveryFishSlowdownPolicy =
    typeof ReelRecoveryFishSlowdownPolicy !== "undefined"
      ? new ReelRecoveryFishSlowdownPolicy()
      : null;
  #landingPolicyResolver = new LandingPolicyResolver();
  #landingLiftCalculator = new LandingLiftTensionCalculator();
  #landingLiftReadinessPolicy =
    typeof LandingLiftReadinessPolicy !== "undefined"
      ? new LandingLiftReadinessPolicy()
      : null;
  #lineConstraintStateResolver = new LineConstraintStateResolver();
  #lineConstrainedFishMotionResolver =
    new LineConstrainedFishMotionResolver();
  #lineConstrainedFishMotionPreviewResolver =
    new LineConstrainedFishMotionResolver();
  #lineRadialMovementSplitter = new LineRadialMovementSplitter();
  #modelFishVelocityScratch = { x: 0, y: 0 };
  #previewLineConstraintStateScratch = {};
  #rodControlMovementProjector = new RodControlMovementProjector();
  #poleFightSectorConstraint =
    typeof PoleFightSectorConstraint !== "undefined"
      ? new PoleFightSectorConstraint()
      : null;
  #poleFightSectorAngleConstraint =
    typeof PoleFightSectorAngleConstraint !== "undefined"
      ? new PoleFightSectorAngleConstraint()
      : null;
  #fightInputActionComposer =
    typeof FightInputActionComposer !== "undefined"
      ? new FightInputActionComposer()
      : null;
  #playerForceBudgetAllocator =
    typeof PlayerForceBudgetAllocator !== "undefined"
      ? new PlayerForceBudgetAllocator()
      : null;
  #playerPressureGainResolver =
    typeof PlayerPressureGainResolver !== "undefined"
      ? new PlayerPressureGainResolver()
      : null;
  #playerTensionBuildRateResolver =
    typeof PlayerTensionBuildRateResolver !== "undefined"
      ? new PlayerTensionBuildRateResolver()
      : null;
  #playerPressureFatigueCalculator =
    typeof PlayerPressureFatigueCalculator !== "undefined"
      ? new PlayerPressureFatigueCalculator()
      : null;
  #playerPressureFatigueSourceResolver =
    typeof PlayerPressureFatigueSourceResolver !== "undefined"
      ? new PlayerPressureFatigueSourceResolver()
      : null;
  #playerPressureFatigueState =
    typeof PlayerPressureFatigueState !== "undefined"
      ? new PlayerPressureFatigueState()
      : null;
  #staminaBalanceFrame =
    typeof StaminaBalanceFrame !== "undefined"
      ? new StaminaBalanceFrame()
      : null;
  #composedInputScratch = {};
  #pipeline = new FightPhysicsPipeline();
  #fishRetrieveSystem;
  #staminaBudgetOverflowWarningActive = false;
  #fishWasInCatchZone = false;
  #landingLiftHoldKg = 0;
  #holdReelRecoverState = {
    eligible: false,
    active: false,
    timerMs: 0,
    delayMs: 3000,
    reelLoadReserveRatio: 0,
    reelMaxLoadKg: 0,
    recoverSpeedMetersPerSecond: 0,
    maxMoveMeters: 0,
    blockedReason: "not_checked",
    source: "none",
  };
  #lineRecoveryFishSlowdownState = {
    active: false,
    multiplier: 1,
    source: "none",
    recoveredMeters: 0,
  };
  #debug = {};

  constructor(config) {
    this.#config = config || {};
    this.#physicsConfig = this.#resolvePhysicsConfigAdapter(this.#config);
    this.#fishRetrieveSystem = new FishRetrieveSystem(this.#physicsConfig);
  }

  step({
    dtMs,
    floatEntity,
    bounds,
    input,
    env,
    checkWater,
    rodTipPosition,
    actualRodTipPosition,
    rodControlCastAnchor,
    rod,
    reel,
    fishForceSystem,
    lineSystem,
    dragSystem,
    pullInputMapper,
    rodPullSystem,
    rodControlSystem,
    reelSystem,
    tensionSystem,
    stressSystem,
    fishCondition,
    buffs,
  }) {
    const pipelineFrame = this.#pipeline.startFrame();
    const physics = pipelineFrame.run(
      "read_runtime_config",
      () => this.#getRuntimePhysicsConfig(),
    );
    const rodControlTargetAnchor = pipelineFrame.run(
      "resolve_rod_control_target_anchor",
      () => this.#resolveRodControlTargetAnchor({
        currentBaseRodTipPosition: rodTipPosition,
        castBaseRodTipPosition: rodControlCastAnchor,
        physics,
      }),
    );
    const dtSec = pipelineFrame.run(
      "resolve_delta_time",
      () => this.#getDtSec(dtMs, physics),
    );
    const fightInput = pipelineFrame.run(
      "compose_fight_input_actions",
      () => this.#composeFightInput(input),
    );
    const pullInput = pipelineFrame.run(
      "read_input",
      () => this.#updateInput({ input: fightInput, pullInputMapper, dragSystem, dtSec }),
    );
    const hasReel = !!reel?.hasReel?.();
    const dragSupported = hasReel && reel?.hasDrag?.() !== false;
    const isPullMode = !!pullInput.pullHeld;
    const isRecoverMode = hasReel && !isPullMode;
    const maxTackleLoadKg = stressSystem.getEffectiveMaxTackleLoadKg?.() || 0;
    const rodLimitKg =
      stressSystem.getEffectiveRodMaxLoadKg?.() || maxTackleLoadKg;
    const motion = pipelineFrame.run("update_fish_motion", () => this.#updateFishMotion({
      dtMs,
      dtSec,
      floatEntity,
      bounds,
      input: fightInput,
      env,
      checkWater,
      rodTipPosition,
      rod,
      reel,
      fishForceSystem,
      lineSystem,
      dragSystem,
      rodPullSystem,
      fishCondition,
      buffs,
      playerMaxLoadKg: maxTackleLoadKg,
      lineRecoveryFishSlowdown: this.#lineRecoveryFishSlowdownState,
    }));
    const forceData = motion.forceData;
    const playerForceFrame = pipelineFrame.run(
      "resolve_player_force_budget",
      () => {
        const rodControlIntent = this.#resolveRodControlIntent({
          fightInput,
          floatEntity,
          rodTipPosition,
          rodControlTargetAnchor,
          actualRodTipPosition,
          rodControlSystem,
        });
        return {
          rodControlIntent,
          budget: this.#resolvePlayerForceBudget({
            fightInput,
            forceData,
            rodLimitKg: maxTackleLoadKg,
            physics,
            rodControlIntent,
          }),
        };
      },
    );
    const playerForceBudget = playerForceFrame.budget;
    const playerPressureGainFrame = pipelineFrame.run(
      "resolve_player_pressure_gain",
      () => this.#resolvePlayerPressureGain({
        playerForceBudget,
        physics,
      }),
    );
    const playerTensionBuildRateFrame = pipelineFrame.run(
      "resolve_player_tension_build_rate",
      () => this.#resolvePlayerTensionBuildRate({
        playerForceBudget,
        physics,
      }),
    );
    const playerPressureFatigueApplication = pipelineFrame.run(
      "resolve_player_pressure_fatigue_application",
      () => this.#buildPlayerPressureFatigueApplicationFrame({ physics }),
    );
    const dragContext = pipelineFrame.run("resolve_drag_context", () =>
      this.#resolveDragContext({
      hasReel,
      dragSupported,
      dragSystem,
      forceData,
      maxTackleLoadKg,
      rodLimitKg,
      playerForceBudget,
    }),
    );

    const rodPullFrame = pipelineFrame.run(
      "resolve_rod_pull_and_retrieve",
      () => this.#updateRodPull({
      dtSec,
      pullInput,
      floatEntity,
      rodTipPosition,
      rod,
      lineSystem,
      rodPullSystem,
      fishRetrieveSystem: this.#fishRetrieveSystem,
      forceData,
      lineStateBeforeFishMotion: motion.lineStateBeforeFishMotion,
      fishCondition,
      dragContext,
      physics,
      bounds,
      checkWater,
      holdReelRecover: this.#holdReelRecoverState,
      isRecoverMode,
      reel,
      rodLimitKg,
      playerForceBudget,
      playerPressureGain: playerPressureGainFrame,
      playerTensionBuildRate: playerTensionBuildRateFrame,
      playerPressureFatigue: playerPressureFatigueApplication,
    }),
    );
    const rodControlFrame = pipelineFrame.run(
      "resolve_rod_control_x",
      () => this.#updateRodControl({
      dtSec,
      input: fightInput,
      floatEntity,
      rodTipPosition,
      rodControlTargetAnchor,
      actualRodTipPosition,
      lineSystem,
      rodControlSystem,
      forceData,
      dragContext,
      stressSystem,
      bounds,
      checkWater,
      maxTackleLoadKg,
      rodLimitKg,
      lineState: rodPullFrame.lineStateAfterPull,
      fishRetrieveResult: rodPullFrame.fishRetrieveResult,
      playerForceBudget,
      rodControlIntent: playerForceFrame.rodControlIntent,
      playerPressureGain: playerPressureGainFrame,
      playerTensionBuildRate: playerTensionBuildRateFrame,
      playerPressureFatigue: playerPressureFatigueApplication,
    }),
    );
    const lineStateAfterControl =
      rodControlFrame.lineStateAfterControl || rodPullFrame.lineStateAfterPull;
    const tensionPreview = pipelineFrame.run(
      "preview_tension",
      () => this.#calculateTension({
      tensionSystem,
      stressSystem,
      forceData,
      rodPullResult: rodPullFrame.rodPullResult,
      fishRetrieveResult: rodPullFrame.fishRetrieveResult,
      rodControlResult: rodControlFrame.rodControlResult,
      dragContext,
      lineState: lineStateAfterControl,
      hardLineLimit: rodPullFrame.hardLineLimitBeforeRelease,
    }),
    );
    const recoverFrame = pipelineFrame.run("recover_line", () => {
      const recoveryLoad = this.#resolveReelRecoveryLoad({
        tensionResult: tensionPreview,
        dragContext,
      });
      const holdReelRecover = this.#updateHoldReelRecovery({
      dtMs,
      isPullMode,
      hasReel,
      reel,
      rodPullResult: rodPullFrame.rodPullResult,
      tensionPreview,
      dragContext,
      physics,
      lineState: lineStateAfterControl,
    });
      const autoRecovery = this.#recoverRodStrokeCredit({
      dtSec,
      reelSystem,
      lineSystem,
      reel,
      tensionKg: recoveryLoad.tensionKg,
      blockedReason: recoveryLoad.blockedReason,
      playerHoldActive: isPullMode,
      strokeWonMeters: rodPullFrame.rodPullResult.rodStrokeWonMeters,
      fishDistanceMeters: lineStateAfterControl.distanceMeters,
    });
      const holdRecoveredMeters = holdReelRecover.recoveringLine
        ? this.#recoverLineCredit({
            dtSec,
            reelSystem,
            lineSystem,
            reel,
            tensionKg: recoveryLoad.tensionKg,
            isRecoverMode: true,
            loadLimitKg: holdReelRecover.reelMaxLoadKg,
            maxRecoverMeters: holdReelRecover.maxMoveMeters,
          })
        : 0;
      return {
        holdReelRecover,
        autoRecovery,
        recoveredMeters: autoRecovery.recoveredMeters + holdRecoveredMeters,
        autoRecoveredMeters: autoRecovery.recoveredMeters,
        holdRecoveredMeters,
      };
    });
    const playerPressureFatigueSourceFrame = pipelineFrame.run(
      "resolve_player_pressure_fatigue_source",
      () => this.#resolvePlayerPressureFatigueSource({
        physics,
        recoverFrame,
        rodPullResult: rodPullFrame.rodPullResult,
        rodControlResult: rodControlFrame.rodControlResult,
      }),
    );
    const playerPressureFatigueFrame = pipelineFrame.run(
      "update_player_pressure_fatigue",
      () => this.#updatePlayerPressureFatigueFrame({
        dtSec,
        physics,
        appliedFrame: playerPressureFatigueApplication,
        sourceFrame: playerPressureFatigueSourceFrame,
        rodPullResult: rodPullFrame.rodPullResult,
        rodControlResult: rodControlFrame.rodControlResult,
      }),
    );
    this.#recoveryFishSlowdownPolicy?.update?.({
      target: this.#lineRecoveryFishSlowdownState,
      autoRecoveredMeters: recoverFrame.autoRecoveredMeters,
      holdRecoveredMeters: recoverFrame.holdRecoveredMeters,
      config:
        this.#physicsConfig?.getReelRecoveryConfig?.() ||
        this.#getRuntimePhysicsConfig()?.fight?.reelRecovery ||
        {},
    });
    const holdReelRecover = recoverFrame.holdReelRecover;
    const recoveredMeters = recoverFrame.recoveredMeters;
    rodPullSystem.recoverStroke?.({
      recoveredMeters: recoverFrame.autoRecoveredMeters,
    });
    const lineLimit = pipelineFrame.run(
      "resolve_line_constraint",
      () => this.#resolveLineLimit({
      floatEntity,
      rodTipPosition,
      lineSystem,
      dragSystem,
      dragContext,
      tensionResult: tensionPreview,
      physics,
      velocity: motion.velocity,
      hardLineLimitBeforeRelease: rodPullFrame.hardLineLimitBeforeRelease,
    }),
    );
    const sectorFrame = pipelineFrame.run(
      "inspect_pole_fight_sector",
      () => this.#inspectPoleFightSector({
        floatEntity,
        rodTipPosition,
        lineSystem,
      }),
    );
    const finalLineState = sectorFrame.lineState || lineLimit.lineState;
    const finalLineConstraintState =
      lineLimit.lineConstraintState ||
      rodControlFrame.lineConstraintState ||
      motion.lineConstraintStateBeforeFishMotion;
    const strokeDistanceFrame = pipelineFrame.run(
      "update_rod_stroke_distance",
      () => this.#recordRodStrokeDistance({
        rodPullSystem,
        previousLineState: rodPullFrame.lineStateBeforePull,
        currentLineState: rodPullFrame.lineStateAfterPull,
      }),
    );
    const tensionResult = pipelineFrame.run(
      "update_final_tension",
      () => this.#updateTension({
      tensionSystem,
      stressSystem,
      forceData,
      rodPullResult: rodPullFrame.rodPullResult,
      fishRetrieveResult: rodPullFrame.fishRetrieveResult,
      rodControlResult: rodControlFrame.rodControlResult,
      dragContext,
      lineState: finalLineState,
      hardLineLimit:
        !!lineLimit.hardLineLimit ||
        !!finalLineConstraintState?.hardLineLimit,
      dtSec,
      pullInput,
    }),
    );
    const landingFrame = pipelineFrame.run(
      "resolve_landing_frame",
      () => this.#buildLandingFrame({
        forceData,
        lineState: finalLineState,
        tensionResult,
      }),
    );
    const staminaFrame = pipelineFrame.run(
      "resolve_stamina_frame",
      () => this.#buildStaminaFrame({
        forceData,
        rodPullResult: rodPullFrame.rodPullResult,
        rodControlResult: rodControlFrame.rodControlResult,
        fishRetrieveResult: rodPullFrame.fishRetrieveResult,
        lineState: finalLineState,
        stressSystem,
        fishCondition,
        floatEntity,
        rodTipPosition,
        physics,
        fightInput,
        dtSec,
        isPullMode,
        isRecoverMode,
        holdReelRecover,
        playerPressureFatigue: playerPressureFatigueFrame,
      }),
    );
    const rodPullDisplay = rodPullSystem.getState();

    this.#debug = pipelineFrame.run(
      "write_debug_snapshot",
      () => this.#buildDebugSnapshot({
      forceData,
      dragSystem,
      lineState: finalLineState,
      finalRecoverableLineMeters: lineLimit.finalRecoverableLineMeters,
      initialRecoverableLineMeters: rodPullFrame.initialRecoverableLineMeters,
      actualSlackMeters: lineLimit.actualSlackMeters,
      releaseResult: lineLimit.releaseResult,
      recoveredMeters,
      autoRecovery: recoverFrame.autoRecovery,
      strokeDistanceFrame,
      prePullStrokeDistanceFrame: rodPullFrame.prePullStrokeDistanceFrame,
      autoRecoveredMeters: recoverFrame.autoRecoveredMeters,
      holdRecoveredMeters: recoverFrame.holdRecoveredMeters,
      hardLineLimit: lineLimit.hardLineLimit,
      constraintResult: lineLimit.constraintResult,
      rodPullDisplay,
      rodPullResult: rodPullFrame.rodPullResult,
      rodPullMoveMeters: rodPullFrame.rodPullMoveMeters,
      rodControlResult: rodControlFrame.rodControlResult,
      rodControlMoveMeters: rodControlFrame.rodControlMoveMeters,
      rodControlMovePx: rodControlFrame.rodControlMovePx,
      rodControlMovementBlockReason: rodControlFrame.rodControlMovementBlockReason,
      lineConstraintState: finalLineConstraintState,
      holdReelRecoverMoveMeters: rodPullFrame.holdReelRecoverMoveMeters,
      rodPullMovementBlockReason: rodPullFrame.rodPullMovementBlockReason,
      reelHoldMovementBlockReason: rodPullFrame.reelHoldMovementBlockReason,
      hardTensionBlocked: rodPullFrame.hardTensionBlocked,
      fishRetrieveResult: rodPullFrame.fishRetrieveResult,
      landingLiftResult: tensionResult.landingLift,
      landingFrame,
      staminaFrame,
      tensionResult,
      stressSystem,
      physics,
      isPullMode,
      isRecoverMode,
      holdReelRecover,
      dragContext,
      playerForceBudget,
      playerPressureGain: playerPressureGainFrame,
      playerTensionBuildRate: playerTensionBuildRateFrame,
      playerPressureFatigue: playerPressureFatigueFrame,
      poleFightSectorFrame: sectorFrame,
      fishCondition,
    }),
    );
    this.#debug.fightPipeline = pipelineFrame.toDebugData();
    stressSystem.setDebugData(this.#debug);

    return {
      consumedSwipe: false,
      forces: {
        pX: rodControlFrame.rodControlResult?.forceKg || 0,
        pY: rodPullFrame.rodPullResult.forceKg,
        fX: forceData.targetVelocity.x,
        fY: forceData.targetVelocity.y,
      },
      pMax: this.#debug.playerMaxPowerY,
      fMag: forceData.totalFishForceKg,
      forceData,
      fightFrame: {
        landing: landingFrame,
        stamina: staminaFrame,
      },
    };
  }

  #getDtSec(dtMs, physics) {
    return Math.min(
      Math.max(0, Number(dtMs) || 0),
      this.#physicsConfig?.getMaxDtMs?.() ?? 50,
    ) / 1000;
  }

  #composeFightInput(input = {}) {
    const source = input || {};
    const target = this.#composedInputScratch;
    Object.assign(target, source);

    const actions = source.fightActions || this.#fightInputActionComposer?.compose?.(
      source,
      {
        keys: this.#config?.input?.keys || {},
        rodControlInput:
          this.#physicsConfig?.getRodControlConfig?.()?.input ||
          this.#config?.physics?.fight?.rodControl?.input ||
          {},
      },
    );

    if (!actions?.hold || !actions?.lateralControl) {
      target.fightActions = null;
      return target;
    }

    target.fightActions = actions;
    target.isPulling = !!actions.hold.active;
    target.holdInputRatio = Number(actions.hold.ratio) || 0;
    target.holdInputSource = actions.hold.source || "none";
    target.rodControlActive = !!actions.lateralControl.active;
    target.rodControlDirectionX = actions.lateralControl.directionX || 0;
    target.rodControlInputRatio = Math.max(
      0,
      Math.min(1, Number(actions.lateralControl.inputRatio) || 0),
    );
    target.rodControlInputSource = actions.lateralControl.source || "none";
    return target;
  }

  #updateInput({ input, pullInputMapper, dragSystem, dtSec }) {
    const pullInput = pullInputMapper?.update(input) || {
      pullHeld: !!input?.isPulling,
      pullStartedThisFrame: !!input?.isPulling,
      pullReleasedThisFrame: false,
    };
    dragSystem.update(input, dtSec);
    return pullInput;
  }

  #resolveRodControlIntent({
    fightInput,
    floatEntity,
    rodTipPosition,
    rodControlTargetAnchor,
    actualRodTipPosition,
    rodControlSystem,
  }) {
    if (!rodControlSystem?.resolveIntent) return null;
    return rodControlSystem.resolveIntent({
      inputState: fightInput,
      fishPosition: floatEntity?.getPosition?.(),
      rodTipPosition,
      baseRodTipPosition: rodControlTargetAnchor || rodTipPosition,
      actualRodTipPosition,
      config: this.#physicsConfig?.getRodControlConfig?.() || {},
    });
  }

  #resolveRodControlTargetAnchor({
    currentBaseRodTipPosition,
    castBaseRodTipPosition,
    physics,
  } = {}) {
    const config =
      this.#physicsConfig?.getRodControlConfig?.() ||
      physics?.fight?.rodControl ||
      {};
    const requestedMode =
      config.alignment?.targetAnchorMode === "cast_base"
        ? "cast_base"
        : "current_base";
    const mode =
      requestedMode === "cast_base" && this.#hasPoint(castBaseRodTipPosition)
        ? "cast_base"
        : "current_base";
    const source =
      mode === "cast_base"
        ? castBaseRodTipPosition
        : currentBaseRodTipPosition;
    if (!this.#hasPoint(source)) return null;
    return Object.freeze({
      x: Number(source.x),
      y: Number(source.y),
      mode,
    });
  }

  #hasPoint(point) {
    return (
      point &&
      Number.isFinite(Number(point.x)) &&
      Number.isFinite(Number(point.y))
    );
  }

  #resolvePlayerForceBudget({
    fightInput,
    forceData,
    rodLimitKg,
    physics,
    rodControlIntent,
  }) {
    const config =
      this.#physicsConfig?.getPlayerForceBudgetConfig?.() ||
      physics?.fight?.playerForceBudget ||
      this.#config?.physics?.fight?.playerForceBudget ||
      {};
    const actions = fightInput?.fightActions || {};
    const holdAction = actions.hold?.active === true
      ? actions.hold
      : Object.freeze({
          active: !!fightInput?.isPulling,
          ratio: fightInput?.isPulling ? 1 : 0,
          source: fightInput?.isPulling ? "legacy" : "none",
        });
    const requestedControlAction = actions.lateralControl?.active === true
      ? actions.lateralControl
      : Object.freeze({
          active: !!fightInput?.rodControlActive,
          directionX: fightInput?.rodControlDirectionX || 0,
          inputRatio: Math.max(
            0,
            Math.min(1, Number(fightInput?.rodControlInputRatio) || 0),
          ),
          source: fightInput?.rodControlActive ? "legacy" : "none",
        });
    const controlAction = requestedControlAction;
    const fallbackFrame = {
      enabled: false,
      reason: "allocator_missing",
      rodLimitKg: Math.max(0, Number(rodLimitKg) || 0),
      fishTensionKg: Math.max(0, Number(forceData?.fishTensionKg) || 0),
      holdActive: !!holdAction.active,
      controlActive: !!controlAction.active,
      controlInputRatio: Math.max(
        0,
        Math.min(1, Number(controlAction.inputRatio) || 0),
      ),
      holdCeilingMultiplier: 1,
      controlCeilingMultiplier: 1,
      maxCombinedCeilingMultiplier: 1,
      rawCombinedCeilingMultiplier: 1,
      combinedCeilingMultiplier: 1,
      combinedTensionCeilingKg: Math.max(0, Number(rodLimitKg) || 0),
      totalPlayerBudgetKg: 0,
      holdShare: 0,
      controlShare: 0,
      holdBudgetKg: 0,
      controlBudgetKg: 0,
      controlRequested: requestedControlAction.active === true,
      controlEligible:
        requestedControlAction.active === true &&
        rodControlIntent?.canRequestForce !== false,
      controlBlockedReason:
        requestedControlAction.active === true &&
        rodControlIntent?.canRequestForce === false
          ? rodControlIntent?.blockedReason || "unavailable"
          : "none",
    };

    if (!this.#playerForceBudgetAllocator?.resolve) {
      return Object.freeze(fallbackFrame);
    }

    return this.#playerForceBudgetAllocator.resolve({
      rodLimitKg,
      fishTensionKg: forceData?.fishTensionKg,
      holdAction,
      controlAction,
      controlEligibility: rodControlIntent,
      config,
    });
  }

  #resolvePlayerPressureGain({ playerForceBudget, physics } = {}) {
    const config = this.#resolvePlayerPressureGainConfig(physics);
    const fallback = Object.freeze({
      source: "player_pressure_gain",
      enabled: false,
      mode: "none",
      multiplier: 1,
      holdActive: false,
      controlActive: false,
      holdForceKg: 0,
      controlForceKg: 0,
      controlInputRatio: 0,
      holdForceThresholdKg: 0.01,
      controlInputThreshold: 0.05,
      controlForceThresholdKg: 0.01,
    });

    if (!this.#playerPressureGainResolver?.resolve) {
      return fallback;
    }

    return this.#playerPressureGainResolver.resolve({
      holdActive: playerForceBudget?.holdActive === true,
      controlActive: playerForceBudget?.controlActive === true,
      holdForceKg: playerForceBudget?.holdBudgetKg,
      controlForceKg: playerForceBudget?.controlBudgetKg,
      controlInputRatio: playerForceBudget?.controlInputRatio,
      config,
    });
  }

  #resolvePlayerPressureGainConfig(physics) {
    return (
      this.#physicsConfig?.getPlayerPressureGainConfig?.() ||
      physics?.fight?.playerPressureGain ||
      this.#config?.physics?.fight?.playerPressureGain ||
      {}
    );
  }

  #resolvePlayerTensionBuildRate({ playerForceBudget, physics } = {}) {
    const config = this.#resolvePlayerTensionBuildRateConfig(physics);
    const fallback = Object.freeze({
      source: "player_tension_build_rate",
      enabled: false,
      mode: "none",
      buildRateMultiplier: 1,
      holdActive: false,
      controlActive: false,
      holdForceKg: 0,
      controlForceKg: 0,
      holdInputRatio: 0,
      controlInputRatio: 0,
      applyTo: Object.freeze({
        rodHoldCharge: true,
        rodControlBuild: true,
      }),
    });

    if (!this.#playerTensionBuildRateResolver?.resolve) {
      return fallback;
    }

    return this.#playerTensionBuildRateResolver.resolve({
      holdActive: playerForceBudget?.holdActive === true,
      controlActive: playerForceBudget?.controlActive === true,
      holdForceKg: playerForceBudget?.holdBudgetKg,
      controlForceKg: playerForceBudget?.controlBudgetKg,
      holdInputRatio: playerForceBudget?.holdActive === true ? 1 : 0,
      controlInputRatio: playerForceBudget?.controlInputRatio,
      config,
    });
  }

  #resolvePlayerTensionBuildRateConfig(physics) {
    return (
      this.#physicsConfig?.getPlayerTensionBuildRateConfig?.() ||
      physics?.fight?.playerTensionBuildRate ||
      this.#config?.physics?.fight?.playerTensionBuildRate ||
      {}
    );
  }

  #resolvePlayerPressureFatigueSource({
    physics,
    recoverFrame,
    rodPullResult,
    rodControlResult,
  } = {}) {
    const config = this.#resolvePlayerPressureFatigueConfig(physics);
    const effectivePressureKg =
      this.#positive(rodPullResult?.forceKg) +
      this.#positive(rodControlResult?.forceKg);
    const fallback = Object.freeze({
      source: "player_pressure_fatigue_source",
      sourceMode: config?.source?.mode || "reel_hold",
      active: false,
      reason: "missing_resolver",
      reelHoldActive: recoverFrame?.holdReelRecover?.active === true,
      rodHoldActive: rodPullResult?.active === true,
      controlActive: rodControlResult?.canApply === true,
      effectivePressureKg,
    });

    if (!this.#playerPressureFatigueSourceResolver?.resolve) {
      return fallback;
    }

    return this.#playerPressureFatigueSourceResolver.resolve({
      reelHoldActive: recoverFrame?.holdReelRecover?.active === true,
      rodHoldActive: rodPullResult?.active === true,
      controlActive: rodControlResult?.canApply === true,
      effectivePressureKg,
      config,
    });
  }

  #buildPlayerPressureFatigueApplicationFrame({ physics } = {}) {
    const config = this.#resolvePlayerPressureFatigueConfig(physics);
    const enabled =
      config.enabled === true &&
      !!this.#playerPressureFatigueCalculator &&
      !!this.#playerPressureFatigueState;
    const state = this.#playerPressureFatigueState?.toFrame?.() || {};
    const efficiency = enabled ? this.#clamp01(state.efficiency ?? 1) : 1;
    return Object.freeze({
      source: "player_pressure_fatigue_application",
      enabled,
      efficiency,
      appliedEfficiency: efficiency,
      pressureHoldMs: enabled ? this.#positive(state.pressureHoldMs) : 0,
      holdElapsedMs: enabled ? this.#positive(state.holdElapsedMs) : 0,
      recoveryIdleMs: enabled ? this.#positive(state.recoveryIdleMs) : 0,
      recoveryState: enabled ? state.recoveryState || "full" : "disabled",
      stateName: enabled ? state.stateName || "idle" : "idle",
      sourceMode: enabled ? state.sourceMode || "reel_hold" : "reel_hold",
      sourceActive: enabled && state.sourceActive === true,
      sourceReason: enabled
        ? state.sourceReason || "reel_hold_inactive"
        : "disabled",
      pressureActive: enabled && state.pressureActive === true,
      pressureKg: enabled ? this.#positive(state.pressureKg) : 0,
      fatigueRatio: enabled ? this.#clamp01(1 - efficiency) : 0,
      fatigueProgress: enabled ? this.#clamp01(state.fatigueProgress) : 0,
      graceElapsedMs: enabled ? this.#positive(state.graceElapsedMs) : 0,
      graceDurationMs: enabled ? this.#positive(state.graceDurationMs) : 0,
      graceRemainingMs: enabled ? this.#positive(state.graceRemainingMs) : 0,
      fatigueElapsedMs: enabled ? this.#positive(state.fatigueElapsedMs) : 0,
      fatigueDurationMs: enabled ? this.#positive(state.fatigueDurationMs) : 0,
      fatigueRemainingMs: enabled ? this.#positive(state.fatigueRemainingMs) : 0,
      recoveryDelayElapsedMs: enabled
        ? this.#positive(state.recoveryDelayElapsedMs)
        : 0,
      recoveryDelayMs: enabled ? this.#positive(state.recoveryDelayMs) : 0,
      recoveryDelayRemainingMs: enabled
        ? this.#positive(state.recoveryDelayRemainingMs)
        : 0,
      recoveryProgress: enabled ? this.#clamp01(state.recoveryProgress) : 0,
      recoveryRemainingMs: enabled
        ? this.#positive(state.recoveryRemainingMs)
        : 0,
      controlBreakEnabled: enabled && state.controlBreakEnabled === true,
      isControlExhausted: enabled && state.isControlExhausted === true,
      controlBreakFatigueProgressThreshold: enabled
        ? this.#clamp01(
            state.controlBreakFatigueProgressThreshold ??
              state.controlBreakFatigueRatioThreshold ??
              0.9,
          )
        : 0,
      controlBreakFatigueRatioThreshold: enabled
        ? this.#clamp01(
            state.controlBreakFatigueProgressThreshold ??
              state.controlBreakFatigueRatioThreshold ??
              0.9,
          )
        : 0,
      controlBreakMinContinuousPressureMs: enabled
        ? this.#positive(state.controlBreakMinContinuousPressureMs)
        : 0,
      channels: this.#resolvePlayerPressureFatigueChannels(config),
    });
  }

  #updatePlayerPressureFatigueFrame({
    dtSec,
    physics,
    appliedFrame,
    sourceFrame,
    rodPullResult,
    rodControlResult,
  } = {}) {
    const config = this.#resolvePlayerPressureFatigueConfig(physics);
    const enabled =
      config.enabled === true &&
      !!this.#playerPressureFatigueCalculator &&
      !!this.#playerPressureFatigueState;
    const channels = this.#resolvePlayerPressureFatigueChannels(config);
    const rawRodHoldKg = this.#positive(
      rodPullResult?.rawForceKg ?? rodPullResult?.forceKg,
    );
    const rawControlKg = this.#positive(
      rodControlResult?.rawForceKg ?? rodControlResult?.forceKg,
    );
    const fatiguedRodHoldKg = this.#positive(rodPullResult?.forceKg);
    const fatiguedControlKg = this.#positive(rodControlResult?.forceKg);
    const pressureKg =
      (channels.rodHold ? fatiguedRodHoldKg : 0) +
      (channels.rodControl ? fatiguedControlKg : 0);

    if (!enabled) {
      this.#playerPressureFatigueState?.reset?.();
      return Object.freeze({
        source: "player_pressure_fatigue",
        enabled: false,
        efficiency: 1,
        appliedEfficiency: 1,
        nextEfficiency: 1,
        pressureHoldMs: 0,
        holdElapsedMs: 0,
        recoveryIdleMs: 0,
        recoveryState: "disabled",
        stateName: "idle",
        sourceMode: config.source?.mode || "reel_hold",
        sourceActive: false,
        sourceReason: "disabled",
        pressureActive: false,
        pressureKg: 0,
        fatigueRatio: 0,
        fatigueProgress: 0,
        graceElapsedMs: 0,
        graceDurationMs: this.#positive(config.graceDurationMs),
        graceRemainingMs: 0,
        fatigueElapsedMs: 0,
        fatigueDurationMs: this.#positive(config.fatigueDurationMs),
        fatigueRemainingMs: 0,
        recoveryDelayElapsedMs: 0,
        recoveryDelayMs: this.#positive(config.recovery?.delayAfterPressureMs),
        recoveryDelayRemainingMs: 0,
        recoveryProgress: 0,
        recoveryRemainingMs: 0,
        controlBreakEnabled: config.controlBreak?.enabled === true,
        isControlExhausted: false,
        controlBreakFatigueProgressThreshold:
          this.#clamp01(
            config.controlBreak?.fatigueProgressThreshold ??
              config.controlBreak?.fatigueRatioThreshold ??
              0.9,
          ),
        controlBreakFatigueRatioThreshold:
          this.#clamp01(
            config.controlBreak?.fatigueProgressThreshold ??
              config.controlBreak?.fatigueRatioThreshold ??
              0.9,
          ),
        controlBreakMinContinuousPressureMs:
          this.#positive(config.controlBreak?.minContinuousPressureMs),
        channels,
        rawRodHoldKg,
        rawControlKg,
        fatiguedRodHoldKg,
        fatiguedControlKg,
      });
    }

    const nextFrame = this.#playerPressureFatigueCalculator.calculate({
      state: this.#playerPressureFatigueState,
      dtSec,
      pressureKg,
      sourceResult: sourceFrame,
      sourceActive: sourceFrame?.active === true,
      sourceMode: sourceFrame?.sourceMode,
      sourceReason: sourceFrame?.reason,
      config,
    });
    this.#playerPressureFatigueState.applyFrame(nextFrame);

    return Object.freeze({
      ...nextFrame,
      source: "player_pressure_fatigue",
      appliedEfficiency: this.#clamp01(
        appliedFrame?.appliedEfficiency ?? appliedFrame?.efficiency ?? 1,
      ),
      nextEfficiency: nextFrame.efficiency,
      channels,
      rawRodHoldKg,
      rawControlKg,
      fatiguedRodHoldKg,
      fatiguedControlKg,
    });
  }

  #resolvePlayerPressureFatigueConfig(physics) {
    return (
      this.#physicsConfig?.getPlayerPressureFatigueConfig?.() ||
      physics?.fight?.playerPressureFatigue ||
      this.#config?.physics?.fight?.playerPressureFatigue ||
      {}
    );
  }

  #resolvePlayerPressureFatigueChannels(config = {}) {
    const channels = config.channels || {};
    return Object.freeze({
      rodHold: channels.rodHold !== false,
      rodControl: channels.rodControl !== false,
    });
  }

  #updateFishMotion({
    dtMs,
    dtSec,
    floatEntity,
    bounds,
    input,
    env,
    checkWater,
    rodTipPosition,
    rod,
    reel,
    fishForceSystem,
    lineSystem,
    dragSystem,
    rodPullSystem,
    fishCondition,
    buffs,
    playerMaxLoadKg,
    lineRecoveryFishSlowdown,
  }) {
    const fishPosition = floatEntity.getPosition();
    const previousFishX = Number(fishPosition.x) || 0;
    const previousFishY = Number(fishPosition.y) || 0;
    const fishVelocity = floatEntity.getVelocity?.() || this.#velocityScratch.set(0, 0);
    const lineState = lineSystem.updateDistance(fishPosition, rodTipPosition);
    const previousRodPullState = rodPullSystem?.getState?.() || {};
    const activeRodHoldKg = input?.isPulling
      ? Number(
          previousRodPullState.effectiveForceKg ??
            previousRodPullState.forceKg,
        ) || 0
      : 0;
    const landingPolicy = this.#landingPolicyResolver.resolve({ rod, reel });
    const landingDistanceMeters = landingPolicy.getLandingDistanceMeters({
      rod,
      reel,
      config: this.#config,
      lineDistanceMeters: lineState.distanceMeters,
    });
    const shoreLandingDistanceMeters = this.#calculateShoreLandingDistanceMeters({
      fishPosition,
      bounds,
    });
    const inCatchZone =
      landingDistanceMeters > 0 &&
      shoreLandingDistanceMeters <= landingDistanceMeters + 0.001;
    if (inCatchZone && !this.#fishWasInCatchZone) {
      fishForceSystem.handleFightEvent?.({
        type: FISH_FIGHT_EVENT.CATCH_ZONE_ENTERED,
        lineDistanceMeters: lineState.distanceMeters,
        shoreLandingDistanceMeters,
        landingDistanceMeters,
      });
    }
    this.#fishWasInCatchZone = inCatchZone;
    fishForceSystem.evaluateLastDashTrigger?.({
      dtMs,
      lineDistanceMeters: lineState.distanceMeters,
      shoreLandingDistanceMeters,
      horizontalDistanceMeters: shoreLandingDistanceMeters,
      landingDistanceMeters,
    });

    const forceData = fishForceSystem.calculate({
      dtMs,
      fishPosition,
      fishVelocity,
      rodTipPosition,
      fishCondition,
      dragRatio: dragSystem.value,
      input,
      rod,
      reel,
      playerMaxLoadKg,
      activeRodHoldKg,
      lineHasReserve: this.#lineHasReserve(lineState),
      lineTaut: this.#isLineTaut(lineState),
      env,
      buffs,
      fishSpeedMultiplier:
        this.#recoveryFishSlowdownPolicy?.getMotionMultiplier?.(
          lineRecoveryFishSlowdown,
        ) ?? 1,
    });
    forceData.landingDistanceMeters = landingDistanceMeters;
    forceData.shoreLandingDistanceMeters = shoreLandingDistanceMeters;
    forceData.lineRecoveryFishSlowdownActive =
      !!lineRecoveryFishSlowdown?.active;
    forceData.lineRecoveryFishSlowdownMultiplier =
      this.#recoveryFishSlowdownPolicy?.getMotionMultiplier?.(
        lineRecoveryFishSlowdown,
      ) ?? 1;
    forceData.lineRecoveryFishSlowdownSource =
      lineRecoveryFishSlowdown?.source || "none";
    const fishMotionDragContext = this.#resolveFishMotionDragContext({
      reel,
      dragSystem,
    });
    const fishMotionLineConstraintState = this.#resolveLineConstraintState({
      lineState,
      dragContext: fishMotionDragContext,
      fishRetrieveResult: forceData,
    });
    const modelFishVelocity = this.#modelFishVelocityScratch;
    modelFishVelocity.x = forceData.modelFishEscapeVelocityX;
    modelFishVelocity.y = forceData.modelFishEscapeVelocityY;
    const previewLineConstraintState =
      this.#previewLineConstraintStateScratch;
    Object.assign(previewLineConstraintState, fishMotionLineConstraintState);
    previewLineConstraintState.radialConstraintActive =
      !!fishMotionLineConstraintState.lineLengthLocked;
    const activeProjectionFrame =
      this.#lineConstrainedFishMotionResolver.resolve({
        position: fishPosition,
        rodTipPosition,
        rawVelocity: modelFishVelocity,
        lineConstraintState: fishMotionLineConstraintState,
        dtSec,
      });
    const constrainedProjectionFrame =
      fishMotionLineConstraintState.radialConstraintActive
        ? activeProjectionFrame
        : this.#lineConstrainedFishMotionPreviewResolver.resolve({
            position: fishPosition,
            rodTipPosition,
            rawVelocity: modelFishVelocity,
            lineConstraintState: previewLineConstraintState,
            dtSec,
          });
    const radialMovementFrame =
      this.#lineRadialMovementSplitter.resolveVelocity({
        position: fishPosition,
        rodTipPosition,
        freeVelocity: modelFishVelocity,
        constrainedVelocity: constrainedProjectionFrame,
        releasedMeters: lineState.releasedMeters,
        pixelsPerMeter:
          this.#physicsConfig?.getPixelsPerMeter?.() ||
          50,
        dtSec,
      });
    const projectionFrame =
      radialMovementFrame.crossedReleasedRadius ||
      fishMotionLineConstraintState.radialConstraintActive
        ? constrainedProjectionFrame
        : activeProjectionFrame;
    const frameTargetVelocity = this.#radialTargetVelocity.set(
      radialMovementFrame.velocityX,
      radialMovementFrame.velocityY,
    );

    let movementFrame = null;
    if (typeof floatEntity.applyHookedFightMovement === "function") {
      movementFrame = floatEntity.applyHookedFightMovement({
        boundsRect: bounds,
        dt: dtMs,
        environment: env,
        checkWater,
        input,
        pullDirection: forceData.player.pullDir,
        targetVelocity: frameTargetVelocity,
      });
    } else {
      const fallbackVelocity = floatEntity.getVelocity?.() || fishVelocity;
      fallbackVelocity.x = frameTargetVelocity.x;
      fallbackVelocity.y = frameTargetVelocity.y;
      floatEntity.update(
        bounds,
        dtMs,
        env,
        checkWater,
        input,
        0,
        forceData.player.pullDir,
      );
      movementFrame = {
        actualSpeedPxPerSec: Math.hypot(fallbackVelocity.x, fallbackVelocity.y),
        targetSpeedPxPerSec: Math.hypot(
          frameTargetVelocity.x,
          frameTargetVelocity.y,
        ),
        dampingApplied: true,
        fallbackDampedUpdate: true,
      };
    }

    const constrainedFishPosition = floatEntity.getPosition();
    const sectorMovementFrame = this.#applyPoleFightSectorAngleMovement({
      fromPosition: {
        x: previousFishX,
        y: previousFishY,
      },
      proposedPosition: constrainedFishPosition,
      velocity: floatEntity.getVelocity?.() || fishVelocity,
      origin: rodTipPosition,
      limitRadiusPx: this.#resolvePoleFightSectorLimitRadiusPx({
        lineState,
      }),
      adjustVelocity: true,
    });
    let prePlayerLineConstraint = null;
    const lineStateAfterFishMovement = lineSystem.updateDistance(
      constrainedFishPosition,
      rodTipPosition,
    );
    const postFishMotionLineConstraintState = this.#resolveLineConstraintState({
      lineState: lineStateAfterFishMovement,
      dragContext: fishMotionDragContext,
      fishRetrieveResult: forceData,
    });
    if (postFishMotionLineConstraintState.radialConstraintActive) {
      prePlayerLineConstraint = lineSystem.constrainPosition(
        constrainedFishPosition,
        floatEntity.getVelocity?.() || fishVelocity,
        rodTipPosition,
      );
    }
    const constrainedMovedX = constrainedFishPosition.x - previousFishX;
    const constrainedMovedY = constrainedFishPosition.y - previousFishY;
    movementFrame.movedX = constrainedMovedX;
    movementFrame.movedY = constrainedMovedY;
    movementFrame.actualSpeedPxPerSec = dtSec > 0
      ? Math.hypot(constrainedMovedX, constrainedMovedY) / dtSec
      : 0;
    movementFrame.poleFightSectorClamped =
      sectorMovementFrame.clamped === true;
    movementFrame.poleFightSectorActive =
      sectorMovementFrame.active === true;
    movementFrame.poleFightSectorSide =
      sectorMovementFrame.side || "none";
    movementFrame.poleFightSectorAngleDeg =
      sectorMovementFrame.proposedAngleDeg ??
      sectorMovementFrame.angleDeg ??
      0;
    movementFrame.poleFightSectorBoundaryType =
      sectorMovementFrame.boundaryType || "none";
    movementFrame.poleFightSectorAllowedMoveRatio =
      sectorMovementFrame.allowedMoveRatio ?? 1;
    movementFrame.poleFightSectorEnforceRadius =
      sectorMovementFrame.enforceRadius !== false;
    movementFrame.prePlayerLineConstraintApplied =
      prePlayerLineConstraint?.constrained === true ||
      prePlayerLineConstraint?.hardLimit === true;
    movementFrame.fishMoveRawVelocityX = modelFishVelocity.x;
    movementFrame.fishMoveRawVelocityY = modelFishVelocity.y;
    movementFrame.fishMoveAllowedVelocityX = frameTargetVelocity.x;
    movementFrame.fishMoveAllowedVelocityY = frameTargetVelocity.y;
    movementFrame.fishMoveRadialX = projectionFrame.radialX ?? 0;
    movementFrame.fishMoveRadialY = projectionFrame.radialY ?? 0;
    movementFrame.fishMoveRadialSpeedPxPerSec =
      projectionFrame.radialSpeedPxPerSec ?? 0;
    movementFrame.fishMoveBlockedRadialSpeedPxPerSec =
      projectionFrame.blockedRadialSpeedPxPerSec ?? 0;
    movementFrame.fishMoveAllowedTangentSpeedPxPerSec =
      projectionFrame.allowedTangentSpeedPxPerSec ?? 0;
    movementFrame.fishMoveConstraintActive =
      !!fishMotionLineConstraintState.radialConstraintActive ||
      !!radialMovementFrame.crossedReleasedRadius;
    movementFrame.fishMoveConstraintReason =
      fishMotionLineConstraintState.reason || "none";
    movementFrame.fishMoveProjectionReason =
      radialMovementFrame.crossedReleasedRadius &&
      projectionFrame.projectionReason === "free"
        ? "released_radius_crossed"
        : projectionFrame.projectionReason || projectionFrame.reason || "free";
    movementFrame.fishActualBlockedReason =
      this.#resolveFishActualBlockedReason({
        allowedVelocityX: frameTargetVelocity.x,
        allowedVelocityY: frameTargetVelocity.y,
        actualSpeedPxPerSec: movementFrame.actualSpeedPxPerSec,
        sectorMovementFrame,
        lineConstraintResult: prePlayerLineConstraint,
      });
    movementFrame.lineConstraintReason =
      fishMotionLineConstraintState.reason || "none";
    movementFrame.radialConstraintActive =
      !!fishMotionLineConstraintState.radialConstraintActive;
    movementFrame.lineLengthLocked =
      !!fishMotionLineConstraintState.lineLengthLocked;
    movementFrame.dragCanPayout =
      !!fishMotionLineConstraintState.dragCanPayout;
    movementFrame.dragPayoutBlocked =
      !!fishMotionLineConstraintState.dragPayoutBlocked;

    movementFrame.freeReleasedLineMeters =
      Number(lineState.freeReleasedLineMeters) ||
      Math.max(
        0,
        (Number(lineState.releasedMeters) || 0) -
        (Number(lineState.distanceMeters) || 0),
      );
    movementFrame.freeRadialTimeSec =
      radialMovementFrame.freeTimeSec;
    movementFrame.constrainedRadialTimeSec =
      radialMovementFrame.constrainedTimeSec;
    movementFrame.crossedReleasedRadius =
      radialMovementFrame.crossedReleasedRadius;
    forceData.fightMovementFrame = movementFrame;
    const currentFishY = Number(floatEntity.getPosition()?.y) || previousFishY;
    const towardPlayerYSign = this.#rodStrokeTracker.resolveTowardPlayerYSign({
      fishY: previousFishY,
      rodTipY: rodTipPosition?.y,
    });
    forceData.fightYMovementFrame = {
      ...this.#rodStrokeTracker.calculate({
        previousFishY,
        currentFishY,
        pixelsPerMeter:
          this.#physicsConfig?.getPixelsPerMeter?.() ||
          50,
        towardPlayerYSign,
      }),
      previousFishY,
      currentFishY,
      towardPlayerYSign,
    };
    const velocity = floatEntity.getVelocity?.() || fishVelocity;
    return {
      forceData,
      velocity,
      movementFrame,
      lineStateBeforeFishMotion: lineState,
      lineConstraintStateBeforeFishMotion: fishMotionLineConstraintState,
    };
  }

  #resolveDragContext({ hasReel, dragSupported, dragSystem, forceData, maxTackleLoadKg, rodLimitKg }) {
    const clampedDrag = Math.max(0, Math.min(1, Number(dragSystem.value) || 0));
    const player = forceData?.player || {};
    const fallbackDragLimitKg = dragSupported
      ? Number(player.dragLimitKg) || 0
      : maxTackleLoadKg;
    const effectiveDragLimitKg = Number.isFinite(Number(player.effectiveDragLimitKg))
      ? Number(player.effectiveDragLimitKg)
      : fallbackDragLimitKg;
    const dragLocked =
      !dragSupported ||
      clampedDrag >= 0.999;
    const dragOpen =
      dragSupported &&
      !dragLocked &&
      clampedDrag <= 0.000001;

    return {
      clampedDrag,
      maxTackleLoadKg,
      rodLimitKg,
      effectiveDragLimitKg,
      dragLocked,
      dragOpen,
      hasReel,
      dragSupported,
    };
  }

  #resolveFishMotionDragContext({ reel, dragSystem } = {}) {
    const hasReel = !!reel?.hasReel?.();
    const dragSupported = hasReel && reel?.hasDrag?.() !== false;
    const clampedDrag = Math.max(
      0,
      Math.min(1, Number(dragSystem?.value) || 0),
    );
    const dragLocked =
      !dragSupported ||
      clampedDrag >= 0.999;
    return {
      clampedDrag,
      dragLocked,
      dragOpen:
        dragSupported &&
        !dragLocked &&
        clampedDrag <= 0.000001,
      hasReel,
      dragSupported,
    };
  }

  #calculateShoreLandingDistanceMeters({
    fishPosition,
    bounds,
  } = {}) {
    const pixelsPerMeter =
      this.#physicsConfig?.getPixelsPerMeter?.() ||
      50;
    const shoreY = Number(bounds?.bottom) || 0;
    const fishY = Number(fishPosition?.y) || 0;
    const distancePx = Math.max(0, shoreY - fishY);
    return distancePx / Math.max(1, pixelsPerMeter);
  }

  #updateRodPull({
    dtSec,
    pullInput,
    floatEntity,
    rodTipPosition,
    rod,
    lineSystem,
    rodPullSystem,
    fishRetrieveSystem,
    forceData,
    lineStateBeforeFishMotion,
    fishCondition,
    dragContext,
    physics,
    bounds,
    checkWater,
    holdReelRecover,
    isRecoverMode,
    reel,
    rodLimitKg,
    playerForceBudget,
    playerPressureGain,
    playerTensionBuildRate,
    playerPressureFatigue,
  }) {
    const lineStateBeforePull = lineSystem.updateDistance(
      floatEntity.getPosition(),
      rodTipPosition,
    );
    const prePullStrokeDistanceFrame = this.#calculateRodStrokeDistanceFrame({
      previousDistanceMeters:
        lineStateBeforeFishMotion?.distanceMeters ??
        lineStateBeforePull.distanceMeters,
      currentDistanceMeters: lineStateBeforePull.distanceMeters,
      reasonPrefix: "pre_player",
    });
    const initialRecoverableLineMeters = this.#recoverableLineCalculator.calculateRecoverableLineMeters({
      releasedMeters: lineStateBeforePull.releasedMeters,
      fishDistanceMeters: lineStateBeforePull.distanceMeters,
    });
    const rodPullResult = rodPullSystem.update({
      dtSec,
      inputState: pullInput,
      rod,
      distanceLostBeforePullMeters:
        prePullStrokeDistanceFrame.lostMeters,
      fishForceKg: forceData.totalFishForceKg,
      fishTensionKg: forceData.fishTensionKg,
      rodLimitKg,
      playerForceBudget,
      playerPressureGain,
      playerTensionBuildRate,
      dragLimitKg: dragContext.effectiveDragLimitKg,
      maxTackleLoadKg: dragContext.maxTackleLoadKg,
      dragLocked: dragContext.dragLocked,
      hardLineLimit: lineStateBeforePull.isFullyExtended,
      lineHasReserve: this.#lineHasReserve(lineStateBeforePull),
      fishDistanceMeters: lineStateBeforePull.distanceMeters,
      playerPressureFatigue,
    });
    const remainingStrokeMeters = Math.max(
      0,
      (Number(rodPullResult.maxDistanceMeters) || 0) -
        (Number(rodPullResult.rodStrokeWonMeters) || 0),
    );
    const rodStrokeMovementBlocked = this.#isRodStrokeMovementBlocked(
      rodPullResult,
      remainingStrokeMeters,
    );
    const holdReelRecoverActive = !!holdReelRecover?.active;
    const fishRetrieveFrame = fishRetrieveSystem.calculate({
      dtSec,
      rodPullResult,
      forceData,
      fishCondition,
      lineDistanceMeters: lineStateBeforePull.distanceMeters,
      landingDistanceMeters: forceData.landingDistanceMeters,
      movementBlocked:
        (rodStrokeMovementBlocked && !holdReelRecoverActive),
      dragRatio: dragContext.clampedDrag,
      dragLimitKg: dragContext.effectiveDragLimitKg,
      dragLocked: dragContext.dragLocked,
      dragSupported: dragContext.dragSupported,
      lineHasReserve: this.#lineHasReserve(lineStateBeforePull),
      lineTaut: this.#isLineTaut(lineStateBeforePull),
    });
    const rodStrokeMoveCapacityMeters =
      rodPullResult.active && !rodStrokeMovementBlocked
        ? this.#calculateAllowedPullMoveMeters({
            requestedMoveMeters: fishRetrieveFrame.desiredMoveMeters,
            remainingStrokeMeters,
            fishPosition: floatEntity.getPosition(),
            rodTipPosition,
          })
        : 0;
    const holdReelRecoverMoveMeters = this.#calculateHoldReelRecoverMoveMeters({
      dtSec,
      fishRetrieveResult: fishRetrieveFrame,
      holdReelRecover,
      holdReelRecoverActive,
    });
    const requestedRodMoveMeters = Math.min(
      fishRetrieveFrame.desiredMoveMeters,
      rodStrokeMoveCapacityMeters,
    );
    const desiredRodMoveMeters = requestedRodMoveMeters;
    const smoothedRodMoveMeters = this.#smoothPlayerPullAxis({
      axis: "y",
      desiredMoveMeters: desiredRodMoveMeters,
      dtSec,
    });
    const rodPullMovement = this.#applyRodPullMovement({
      floatEntity,
      rodTipPosition,
      deltaMeters: smoothedRodMoveMeters,
      pixelsPerMeter:
        this.#physicsConfig?.getPixelsPerMeter?.() ||
        50,
      bounds,
      checkWater,
      limitRadiusPx: this.#resolvePoleFightSectorLimitRadiusPx({
        lineState: lineStateBeforePull,
      }),
    });
    const rodPullMoveMeters = rodPullMovement.meters;
    this.#playerPullMotionSmoother.reconcileAxis?.({
      axis: "y",
      appliedMove: rodPullMoveMeters,
      deltaTime: dtSec,
      blocked:
        rodPullMovement.hardBlocked ||
        rodPullMovement.directionalBlocked ||
        rodPullMoveMeters + 0.000001 < smoothedRodMoveMeters,
    });
    const reelHoldDesiredMoveMeters = Math.min(
      Math.max(0, fishRetrieveFrame.desiredMoveMeters - rodPullMoveMeters),
      holdReelRecoverMoveMeters,
    );
    const reelHoldMovement = this.#applyRodPullMovement({
      floatEntity,
      rodTipPosition,
      deltaMeters: reelHoldDesiredMoveMeters,
      pixelsPerMeter:
        this.#physicsConfig?.getPixelsPerMeter?.() ||
        50,
      bounds,
      checkWater,
      limitRadiusPx: this.#resolvePoleFightSectorLimitRadiusPx({
        lineState: lineStateBeforePull,
      }),
    });
    const reelHoldMoveMeters = reelHoldMovement.meters;
    const totalAppliedMoveMeters = rodPullMoveMeters + reelHoldMoveMeters;
    const movementBlocked =
      fishRetrieveFrame.desiredMoveMeters > totalAppliedMoveMeters + 0.001 ||
      (
        rodStrokeMovementBlocked &&
        !holdReelRecoverActive
      );
    const hardTensionBlocked =
      !!lineStateBeforePull.isFullyExtended ||
      rodPullMovement.hardBlocked ||
      reelHoldMovement.hardBlocked;
    const fishRetrieveResult = fishRetrieveFrame
      .withAppliedMovement({
        appliedMoveMeters: totalAppliedMoveMeters,
        movementBlocked,
        hardTensionBlocked,
      });
    const lineStateAfterPull = lineSystem.updateDistance(
      floatEntity.getPosition(),
      rodTipPosition,
    );

    return {
      lineStateBeforePull,
      lineStateAfterPull,
      initialRecoverableLineMeters,
      rodPullResult,
      fishRetrieveResult,
      prePullStrokeDistanceFrame,
      rodPullMoveMeters,
      reelHoldMoveMeters,
      rodPullMovementBlockReason: rodPullMovement.blockedReason,
      reelHoldMovementBlockReason: reelHoldMovement.blockedReason,
      hardTensionBlocked,
      holdReelRecoverMoveMeters: holdReelRecoverActive
        ? reelHoldMoveMeters
        : 0,
      hardLineLimitBeforeRelease: !!lineStateAfterPull.isFullyExtended,
    };
  }

  #recordRodStrokeDistance({
    rodPullSystem,
    previousLineState,
    currentLineState,
  } = {}) {
    const frame = this.#calculateRodStrokeDistanceFrame({
      previousDistanceMeters: previousLineState?.distanceMeters,
      currentDistanceMeters: currentLineState?.distanceMeters,
      reasonPrefix: "player_frame",
    });
    rodPullSystem?.recordDistanceMovement?.({
      gainedMeters: frame.gainedMeters,
      lostMeters: frame.lostMeters,
      previousDistanceMeters: frame.previousDistanceMeters,
      currentDistanceMeters: frame.currentDistanceMeters,
      deltaMeters: frame.deltaMeters,
      reason: frame.reason,
    });
    return frame;
  }

  #calculateRodStrokeDistanceFrame({
    previousDistanceMeters,
    currentDistanceMeters,
    reasonPrefix = "line_distance",
  } = {}) {
    if (!this.#rodStrokeDistanceTracker?.calculate) {
      return {
        previousDistanceMeters: Math.max(0, Number(previousDistanceMeters) || 0),
        currentDistanceMeters: Math.max(0, Number(currentDistanceMeters) || 0),
        deltaMeters: 0,
        gainedMeters: 0,
        lostMeters: 0,
        reason: "distance_tracker_missing",
      };
    }
    return this.#rodStrokeDistanceTracker.calculate({
      previousDistanceMeters,
      currentDistanceMeters,
      reasonPrefix,
    });
  }

  #calculateHoldReelRecoverMoveMeters({
    dtSec,
    fishRetrieveResult,
    holdReelRecover,
    holdReelRecoverActive,
  }) {
    if (!holdReelRecoverActive) return 0;
    const targetFishSpeed = Math.max(
      0,
      Number(fishRetrieveResult?.targetFishPullSpeedMetersPerSecond) || 0,
    );
    const recoverSpeed = Math.max(
      0,
      Number(holdReelRecover?.recoverSpeedMetersPerSecond) || 0,
    );
    const speed = targetFishSpeed > 0.001
      ? Math.min(targetFishSpeed, recoverSpeed)
      : recoverSpeed;
    return Math.max(0, speed * Math.max(0, Number(dtSec) || 0));
  }

  #isRodStrokeMovementBlocked(rodPullResult, remainingStrokeMeters = null) {
    if (!rodPullResult?.active) return false;
    const reason = rodPullResult.blockedReason;
    if (
      reason === "stroke_capacity_unavailable" ||
      reason === "pump_credit_too_high"
    ) {
      return true;
    }
    if (reason === "max_distance_reached") {
      if (remainingStrokeMeters !== null) {
        return Math.max(0, Number(remainingStrokeMeters) || 0) <= 0.001;
      }
      return true;
    }
    if (remainingStrokeMeters === null) return false;
    return Math.max(0, Number(remainingStrokeMeters) || 0) <= 0.001;
  }

  #updateRodControl({
    dtSec,
    input,
    floatEntity,
    rodTipPosition,
    rodControlTargetAnchor,
    actualRodTipPosition,
    lineSystem,
    rodControlSystem,
    forceData,
    dragContext,
    stressSystem,
    bounds,
    checkWater,
    maxTackleLoadKg,
    rodLimitKg,
    lineState,
    fishRetrieveResult,
    playerForceBudget,
    rodControlIntent,
    playerPressureGain,
    playerTensionBuildRate,
    playerPressureFatigue,
  }) {
    if (!rodControlSystem?.update) {
      return {
        rodControlResult: this.#emptyRodControlResult("missing_system"),
        rodControlMoveMeters: 0,
        rodControlMovePx: 0,
        rodControlMovementBlockReason: "missing_system",
        lineStateAfterControl: lineSystem.updateDistance(
          floatEntity.getPosition(),
          rodTipPosition,
        ),
      };
    }

    const config = this.#physicsConfig?.getRodControlConfig?.() || {};
    const fishPosition = floatEntity.getPosition();
    const currentLineState = lineState || lineSystem.updateDistance(
      fishPosition,
      rodTipPosition,
    );
    const lineConstraintState = this.#resolveLineConstraintState({
      lineState: currentLineState,
      dragContext,
      fishRetrieveResult,
      payoutResult: currentLineState?.lastReleaseResult,
      config,
    });
    const lineHasReserve = lineConstraintState.lineHasReserve;
    const hardLineLimit = lineConstraintState.hardLineLimit;
    const currentFrameTensionKg = Number(
      fishRetrieveResult?.totalTensionKg,
    );
    const currentTensionKg = Math.max(
      0,
      Number.isFinite(currentFrameTensionKg)
        ? currentFrameTensionKg
        : Number(stressSystem?.getTensionKg?.()) ||
          Number(forceData?.fishTensionKg) ||
          0,
    );
    const rodControlResult = rodControlSystem.update({
      dtSec,
      inputState: input,
      fishPosition,
      rodTipPosition,
      baseRodTipPosition: rodControlTargetAnchor || rodTipPosition,
      actualRodTipPosition,
      rodLimitKg,
      maxTackleLoadKg,
      currentTensionKg,
      fishTensionKg: forceData?.fishTensionKg,
      fishVelocity: forceData?.targetVelocity,
      fishWeightKg: forceData?.fishWeightKg,
      playerForceBudget,
      dragLimitKg: dragContext?.effectiveDragLimitKg,
      dragLocked: dragContext?.dragLocked !== false,
      lineHasReserve,
      hardLineLimit,
      lineConstraintState,
      intentFrame: rodControlIntent,
      playerPressureGain,
      playerTensionBuildRate,
      playerPressureFatigue,
      config,
    });
    const desiredSignedMoveMeters =
      (Number(rodControlResult.directionX) || 0) *
      Math.max(0, Number(rodControlResult.desiredMoveMeters) || 0);
    let rawSmoothedSignedMoveMeters = 0;
    if (rodControlResult.canApply) {
      rawSmoothedSignedMoveMeters = this.#smoothPlayerPullAxis({
        axis: "x",
        desiredMoveMeters: desiredSignedMoveMeters,
        dtSec,
      });
    } else {
      this.#playerPullMotionSmoother.resetAxis?.("x");
    }
    const smoothedSignedMoveMeters = this.#limitRodControlMoveTowardTarget({
      signedMoveMeters: rawSmoothedSignedMoveMeters,
      fishPosition,
      rodControlResult,
      pixelsPerMeter:
        this.#physicsConfig?.getPixelsPerMeter?.() ||
        50,
    });
    if (
      Math.abs(rawSmoothedSignedMoveMeters) > 0.000001 &&
      Math.abs(smoothedSignedMoveMeters) <= 0.000001
    ) {
      this.#playerPullMotionSmoother.resetAxis?.("x");
    }
    const allowedMoveMeters = Math.abs(smoothedSignedMoveMeters);
    const movement = this.#applyRodControlMovement({
      floatEntity,
      rodTipPosition,
      directionX: Math.sign(smoothedSignedMoveMeters),
      deltaMeters: Math.abs(smoothedSignedMoveMeters),
      pixelsPerMeter:
        this.#physicsConfig?.getPixelsPerMeter?.() ||
        50,
      bounds,
      checkWater,
      lineConstraintState,
      limitRadiusPx: this.#resolvePoleFightSectorLimitRadiusPx({
        lineConstraintState,
      }),
      projectLockedMovementToArc:
        config.lineConstraint?.projectLockedMovementToArc !== false,
    });
    const requestedAppliedMeters = Math.abs(smoothedSignedMoveMeters);
    const controlMovementBlocked =
      movement.hardBlocked ||
      movement.directionalBlocked ||
      movement.meters + 0.000001 < requestedAppliedMeters;
    this.#playerPullMotionSmoother.reconcileAxis?.({
      axis: "x",
      appliedMove: movement.signedMeters,
      deltaTime: dtSec,
      blocked: controlMovementBlocked,
    });
    rodControlSystem.recordAppliedMovement?.({
      movedMeters: movement.meters,
      movedPx: movement.px,
    });
    const updatedResult = rodControlSystem.getState?.() || rodControlResult;
    Object.assign(updatedResult, {
      phase: updatedResult.canApply
        ? "applying_force"
        : updatedResult.active
          ? "blocked"
          : "inactive",
      allowedMoveMeters,
      movementMode: movement.mode,
      lineLengthLocked: lineConstraintState.lineLengthLocked,
      radialConstraintActive: lineConstraintState.radialConstraintActive,
    });
    const lineStateAfterControl = lineSystem.updateDistance(
      floatEntity.getPosition(),
      rodTipPosition,
    );
    return {
      rodControlResult: updatedResult,
      rodControlMoveMeters: movement.meters,
      rodControlMovePx: movement.px,
      rodControlMovementBlockReason: movement.blockedReason,
      lineConstraintState,
      lineStateAfterControl,
    };
  }

  #emptyRodControlResult(blockedReason = "no_input") {
    return {
      active: false,
      canApply: false,
      directionX: 0,
      inputDirectionX: 0,
      inputRatio: 0,
      requestedForceRatio: 0,
      rawForceKg: 0,
      forceKg: 0,
      loadReserveKg: 0,
      loadReserveRatio: 0,
      tensionCeilingMultiplier: 1,
      tensionCeilingKg: 0,
      forceLimitKg: 0,
      effectiveForceLimitKg: 0,
      currentTensionKg: 0,
      dragLimited: false,
      dragReserveKg: 0,
      canSlipDrag: false,
      deliveredForceRatio: 0,
      playerPressureEfficiency: 1,
      playerPressureFatigueEnabled: false,
      playerTensionKg: 0,
      tensionMultiplier: 0,
      desiredMoveMeters: 0,
      desiredMovePx: 0,
      appliedMoveMeters: 0,
      appliedMovePx: 0,
      actualMovementRatio: 0,
      maxPullSpeedMetersPerSecond: 0,
      visualControlRatio: 0,
      targetRodX: null,
      targetRodY: null,
      targetMode: "input_direction",
      fishOffsetX: 0,
      lineAngleDeg: 0,
      angleRatio: 0,
      directionFactor: 0,
      aligned: false,
      blockedReason,
      phase: "inactive",
      allowedMoveMeters: 0,
    };
  }

  resetPlayerPullMotion() {
    this.#playerPullMotionSmoother.reset();
    this.#poleFightSectorConstraint?.reset?.();
    this.#poleFightSectorAngleConstraint?.reset?.();
    this.#staminaBudgetOverflowWarningActive = false;
    this.#playerPressureFatigueState?.reset?.();
    this.#recoveryFishSlowdownPolicy?.reset?.(
      this.#lineRecoveryFishSlowdownState,
    );
  }

  #updateTension({
    tensionSystem,
    stressSystem,
    forceData,
    rodPullResult,
    fishRetrieveResult,
    rodControlResult,
    dragContext,
    lineState,
    hardLineLimit,
    dtSec,
    pullInput,
  }) {
    const landingLift = this.#updateLandingLift({
      dtSec,
      pullInput,
      forceData,
      rodPullResult,
      fishRetrieveResult,
      lineState,
      maxTackleLoadKg: stressSystem.getEffectiveMaxTackleLoadKg?.(),
    });
    const calculatedTension = this.#calculateTension({
      tensionSystem,
      stressSystem,
      forceData,
      rodPullResult,
      fishRetrieveResult,
      rodControlResult,
      landingLift,
      dragContext,
      lineState,
      hardLineLimit,
    });
    const tensionResult = {
      ...calculatedTension,
      landingLift,
    };

    if (typeof stressSystem.updateTensionFrame === "function") {
      const lineHasReserve = this.#lineHasReserve(lineState);
      const canSlipDrag =
        !dragContext.dragLocked &&
        lineHasReserve &&
        !hardLineLimit;
      const tensionStressSource =
        canSlipDrag && tensionResult.shouldSlipDrag
          ? "visible"
          : "raw";
      stressSystem.updateTensionFrame({
        visibleTensionKg: tensionResult.tensionKg,
        totalTensionKg: tensionResult.totalTensionKg,
        rawTotalTensionKg: tensionResult.rawTotalTensionKg,
        rawTensionKg: tensionResult.rawTensionKg,
        fishTensionKg: tensionResult.fishTensionKg,
        tensionStressSource,
        dtSec,
        tensionConfig:
          this.#physicsConfig?.getTensionConfig?.() ||
          this.#config.tension ||
          {},
      });
    } else {
      stressSystem.updateTarget(
        tensionResult.tensionKg,
        dtSec,
        this.#config.tension || {},
      );
    }
    return tensionResult;
  }

  #calculateTension({
    tensionSystem,
    stressSystem,
    forceData,
    rodPullResult,
    fishRetrieveResult,
    rodControlResult,
    landingLift,
    dragContext,
    lineState,
    hardLineLimit,
  }) {
    const lineHasReserve = this.#lineHasReserve(lineState);
    const baseFishTensionKg =
      fishRetrieveResult.fishTensionKg ?? forceData.fishTensionKg;
    const basePlayerHoldTensionKg = fishRetrieveResult.playerHoldTensionKg ?? 0;
    const lateralTensionKg = Math.max(
      0,
      Number(rodControlResult?.playerTensionKg) || 0,
    );
    const baseTotalTensionKg =
      fishRetrieveResult.totalTensionKg ?? fishRetrieveResult.lineTensionKg;
    const landingLiftActive = !!landingLift?.active;
    const fishTensionKg = landingLiftActive
      ? landingLift.fishTensionKg
      : baseFishTensionKg;
    const playerHoldTensionKg = landingLiftActive
      ? 0
      : basePlayerHoldTensionKg + lateralTensionKg;
    const totalTensionKg = landingLiftActive
      ? landingLift.totalTensionKg
      : Math.max(0, Number(baseTotalTensionKg) || 0) + lateralTensionKg;
    return tensionSystem.calculate({
      totalTensionKg,
      fishForceKg: fishTensionKg,
      rodPullForceKg: playerHoldTensionKg,
      fishTensionKg,
      playerHoldTensionKg,
      rodLimitKg: stressSystem.getEffectiveRodMaxLoadKg?.(),
      lineLimitKg: stressSystem.getEffectiveLineSystemMaxLoadKg?.(),
      hookLimitKg: stressSystem.getEffectiveHookMaxLoadKg?.(),
      dragLimitKg: dragContext.effectiveDragLimitKg,
      hardLineLimit: !!hardLineLimit,
      lineHasReserve,
      dragLocked: dragContext.dragLocked,
      dragAlreadyResolved:
        Number.isFinite(Number(fishRetrieveResult?.dragBlockedForceKg)),
      shouldSlipDrag: !!fishRetrieveResult?.shouldSlipDrag,
      landingLift,
    });
  }

  #updateLandingLift({
    dtSec,
    pullInput,
    forceData,
    rodPullResult,
    fishRetrieveResult,
    lineState,
    maxTackleLoadKg,
  }) {
    const landingDistanceMeters = Number(forceData?.landingDistanceMeters) || 0;
    const rawShoreDistanceMeters = Number(forceData?.shoreLandingDistanceMeters);
    const shoreLandingDistanceMeters = Number.isFinite(rawShoreDistanceMeters)
      ? Math.max(0, rawShoreDistanceMeters)
      : Infinity;
    const inLandingZone =
      landingDistanceMeters > 0 &&
      shoreLandingDistanceMeters <= landingDistanceMeters + 0.001;
    const playerHoldActive = !!pullInput?.pullHeld;
    const lift = this.#landingLiftCalculator.calculate({
      previousLiftHoldKg: this.#landingLiftHoldKg,
      fishWeightKg: this.#resolveFishWeightKg(forceData),
      maxTackleLoadKg,
      waterFightTensionKg:
        fishRetrieveResult?.fishTensionKg ?? forceData?.fishTensionKg,
      inLandingZone,
      playerHoldActive,
      dtSec,
      config: this.#physicsConfig?.getLandingLiftConfig?.(),
    });

    this.#landingLiftHoldKg = lift.liftHoldKg;
    return lift;
  }

  #buildLandingFrame({ forceData, lineState, tensionResult } = {}) {
    const lift = tensionResult?.landingLift || {};
    const rawLineDistanceMeters = Number(lineState?.distanceMeters);
    const lineDistanceMeters = Number.isFinite(rawLineDistanceMeters)
      ? Math.max(0, rawLineDistanceMeters)
      : Infinity;
    const rawShoreDistanceMeters = Number(forceData?.shoreLandingDistanceMeters);
    const shoreLandingDistanceMeters = Number.isFinite(rawShoreDistanceMeters)
      ? Math.max(0, rawShoreDistanceMeters)
      : Infinity;
    const landingDistanceMeters = Math.max(
      0,
      Number(forceData?.landingDistanceMeters) || 0,
    );
    const tensionFrame = Object.freeze({
      visibleTensionKg: Math.max(0, Number(tensionResult?.tensionKg) || 0),
      supportedTensionKg: Math.max(
        0,
        Number(tensionResult?.totalTensionKg) || 0,
      ),
      totalTensionKg: Math.max(0, Number(tensionResult?.totalTensionKg) || 0),
      rawTensionKg: Math.max(0, Number(tensionResult?.rawTensionKg) || 0),
      rawTotalTensionKg: Math.max(
        0,
        Number(tensionResult?.rawTotalTensionKg) || 0,
      ),
      shouldSlipDrag: !!tensionResult?.shouldSlipDrag,
      dragSlipping: !!tensionResult?.shouldSlipDrag,
    });
    const readiness = this.#resolveLandingReadiness({
      landingLiftFrame: lift,
      tensionFrame,
    });

    return Object.freeze({
      inLandingZone: !!lift?.inLandingZone,
      landingDistanceMeters,
      lineDistanceMeters,
      shoreLandingDistanceMeters,
      lift,
      tension: tensionFrame,
      readiness,
    });
  }

  #buildStaminaFrame({
    forceData,
    rodPullResult,
    rodControlResult,
    fishRetrieveResult,
    lineState,
    stressSystem,
    fishCondition,
    floatEntity,
    rodTipPosition,
    physics,
    fightInput,
    dtSec,
    isPullMode,
    isRecoverMode,
    holdReelRecover,
    playerPressureFatigue,
  } = {}) {
    const playerIsPulling = !!isPullMode && !isRecoverMode;
    const appliedRodHoldKg = Math.max(
      0,
      Number(
        fishRetrieveResult?.effectiveRodHoldKg ??
          rodPullResult?.effectiveForceKg ??
          rodPullResult?.forceKg,
      ) || 0,
    );
    const appliedControlKg = Math.max(
      0,
      Number(rodControlResult?.forceKg) || 0,
    );
    const appliedReelHoldKg = holdReelRecover?.active === true
      ? Math.max(
          0,
          (Number(holdReelRecover?.reelMaxLoadKg) || 0) *
            (Number(holdReelRecover?.reelLoadReserveRatio) || 0),
        )
      : 0;
    const playerPressureControlExhausted =
      playerPressureFatigue?.isControlExhausted === true;
    const weakestFrame =
      stressSystem?.getWeakestTackleLimitFrame?.() ||
      Object.freeze({
        weakestTackleLimitKg:
          Math.max(0, Number(stressSystem?.getEffectiveMaxTackleLoadKg?.()) || 0),
        component: "stress_system",
        candidates: Object.freeze([]),
      });
    const frame = this.#staminaBalanceFrame?.create?.({
      phase: fishCondition?.phase || "stamina",
      playerIsPulling,
      fishTensionKg:
        fishRetrieveResult?.fishTensionKg ?? forceData?.fishTensionKg,
      appliedRodHoldKg,
      appliedReelHoldKg,
      appliedControlKg,
      playerPressureControlExhausted,
      playerFatigueProgress: playerPressureFatigue?.fatigueProgress ?? 0,
      weakestTackleLimitKg: weakestFrame.weakestTackleLimitKg,
      currentStamina: fishCondition?.currentStamina,
      maxStamina: fishCondition?.maxStamina ?? fishCondition?.maxPoints,
      lineAngleDeg: this.#resolveLineAngleDeg({
        floatEntity,
        rodTipPosition,
        rodControlResult,
      }),
      fishLateralContext: this.#resolveStaminaLateralContext({
        rodControlResult,
      }),
      controlDirectionX: rodControlResult?.inputDirectionX ?? 0,
      rawStaminaInputActive: this.#resolveRawStaminaInputActive({
        fightInput,
      }),
      fishStaminaResistanceKg: this.#resolveFishStaminaResistanceKg({
        forceData,
        fishRetrieveResult,
      }),
      isLineFullyExtended: !!lineState?.isFullyExtended,
      fishWonRadialForceKg:
        fishRetrieveResult?.fishWonRadialForceKg ??
        forceData?.fishWonRadialForceKg,
      dragBlockedForceKg:
        fishRetrieveResult?.dragBlockedForceKg ??
        forceData?.dragBlockedForceKg,
      lineTaut:
        fishRetrieveResult?.lineTaut ??
        forceData?.lineTaut ??
        this.#isLineTaut(lineState),
      lineTautRatio: this.#resolveLineTautRatio({
        fishRetrieveResult,
        forceData,
        lineState,
      }),
      fishBehaviorName: this.#resolveFishBehaviorName(forceData),
      shouldSlipDrag:
        fishRetrieveResult?.shouldSlipDrag ?? forceData?.shouldSlipDrag,
      hardLineLimit:
        !!lineState?.isFullyExtended ||
        !!fishRetrieveResult?.tensionBlocked,
      currentExhaustion: fishCondition?.currentExhaustion,
      maxEndurance:
        fishCondition?.maxEndurance ?? fishCondition?.maxPoints,
      dtSec,
      config:
        this.#config?.stamina?.mechanics ||
        physics?.stamina?.mechanics ||
        {},
    });

    if (frame) {
      this.#warnStaminaBudgetOverflow(frame);
      return Object.freeze({
        ...frame,
        angleStressRatio: frame.angleStressRatio,
        staminaPressureRatio: frame.activeDrainRatio,
        weakestTackleLimitComponent: weakestFrame.component,
        weakestTackleLimitCandidates: weakestFrame.candidates,
      });
    }

    return Object.freeze({
      playerPowerIsPulling: playerIsPulling,
      angleStressRatio: Math.max(
        0,
        Math.min(1, Number(forceData?.player?.angleStressRatio) || 0),
      ),
      staminaPressureRatio: 0,
      framePhase: fishCondition?.phase || "stamina",
      frameCurrentExhaustion: Math.max(
        0,
        Number(fishCondition?.currentExhaustion) || 0,
      ),
      frameMaxEndurance: Math.max(
        0,
        Number(fishCondition?.maxEndurance ?? fishCondition?.maxPoints) || 0,
      ),
      frameEnduranceProgress:
        this.#resolveFrameEnduranceProgress(fishCondition),
      isLineFullyExtended: !!lineState?.isFullyExtended,
      source: "legacy_fallback",
    });
  }

  #resolveFrameEnduranceProgress(fishCondition) {
    const maxEndurance = Math.max(
      0,
      Number(fishCondition?.maxEndurance ?? fishCondition?.maxPoints) || 0,
    );
    if (maxEndurance <= 0) return 0;
    return Math.max(
      0,
      Math.min(
        1,
        1 - (Number(fishCondition?.currentExhaustion) || 0) / maxEndurance,
      ),
    );
  }

  #resolveLineTautRatio({ fishRetrieveResult, forceData, lineState } = {}) {
    const explicit = Number(
      fishRetrieveResult?.lineTautRatio ?? forceData?.lineTautRatio,
    );
    if (Number.isFinite(explicit)) {
      return Math.max(0, Math.min(1, explicit));
    }
    const lineTaut =
      fishRetrieveResult?.lineTaut ??
      forceData?.lineTaut ??
      this.#isLineTaut(lineState);
    return lineTaut ? 1 : 0;
  }

  #resolveFishBehaviorName(forceData) {
    const value =
      forceData?.behavior?.name ??
      forceData?.debug?.fishState ??
      forceData?.fishState ??
      forceData?.fishBehaviorName ??
      "unknown";
    const normalized = String(value || "unknown").trim().toLowerCase();
    return normalized || "unknown";
  }

  #resolveLineAngleDeg({ floatEntity, rodTipPosition, rodControlResult } = {}) {
    const fishPosition = floatEntity?.getPosition?.();
    if (this.#hasPoint(fishPosition) && this.#hasPoint(rodTipPosition)) {
      const absOffsetX = Math.abs(fishPosition.x - rodTipPosition.x);
      const dy = Math.abs(rodTipPosition.y - fishPosition.y);
      return Math.atan2(absOffsetX, Math.max(1, dy)) * 180 / Math.PI;
    }
    const existing = Number(rodControlResult?.lineAngleDeg);
    return Number.isFinite(existing) && existing >= 0 ? existing : 0;
  }

  #resolveStaminaLateralContext({ rodControlResult } = {}) {
    const fishOffsetX = Number(rodControlResult?.fishOffsetX) || 0;
    const angleRatio = Math.max(
      0,
      Math.min(1, Number(rodControlResult?.angleRatio) || 0),
    );
    const absOffset = Math.abs(fishOffsetX);
    const maxAllowedLateralOffsetPx =
      angleRatio > 0.000001 ? absOffset / angleRatio : 0;
    return Object.freeze({
      fishLateralOffsetPx: fishOffsetX,
      maxAllowedLateralOffsetPx,
      angleRatio,
    });
  }

  #resolveRawStaminaInputActive({ fightInput } = {}) {
    const actions = fightInput?.fightActions;
    if (actions?.hold?.active === true) return true;
    if (actions?.lateralControl?.active === true) return true;
    return (
      fightInput?.isPulling === true ||
      fightInput?.pullHeld === true ||
      fightInput?.rodControlActive === true
    );
  }

  #resolveFishStaminaResistanceKg({ forceData, fishRetrieveResult } = {}) {
    const candidates = [
      forceData?.fishCurrentStateMaxForceKg,
      forceData?.debug?.fishCurrentStateMaxForceKg,
      forceData?.fishStateMaxForceWithoutPowerDebuffKg,
      fishRetrieveResult?.fishOppositionKg,
      forceData?.fishOppositionKg,
      forceData?.totalFishForceKg,
      forceData?.fishWeightKg,
    ];
    for (const candidate of candidates) {
      const value = Number(candidate);
      if (Number.isFinite(value) && value > 0) return value;
    }
    return 0;
  }

  #warnStaminaBudgetOverflow(frame) {
    if (!frame?.budgetOverflowWarning) {
      this.#staminaBudgetOverflowWarningActive = false;
      return;
    }
    if (this.#staminaBudgetOverflowWarningActive) return;
    this.#staminaBudgetOverflowWarningActive = true;
    console.warn(
      "[STAMINA] Stamina received applied player pressure above available tackle budget. This means physics budget and stamina frame are out of sync.",
      frame,
    );
  }

  #resolveLandingReadiness({ landingLiftFrame, tensionFrame }) {
    const config = this.#physicsConfig?.getLandingLiftConfig?.() || {};
    if (this.#landingLiftReadinessPolicy?.evaluate) {
      return this.#landingLiftReadinessPolicy.evaluate({
        landingLiftFrame,
        tensionFrame,
        config,
      });
    }

    const liftMaxKg = Math.max(0, Number(landingLiftFrame?.liftMaxKg) || 0);
    const liftHoldKg = Math.max(0, Number(landingLiftFrame?.liftHoldKg) || 0);
    const supportedTensionKg = Math.max(
      0,
      Number(tensionFrame?.supportedTensionKg) || 0,
    );
    return Object.freeze({
      ready:
        config.enabled === false ||
        (
          !!landingLiftFrame?.inLandingZone &&
          !!landingLiftFrame?.playerHoldActive &&
          !!landingLiftFrame?.active &&
          liftMaxKg > 0 &&
          liftHoldKg >= liftMaxKg - 0.001 &&
          supportedTensionKg >= liftMaxKg - 0.001
        ),
      reason: "fallback",
      liftRequiredKg: liftMaxKg,
      liftHoldKg,
      supportedTensionKg,
      rawTensionKg: Math.max(0, Number(tensionFrame?.rawTensionKg) || 0),
      visibleTensionKg: Math.max(
        0,
        Number(tensionFrame?.visibleTensionKg) || 0,
      ),
      dragSlipping: !!tensionFrame?.shouldSlipDrag,
    });
  }

  #resolveFishWeightKg(forceData) {
    return Math.max(
      0,
      Number(forceData?.fishWeightKg) || 0,
    );
  }

  #recoverLineCredit({
    dtSec,
    reelSystem,
    lineSystem,
    reel,
    tensionKg,
    isRecoverMode,
    loadLimitKg = null,
    maxRecoverMeters = null,
  }) {
    return reelSystem.recoverLineCredit({
      dtSec,
      lineSystem,
      reel,
      tensionKg,
      inputRecover: isRecoverMode,
      loadLimitKg,
      maxRecoverMeters,
    });
  }

  #recoverRodStrokeCredit({
    dtSec,
    reelSystem,
    lineSystem,
    reel,
    tensionKg,
    blockedReason,
    playerHoldActive,
    strokeWonMeters,
    fishDistanceMeters,
  }) {
    if (!reelSystem?.recoverRodStrokeCredit) {
      return {
        active: false,
        blockedReason: "missing_reel_recovery",
        reelLoadRatio: 1,
        reelEfficiency: 0,
        recoverSpeedMetersPerSec: 0,
        desiredRecoverMeters: 0,
        maxRecoverByLineMeters: 0,
        recoveredMeters: 0,
      };
    }

    return reelSystem.recoverRodStrokeCredit({
      dtSec,
      lineSystem,
      reel,
      tensionKg,
      blockedReason,
      playerHoldActive,
      strokeWonMeters,
      fishDistanceMeters,
    });
  }

  #resolveReelRecoveryLoad({ tensionResult, dragContext }) {
    const rawLoadKg = Math.max(0, Number(tensionResult?.rawTensionKg) || 0);
    const dragLimitKg = Math.max(0, Number(dragContext?.effectiveDragLimitKg) || 0);
    if (!dragContext?.dragLocked && rawLoadKg > dragLimitKg + 0.001) {
      return {
        tensionKg: rawLoadKg,
        blockedReason: "raw_load_above_drag_limit",
      };
    }
    return {
      tensionKg: rawLoadKg,
      blockedReason: null,
    };
  }

  #updateHoldReelRecovery({
    dtMs,
    isPullMode,
    hasReel,
    reel,
    rodPullResult,
    tensionPreview,
    dragContext,
    physics,
    lineState,
  }) {
    const reelHoldConfig =
      this.#physicsConfig?.getReelHoldConfig?.() ||
      this.#physicsConfig?.getReelConfig?.() ||
      {};
    const lineRecoverableMeters = Math.max(
      0,
      Number(lineState?.recoverableLineMeters) ||
        (
          (Number(lineState?.releasedMeters) || 0) -
          (Number(lineState?.distanceMeters) || 0)
        ),
    );

    const rodStrokeRatio = Math.max(
      0,
      Math.min(1, Number(rodPullResult?.rodStrokeRatio) || 0),
    );
    this.#holdReelRecoverState = this.#reelHoldRecoverySystem.update({
      dtMs,
      config: reelHoldConfig,
      hasReel,
      playerHoldActive: isPullMode,
      rodPullActive: rodPullResult?.active,
      strokeRatio: rodStrokeRatio,
      rawTensionKg: tensionPreview?.rawTensionKg,
      dragLimitKg: dragContext?.effectiveDragLimitKg,
      dragLocked: dragContext?.dragLocked,
      shouldSlipDrag: tensionPreview?.shouldSlipDrag,
      reelMaxLoadKg:
        reel?.getEffectiveMaxLoadKg?.() ??
        reel?.getMaxLoadKg?.() ??
        0,
      retrieveSpeedMetersPerSecond: reel?.getRetrieveSpeedMetersPerSec?.() ?? 0,
      lineRecoverableMeters,
      physics,
    });
    this.#holdReelRecoverState.source = "reel_hold_recovery";
    return this.#holdReelRecoverState;
  }

  #resolveLineLimit({
    floatEntity,
    rodTipPosition,
    lineSystem,
    dragSystem,
    dragContext,
    tensionResult,
    physics,
    velocity,
    hardLineLimitBeforeRelease,
  }) {
    lineSystem.updateDistance(floatEntity.getPosition(), rodTipPosition);
    const releaseResult = lineSystem.releaseForDistance({
      dragRatio: dragSystem.value,
      shouldSlip: tensionResult.shouldSlipDrag,
      slipReleaseRatio: tensionResult.shouldSlipDrag ? 1 : 0,
      creepReleaseRatio:
        this.#physicsConfig?.getReelDragConfig?.()?.creepReleaseRatio ??
        0,
    });
    const constraintResult = lineSystem.constrainPosition(
      floatEntity.getPosition(),
      floatEntity.getVelocity?.() || velocity,
      rodTipPosition,
    );
    const lineStateBeforeRecover = lineSystem.updateDistance(
      floatEntity.getPosition(),
      rodTipPosition,
    );
    const hardLineLimit =
      hardLineLimitBeforeRelease ||
      !!releaseResult.hardLimitReached ||
      !!constraintResult.hardLimit ||
      !!lineStateBeforeRecover.isFullyExtended;
    const lineState = lineSystem.updateDistance(floatEntity.getPosition(), rodTipPosition);
    const lineConstraintState = this.#resolveLineConstraintState({
      lineState,
      dragContext,
      fishRetrieveResult: tensionResult,
      payoutResult: releaseResult,
    });
    const finalRecoverableLineMeters = this.#recoverableLineCalculator.calculateRecoverableLineMeters({
      releasedMeters: lineState.releasedMeters,
      fishDistanceMeters: lineState.distanceMeters,
    });
    const actualSlackMeters = this.#looseLineCalculator.calculateActualSlackMeters({
      releasedMeters: lineState.releasedMeters,
      fishDistanceMeters: lineState.distanceMeters,
      fishMovingTowardPlayer: false,
      playerPulling: false,
      reelRecovering: false,
    });

    return {
      releaseResult,
      constraintResult,
      lineState,
      lineConstraintState,
      hardLineLimit,
      finalRecoverableLineMeters,
      actualSlackMeters,
    };
  }

  #inspectPoleFightSector({
    floatEntity,
    rodTipPosition,
    lineSystem,
  }) {
    const fallback = {
      enabled: false,
      active: false,
      clamped: false,
      side: "none",
      angleDeg: 0,
      clampedAngleDeg: 0,
      maxAngleFromCenterDeg: 60,
      radiusPx: 0,
      originX: Number(rodTipPosition?.x) || 0,
      originY: Number(rodTipPosition?.y) || 0,
      radialOriginX: Number(rodTipPosition?.x) || 0,
      radialOriginY: Number(rodTipPosition?.y) || 0,
      sectorApexX: Number(rodTipPosition?.x) || 0,
      sectorApexY: Number(rodTipPosition?.y) || 0,
      apexOffsetPx: 0,
      shoreOpeningWidthMeters: 0,
      positionX: Number(floatEntity?.getPosition?.()?.x) || 0,
      positionY: Number(floatEntity?.getPosition?.()?.y) || 0,
      lineState: null,
    };
    if (!this.#poleFightSectorConstraint?.inspect) return fallback;

    const lineState = lineSystem.updateDistance(
      floatEntity.getPosition(),
      rodTipPosition,
    );
    const frame = this.#poleFightSectorConstraint.inspect({
      position: floatEntity.getPosition(),
      origin: rodTipPosition,
      limitRadiusPx: this.#resolvePoleFightSectorLimitRadiusPx({ lineState }),
      pixelsPerMeter:
        this.#physicsConfig?.getPixelsPerMeter?.() || 50,
      config:
        this.#physicsConfig?.getPoleFightSectorConfig?.() ||
        this.#getRuntimePhysicsConfig()?.fight?.poleFightSector ||
        {},
    });
    return {
      ...frame,
      lineState,
    };
  }

  #applyPoleFightSectorMovement({
    fromPosition,
    proposedPosition,
    velocity,
    origin,
    limitRadiusPx = 0,
    adjustVelocity = false,
    enforceRadius = true,
  }) {
    if (!this.#poleFightSectorConstraint?.resolveMovement) {
      return {
        active: false,
        clamped: false,
        positionX: Number(proposedPosition?.x) || 0,
        positionY: Number(proposedPosition?.y) || 0,
      };
    }

    const frame = this.#poleFightSectorConstraint.resolveMovement({
      fromPosition,
      proposedPosition,
      velocity: adjustVelocity ? velocity : null,
      origin,
      limitRadiusPx,
      pixelsPerMeter:
        this.#physicsConfig?.getPixelsPerMeter?.() || 50,
      config:
        this.#physicsConfig?.getPoleFightSectorConfig?.() ||
        this.#getRuntimePhysicsConfig()?.fight?.poleFightSector ||
        {},
      enforceRadius,
    });
    if (!frame.active) return frame;

    proposedPosition.x = frame.positionX;
    proposedPosition.y = frame.positionY;
    if (adjustVelocity && frame.velocityAdjusted && velocity) {
      velocity.x = frame.velocityX;
      velocity.y = frame.velocityY;
    }
    return frame;
  }

  #applyPoleFightSectorAngleMovement({
    fromPosition,
    proposedPosition,
    velocity,
    origin,
    limitRadiusPx = 0,
    adjustVelocity = false,
  }) {
    if (!this.#poleFightSectorAngleConstraint?.resolveMovement) {
      return {
        active: false,
        clamped: false,
        positionX: Number(proposedPosition?.x) || 0,
        positionY: Number(proposedPosition?.y) || 0,
        enforceRadius: false,
      };
    }

    const frame = this.#poleFightSectorAngleConstraint.resolveMovement({
      fromPosition,
      proposedPosition,
      velocity: adjustVelocity ? velocity : null,
      origin,
      limitRadiusPx,
      pixelsPerMeter:
        this.#physicsConfig?.getPixelsPerMeter?.() || 50,
      config:
        this.#physicsConfig?.getPoleFightSectorConfig?.() ||
        this.#getRuntimePhysicsConfig()?.fight?.poleFightSector ||
        {},
    });
    if (!frame.active) return frame;

    proposedPosition.x = frame.positionX;
    proposedPosition.y = frame.positionY;
    if (adjustVelocity && frame.velocityAdjusted && velocity) {
      velocity.x = frame.velocityX;
      velocity.y = frame.velocityY;
    }
    return frame;
  }

  #buildDebugSnapshot({
    forceData,
    dragSystem,
    lineState,
    finalRecoverableLineMeters,
    initialRecoverableLineMeters,
    actualSlackMeters,
    releaseResult,
    recoveredMeters,
    autoRecovery,
    strokeDistanceFrame,
    prePullStrokeDistanceFrame,
    autoRecoveredMeters,
    holdRecoveredMeters,
    hardLineLimit,
    constraintResult,
    rodPullDisplay,
    rodPullResult,
    rodPullMoveMeters,
    rodControlResult,
    rodControlMoveMeters,
    rodControlMovePx,
    rodControlMovementBlockReason,
    lineConstraintState,
    holdReelRecoverMoveMeters,
    rodPullMovementBlockReason,
    reelHoldMovementBlockReason,
    hardTensionBlocked,
    fishRetrieveResult,
    landingLiftResult,
    landingFrame,
    staminaFrame,
    tensionResult,
    stressSystem,
    physics,
    isPullMode,
    isRecoverMode,
    holdReelRecover,
    dragContext,
    playerForceBudget,
    playerPressureGain,
    playerTensionBuildRate,
    playerPressureFatigue,
    poleFightSectorFrame,
    fishCondition,
  }) {
    const lineHasReserve = this.#lineHasReserve(lineState);
    const frameDtSec = Math.max(0, Number(physics?.dtSec) || 0);
    const appliedRodPullMoveMeters = Math.max(0, Number(rodPullMoveMeters) || 0);
    const appliedRodControlMoveMeters = Math.max(
      0,
      Number(rodControlMoveMeters) || 0,
    );
    const appliedRodControlMovePx = Math.max(
      0,
      Number(rodControlMovePx) || 0,
    );
    const appliedReelHoldMoveMeters = Math.max(
      0,
      Number(holdReelRecoverMoveMeters) || 0,
    );
    const totalAppliedPullMoveMeters =
      appliedRodPullMoveMeters + appliedReelHoldMoveMeters;
    const rodPullAppliedSpeedMps =
      frameDtSec > 0 ? appliedRodPullMoveMeters / frameDtSec : 0;
    const rodControlAppliedSpeedMps =
      frameDtSec > 0 ? appliedRodControlMoveMeters / frameDtSec : 0;
    const reelHoldAppliedSpeedMps =
      frameDtSec > 0 ? appliedReelHoldMoveMeters / frameDtSec : 0;
    const playerPullMotion = this.#playerPullMotionSmoother.getDebugData();
    const totalAppliedPullSpeedMps =
      frameDtSec > 0 ? totalAppliedPullMoveMeters / frameDtSec : 0;
    const playerPullMovementMode = this.#resolvePlayerPullMovementMode({
      appliedReelHoldMoveMeters,
      appliedRodPullMoveMeters,
    });
    const fishMovementMode = this.#resolveFishMovementMode(
      forceData.fightMovementFrame,
    );
    const fishMovementSummary = this.#resolveFishMovementSummary({
      frame: forceData.fightMovementFrame,
      awayDirX: forceData.awayDirX,
      awayDirY: forceData.awayDirY,
      fishWonForceKg:
        fishRetrieveResult?.fishWonForceKg ?? forceData.fishWonForceKg,
      netForceKg: fishRetrieveResult?.netForceKg,
      rodControlForceKg: rodControlResult?.forceKg,
    });
    const fishPressureSummary = this.#resolveFishPressureSummary({
      frame: forceData.fightMovementFrame,
      awayDirX: forceData.awayDirX,
      awayDirY: forceData.awayDirY,
      fishWonForceKg:
        fishRetrieveResult?.fishWonForceKg ?? forceData.fishWonForceKg,
      netForceKg: fishRetrieveResult?.netForceKg,
      rodControlForceKg: rodControlResult?.forceKg,
    });
    const lineDebug = {
      totalLineMeters: Math.max(0, Number(lineState.totalLineMeters ?? lineState.totalLengthMeters) || 0),
      fishDistanceMeters: Math.max(0, Number(lineState.distanceMeters) || 0),
      releasedLineMeters: Math.max(0, Number(lineState.releasedMeters) || 0),
      remainingLineMeters: Math.max(0, Number(lineState.remainingMeters) || 0),
      recoverableLineMeters: Math.max(0, Number(lineState.recoverableLineMeters) || 0),
      initialRecoverableLineMeters:
        Math.max(0, Number(initialRecoverableLineMeters) || 0),
      finalRecoverableLineMeters:
        Math.max(0, Number(finalRecoverableLineMeters) || 0),
      lineReleasedThisFrameMeters: Math.max(0, Number(releaseResult.releasedMeters) || 0),
      lineRecoveredThisFrameMeters: Math.max(0, Number(recoveredMeters) || 0),
      lineDemandedThisFrameMeters: Math.max(0, Number(releaseResult.demandedMeters) || 0),
      lineUnsatisfiedThisFrameMeters: Math.max(0, Number(releaseResult.unsatisfiedMeters) || 0),
      lineLengthLocked:
        lineConstraintState?.lineLengthLocked ??
        !!releaseResult.lineLengthLocked,
      radialConstraintActive:
        !!lineConstraintState?.radialConstraintActive,
      tautLine: !!lineConstraintState?.tautLine,
      dragCanPayout: !!lineConstraintState?.dragCanPayout,
      dragPayoutBlocked: !!lineConstraintState?.dragPayoutBlocked,
      constraintReason: lineConstraintState?.reason || "none",
      releaseBlockedReason: releaseResult.releaseBlockedReason || "none",
      releaseBlockedByDrag: !!releaseResult.blockedByDrag,
      releaseBlockedByHardLimit: !!releaseResult.blockedByHardLimit,
      lineHasReserve,
      spoolEmpty: !lineHasReserve,
      fullyExtended: !!lineState.isFullyExtended,
      hardLineLimit: !!hardLineLimit,
      hardLineLimitMeters: Math.max(0, Number(lineState.releasedMeters) || 0),
      rodStrokeCapacityMeters: Math.max(0, Number(rodPullDisplay.rodStrokeCapacityMeters) || 0),
      rodStrokeWonMeters: Math.max(0, Number(rodPullDisplay.rodStrokeWonMeters) || 0),
      rodStrokeUsedMeters: Math.max(0, Number(rodPullDisplay.rodStrokeUsedMeters) || 0),
      rodStrokeUnrecoveredMeters: Math.max(0, Number(rodPullDisplay.rodStrokeUnrecoveredMeters) || 0),
      rodStrokeRatio: Math.max(0, Math.min(1, Number(rodPullDisplay.rodStrokeRatio) || 0)),
      strokeRecoveredMeters: Math.max(0, Number(rodPullDisplay.strokeRecoveredMeters) || 0),
      strokeDistancePreviousMeters:
        Math.max(0, Number(rodPullDisplay.strokeDistancePreviousMeters) || 0),
      strokeDistanceCurrentMeters:
        Math.max(0, Number(rodPullDisplay.strokeDistanceCurrentMeters) || 0),
      strokeDistanceDeltaMeters:
        Number(rodPullDisplay.strokeDistanceDeltaMeters) || 0,
      strokeDistanceGainedMeters:
        Math.max(0, Number(rodPullDisplay.strokeDistanceGainedMeters) || 0),
      strokeDistanceLostMeters:
        Math.max(0, Number(rodPullDisplay.strokeDistanceLostMeters) || 0),
      strokeDistanceReason: rodPullDisplay.strokeDistanceReason || "none",
      prePullStrokeDistanceLostMeters:
        Math.max(0, Number(prePullStrokeDistanceFrame?.lostMeters) || 0),
      autoRecoverActive: !!autoRecovery?.active,
      autoRecoverBlockedReason: autoRecovery?.blockedReason || "not_checked",
      autoRecoverSpeedMetersPerSec:
        Math.max(0, Number(autoRecovery?.recoverSpeedMetersPerSec) || 0),
      autoRecoverBaseRetrieveSpeedMetersPerSec:
        Math.max(0, Number(autoRecovery?.retrieveSpeedMetersPerSec) || 0),
      autoRecoverReelMaxLoadKg:
        Math.max(0, Number(autoRecovery?.reelMaxLoadKg) || 0),
      autoRecoverReelEfficiency:
        Math.max(0, Math.min(1, Number(autoRecovery?.reelEfficiency) || 0)),
      autoRecoverReelLoadRatio:
        Math.max(0, Math.min(1, Number(autoRecovery?.reelLoadRatio) || 0)),
      autoRecoveredMeters: Math.max(0, Number(autoRecoveredMeters) || 0),
      holdRecoveredMeters: Math.max(0, Number(holdRecoveredMeters) || 0),
      reelHoldConfigEnabled: holdReelRecover?.enabled === true,
      reelHoldHasReel: holdReelRecover?.hasReel === true,
      reelHoldPlayerHoldActive:
        holdReelRecover?.playerHoldActive === true,
      reelHoldRequiredStrokeRatio:
        Math.max(0, Number(holdReelRecover?.requiredStrokeRatio) || 1),
      reelHoldStrokeFull: holdReelRecover?.strokeFull === true,
      reelHoldRawTensionKg:
        Math.max(0, Number(holdReelRecover?.rawTensionKg) || 0),
      reelHoldDragLimitKg:
        Math.max(0, Number(holdReelRecover?.dragLimitKg) || 0),
      reelHoldDragLocked: holdReelRecover?.dragLocked === true,
      reelHoldShouldSlipDrag: holdReelRecover?.shouldSlipDrag === true,
      reelHoldTensionBelowDragLimit:
        holdReelRecover?.tensionBelowDragLimit === true,
      reelHoldTensionBelowMaxLoad:
        holdReelRecover?.tensionBelowMaxLoad === true,
      reelHoldDragCanHold: holdReelRecover?.dragCanHold === true,
      reelHoldRetrieveSpeedMps:
        Math.max(
          0,
          Number(holdReelRecover?.retrieveSpeedMetersPerSecond) || 0,
        ),
      holdReelRecoverEngaged: !!holdReelRecover?.engaged,
      holdReelRecoveringLine: !!holdReelRecover?.recoveringLine,
      holdReelRecoverHasRecoverableLine:
        !!holdReelRecover?.hasRecoverableLine,
      holdReelRecoverLineBlockedReason:
        holdReelRecover?.lineRecoveryBlockedReason || "not_checked",
      strokeResetReason: rodPullDisplay.strokeResetReason || "none",
    };

    return {
      ...forceData.debug,
      ...dragSystem.getDebugData(),
      dragSupported: !!dragContext.dragSupported,
      lineDebug,
      lineTotalMeters: lineState.totalLineMeters ?? lineState.totalLengthMeters,
      lineReleasedMeters: lineState.releasedMeters,
      lineRemainingMeters: lineState.remainingMeters,
      lineCanRelease: lineHasReserve,
      lineSpoolEmpty: !lineHasReserve,
      lineReserveEmpty: !lineHasReserve,
      physicalLineLimit: !!lineState.isFullyExtended,
      lineMaxRemainingMeters: lineState.maxRemainingMeters,
      lineBaseReachMeters: lineState.baseReachMeters,
      lineTotalLengthMeters: lineState.totalLengthMeters,
      lineRecoverableMeters: lineState.recoverableLineMeters,
      isLineFullyExtended: lineState.isFullyExtended,
      lineExtensionRatio: lineState.lineExtensionRatio,
      lineDistanceMeters: lineState.distanceMeters,
      shoreLandingDistanceMeters:
        Math.max(0, Number(forceData.shoreLandingDistanceMeters) || 0),
      landingDistanceMode: "shore",
      actualSlackMeters,
      lineReleasedThisFrameMeters: releaseResult.releasedMeters,
      lineDemandedThisFrameMeters: releaseResult.demandedMeters,
      lineUnsatisfiedThisFrameMeters: releaseResult.unsatisfiedMeters,
      lineLengthLocked:
        lineConstraintState?.lineLengthLocked ??
        !!releaseResult.lineLengthLocked,
      radialConstraintActive:
        !!lineConstraintState?.radialConstraintActive,
      lineTaut: !!lineConstraintState?.tautLine,
      lineDragCanPayout: !!lineConstraintState?.dragCanPayout,
      lineDragPayoutBlocked: !!lineConstraintState?.dragPayoutBlocked,
      lineConstraintReason: lineConstraintState?.reason || "none",
      lineReleaseBlockedReason:
        releaseResult.releaseBlockedReason || "none",
      reelSlip: releaseResult.didSlip,
      lineRecoveredThisFrameMeters: recoveredMeters,
      hardLineLimit,
      constraintCorrectionPx: constraintResult.correctionPx,
      playerForceBudgetEnabled: !!playerForceBudget?.enabled,
      playerForceTotalBudgetKg:
        Math.max(0, Number(playerForceBudget?.totalPlayerBudgetKg) || 0),
      playerForceHoldBudgetKg:
        Math.max(0, Number(playerForceBudget?.holdBudgetKg) || 0),
      playerForceControlBudgetKg:
        Math.max(0, Number(playerForceBudget?.controlBudgetKg) || 0),
      playerForceHoldShare:
        Math.max(0, Math.min(1, Number(playerForceBudget?.holdShare) || 0)),
      playerForceControlShare:
        Math.max(0, Math.min(1, Number(playerForceBudget?.controlShare) || 0)),
      playerForceCombinedCeilingMultiplier:
        Math.max(0, Number(playerForceBudget?.combinedCeilingMultiplier) || 1),
      playerForceCombinedTensionCeilingKg:
        Math.max(0, Number(playerForceBudget?.combinedTensionCeilingKg) || 0),
      playerForceBudgetReason: playerForceBudget?.reason || "none",
      playerForceControlRequested:
        playerForceBudget?.controlRequested === true,
      playerForceControlEligible:
        playerForceBudget?.controlEligible === true,
      playerForceControlBlockedReason:
        playerForceBudget?.controlBlockedReason || "none",
      playerPressureGainMode:
        playerPressureGain?.mode || "none",
      playerPressureGainMultiplier:
        Math.max(0, Number(playerPressureGain?.multiplier) || 1),
      playerPressureHoldActive:
        playerPressureGain?.holdActive === true,
      playerPressureControlActive:
        playerPressureGain?.controlActive === true,
      playerPressureHoldForceKg:
        Math.max(0, Number(playerPressureGain?.holdForceKg) || 0),
      playerPressureControlForceKg:
        Math.max(0, Number(playerPressureGain?.controlForceKg) || 0),
      playerPressureControlInputRatio:
        Math.max(
          0,
          Math.min(1, Number(playerPressureGain?.controlInputRatio) || 0),
        ),
      tensionBuildMode:
        playerTensionBuildRate?.mode || "none",
      tensionBuildRateMultiplier:
        Math.max(
          0,
          Number(playerTensionBuildRate?.buildRateMultiplier) || 1,
        ),
      tensionBuildHoldActive:
        playerTensionBuildRate?.holdActive === true,
      tensionBuildControlActive:
        playerTensionBuildRate?.controlActive === true,
      rodHoldBaseChargePerSecond:
        Math.max(0, Number(rodPullResult?.baseChargePerSecond) || 0),
      rodHoldEffectiveChargePerSecond:
        Math.max(0, Number(rodPullResult?.chargePerSecond) || 0),
      rodControlBaseBuildPerSecond:
        Math.max(0, Number(rodControlResult?.controlBaseBuildPerSecond) || 0),
      rodControlEffectiveBuildPerSecond:
        Math.max(
          0,
          Number(rodControlResult?.controlEffectiveBuildPerSecond) || 0,
        ),
      rodControlBuildRatio:
        Math.max(0, Math.min(1, Number(rodControlResult?.controlBuildRatio) || 0)),
      tensionBuildRemainingReserveKg:
        Math.max(
          0,
          Number(playerForceBudget?.combinedTensionCeilingKg) -
            Number(tensionResult?.totalTensionKg),
        ) || 0,
      tensionBuildBlockedByCap:
        Math.max(
          0,
          Number(playerForceBudget?.combinedTensionCeilingKg) -
            Number(tensionResult?.totalTensionKg),
        ) <= 0.001,
      playerPressureFatigueEnabled:
        playerPressureFatigue?.enabled === true,
      playerPressureFatigueEfficiency:
        playerPressureFatigue?.appliedEfficiency ??
        playerPressureFatigue?.efficiency ??
        1,
      playerPressureFatigueNextEfficiency:
        playerPressureFatigue?.nextEfficiency ??
        playerPressureFatigue?.efficiency ??
        1,
      playerPressureFatigueState:
        playerPressureFatigue?.stateName || "idle",
      playerPressureFatigueSourceMode:
        playerPressureFatigue?.sourceMode || "reel_hold",
      playerPressureFatigueSourceActive:
        playerPressureFatigue?.sourceActive === true,
      playerPressureFatigueSourceReason:
        playerPressureFatigue?.sourceReason || "reel_hold_inactive",
      playerPressureFatigueHoldMs:
        playerPressureFatigue?.holdElapsedMs ??
        playerPressureFatigue?.pressureHoldMs ??
        0,
      playerPressureFatigueHoldElapsedMs:
        playerPressureFatigue?.holdElapsedMs ??
        playerPressureFatigue?.pressureHoldMs ??
        0,
      playerPressureFatigueHoldSeconds:
        Math.max(
          0,
          Number(
            playerPressureFatigue?.holdElapsedMs ??
              playerPressureFatigue?.pressureHoldMs,
          ) || 0,
        ) /
        1000,
      playerPressureFatigueRecoveryState:
        playerPressureFatigue?.recoveryState || "disabled",
      playerPressureFatiguePressureKg:
        playerPressureFatigue?.pressureKg ?? 0,
      playerPressureFatigueFatigueRatio:
        playerPressureFatigue?.fatigueRatio ?? 0,
      playerPressureFatigueProgress:
        playerPressureFatigue?.fatigueProgress ?? 0,
      playerPressureFatigueGraceElapsedMs:
        playerPressureFatigue?.graceElapsedMs ?? 0,
      playerPressureFatigueGraceDurationMs:
        playerPressureFatigue?.graceDurationMs ?? 0,
      playerPressureFatigueGraceRemainingMs:
        playerPressureFatigue?.graceRemainingMs ?? 0,
      playerPressureFatigueFatigueElapsedMs:
        playerPressureFatigue?.fatigueElapsedMs ?? 0,
      playerPressureFatigueFatigueDurationMs:
        playerPressureFatigue?.fatigueDurationMs ?? 0,
      playerPressureFatigueFatigueRemainingMs:
        playerPressureFatigue?.fatigueRemainingMs ?? 0,
      playerPressureFatigueRecoveryDelayElapsedMs:
        playerPressureFatigue?.recoveryDelayElapsedMs ?? 0,
      playerPressureFatigueRecoveryDelayMs:
        playerPressureFatigue?.recoveryDelayMs ??
        playerPressureFatigue?.delayAfterPressureMs ??
        0,
      playerPressureFatigueRecoveryDelayRemainingMs:
        playerPressureFatigue?.recoveryDelayRemainingMs ?? 0,
      playerPressureFatigueRecoveryProgress:
        playerPressureFatigue?.recoveryProgress ?? 0,
      playerPressureFatigueRecoveryRemainingMs:
        playerPressureFatigue?.recoveryRemainingMs ?? 0,
      playerPressureFatigueControlBreakEnabled:
        playerPressureFatigue?.controlBreakEnabled === true,
      playerPressureFatigueControlExhausted:
        playerPressureFatigue?.isControlExhausted === true,
      playerPressureFatigueControlBreakThreshold:
        playerPressureFatigue?.controlBreakFatigueProgressThreshold ??
        playerPressureFatigue?.controlBreakFatigueRatioThreshold ??
        0,
      playerPressureFatigueControlBreakMinHoldMs:
        playerPressureFatigue?.controlBreakMinContinuousPressureMs ?? 0,
      playerPressureFatigueRawRodHoldKg:
        playerPressureFatigue?.rawRodHoldKg ?? 0,
      playerPressureFatigueRawControlKg:
        playerPressureFatigue?.rawControlKg ?? 0,
      playerPressureFatigueRodHoldKg:
        playerPressureFatigue?.fatiguedRodHoldKg ?? 0,
      playerPressureFatigueControlKg:
        playerPressureFatigue?.fatiguedControlKg ?? 0,
      playerPressureFatigueRodHoldChannel:
        playerPressureFatigue?.channels?.rodHold !== false,
      playerPressureFatigueControlChannel:
        playerPressureFatigue?.channels?.rodControl !== false,
      poleFightSectorEnabled:
        poleFightSectorFrame?.enabled === true,
      poleFightSectorActive:
        poleFightSectorFrame?.active === true,
      poleFightSectorClamped:
        poleFightSectorFrame?.clamped === true,
      poleFightSectorSide:
        poleFightSectorFrame?.side || "none",
      poleFightSectorAngleDeg:
        Number(poleFightSectorFrame?.angleDeg) || 0,
      poleFightSectorClampedAngleDeg:
        Number(poleFightSectorFrame?.clampedAngleDeg) || 0,
      poleFightSectorMaxAngleDeg:
        Number(poleFightSectorFrame?.maxAngleFromCenterDeg) || 0,
      poleFightSectorFishRadiusPx:
        Math.max(0, Number(poleFightSectorFrame?.radiusPx) || 0),
      poleFightSectorRadiusPx:
        Math.max(0, Number(poleFightSectorFrame?.radiusPx) || 0),
      poleFightSectorLimitRadiusPx:
        Math.max(0, Number(poleFightSectorFrame?.limitRadiusPx) || 0),
      poleFightSectorLimitRadiusMeters:
        Math.max(0, Number(poleFightSectorFrame?.limitRadiusPx) || 0) /
        Math.max(1, this.#physicsConfig?.getPixelsPerMeter?.() || 50),
      poleFightSectorOriginX:
        Number(poleFightSectorFrame?.originX) || 0,
      poleFightSectorOriginY:
        Number(poleFightSectorFrame?.originY) || 0,
      poleFightSectorShoreOpeningWidthMeters:
        Math.max(
          0,
          Number(poleFightSectorFrame?.shoreOpeningWidthMeters) || 0,
        ),
      poleFightSectorApexX:
        Number(
          poleFightSectorFrame?.sectorApexX ??
          poleFightSectorFrame?.originX,
        ) || 0,
      poleFightSectorApexY:
        Number(
          poleFightSectorFrame?.sectorApexY ??
          poleFightSectorFrame?.originY,
        ) || 0,
      poleFightSectorApexOffsetPx:
        Math.max(0, Number(poleFightSectorFrame?.apexOffsetPx) || 0),
      poleFightSectorForwardX:
        Number(poleFightSectorFrame?.forwardX) || 0,
      poleFightSectorForwardY:
        Number(poleFightSectorFrame?.forwardY) || -1,
      poleFightSectorLeftBoundaryDirectionX:
        Number(poleFightSectorFrame?.leftBoundaryDirectionX) || 0,
      poleFightSectorLeftBoundaryDirectionY:
        Number(poleFightSectorFrame?.leftBoundaryDirectionY) || 0,
      poleFightSectorRightBoundaryDirectionX:
        Number(poleFightSectorFrame?.rightBoundaryDirectionX) || 0,
      poleFightSectorRightBoundaryDirectionY:
        Number(poleFightSectorFrame?.rightBoundaryDirectionY) || 0,
      poleFightSectorLeftBoundaryRadiusIntersectionX:
        Number(
          poleFightSectorFrame?.leftBoundaryRadiusIntersectionX,
        ) || 0,
      poleFightSectorLeftBoundaryRadiusIntersectionY:
        Number(
          poleFightSectorFrame?.leftBoundaryRadiusIntersectionY,
        ) || 0,
      poleFightSectorRightBoundaryRadiusIntersectionX:
        Number(
          poleFightSectorFrame?.rightBoundaryRadiusIntersectionX,
        ) || 0,
      poleFightSectorRightBoundaryRadiusIntersectionY:
        Number(
          poleFightSectorFrame?.rightBoundaryRadiusIntersectionY,
        ) || 0,
      poleFightSectorBoundaryType:
        poleFightSectorFrame?.boundaryType || "none",
      poleFightSectorOutside:
        poleFightSectorFrame?.outside === true,
      poleFightSectorRecoveryMovement:
        poleFightSectorFrame?.recoveryMovement === true,
      rodPullActive: rodPullDisplay.active,
      rodPullRatio: rodPullDisplay.ratio,
      rodPullRawForceKg: rodPullResult.rawForceKg ?? rodPullResult.forceKg,
      rodPullForceKg: rodPullResult.forceKg,
      rodLimitKg: rodPullResult.rodLimitKg,
      rodHoldMaxKg: rodPullResult.rodHoldMaxKg,
      rodHoldTensionCeilingMultiplier:
        rodPullResult.tensionCeilingMultiplier ?? 1,
      rodHoldTensionCeilingKg:
        rodPullResult.tensionCeilingKg ?? rodPullResult.rodLimitKg,
      effectiveRodHoldKg: fishRetrieveResult?.effectiveRodHoldKg ?? rodPullResult.effectiveForceKg,
      holdTensionRatio: rodPullResult.holdTensionRatio,
      playerHoldTensionKg: fishRetrieveResult?.playerHoldTensionKg ?? rodPullResult.playerHoldTensionKg,
      rawPlayerHoldTensionKg: fishRetrieveResult?.rawPlayerHoldTensionKg ?? 0,
      movableHoldTensionCapKg: fishRetrieveResult?.movableHoldTensionCapKg ?? 0,
      movableHoldTensionCapRatio:
        fishRetrieveResult?.movableHoldTensionCapRatio ?? 1,
      movableHoldTensionCapApplied:
        !!fishRetrieveResult?.movableHoldTensionCapApplied,
      fishCanMoveTowardPlayer:
        fishRetrieveResult?.fishCanMoveTowardPlayer !== false,
      playerDemandForceKg: rodPullResult.forceKg,
      fishRetrieveHoldRatio: fishRetrieveResult?.holdRatio,
      actualFishPullSpeedMps: fishRetrieveResult?.towardPlayerSpeedMps,
      targetFishPullSpeedMps: fishRetrieveResult?.towardPlayerSpeedMps,
      fishOppositionKg: fishRetrieveResult?.fishOppositionKg,
      fishTensionKg: fishRetrieveResult?.fishTensionKg ?? forceData.fishTensionKg,
      fishPassiveKg: fishRetrieveResult?.fishPassiveKg ?? forceData.fishPassiveKg,
      fishActiveKg: fishRetrieveResult?.fishActiveKg ?? forceData.fishActiveKg,
      fishWonForceKg:
        fishRetrieveResult?.fishWonForceKg ?? forceData.fishWonForceKg,
      fishWonRadialForceKg:
        fishRetrieveResult?.fishWonRadialForceKg ??
        forceData.fishWonRadialForceKg,
      radialAwayRatio:
        fishRetrieveResult?.radialAwayRatio ??
        forceData.radialAwayRatio ??
        fishRetrieveResult?.yAwayRatio ??
        forceData.yAwayRatio,
      fishWonYForceKg:
        fishRetrieveResult?.fishWonYForceKg ?? forceData.fishWonYForceKg,
      yAwayRatio:
        fishRetrieveResult?.yAwayRatio ?? forceData.yAwayRatio,
      dragBlockedForceKg:
        fishRetrieveResult?.dragBlockedForceKg ?? forceData.dragBlockedForceKg,
      excessYForceKg:
        fishRetrieveResult?.excessYForceKg ?? forceData.excessYForceKg,
      yEscapeForceKg:
        fishRetrieveResult?.yEscapeForceKg ?? forceData.yEscapeForceKg,
      radialEscapeForceKg:
        fishRetrieveResult?.radialEscapeForceKg ??
        forceData.radialEscapeForceKg,
      finalRadialSpeedPxPerSec:
        fishRetrieveResult?.finalRadialSpeedPxPerSec ??
        forceData.finalRadialSpeedPxPerSec,
      radialSpeedPxPerSec:
        fishRetrieveResult?.radialSpeedPxPerSec ??
        forceData.radialSpeedPxPerSec,
      outwardRadialSpeedPxPerSec:
        fishRetrieveResult?.outwardRadialSpeedPxPerSec ??
        forceData.outwardRadialSpeedPxPerSec,
      tangentSpeedPxPerSec:
        fishRetrieveResult?.tangentSpeedPxPerSec ??
        forceData.tangentSpeedPxPerSec,
      fishMoveIntentRadial: forceData.fishMoveIntentRadial,
      fishMoveIntentLateral: forceData.fishMoveIntentLateral,
      fishMoveDirX: forceData.fishMoveDirX,
      fishMoveDirY: forceData.fishMoveDirY,
      awayDirX: forceData.awayDirX,
      awayDirY: forceData.awayDirY,
      fishRuntimeBehaviorStates:
        forceData.fishPhysicsConfig?.behaviorProfile?.behaviors ||
        forceData.fishPhysicsConfig?.behaviors ||
        {},
      fishRuntimeForceProfile:
        forceData.fishPhysicsConfig?.forceProfile || {},
      fishRuntimeMovementProfile:
        forceData.fishPhysicsConfig?.movementProfile || {},
      enduranceMovementDebuffEnabled:
        forceData.enduranceMovementDebuffEnabled === true,
      enduranceMovementDebuffActive:
        forceData.enduranceMovementDebuffActive === true,
      enduranceMovementDebuffProgress:
        forceData.enduranceMovementDebuffProgress ?? 0,
      enduranceMovementDebuffPower:
        forceData.enduranceMovementDebuffPower ?? 0,
      enduranceLastSelectedBehavior:
        forceData.enduranceLastSelectedBehavior || "unknown",
      enduranceLastSampledRadialIntent:
        forceData.enduranceLastSampledRadialIntent ?? null,
      enduranceLastSampledLateralIntent:
        forceData.enduranceLastSampledLateralIntent ?? null,
      enduranceTargetRadialMin:
        forceData.enduranceTargetRadialMin ?? null,
      enduranceTargetRadialMax:
        forceData.enduranceTargetRadialMax ?? null,
      enduranceBaseRadialMin:
        forceData.enduranceBaseRadialMin ?? null,
      enduranceBaseRadialMax:
        forceData.enduranceBaseRadialMax ?? null,
      enduranceEffectiveRadialMin:
        forceData.enduranceEffectiveRadialMin ?? null,
      enduranceEffectiveRadialMax:
        forceData.enduranceEffectiveRadialMax ?? null,
      enduranceDashWeightMultiplier:
        forceData.enduranceDashWeightMultiplier ?? 1,
      enduranceLastDashWeightMultiplier:
        forceData.enduranceLastDashWeightMultiplier ?? 1,
      enduranceSwimWeightMultiplier:
        forceData.enduranceSwimWeightMultiplier ?? 1,
      enduranceIdleWeightMultiplier:
        forceData.enduranceIdleWeightMultiplier ?? 1,
      enduranceRestWeightMultiplier:
        forceData.enduranceRestWeightMultiplier ?? 1,
      fishRetrieveUsefulPullForceKg: fishRetrieveResult?.effectiveRodHoldKg,
      fishRetrieveSpeedMps: fishRetrieveResult?.speedMps,
      modelFightSpeedMps: fishRetrieveResult?.speedMps,
      simpleFightSpeedMps: fishRetrieveResult?.speedMps,
      totalAppliedPullMoveMeters,
      totalAppliedPullSpeedMps,
      fishOwnTowardSpeedMps: forceData.fishOwnTowardSpeedMps ?? 0,
      combinedTowardSpeedMps:
        (Number(forceData.fishOwnTowardSpeedMps) || 0) +
        totalAppliedPullSpeedMps,
      playerPullMovementMode,
      fishMovementMode,
      fishPressureRelation: fishPressureSummary.relation,
      fishPressureRelationLabel: fishPressureSummary.relationLabel,
      fishPressureDirection: fishPressureSummary.direction,
      fishPressureDirectionLabel: fishPressureSummary.directionLabel,
      fishPressureStrengthKg: fishPressureSummary.strengthKg,
      fishPressureSpeedPxPerSec: fishPressureSummary.speedPxPerSec,
      fishPressureDirX: fishPressureSummary.dirX,
      fishPressureDirY: fishPressureSummary.dirY,
      fishMovementRelation: fishMovementSummary.relation,
      fishMovementRelationLabel: fishMovementSummary.relationLabel,
      fishMovementDirection: fishMovementSummary.direction,
      fishMovementDirectionLabel: fishMovementSummary.directionLabel,
      fishMovementStrengthKg: fishMovementSummary.strengthKg,
      fishMovementActualSpeedPxPerSec: fishMovementSummary.actualSpeedPxPerSec,
      fishMovementActualDirX: fishMovementSummary.dirX,
      fishMovementActualDirY: fishMovementSummary.dirY,
      fishActualBlockedReason:
        forceData.fightMovementFrame?.fishActualBlockedReason || "none",
      fishMoveSectorClamped:
        !!forceData.fightMovementFrame?.poleFightSectorClamped,
      fishMoveSectorActive:
        !!forceData.fightMovementFrame?.poleFightSectorActive,
      fishMoveSectorSide:
        forceData.fightMovementFrame?.poleFightSectorSide || "none",
      fishMoveSectorAngleDeg:
        forceData.fightMovementFrame?.poleFightSectorAngleDeg ?? 0,
      fishMoveSectorBoundaryType:
        forceData.fightMovementFrame?.poleFightSectorBoundaryType || "none",
      fishMoveSectorAllowedMoveRatio:
        forceData.fightMovementFrame?.poleFightSectorAllowedMoveRatio ?? 1,
      fishMoveSectorEnforceRadius:
        forceData.fightMovementFrame?.poleFightSectorEnforceRadius !== false,
      // Deprecated alias: this is player pull movement, not fish movement.
      movementMode: playerPullMovementMode,
      towardPlayerSpeedMps: fishRetrieveResult?.towardPlayerSpeedMps,
      awaySpeedMps: fishRetrieveResult?.awaySpeedMps,
      netForceKg: fishRetrieveResult?.netForceKg,
      fishRetrieveMovementControlRatio:
        fishRetrieveResult?.movementControlRatio,
      fishRetrieveLineTensionKg: fishRetrieveResult?.totalTensionKg,
      fishRetrieveBalanceState: fishRetrieveResult?.balanceState,
      fishRetrieveMovementBlocked: fishRetrieveResult?.movementBlocked,
      fishRetrieveTensionBlocked: fishRetrieveResult?.tensionBlocked,
      fishRetrieveDesiredMoveMeters: fishRetrieveResult?.desiredMoveMeters,
      fishRetrieveAppliedMoveMeters: fishRetrieveResult?.appliedMoveMeters,
      landingLiftEnabled: !!landingLiftResult?.enabled,
      landingLiftInZone: !!landingLiftResult?.inLandingZone,
      landingLiftPlayerHoldActive: !!landingLiftResult?.playerHoldActive,
      landingLiftActive: !!landingLiftResult?.active,
      landingLiftHoldKg: landingLiftResult?.liftHoldKg ?? 0,
      landingLiftMaxKg: landingLiftResult?.liftMaxKg ?? 0,
      landingLiftWaterTensionKg:
        landingLiftResult?.waterFightTensionKg ?? 0,
      landingLiftFishTensionKg: landingLiftResult?.fishTensionKg ?? 0,
      landingLiftWeightTensionRatio:
        landingLiftResult?.liftWeightTensionRatio ?? 0,
      landingLiftFastTimeSeconds:
        landingLiftResult?.fastLiftTimeSeconds ?? 0,
      landingLiftReleaseTimeSeconds:
        landingLiftResult?.releaseTimeSeconds ?? 0,
      landingLiftProgressRatio: landingLiftResult?.progressRatio ?? 0,
      landingLiftTackleLoadProgressRatio:
        landingLiftResult?.tackleLoadProgressRatio ?? 0,
      landingLiftSlowdownRatio: landingLiftResult?.slowdownRatio ?? 0,
      landingLiftSpeedRatio: landingLiftResult?.speedRatio ?? 0,
      landingLiftGainKgPerSecond:
        landingLiftResult?.gainKgPerSecond ?? 0,
      landingReady: !!landingFrame?.readiness?.ready,
      landingReadyReason: landingFrame?.readiness?.reason || "not_checked",
      landingSupportedTensionKg:
        landingFrame?.readiness?.supportedTensionKg ?? 0,
      landingRawTensionKg: landingFrame?.readiness?.rawTensionKg ?? 0,
      landingVisibleTensionKg:
        landingFrame?.readiness?.visibleTensionKg ?? 0,
      landingDragSlipping: !!landingFrame?.readiness?.dragSlipping,
      rodPullDistanceMeters: rodPullDisplay.distanceMeters,
      rodPullMaxDistanceMeters: rodPullDisplay.maxDistanceMeters,
      rodPullAvailableDistanceMeters: rodPullDisplay.availableDistanceMeters,
      rodPullDeltaMeters: rodPullResult.deltaMeters,
      rodPullMoveMeters: appliedRodPullMoveMeters,
      rodPullAppliedSpeedMps,
      playerPullMotionEnabled: !!playerPullMotion.enabled,
      playerPullMotionInertiaSeconds: playerPullMotion.inertiaSeconds,
      playerPullDesiredMoveX: playerPullMotion.desiredMoveX,
      playerPullActualMoveX: playerPullMotion.actualMoveX,
      playerPullDesiredMoveY: playerPullMotion.desiredMoveY,
      playerPullActualMoveY: playerPullMotion.actualMoveY,
      playerPullVelocityX: playerPullMotion.velocityX,
      playerPullVelocityY: playerPullMotion.velocityY,
      rodPullMovementBlockReason: rodPullMovementBlockReason || "none",
      rodPullCanMoveFish: rodPullResult.canMoveFish,
      rodPullBlockedReason: rodPullDisplay.blockedReason,
      rodPullDragSlipping: rodPullDisplay.dragSlipping,
      rodPullReleaseRecovering: rodPullDisplay.releaseRecovering,
      rodPullReleaseRecoveryRatio: rodPullDisplay.releaseRecoveryRatio,
      rodPullChargeSpeedMultiplier: rodPullDisplay.chargeSpeedMultiplier,
      rodPullChargePerSecond: rodPullDisplay.chargePerSecond,
      activeRodPullForceKg: rodPullResult.forceKg,
      rodPullPlayerPressureEfficiency:
        rodPullResult.playerPressureEfficiency ?? 1,
      rodPullPlayerPressureFatigueEnabled:
        rodPullResult.playerPressureFatigueEnabled === true,
      rodControlActive: !!rodControlResult?.active,
      rodControlCanApply: !!rodControlResult?.canApply,
      rodControlDirectionX: rodControlResult?.directionX ?? 0,
      rodControlInputDirectionX: rodControlResult?.inputDirectionX ?? 0,
      rodControlInputRatio: rodControlResult?.inputRatio ?? 0,
      rodControlRequestedForceRatio:
        rodControlResult?.requestedForceRatio ?? 0,
      rodControlLoadReserveKg: rodControlResult?.loadReserveKg ?? 0,
      rodControlLoadReserveRatio: rodControlResult?.loadReserveRatio ?? 0,
      rodControlTensionCeilingMultiplier:
        rodControlResult?.tensionCeilingMultiplier ?? 1,
      rodControlTensionCeilingKg:
        rodControlResult?.tensionCeilingKg ?? rodPullResult.rodLimitKg,
      rodControlPlayerForceBudgetEnabled:
        !!rodControlResult?.playerForceBudgetEnabled,
      rodControlPlayerForceBudgetKg:
        rodControlResult?.playerForceControlBudgetKg ?? 0,
      rodControlPlayerForceBudgetShare:
        rodControlResult?.playerForceControlShare ?? 0,
      rodControlForceLimitKg: rodControlResult?.forceLimitKg ?? 0,
      rodControlEffectiveForceLimitKg:
        rodControlResult?.effectiveForceLimitKg ?? 0,
      rodControlDragLimited: !!rodControlResult?.dragLimited,
      rodControlDragReserveKg: rodControlResult?.dragReserveKg ?? 0,
      rodControlCanSlipDrag: !!rodControlResult?.canSlipDrag,
      rodControlDeliveredForceRatio:
        rodControlResult?.deliveredForceRatio ?? 0,
      rodControlActualMovementRatio:
        rodControlResult?.actualMovementRatio ?? 0,
      rodControlTargetMode: rodControlResult?.targetMode || "input_direction",
      rodControlTargetRodX: rodControlResult?.targetRodX ?? null,
      rodControlFishOffsetX: rodControlResult?.fishOffsetX ?? 0,
      rodControlLineAngleDeg: rodControlResult?.lineAngleDeg ?? 0,
      rodControlAngleRatio: rodControlResult?.angleRatio ?? 0,
      rodControlDirectionFactor: rodControlResult?.directionFactor ?? 0,
      rodControlAligned: !!rodControlResult?.aligned,
      rodControlCentered: !!rodControlResult?.centered,
      rodControlStartedCentered:
        !!rodControlResult?.controlStartedCentered,
      rodControlCenterStartActive:
        !!rodControlResult?.centerStartActive,
      rodControlMaxPullSpeedMps:
        rodControlResult?.maxPullSpeedMetersPerSecond ?? 0,
      rodControlPhase:
        rodControlResult?.phase || "inactive",
      rodControlVisualControlRatio:
        rodControlResult?.visualControlRatio ?? 0,
      rodControlRawForceKg:
        rodControlResult?.rawForceKg ?? rodControlResult?.forceKg ?? 0,
      rodControlForceKg: rodControlResult?.forceKg ?? 0,
      rodControlPlayerPressureEfficiency:
        rodControlResult?.playerPressureEfficiency ?? 1,
      rodControlPlayerPressureFatigueEnabled:
        rodControlResult?.playerPressureFatigueEnabled === true,
      rodControlPlayerTensionKg: rodControlResult?.playerTensionKg ?? 0,
      rodControlTensionMultiplier: rodControlResult?.tensionMultiplier ?? 0,
      rodControlTensionMode:
        rodControlResult?.tensionMode || "side",
      rodControlFishControlAxisAlignment:
        rodControlResult?.fishControlAxisAlignment ?? 0,
      rodControlFishControlAxisVelocity:
        rodControlResult?.fishControlAxisVelocityPxPerSecond ?? 0,
      rodControlFishAutonomousSpeed:
        rodControlResult?.fishAutonomousSpeedPxPerSecond ?? 0,
      rodControlAxisX: rodControlResult?.controlAxisX ?? 0,
      rodControlAxisY: rodControlResult?.controlAxisY ?? 0,
      rodControlDesiredMoveMeters: rodControlResult?.desiredMoveMeters ?? 0,
      rodControlDesiredMovePx: rodControlResult?.desiredMovePx ?? 0,
      rodControlAllowedMoveMeters:
        rodControlResult?.allowedMoveMeters ?? 0,
      rodControlMoveMeters: appliedRodControlMoveMeters,
      rodControlMovePx: appliedRodControlMovePx,
      rodControlAppliedSpeedMps,
      rodControlMovementMode:
        rodControlResult?.movementMode || "none",
      rodControlLineLengthLocked:
        !!rodControlResult?.lineLengthLocked,
      rodControlRadialConstraintActive:
        !!rodControlResult?.radialConstraintActive,
      rodControlMovementBlockReason:
        rodControlMovementBlockReason ||
        rodControlResult?.blockedReason ||
        "none",
      rodControlBlockedReason: rodControlResult?.blockedReason || "none",
      rodStrokeCapacityMeters: rodPullDisplay.rodStrokeCapacityMeters,
      rodStrokeWonMeters: rodPullDisplay.rodStrokeWonMeters,
      rodStrokeUsedMeters: rodPullDisplay.rodStrokeUsedMeters,
      rodStrokeUnrecoveredMeters: rodPullDisplay.rodStrokeUnrecoveredMeters,
      rodStrokeRatio: rodPullDisplay.rodStrokeRatio,
      strokeRecoveredMeters: rodPullDisplay.strokeRecoveredMeters ?? 0,
      strokeDistancePreviousMeters:
        rodPullDisplay.strokeDistancePreviousMeters ?? 0,
      strokeDistanceCurrentMeters:
        rodPullDisplay.strokeDistanceCurrentMeters ?? 0,
      strokeDistanceDeltaMeters:
        rodPullDisplay.strokeDistanceDeltaMeters ?? 0,
      strokeDistanceGainedMeters:
        rodPullDisplay.strokeDistanceGainedMeters ?? 0,
      strokeDistanceLostMeters:
        rodPullDisplay.strokeDistanceLostMeters ?? 0,
      strokeDistanceReason:
        rodPullDisplay.strokeDistanceReason || "none",
      prePullStrokeDistanceLostMeters:
        prePullStrokeDistanceFrame?.lostMeters ?? 0,
      playerFrameStrokeDistanceGainedMeters:
        strokeDistanceFrame?.gainedMeters ?? 0,
      playerFrameStrokeDistanceLostMeters:
        strokeDistanceFrame?.lostMeters ?? 0,
      playerFrameStrokeDistanceReason:
        strokeDistanceFrame?.reason || "none",
      strokeResetReason: rodPullDisplay.strokeResetReason || "none",
      availableExtraForceKg: rodPullDisplay.availableExtraForceKg,
      reelRecoveringLineCredit: recoveredMeters > 0,
      autoRecoverActive: !!autoRecovery?.active,
      autoRecoverBlockedReason: autoRecovery?.blockedReason || "not_checked",
      autoRecoverSpeedMps: autoRecovery?.recoverSpeedMetersPerSec ?? 0,
      autoRecoverBaseRetrieveSpeedMps:
        autoRecovery?.retrieveSpeedMetersPerSec ?? 0,
      autoRecoverReelMaxLoadKg: autoRecovery?.reelMaxLoadKg ?? 0,
      autoRecoverReelEfficiency: autoRecovery?.reelEfficiency ?? 0,
      autoRecoverReelLoadRatio: autoRecovery?.reelLoadRatio ?? 0,
      autoRecoverDesiredMeters: autoRecovery?.desiredRecoverMeters ?? 0,
      autoRecoverMaxByLineMeters: autoRecovery?.maxRecoverByLineMeters ?? 0,
      autoRecoveredMeters: autoRecoveredMeters ?? 0,
      holdRecoveredMeters: holdRecoveredMeters ?? 0,
      reelHoldConfigEnabled: holdReelRecover?.enabled === true,
      reelHoldHasReel: holdReelRecover?.hasReel === true,
      reelHoldPlayerHoldActive:
        holdReelRecover?.playerHoldActive === true,
      reelHoldRequiredStrokeRatio:
        holdReelRecover?.requiredStrokeRatio ?? 1,
      reelHoldStrokeFull: holdReelRecover?.strokeFull === true,
      reelHoldRawTensionKg: holdReelRecover?.rawTensionKg ?? 0,
      reelHoldDragLimitKg: holdReelRecover?.dragLimitKg ?? 0,
      reelHoldDragLocked: holdReelRecover?.dragLocked === true,
      reelHoldShouldSlipDrag: holdReelRecover?.shouldSlipDrag === true,
      reelHoldTensionBelowDragLimit:
        holdReelRecover?.tensionBelowDragLimit === true,
      reelHoldTensionBelowMaxLoad:
        holdReelRecover?.tensionBelowMaxLoad === true,
      reelHoldDragCanHold: holdReelRecover?.dragCanHold === true,
      reelHoldRetrieveSpeedMps:
        holdReelRecover?.retrieveSpeedMetersPerSecond ?? 0,
      holdReelRecoverEligible: !!holdReelRecover?.eligible,
      holdReelRecoverActive: !!holdReelRecover?.active,
      holdReelRecoverEngaged: !!holdReelRecover?.engaged,
      holdReelRecoveringLine: !!holdReelRecover?.recoveringLine,
      holdReelRecoverHasRecoverableLine:
        !!holdReelRecover?.hasRecoverableLine,
      holdReelRecoverTimerMs: holdReelRecover?.timerMs ?? 0,
      holdReelRecoverDelayMs: holdReelRecover?.delayMs ?? 0,
      holdReelRecoverLoadReserveRatio:
        holdReelRecover?.reelLoadReserveRatio ?? 0,
      holdReelRecoverReelMaxLoadKg: holdReelRecover?.reelMaxLoadKg ?? 0,
      holdReelRecoverSpeedMps:
        holdReelRecover?.recoverSpeedMetersPerSecond ?? 0,
      holdReelRecoverMoveMeters: appliedReelHoldMoveMeters,
      reelHoldMoveMeters: appliedReelHoldMoveMeters,
      reelHoldAppliedSpeedMps,
      reelHoldMovementBlockReason: reelHoldMovementBlockReason || "none",
      hardTensionBlocked: !!hardTensionBlocked,
      holdReelRecoverBlockedReason:
        holdReelRecover?.blockedReason || "not_checked",
      holdReelRecoverLineBlockedReason:
        holdReelRecover?.lineRecoveryBlockedReason || "not_checked",
      holdReelRecoverSource:
        holdReelRecover?.source || "none",
      tensionMode: tensionResult.mode,
      rawTensionKg: tensionResult.rawTensionKg,
      fishTensionKg: tensionResult.fishTensionKg,
      playerHoldTensionKg: tensionResult.playerHoldTensionKg,
      totalTensionKg: tensionResult.totalTensionKg,
      rodStressRatio: tensionResult.rodStressRatio,
      lineStressRatio: tensionResult.lineStressRatio,
      hookStressRatio: tensionResult.hookStressRatio,
      rodMaxLoadKg: stressSystem.getEffectiveRodMaxLoadKg?.() || 0,
      lineMaxLoadKg: stressSystem.getEffectiveLineSystemMaxLoadKg?.() || 0,
      hookMaxLoadKg: stressSystem.getEffectiveHookMaxLoadKg?.() || 0,
      playerForceKg: forceData.player.forceKg,
      activeEffectivePullKg: fishRetrieveResult?.effectiveRodHoldKg ?? 0,
      activeNetPullKg: Math.max(0, Number(fishRetrieveResult?.netForceKg) || 0),
      effectivePullKg: fishRetrieveResult?.usefulPullForceKg ?? 0,
      netPullKg: fishRetrieveResult?.netForceKg ?? 0,
      dragLimitKg: dragContext.effectiveDragLimitKg,
      rawDragLimitKg: forceData.player.dragLimitKg,
      dragLocked: dragContext.dragLocked,
      rodPullCanWinDistance: rodPullResult.canMoveFish,
      shouldSlipDrag: !!fishRetrieveResult?.shouldSlipDrag,
      fishConditionPhase: fishCondition?.phase || "n/a",
      currentStamina: fishCondition?.currentStamina ?? 0,
      currentExhaustion: fishCondition?.currentExhaustion ?? 0,
      fishConditionMaxStamina: fishCondition?.maxStamina ?? 0,
      fishConditionMaxEndurance:
        fishCondition?.maxEndurance ?? fishCondition?.maxPoints ?? 0,
      staminaFrame,
      staminaFrameSource: staminaFrame?.source || "none",
      staminaPhase: staminaFrame?.phase || "stamina",
      framePhase: staminaFrame?.framePhase || staminaFrame?.phase || "stamina",
      frameCurrentExhaustion:
        staminaFrame?.frameCurrentExhaustion ?? 0,
      frameMaxEndurance:
        staminaFrame?.frameMaxEndurance ?? 0,
      frameEnduranceProgress:
        staminaFrame?.frameEnduranceProgress ?? 0,
      staminaPressureRatio: staminaFrame?.staminaPressureRatio ?? 0,
      staminaModelMode: staminaFrame?.staminaModelMode || "legacy",
      staminaMode: staminaFrame?.staminaMode || "idle",
      staminaTransitionReason:
        staminaFrame?.staminaTransitionReason || "none",
      staminaRecoveryFromExhaustionActive:
        staminaFrame?.staminaRecoveryFromExhaustionActive === true,
      rawStaminaInputActive:
        staminaFrame?.rawStaminaInputActive === true,
      staminaNoInputElapsedMs:
        staminaFrame?.staminaNoInputElapsedMs ?? 0,
      staminaNoInputTimeoutMs:
        staminaFrame?.staminaNoInputTimeoutMs ?? 0,
      staminaNoInputRecoveryReady:
        staminaFrame?.staminaNoInputRecoveryReady === true,
      staminaRecoveryTrigger:
        staminaFrame?.staminaRecoveryTrigger || "none",
      staminaPhaseReturnThreshold:
        staminaFrame?.staminaPhaseReturnThreshold ?? 0,
      staminaBefore: staminaFrame?.staminaBefore ?? 0,
      staminaAfter: staminaFrame?.staminaAfter ?? 0,
      playerStaminaPressureKg:
        staminaFrame?.playerStaminaPressureKg ??
        staminaFrame?.usedPlayerPressureKg ??
        0,
      fishStaminaResistanceKg:
        staminaFrame?.fishStaminaResistanceKg ?? 0,
      playerAdvantageRatio:
        staminaFrame?.playerAdvantageRatio ??
        staminaFrame?.activeDrainRatio ??
        0,
      clampedAdvantageRatio:
        staminaFrame?.clampedAdvantageRatio ?? 0,
      staminaDrainMultiplier:
        staminaFrame?.staminaDrainMultiplier ?? 0,
      lateralEdgeRatio:
        staminaFrame?.lateralEdgeRatio ?? 0,
      holdStaminaDrainMultiplier:
        staminaFrame?.holdStaminaDrainMultiplier ?? 1,
      controlStaminaDrainMultiplier:
        staminaFrame?.controlStaminaDrainMultiplier ??
        staminaFrame?.lateralStaminaWeight ??
        0,
      controlCenteringFactor:
        staminaFrame?.controlCenteringFactor ?? 1,
      controlDirectionState:
        staminaFrame?.controlDirectionState || "unknown",
      rodHoldStaminaPressureKg:
        staminaFrame?.rodHoldStaminaPressureKg ?? 0,
      reelHoldStaminaPressureKg:
        staminaFrame?.reelHoldStaminaPressureKg ?? 0,
      controlStaminaPressureKg:
        staminaFrame?.controlStaminaPressureKg ?? 0,
      staminaRegenPerSecond:
        staminaFrame?.passiveStaminaRegenPerSecond ?? 0,
      fatigueRegenMultiplier:
        staminaFrame?.fatigueRegenMultiplier ?? 1,
      staminaPlayerFatigueProgress:
        staminaFrame?.playerFatigueProgress ??
        playerPressureFatigue?.fatigueProgress ??
        0,
      staminaPlayerFatigueFull:
        staminaFrame?.playerFatigueFull === true,
      angleStressRatio: staminaFrame?.angleStressRatio ?? 0,
      staminaAppliedRodHoldKg: staminaFrame?.appliedRodHoldKg ?? 0,
      staminaAppliedReelHoldKg: staminaFrame?.appliedReelHoldKg ?? 0,
      staminaAppliedControlKg: staminaFrame?.appliedControlKg ?? 0,
      staminaPhysicalAppliedRodHoldKg:
        staminaFrame?.physicalAppliedRodHoldKg ??
        staminaFrame?.appliedRodHoldKg ??
        0,
      staminaPhysicalAppliedControlKg:
        staminaFrame?.physicalAppliedControlKg ??
        staminaFrame?.appliedControlKg ??
        0,
      staminaControlAppliedRodHoldKg:
        staminaFrame?.controlAppliedRodHoldKg ??
        staminaFrame?.appliedRodHoldKg ??
        0,
      staminaControlAppliedControlKg:
        staminaFrame?.controlAppliedControlKg ??
        staminaFrame?.appliedControlKg ??
        0,
      staminaPlayerPressureControlExhausted:
        staminaFrame?.playerPressureControlExhausted === true,
      staminaBudgetedRodHoldKg: staminaFrame?.budgetedRodHoldKg ?? 0,
      staminaBudgetedControlKg: staminaFrame?.budgetedControlKg ?? 0,
      staminaUsedPlayerPressureKg:
        staminaFrame?.usedPlayerPressureKg ?? 0,
      staminaRawAppliedPlayerPressureKg:
        staminaFrame?.rawAppliedPlayerPressureKg ?? 0,
      staminaAvailablePlayerPressureKg:
        staminaFrame?.availablePlayerPressureKg ?? 0,
      staminaActiveDrainRatio: staminaFrame?.activeDrainRatio ?? 0,
      staminaActiveDrainPerSecond:
        staminaFrame?.activeDrainPerSecond ?? 0,
      staminaActiveDrain:
        staminaFrame?.activeStaminaDrain ?? 0,
      staminaPassiveRegenPerSecond:
        staminaFrame?.passiveStaminaRegenPerSecond ?? 0,
      staminaPassiveRegen:
        staminaFrame?.passiveStaminaRegen ?? 0,
      staminaAngleRegenMultiplier:
        staminaFrame?.angleRegenMultiplier ?? 1,
      staminaRegenDelayActive:
        staminaFrame?.regenDelayActive === true,
      staminaPressureActive:
        staminaFrame?.staminaPressureActive === true,
      staminaPressureThresholdKg:
        staminaFrame?.staminaPressureThresholdKg ?? 0,
      staminaLineAngleDeg: staminaFrame?.lineAngleDeg ?? 0,
      staminaAngleRecoveryRatio:
        staminaFrame?.angleRecoveryRatio ?? 0,
      staminaAngleRegenPerSecond:
        staminaFrame?.angleRegenPerSecond ?? 0,
      staminaAngleRegen:
        staminaFrame?.angleStaminaRegen ?? 0,
      staminaNetPerSecond:
        staminaFrame?.netStaminaPerSecond ?? 0,
      staminaNetChange:
        staminaFrame?.netStaminaChange ?? 0,
      staminaWeakestTackleLimitKg:
        staminaFrame?.weakestTackleLimitKg ?? 0,
      staminaWeakestTackleLimitComponent:
        staminaFrame?.weakestTackleLimitComponent || "none",
      staminaLateralWeight:
        staminaFrame?.lateralStaminaWeight ?? 0,
      staminaAllowRegenWhilePulling:
        staminaFrame?.allowStaminaRegenWhilePulling === true,
      staminaRegenBlockedByPull:
        staminaFrame?.regenBlockedByPull === true,
      staminaBudgetOverflowWarning:
        staminaFrame?.budgetOverflowWarning === true,
      staminaPassiveDrainEnabled:
        staminaFrame?.passiveDrainEnabled === true,
      staminaPassiveDrainRatio:
        staminaFrame?.passiveDrainRatio ?? 0,
      staminaPassiveDrainPerSecond:
        staminaFrame?.passiveDrainPerSecond ?? 0,
      staminaPassiveDrain:
        staminaFrame?.passiveStaminaDrain ?? 0,
      staminaFishRadialEffortKg:
        staminaFrame?.fishWonRadialForceKg ?? 0,
      staminaDragBlockedKg:
        staminaFrame?.dragBlockedForceKg ?? 0,
      staminaResistanceRatio:
        staminaFrame?.passiveResistanceRatio ?? 0,
      staminaPassiveFishEffortRatio:
        staminaFrame?.passiveFishEffortRatio ?? 0,
      staminaLineTautRatio:
        staminaFrame?.lineTautRatio ?? 0,
      staminaLineTaut:
        staminaFrame?.lineTaut === true,
      staminaBehaviorMultiplier:
        staminaFrame?.passiveBehaviorMultiplier ?? 0,
      staminaBehaviorName:
        staminaFrame?.fishBehaviorName || "unknown",
      staminaShouldSlipDrag:
        staminaFrame?.shouldSlipDrag === true,
      staminaHardLineLimit:
        staminaFrame?.hardLineLimit === true,
      staminaTotalDrainPerSecond:
        staminaFrame?.totalStaminaDrainPerSecond ?? 0,
      staminaTotalDrain:
        staminaFrame?.totalStaminaDrain ?? 0,
      enduranceActiveDrainRatio:
        staminaFrame?.activeEnduranceDrainRatio ?? 0,
      enduranceActiveDrainPerSecond:
        staminaFrame?.activeEnduranceDrainPerSecond ?? 0,
      enduranceActiveDrain:
        staminaFrame?.activeEnduranceDrain ?? 0,
      endurancePassiveDrainRatio:
        staminaFrame?.passiveEnduranceDrainRatio ?? 0,
      endurancePassiveDrainPerSecond:
        staminaFrame?.passiveEnduranceDrainPerSecond ?? 0,
      endurancePassiveDrain:
        staminaFrame?.passiveEnduranceDrain ?? 0,
      enduranceTotalDrainRatio:
        staminaFrame?.enduranceTotalDrainRatio ?? 0,
      enduranceTotalDrainPerSecond:
        staminaFrame?.totalEnduranceDrainPerSecond ?? 0,
      enduranceTotalDrain:
        staminaFrame?.totalEnduranceDrain ?? 0,
      enduranceFishEffortRatio:
        staminaFrame?.enduranceFishEffortRatio ?? 0,
      enduranceResistanceRatio:
        staminaFrame?.enduranceResistanceRatio ?? 0,
      enduranceLineTautRatio:
        staminaFrame?.enduranceLineTautRatio ?? 0,
      enduranceBehaviorName:
        staminaFrame?.enduranceBehaviorName || "unknown",
      enduranceBehaviorMultiplier:
        staminaFrame?.enduranceBehaviorMultiplier ?? 0,
      playerForceY: Math.abs(rodPullResult.forceKg),
      playerForceX: Math.abs(rodControlResult?.forceKg || 0),
      fishForceY: Math.abs(forceData.totalFishForceKg * (forceData.targetVelocity.y < 0 ? -1 : 1)),
      fishForceX: Math.abs(forceData.totalFishForceKg * (forceData.targetVelocity.x ? Math.sign(forceData.targetVelocity.x) : 0)),
      playerMaxPowerY: stressSystem.getEffectiveMaxTackleLoadKg?.() || 0,
      playerMaxPowerX:
        (stressSystem.getEffectiveMaxTackleLoadKg?.() || 0) *
        (
          this.#physicsConfig?.getPlayerSteeringMultiplier?.() ??
          1.5
        ),
      lineConstrained: constraintResult.constrained,
      fightMode: isPullMode ? "pull" : isRecoverMode ? "recover" : "free",
      retrieveActive: isRecoverMode,
      playerPulling: forceData.player.isPulling,
      currentTensionKg: stressSystem.getTensionKg(),
      fishForceKg: forceData.totalFishForceKg,
      calculatedTensionKg: tensionResult.tensionKg,
      simpleFightSpeedPxPerSec:
        (Number(fishRetrieveResult?.speedMps) || 0) *
        (this.#physicsConfig?.getPixelsPerMeter?.() || 50),
      fightMovementTargetSpeedPxPerSec:
        forceData.fightMovementFrame?.targetSpeedPxPerSec ??
        Math.hypot(forceData.targetVelocity.x || 0, forceData.targetVelocity.y || 0),
      fightMovementActualSpeedPxPerSec:
        forceData.fightMovementFrame?.actualSpeedPxPerSec ?? 0,
      fightMovementDampingApplied:
        !!forceData.fightMovementFrame?.dampingApplied,
      fightMovementFallbackDampedUpdate:
        !!forceData.fightMovementFrame?.fallbackDampedUpdate,
      fishMoveRawVelocityX:
        forceData.fightMovementFrame?.fishMoveRawVelocityX ?? 0,
      fishMoveRawVelocityY:
        forceData.fightMovementFrame?.fishMoveRawVelocityY ?? 0,
      fishMoveAllowedVelocityX:
        forceData.fightMovementFrame?.fishMoveAllowedVelocityX ?? 0,
      fishMoveAllowedVelocityY:
        forceData.fightMovementFrame?.fishMoveAllowedVelocityY ?? 0,
      fishMoveRadialX:
        forceData.fightMovementFrame?.fishMoveRadialX ?? 0,
      fishMoveRadialY:
        forceData.fightMovementFrame?.fishMoveRadialY ?? 0,
      fishMoveRadialSpeedPxPerSec:
        forceData.fightMovementFrame?.fishMoveRadialSpeedPxPerSec ?? 0,
      fishMoveBlockedRadialSpeedPxPerSec:
        forceData.fightMovementFrame?.fishMoveBlockedRadialSpeedPxPerSec ?? 0,
      fishMoveAllowedTangentSpeedPxPerSec:
        forceData.fightMovementFrame?.fishMoveAllowedTangentSpeedPxPerSec ?? 0,
      fishMoveConstraintActive:
        !!forceData.fightMovementFrame?.fishMoveConstraintActive,
      fishMoveConstraintReason:
        forceData.fightMovementFrame?.fishMoveConstraintReason || "none",
      fishMoveProjectionReason:
        forceData.fightMovementFrame?.fishMoveProjectionReason || "free",
      fightMovementLineConstraintReason:
        forceData.fightMovementFrame?.lineConstraintReason || "none",
      fightMovementRadialConstraintActive:
        !!forceData.fightMovementFrame?.radialConstraintActive,
      fightMovementDragCanPayout:
        !!forceData.fightMovementFrame?.dragCanPayout,
      fightMovementDragPayoutBlocked:
        !!forceData.fightMovementFrame?.dragPayoutBlocked,
    };
  }

  #lineHasReserve(lineState) {
    if (typeof lineState?.canReleaseLine === "boolean") return lineState.canReleaseLine;
    return (Number(lineState?.remainingMeters) || 0) > 0.001;
  }

  #resolvePlayerPullMovementMode({
    appliedReelHoldMoveMeters,
    appliedRodPullMoveMeters,
  } = {}) {
    if (Number(appliedReelHoldMoveMeters) > 0.000001) return "reel_hold";
    if (Number(appliedRodPullMoveMeters) > 0.000001) return "rod_hold";
    return "none";
  }

  #resolveFishMovementMode(frame) {
    if (frame?.fishMoveProjectionReason === "radial_outward_projected") {
      return "radial_projection";
    }
    if (Number(frame?.actualSpeedPxPerSec) > 0.001) return "autonomous";
    return "none";
  }

  #resolveFishActualBlockedReason({
    allowedVelocityX = 0,
    allowedVelocityY = 0,
    actualSpeedPxPerSec = 0,
    sectorMovementFrame = null,
    lineConstraintResult = null,
  } = {}) {
    const allowedSpeed = Math.hypot(
      Number(allowedVelocityX) || 0,
      Number(allowedVelocityY) || 0,
    );
    if (allowedSpeed <= 0.001 || Number(actualSpeedPxPerSec) > 0.001) {
      return "none";
    }
    if (sectorMovementFrame?.clamped === true) {
      const boundaryType = sectorMovementFrame.boundaryType || "unknown";
      const radiusDuplicate =
        boundaryType.includes("radius") &&
        sectorMovementFrame.enforceRadius !== false;
      return radiusDuplicate
        ? "sector_radius_duplicate"
        : `sector_${boundaryType}`;
    }
    if (
      lineConstraintResult?.constrained === true ||
      lineConstraintResult?.hardLimit === true
    ) {
      return "line_radius";
    }
    return "unknown_post_constraint";
  }

  #resolveFishMovementSummary({
    frame,
    awayDirX = 0,
    awayDirY = 0,
    fishWonForceKg = 0,
    netForceKg = 0,
    rodControlForceKg = 0,
  } = {}) {
    const moveX = Number(frame?.movedX) || 0;
    const moveY = Number(frame?.movedY) || 0;
    const magnitude = Math.hypot(moveX, moveY);
    const actualSpeedPxPerSec = Math.max(
      0,
      Number(frame?.actualSpeedPxPerSec) || 0,
    );

    if (magnitude <= 0.000001 || actualSpeedPxPerSec <= 0.001) {
      return {
        relation: "none",
        relationLabel: "немає руху",
        direction: "none",
        directionLabel: "немає",
        strengthKg: 0,
        actualSpeedPxPerSec,
        dirX: 0,
        dirY: 0,
      };
    }

    const dirX = moveX / magnitude;
    const dirY = moveY / magnitude;
    const awayLength = Math.hypot(Number(awayDirX) || 0, Number(awayDirY) || 0);
    const normalizedAwayX = awayLength > 0.000001 ? awayDirX / awayLength : 0;
    const normalizedAwayY = awayLength > 0.000001 ? awayDirY / awayLength : -1;
    const radialDot = dirX * normalizedAwayX + dirY * normalizedAwayY;
    const relation = this.#resolveFishMovementRelation(radialDot);

    return {
      relation,
      relationLabel: this.#fishMovementRelationLabel(relation),
      direction: this.#resolveEightWayDirection(dirX, dirY),
      directionLabel: this.#eightWayDirectionLabel(dirX, dirY),
      strengthKg: this.#resolveFishMovementStrengthKg({
        relation,
        fishWonForceKg,
        netForceKg,
        rodControlForceKg,
      }),
      actualSpeedPxPerSec,
      dirX,
      dirY,
    };
  }

  #resolveFishPressureSummary({
    frame,
    awayDirX = 0,
    awayDirY = 0,
    fishWonForceKg = 0,
    netForceKg = 0,
    rodControlForceKg = 0,
  } = {}) {
    const rawX = Number(frame?.fishMoveRawVelocityX) || 0;
    const rawY = Number(frame?.fishMoveRawVelocityY) || 0;
    const allowedX = Number(frame?.fishMoveAllowedVelocityX) || 0;
    const allowedY = Number(frame?.fishMoveAllowedVelocityY) || 0;
    const rawSpeed = Math.hypot(rawX, rawY);
    const allowedSpeed = Math.hypot(allowedX, allowedY);
    const hasRawVelocity = rawSpeed > 0.001;
    const sourceX = hasRawVelocity ? rawX : allowedX;
    const sourceY = hasRawVelocity ? rawY : allowedY;
    const speedPxPerSec = hasRawVelocity ? rawSpeed : allowedSpeed;
    const hasVelocity = speedPxPerSec > 0.001;
    const fallbackForce = Math.max(
      0,
      Number(fishWonForceKg) || 0,
      Number(netForceKg) || 0,
      Number(rodControlForceKg) || 0,
    );

    if (!hasVelocity && fallbackForce <= 0.000001) {
      return {
        relation: "none",
        relationLabel: "немає тиску",
        direction: "none",
        directionLabel: "немає",
        strengthKg: 0,
        speedPxPerSec: 0,
        dirX: 0,
        dirY: 0,
      };
    }

    const awayLength = Math.hypot(Number(awayDirX) || 0, Number(awayDirY) || 0);
    const normalizedAwayX = awayLength > 0.000001 ? awayDirX / awayLength : 0;
    const normalizedAwayY = awayLength > 0.000001 ? awayDirY / awayLength : -1;
    const dirX = hasVelocity ? sourceX / speedPxPerSec : normalizedAwayX;
    const dirY = hasVelocity ? sourceY / speedPxPerSec : normalizedAwayY;
    const radialDot = dirX * normalizedAwayX + dirY * normalizedAwayY;
    const relation = this.#resolveFishMovementRelation(radialDot);

    return {
      relation,
      relationLabel: this.#fishMovementRelationLabel(relation),
      direction: this.#resolveEightWayDirection(dirX, dirY),
      directionLabel: this.#eightWayDirectionLabel(dirX, dirY),
      strengthKg: this.#resolveFishMovementStrengthKg({
        relation,
        fishWonForceKg,
        netForceKg,
        rodControlForceKg,
      }),
      speedPxPerSec,
      dirX,
      dirY,
    };
  }

  #resolveFishMovementRelation(radialDot) {
    if (radialDot > 0.25) return "away_from_player";
    if (radialDot < -0.25) return "toward_player";
    return "sideways";
  }

  #fishMovementRelationLabel(relation) {
    if (relation === "away_from_player") return "від гравця";
    if (relation === "toward_player") return "до гравця";
    if (relation === "sideways") return "поперек";
    return "немає руху";
  }

  #resolveFishMovementStrengthKg({
    relation,
    fishWonForceKg = 0,
    netForceKg = 0,
    rodControlForceKg = 0,
  } = {}) {
    if (relation === "toward_player") return Math.max(0, Number(netForceKg) || 0);
    if (relation === "away_from_player") {
      return Math.max(0, Number(fishWonForceKg) || 0);
    }
    if (relation === "sideways") {
      return Math.max(
        0,
        Number(fishWonForceKg) || 0,
        Number(rodControlForceKg) || 0,
      );
    }
    return 0;
  }

  #resolveEightWayDirection(dirX, dirY) {
    const horizontal = this.#directionAxis(dirX, "left", "right");
    const vertical = this.#directionAxis(dirY, "up", "down");
    if (vertical && horizontal) return `${vertical}_${horizontal}`;
    return vertical || horizontal || "none";
  }

  #eightWayDirectionLabel(dirX, dirY) {
    const direction = this.#resolveEightWayDirection(dirX, dirY);
    const labels = {
      up: "вгору",
      up_left: "вгору-вліво",
      up_right: "вгору-вправо",
      left: "вліво",
      right: "вправо",
      down: "вниз",
      down_left: "вниз-вліво",
      down_right: "вниз-вправо",
      none: "немає",
    };
    return labels[direction] || labels.none;
  }

  #directionAxis(value, negativeName, positiveName) {
    if (value < -0.3826834323650898) return negativeName;
    if (value > 0.3826834323650898) return positiveName;
    return "";
  }

  #isLineTaut(lineState) {
    const recoverableLineMeters = Math.max(
      0,
      Number(lineState?.recoverableLineMeters) ||
        (
          (Number(lineState?.releasedMeters) || 0) -
          (Number(lineState?.distanceMeters) || 0)
        ),
    );
    return recoverableLineMeters <= 0.001;
  }

  #calculateAllowedPullMoveMeters({
    requestedMoveMeters,
    remainingStrokeMeters,
    fishPosition,
    rodTipPosition,
  }) {
    const requested = Math.max(0, Number(requestedMoveMeters) || 0);
    const remainingStroke = Math.max(0, Number(remainingStrokeMeters) || 0);
    if (requested <= 0 || remainingStroke <= 0) return 0;

    const dx = (Number(rodTipPosition?.x) || 0) - (Number(fishPosition?.x) || 0);
    const dy = (Number(rodTipPosition?.y) || 0) - (Number(fishPosition?.y) || 0);
    const distance = Math.hypot(dx, dy);
    if (distance <= 0.001) return 0;

    const yRatio = Math.abs(dy) / distance;
    if (yRatio <= 0.000001) return requested;
    return Math.min(requested, remainingStroke / yRatio);
  }

  #smoothPlayerPullAxis({ axis, desiredMoveMeters, dtSec }) {
    const config =
      this.#physicsConfig?.getPlayerPullMotionConfig?.() ||
      this.#getRuntimePhysicsConfig()?.fight?.playerPullMotion ||
      {};
    return this.#playerPullMotionSmoother.updateAxis({
      axis,
      desiredMove: Number(desiredMoveMeters) || 0,
      deltaTime: dtSec,
      config,
    }).move;
  }


  #limitRodControlMoveTowardTarget({
    signedMoveMeters,
    fishPosition,
    rodControlResult,
    pixelsPerMeter,
  }) {
    const move = Number(signedMoveMeters) || 0;
    if (move === 0) return 0;
    if (rodControlResult?.active !== true) return move;
    const rawTargetX = rodControlResult?.targetRodX;
    if (rawTargetX === null || rawTargetX === undefined) return move;
    const targetX = Number(rawTargetX);
    if (!Number.isFinite(targetX)) return move;
    const fishX = Number(fishPosition?.x);
    if (!Number.isFinite(fishX)) return move;

    const direction = Math.sign(move);
    const distancePx = Math.abs(targetX - fishX);
    const thresholdPx = 0.001;
    if (distancePx <= thresholdPx) return 0;

    const towardTarget = Math.sign(targetX - fishX);
    if (towardTarget !== 0 && direction !== towardTarget) return 0;

    const scale = Math.max(1, Number(pixelsPerMeter) || 50);
    const maxMoveMeters = distancePx / scale;
    return direction * Math.min(Math.abs(move), maxMoveMeters);
  }

  #applyRodPullMovement({
    floatEntity,
    rodTipPosition,
    deltaMeters,
    pixelsPerMeter,
    bounds,
    checkWater,
    limitRadiusPx = 0,
  }) {
    const meters = Math.max(0, Number(deltaMeters) || 0);
    if (meters <= 0) return this.#movementResult();

    const position = floatEntity.getPosition();
    const dx = rodTipPosition.x - position.x;
    const dy = rodTipPosition.y - position.y;
    const distancePx = Math.hypot(dx, dy);
    if (distancePx <= 0.001) {
      return this.#movementResult({ blockedReason: "target_reached" });
    }

    const scale = Math.max(1, Number(pixelsPerMeter) || 50);
    const movePx = Math.min(distancePx, meters * scale);
    const rawNext = {
      x: position.x + (dx / distancePx) * movePx,
      y: position.y + (dy / distancePx) * movePx,
    };
    const next = this.#clampToBounds(
      rawNext,
      bounds,
    );
    let hardBlocked =
      Math.abs(next.x - rawNext.x) > 0.001 ||
      Math.abs(next.y - rawNext.y) > 0.001;
    let blockedReason = hardBlocked ? "bounds_blocked" : "none";

    if (typeof checkWater === "function" && !checkWater(next.x, next.y)) {
      const waterEdgePoint = this.#findLastWaterPoint({
        from: position,
        to: next,
        checkWater,
      });
      hardBlocked = true;
      blockedReason = "water_blocked";
      if (!waterEdgePoint) {
        return this.#movementResult({ blockedReason, hardBlocked });
      }
      next.x = waterEdgePoint.x;
      next.y = waterEdgePoint.y;
    }

    const sectorFrame = this.#applyPoleFightSectorMovement({
      fromPosition: position,
      proposedPosition: next,
      origin: rodTipPosition,
      limitRadiusPx,
    });
    const directionalBlocked = sectorFrame.clamped === true;
    if (directionalBlocked && blockedReason === "none") {
      blockedReason = "pole_fight_sector";
    }

    const appliedPx = Math.hypot(next.x - position.x, next.y - position.y);
    position.x = next.x;
    position.y = next.y;
    return this.#movementResult({
      meters: appliedPx / scale,
      blockedReason,
      hardBlocked,
      directionalBlocked,
    });
  }

  #applyRodControlMovement({
    floatEntity,
    rodTipPosition,
    directionX,
    deltaMeters,
    pixelsPerMeter,
    bounds,
    checkWater,
    lineConstraintState,
    limitRadiusPx = 0,
    projectLockedMovementToArc,
  }) {
    const direction = Math.sign(Number(directionX) || 0);
    const meters = Math.max(0, Number(deltaMeters) || 0);
    if (direction === 0 || meters <= 0) {
      return this.#movementResult();
    }

    const position = floatEntity.getPosition();
    const scale = Math.max(1, Number(pixelsPerMeter) || 50);
    const requestedMovePx = meters * scale;
    const rawNext = this.#rodControlMovementProjector.resolveNextPoint({
      position,
      rodTipPosition,
      directionX: direction,
      deltaMeters: meters,
      pixelsPerMeter: scale,
      lineConstraintState,
      projectLockedMovementToArc,
    });
    const movementStart = {
      x: Number(rawNext.normalizedStartX) || position.x,
      y: Number(rawNext.normalizedStartY) || position.y,
    };
    const next = this.#clampToBounds(rawNext, bounds);
    let hardBlocked =
      Math.abs(next.x - rawNext.x) > 0.001 ||
      Math.abs(next.y - rawNext.y) > 0.001;
    let blockedReason = hardBlocked ? "bounds_blocked" : "none";
    let postProjectionClamped = hardBlocked;

    if (typeof checkWater === "function" && !checkWater(next.x, next.y)) {
      const waterEdgePoint = this.#findLastWaterPoint({
        from: movementStart,
        to: next,
        checkWater,
      });
      hardBlocked = true;
      postProjectionClamped = true;
      blockedReason = "water_blocked";
      if (!waterEdgePoint) {
        position.x = movementStart.x;
        position.y = movementStart.y;
        return this.#movementResult({
          blockedReason,
          hardBlocked,
          constraintCorrectionPx: rawNext.constraintCorrectionPx,
        });
      }
      next.x = waterEdgePoint.x;
      next.y = waterEdgePoint.y;
    }

    const sectorFrame = this.#applyPoleFightSectorMovement({
      fromPosition: movementStart,
      proposedPosition: next,
      origin: rodTipPosition,
      limitRadiusPx,
    });
    const directionalBlocked = sectorFrame.clamped === true;
    if (directionalBlocked) {
      postProjectionClamped = true;
      if (blockedReason === "none") blockedReason = "pole_fight_sector";
    }

    const endpointMovePx = Math.hypot(
      next.x - movementStart.x,
      next.y - movementStart.y,
    );
    const projectedPathPx = Math.min(
      requestedMovePx,
      Math.max(0, Number(rawNext.appliedPathPx) || 0),
    );
    const appliedControlPx = postProjectionClamped
      ? Math.min(projectedPathPx, endpointMovePx)
      : projectedPathPx;
    const movementInvariantViolated =
      appliedControlPx > requestedMovePx + 0.001;

    position.x = next.x;
    position.y = next.y;
    return this.#movementResult({
      meters: movementInvariantViolated ? meters : appliedControlPx / scale,
      px: movementInvariantViolated ? requestedMovePx : appliedControlPx,
      signedMeters: direction * (
        movementInvariantViolated ? meters : appliedControlPx / scale
      ),
      requestedPx: requestedMovePx,
      blockedReason: movementInvariantViolated
        ? "movement_invariant_violation"
        : blockedReason,
      hardBlocked: hardBlocked || movementInvariantViolated,
      directionalBlocked,
      constraintCorrectionPx: rawNext.constraintCorrectionPx,
      mode: rawNext.mode,
    });
  }

  #resolvePoleFightSectorLimitRadiusPx({
    lineState = null,
    lineConstraintState = null,
  } = {}) {
    const releasedMeters = Math.max(
      0,
      Number(
        lineConstraintState?.lockedLengthMeters ??
        lineConstraintState?.releasedMeters ??
        lineState?.releasedMeters,
      ) || 0,
    );
    const pixelsPerMeter = Math.max(
      1,
      Number(this.#physicsConfig?.getPixelsPerMeter?.()) || 50,
    );
    return releasedMeters * pixelsPerMeter;
  }

  #resolveLineConstraintState({
    lineState,
    dragContext,
    fishRetrieveResult,
    payoutResult = null,
    config = null,
  } = {}) {
    const payoutContext = this.#buildLinePayoutContext({
      lineState,
      dragContext,
      fishRetrieveResult,
      payoutResult,
    });
    return this.#lineConstraintStateResolver.resolve({
      lineState,
      payoutContext,
      config: this.#getLineConstraintConfig(config),
    });
  }

  #getLineConstraintConfig(config = null) {
    if (config?.lineConstraint) return config.lineConstraint;
    if (
      config &&
      (
        Object.prototype.hasOwnProperty.call(config, "tautThresholdRatio") ||
        Object.prototype.hasOwnProperty.call(config, "epsilonMeters") ||
        Object.prototype.hasOwnProperty.call(config, "projectLockedMovementToArc")
      )
    ) {
      return config;
    }
    return (
      this.#physicsConfig?.getRodControlConfig?.()?.lineConstraint ||
      this.#getRuntimePhysicsConfig()?.fight?.rodControl?.lineConstraint ||
      {}
    );
  }

  #buildLinePayoutContext({
    lineState,
    dragContext,
    fishRetrieveResult,
    payoutResult,
  }) {
    const lineHasReserve = this.#lineHasReserve(lineState);
    const dragSupported = !!dragContext?.dragSupported;
    const dragLocked = dragContext?.dragLocked !== false;
    const dragOpen = dragContext?.dragOpen === true;
    const dragSlipResolved = fishRetrieveResult?.shouldSlipDrag === true;
    const dragCanPayout =
      lineHasReserve &&
      dragSupported &&
      !dragLocked &&
      (dragOpen || dragSlipResolved);
    const dragPayoutBlocked =
      lineHasReserve && !dragCanPayout;

    return Object.freeze({
      lineHasReserve,
      dragCanPayout,
      dragPayoutBlocked,
      dragOpen,
      dragSlipResolved,
      payoutOccurred: payoutResult?.didSlip === true,
      payoutBlockedReason:
        payoutResult?.releaseBlockedReason || "none",
      reason: !lineHasReserve
        ? "spool_empty"
        : dragCanPayout
          ? "none"
          : "drag_holding",
    });
  }

  #movementResult({
    meters = 0,
    px = 0,
    signedMeters = 0,
    requestedPx = 0,
    constraintCorrectionPx = 0,
    blockedReason = "none",
    hardBlocked = false,
    directionalBlocked = false,
    mode = "none",
  } = {}) {
    return {
      meters: Math.max(0, Number(meters) || 0),
      px: Math.max(0, Number(px) || 0),
      signedMeters: Number(signedMeters) || 0,
      requestedPx: Math.max(0, Number(requestedPx) || 0),
      constraintCorrectionPx: Math.max(
        0,
        Number(constraintCorrectionPx) || 0,
      ),
      blockedReason,
      hardBlocked: !!hardBlocked,
      directionalBlocked: !!directionalBlocked,
      mode,
    };
  }

  #findLastWaterPoint({ from, to, checkWater }) {
    if (!checkWater(from.x, from.y)) return null;

    let low = 0;
    let high = 1;
    let found = false;
    const dx = to.x - from.x;
    const dy = to.y - from.y;

    for (let i = 0; i < 8; i++) {
      const t = (low + high) * 0.5;
      const x = from.x + dx * t;
      const y = from.y + dy * t;

      if (checkWater(x, y)) {
        low = t;
        found = true;
      } else {
        high = t;
      }
    }

    if (!found || low <= 0.0001) return null;

    this.#waterProbePoint.x = from.x + dx * low;
    this.#waterProbePoint.y = from.y + dy * low;
    return this.#waterProbePoint;
  }

  #clampToBounds(point, bounds) {
    if (!bounds) return point;
    const minX = Number.isFinite(Number(bounds.left)) ? Number(bounds.left) : -Infinity;
    const maxX = Number.isFinite(Number(bounds.right)) ? Number(bounds.right) : Infinity;
    const minY = Number.isFinite(Number(bounds.top)) ? Number(bounds.top) : -Infinity;
    const maxY = Number.isFinite(Number(bounds.bottom)) ? Number(bounds.bottom) : Infinity;
    return {
      x: Math.max(minX, Math.min(maxX, point.x)),
      y: Math.max(minY, Math.min(maxY, point.y)),
    };
  }

  getDebugData() {
    return this.#debug;
  }

  #resolvePhysicsConfigAdapter(config) {
    if (config?.fightPhysicsConfig) return config.fightPhysicsConfig;
    if (typeof FightPhysicsConfigAdapter !== "undefined") {
      return new FightPhysicsConfigAdapter(config);
    }
    return null;
  }

  #getRuntimePhysicsConfig() {
    return this.#config.physics || {};
  }

  #positive(value, fallback = 0) {
    const number = Number(value);
    if (Number.isFinite(number) && number >= 0) return number;
    const safeFallback = Number(fallback);
    return Number.isFinite(safeFallback) && safeFallback >= 0
      ? safeFallback
      : 0;
  }

  #clamp01(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.max(0, Math.min(1, number));
  }

}
