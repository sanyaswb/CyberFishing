class FightPhysicsSystem {
  #config;
  #physicsConfig;
  #velocityScratch = new Vector2(0, 0);
  #radialTargetVelocity = new Vector2(0, 0);
  #waterProbePoint = { x: 0, y: 0 };
  #pumpCreditCalculator = new PumpCreditCalculator();
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
      strokeWonMeters:
        rodPullFrame.rodPullResult.rodStrokeWonMeters ??
        rodPullFrame.rodPullResult.rodStrokeUnrecoveredMeters,
      fishDistanceMeters: lineStateAfterControl.distanceMeters,
    });
      const holdRecoveredMeters = holdReelRecover.active
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
        floatEntity,
        rodTipPosition,
        physics,
        dtSec,
        isPullMode,
        isRecoverMode,
      }),
    );
    const rodPullDisplay = rodPullSystem.getState();

    this.#debug = pipelineFrame.run(
      "write_debug_snapshot",
      () => this.#buildDebugSnapshot({
      forceData,
      dragSystem,
      lineState: finalLineState,
      finalPumpCreditMeters: lineLimit.finalPumpCreditMeters,
      initialPumpCreditMeters: rodPullFrame.pumpCreditMeters,
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
      poleFightSectorFrame: sectorFrame,
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
    const pumpCreditMeters = this.#pumpCreditCalculator.calculateRecoverableLineMeters({
      releasedMeters: lineStateBeforePull.releasedMeters,
      fishDistanceMeters: lineStateBeforePull.distanceMeters,
    });
    const rodPullResult = rodPullSystem.update({
      dtSec,
      inputState: pullInput,
      rod,
      pumpCreditMeters,
      distanceLostBeforePullMeters:
        prePullStrokeDistanceFrame.lostMeters,
      yLostBeforePullMeters: forceData?.fightYMovementFrame?.yAwayMeters,
      fishForceKg: forceData.totalFishForceKg,
      fishTensionKg: forceData.fishTensionKg,
      rodLimitKg,
      playerForceBudget,
      dragLimitKg: dragContext.effectiveDragLimitKg,
      maxTackleLoadKg: dragContext.maxTackleLoadKg,
      dragLocked: dragContext.dragLocked,
      hardLineLimit: lineStateBeforePull.isFullyExtended,
      lineHasReserve: this.#lineHasReserve(lineStateBeforePull),
      fishDistanceMeters: lineStateBeforePull.distanceMeters,
    });
    const remainingStrokeMeters = Math.max(
      0,
      (Number(rodPullResult.maxDistanceMeters) || 0) -
        (Number(
          rodPullResult.rodStrokeWonMeters ??
            rodPullResult.rodStrokeUsedMeters,
        ) || 0),
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
      pumpCreditMeters,
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
    floatEntity,
    rodTipPosition,
    physics,
    dtSec,
    isPullMode,
    isRecoverMode,
  } = {}) {
    const playerIsPulling = !!isPullMode && !isRecoverMode;
    const legacyAngleStressRatio = Math.max(
      0,
      Math.min(1, Number(forceData?.player?.angleStressRatio) || 0),
    );
    const legacyStaminaPressureRatio =
      this.#resolveLegacyStaminaPressureRatio({
        forceData,
        fishRetrieveResult,
        isPullMode,
      });
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
    const weakestFrame =
      stressSystem?.getWeakestTackleLimitFrame?.() ||
      Object.freeze({
        weakestTackleLimitKg:
          Math.max(0, Number(stressSystem?.getEffectiveMaxTackleLoadKg?.()) || 0),
        component: "stress_system",
        candidates: Object.freeze([]),
      });
    const frame = this.#staminaBalanceFrame?.create?.({
      playerIsPulling,
      fishTensionKg:
        fishRetrieveResult?.fishTensionKg ?? forceData?.fishTensionKg,
      appliedRodHoldKg,
      appliedControlKg,
      weakestTackleLimitKg: weakestFrame.weakestTackleLimitKg,
      lineAngleDeg: this.#resolveLineAngleDeg({
        floatEntity,
        rodTipPosition,
        rodControlResult,
      }),
      isLineFullyExtended: !!lineState?.isFullyExtended,
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
        angleStressRatio: legacyAngleStressRatio,
        staminaPressureRatio: frame.activeDrainRatio,
        legacyAngleStressRatio,
        legacyStaminaPressureRatio,
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
      isLineFullyExtended: !!lineState?.isFullyExtended,
      source: "legacy_fallback",
    });
  }

  #resolveLegacyStaminaPressureRatio({
    forceData,
    fishRetrieveResult,
    isPullMode,
  } = {}) {
    const fishWonYForceKg = Math.max(
      0,
      Number(fishRetrieveResult?.fishWonYForceKg) || 0,
    );
    const dragBlockedForceKg = Math.max(
      0,
      Number(fishRetrieveResult?.dragBlockedForceKg) || 0,
    );
    const fallbackPressureRatio = Math.max(
      0,
      Math.min(1, Number(forceData?.staminaPressureRatio) || 0),
    );
    if (isPullMode && fishWonYForceKg > 0) {
      return Math.max(
        0,
        Math.min(1, dragBlockedForceKg / fishWonYForceKg),
      );
    }
    return fallbackPressureRatio;
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
    const recover = reelSystem.recoverLineCredit || reelSystem.recoverSlack;
    return recover.call(reelSystem, {
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
      strokeCapacityMeters: rodPullResult?.rodStrokeCapacityMeters,
      strokeUnrecoveredMeters: rodPullResult?.rodStrokeUnrecoveredMeters,
      rodPullBlockedReason: rodPullResult?.blockedReason,
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
    this.#holdReelRecoverState.source = "rod_hold_y";
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
    const finalPumpCreditMeters = this.#pumpCreditCalculator.calculateRecoverableLineMeters({
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
      finalPumpCreditMeters,
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
    finalPumpCreditMeters,
    initialPumpCreditMeters,
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
    poleFightSectorFrame,
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
      initialPumpCreditMeters: Math.max(0, Number(initialPumpCreditMeters) || 0),
      finalPumpCreditMeters: Math.max(0, Number(finalPumpCreditMeters) || 0),
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
      strokeSyncedMeters: Math.max(0, Number(rodPullDisplay.strokeSyncedMeters) || 0),
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
      strokeYGainedMeters: Math.max(0, Number(rodPullDisplay.strokeYGainedMeters) || 0),
      strokeYLostMeters: Math.max(0, Number(rodPullDisplay.strokeYLostMeters) || 0),
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
      strokeResetReason: rodPullDisplay.strokeResetReason || "none",
      strokeSyncReason: rodPullDisplay.strokeSyncReason || "none",
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
      lineSlackMeters: lineState.recoverableLineMeters,
      isLineFullyExtended: lineState.isFullyExtended,
      lineExtensionRatio: lineState.lineExtensionRatio,
      lineDistanceMeters: lineState.distanceMeters,
      shoreLandingDistanceMeters:
        Math.max(0, Number(forceData.shoreLandingDistanceMeters) || 0),
      landingDistanceMode: "shore",
      pumpCreditMeters: finalPumpCreditMeters,
      pumpCreditPenaltyMeters: initialPumpCreditMeters,
      actualSlackMeters,
      // Deprecated debug aliases: these values are pump credit, not real loose line.
      slackMeters: finalPumpCreditMeters,
      slackPenaltyMeters: initialPumpCreditMeters,
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
      rodControlForceKg: rodControlResult?.forceKg ?? 0,
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
      strokeSyncedMeters: rodPullDisplay.strokeSyncedMeters ?? 0,
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
      strokeYGainedMeters: rodPullDisplay.strokeYGainedMeters ?? 0,
      strokeYLostMeters: rodPullDisplay.strokeYLostMeters ?? 0,
      strokeResetReason: rodPullDisplay.strokeResetReason || "none",
      strokeSyncReason: rodPullDisplay.strokeSyncReason || "none",
      availableExtraForceKg: rodPullDisplay.availableExtraForceKg,
      reelRecoveringSlack: recoveredMeters > 0,
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
      holdReelRecoverEligible: !!holdReelRecover?.eligible,
      holdReelRecoverActive: !!holdReelRecover?.active,
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
      staminaFrame,
      staminaFrameSource: staminaFrame?.source || "none",
      staminaPressureRatio: staminaFrame?.staminaPressureRatio ?? 0,
      angleStressRatio: staminaFrame?.angleStressRatio ?? 0,
      staminaAppliedRodHoldKg: staminaFrame?.appliedRodHoldKg ?? 0,
      staminaAppliedControlKg: staminaFrame?.appliedControlKg ?? 0,
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

}
