class FightPhysicsSystem {
  #config;
  #physicsConfig;
  #velocityScratch = new Vector2(0, 0);
  #waterProbePoint = { x: 0, y: 0 };
  #pumpCreditCalculator = new PumpCreditCalculator();
  #looseLineCalculator = new LooseLineCalculator();
  #rodStrokeTracker = new RodStrokeTracker();
  #playerPullMotionSmoother = new PlayerPullMotionSmoother();
  #reelHoldRecoverySystem = new ReelHoldRecoverySystem();
  #landingPolicyResolver = new LandingPolicyResolver();
  #landingLiftCalculator = new LandingLiftTensionCalculator();
  #pipeline = new FightPhysicsPipeline();
  #fishRetrieveSystem;
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
    const dtSec = pipelineFrame.run(
      "resolve_delta_time",
      () => this.#getDtSec(dtMs, physics),
    );
    const pullInput = pipelineFrame.run(
      "read_input",
      () => this.#updateInput({ input, pullInputMapper, dragSystem, dtSec }),
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
      playerMaxLoadKg: maxTackleLoadKg,
    }));
    const forceData = motion.forceData;
    const dragContext = pipelineFrame.run("resolve_drag_context", () =>
      this.#resolveDragContext({
      hasReel,
      dragSupported,
      dragSystem,
      forceData,
      maxTackleLoadKg,
      rodLimitKg,
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
      fishCondition,
      dragContext,
      physics,
      bounds,
      checkWater,
      holdReelRecover: this.#holdReelRecoverState,
      isRecoverMode,
      reel,
      rodLimitKg,
    }),
    );
    const rodControlFrame = pipelineFrame.run(
      "resolve_rod_control_x",
      () => this.#updateRodControl({
      dtSec,
      input,
      floatEntity,
      rodTipPosition,
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
      tensionResult: tensionPreview,
      physics,
      velocity: motion.velocity,
      hardLineLimitBeforeRelease: rodPullFrame.hardLineLimitBeforeRelease,
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
      lineState: lineLimit.lineState,
      hardLineLimit: lineLimit.hardLineLimit,
      dtSec,
      pullInput,
    }),
    );
    const rodPullDisplay = rodPullSystem.getState();

    this.#debug = pipelineFrame.run(
      "write_debug_snapshot",
      () => this.#buildDebugSnapshot({
      forceData,
      dragSystem,
      lineState: lineLimit.lineState,
      finalPumpCreditMeters: lineLimit.finalPumpCreditMeters,
      initialPumpCreditMeters: rodPullFrame.pumpCreditMeters,
      actualSlackMeters: lineLimit.actualSlackMeters,
      releaseResult: lineLimit.releaseResult,
      recoveredMeters,
      autoRecovery: recoverFrame.autoRecovery,
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
      holdReelRecoverMoveMeters: rodPullFrame.holdReelRecoverMoveMeters,
      rodPullMovementBlockReason: rodPullFrame.rodPullMovementBlockReason,
      reelHoldMovementBlockReason: rodPullFrame.reelHoldMovementBlockReason,
      hardTensionBlocked: rodPullFrame.hardTensionBlocked,
      fishRetrieveResult: rodPullFrame.fishRetrieveResult,
      landingLiftResult: tensionResult.landingLift,
      tensionResult,
      stressSystem,
      physics,
      isPullMode,
      isRecoverMode,
      holdReelRecover,
      dragContext,
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
    };
  }

  #getDtSec(dtMs, physics) {
    return Math.min(
      Math.max(0, Number(dtMs) || 0),
      this.#physicsConfig?.getMaxDtMs?.() ?? 50,
    ) / 1000;
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
  }) {
    const fishPosition = floatEntity.getPosition();
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
    const inCatchZone =
      landingDistanceMeters > 0 &&
      lineState.distanceMeters <= landingDistanceMeters + 0.001;
    if (inCatchZone && !this.#fishWasInCatchZone) {
      fishForceSystem.handleFightEvent?.({
        type: FISH_FIGHT_EVENT.CATCH_ZONE_ENTERED,
        lineDistanceMeters: lineState.distanceMeters,
        landingDistanceMeters,
      });
    }
    this.#fishWasInCatchZone = inCatchZone;
    fishForceSystem.evaluateLastDashTrigger?.({
      dtMs,
      lineDistanceMeters: lineState.distanceMeters,
      horizontalDistanceMeters: this.#calculateHorizontalDistanceMeters({
        fishPosition,
        rodTipPosition,
      }),
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
      lineHasReserve: this.#lineCanAbsorbEscape(lineState),
      env,
      buffs,
    });
    forceData.landingDistanceMeters = landingDistanceMeters;

    let movementFrame = null;
    if (typeof floatEntity.applyHookedFightMovement === "function") {
      movementFrame = floatEntity.applyHookedFightMovement({
        boundsRect: bounds,
        dt: dtMs,
        environment: env,
        checkWater,
        input,
        pullDirection: forceData.player.pullDir,
        targetVelocity: forceData.targetVelocity,
      });
    } else {
      const fallbackVelocity = floatEntity.getVelocity?.() || fishVelocity;
      fallbackVelocity.x = forceData.targetVelocity.x;
      fallbackVelocity.y = forceData.targetVelocity.y;
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
        targetSpeedPxPerSec: Math.hypot(forceData.targetVelocity.x, forceData.targetVelocity.y),
        dampingApplied: true,
        fallbackDampedUpdate: true,
      };
    }

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
    return { forceData, velocity, movementFrame };
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

    return {
      clampedDrag,
      maxTackleLoadKg,
      rodLimitKg,
      effectiveDragLimitKg,
      dragLocked,
      hasReel,
      dragSupported,
    };
  }

  #calculateHorizontalDistanceMeters({ fishPosition, rodTipPosition }) {
    const pixelsPerMeter =
      this.#physicsConfig?.getPixelsPerMeter?.() ||
      50;
    const verticalPx =
      (Number(rodTipPosition?.y) || 0) - (Number(fishPosition?.y) || 0);
    return Math.max(0, verticalPx / Math.max(1, pixelsPerMeter));
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
    fishCondition,
    dragContext,
    physics,
    bounds,
    checkWater,
    holdReelRecover,
    isRecoverMode,
    reel,
    rodLimitKg,
  }) {
    const lineStateBeforePull = lineSystem.updateDistance(
      floatEntity.getPosition(),
      rodTipPosition,
    );
    const pumpCreditMeters = this.#pumpCreditCalculator.calculateRecoverableLineMeters({
      releasedMeters: lineStateBeforePull.releasedMeters,
      fishDistanceMeters: lineStateBeforePull.distanceMeters,
    });
    const rodPullResult = rodPullSystem.update({
      dtSec,
      inputState: pullInput,
      rod,
      pumpCreditMeters,
      yLostBeforePullMeters: forceData?.fightYMovementFrame?.yAwayMeters,
      fishForceKg: forceData.totalFishForceKg,
      fishTensionKg: forceData.fishTensionKg,
      rodLimitKg,
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
      lineHasReserve: this.#lineCanAbsorbEscape(lineStateBeforePull),
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
    const pullStartY = Number(floatEntity.getPosition()?.y) || 0;
    const rodPullMovement = this.#applyRodPullMovement({
      floatEntity,
      rodTipPosition,
      deltaMeters: smoothedRodMoveMeters,
      pixelsPerMeter:
        this.#physicsConfig?.getPixelsPerMeter?.() ||
        50,
      bounds,
      checkWater,
    });
    const rodPullMoveMeters = rodPullMovement.meters;
    const pullEndY = Number(floatEntity.getPosition()?.y) || pullStartY;
    const pullYFrame = this.#rodStrokeTracker.calculate({
      previousFishY: pullStartY,
      currentFishY: pullEndY,
      pixelsPerMeter:
        this.#physicsConfig?.getPixelsPerMeter?.() ||
        50,
      towardPlayerYSign: this.#rodStrokeTracker.resolveTowardPlayerYSign({
        fishY: pullStartY,
        rodTipY: rodTipPosition?.y,
      }),
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
    if (rodPullResult.active) {
      rodPullSystem.recordYMovement?.({
        gainedMeters: pullYFrame.yTowardMeters,
      });
    }
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
    const lineHasReserve = this.#lineHasReserve(currentLineState);
    const hardLineLimit =
      !!currentLineState?.isFullyExtended ||
      !lineHasReserve;
    const currentTensionKg = Math.max(
      0,
      Number(stressSystem?.getTensionKg?.()) ||
        Number(forceData?.fishTensionKg) ||
        0,
    );
    const rodControlResult = rodControlSystem.update({
      dtSec,
      inputState: input,
      fishPosition,
      rodTipPosition,
      baseRodTipPosition: rodTipPosition,
      actualRodTipPosition,
      rodLimitKg,
      maxTackleLoadKg,
      currentTensionKg,
      fishTensionKg: forceData?.fishTensionKg,
      fishVelocityX: forceData?.targetVelocity?.x,
      fishWeightKg: forceData?.fishWeightKg,
      dragLimitKg: dragContext?.effectiveDragLimitKg,
      dragLocked: dragContext?.dragLocked !== false,
      lineHasReserve,
      hardLineLimit,
      config,
    });
    const desiredSignedMoveMeters =
      (Number(rodControlResult.directionX) || 0) *
      Math.max(0, Number(rodControlResult.desiredMoveMeters) || 0);
    const rawSmoothedSignedMoveMeters = this.#smoothPlayerPullAxis({
      axis: "x",
      desiredMoveMeters: rodControlResult.canApply
        ? desiredSignedMoveMeters
        : 0,
      dtSec,
    });
    const smoothedSignedMoveMeters = this.#limitRodControlMoveTowardTarget({
      signedMoveMeters: rawSmoothedSignedMoveMeters,
      fishPosition,
      rodControlResult,
      pixelsPerMeter:
        this.#physicsConfig?.getPixelsPerMeter?.() ||
        50,
    });
    const allowedMoveMeters = Math.abs(smoothedSignedMoveMeters);
    const movement = this.#applyRodControlMovement({
      floatEntity,
      directionX: Math.sign(smoothedSignedMoveMeters),
      deltaMeters: Math.abs(smoothedSignedMoveMeters),
      pixelsPerMeter:
        this.#physicsConfig?.getPixelsPerMeter?.() ||
        50,
      bounds,
      checkWater,
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
  }) {
    const landingDistanceMeters = Number(forceData?.landingDistanceMeters) || 0;
    const rawLineDistanceMeters = Number(lineState?.distanceMeters);
    const lineDistanceMeters = Number.isFinite(rawLineDistanceMeters)
      ? Math.max(0, rawLineDistanceMeters)
      : Infinity;
    const inLandingZone =
      landingDistanceMeters > 0 &&
      lineDistanceMeters <= landingDistanceMeters + 0.001;
    const playerHoldActive = !!pullInput?.pullHeld;
    const lift = this.#landingLiftCalculator.calculate({
      previousLiftHoldKg: this.#landingLiftHoldKg,
      fishWeightKg: this.#resolveFishWeightKg(forceData),
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

  #resolveFishWeightKg(forceData) {
    return Math.max(
      0,
      Number(forceData?.fishWeightKg) ||
        Number(forceData?.debug?.fishWeightKg) ||
        0,
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
      hardLineLimit,
      finalPumpCreditMeters,
      actualSlackMeters,
    };
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
    holdReelRecoverMoveMeters,
    rodPullMovementBlockReason,
    reelHoldMovementBlockReason,
    hardTensionBlocked,
    fishRetrieveResult,
    landingLiftResult,
    tensionResult,
    stressSystem,
    physics,
    isPullMode,
    isRecoverMode,
    holdReelRecover,
    dragContext,
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
    const movementMode = appliedReelHoldMoveMeters > 0.000001
      ? "reel_hold"
      : appliedRodPullMoveMeters > 0.000001
        ? "rod_hold"
        : "none";
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
      pumpCreditMeters: finalPumpCreditMeters,
      pumpCreditPenaltyMeters: initialPumpCreditMeters,
      actualSlackMeters,
      // Deprecated debug aliases: these values are pump credit, not real loose line.
      slackMeters: finalPumpCreditMeters,
      slackPenaltyMeters: initialPumpCreditMeters,
      lineReleasedThisFrameMeters: releaseResult.releasedMeters,
      lineDemandedThisFrameMeters: releaseResult.demandedMeters,
      lineUnsatisfiedThisFrameMeters: releaseResult.unsatisfiedMeters,
      reelSlip: releaseResult.didSlip,
      lineRecoveredThisFrameMeters: recoveredMeters,
      hardLineLimit,
      constraintCorrectionPx: constraintResult.correctionPx,
      rodPullActive: rodPullDisplay.active,
      rodPullRatio: rodPullDisplay.ratio,
      rodPullForceKg: rodPullResult.forceKg,
      rodLimitKg: rodPullResult.rodLimitKg,
      rodHoldMaxKg: rodPullResult.rodHoldMaxKg,
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
      movementMode,
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
      landingLiftTimeSeconds: landingLiftResult?.liftTimeSeconds ?? 0,
      landingLiftReleaseTimeSeconds:
        landingLiftResult?.releaseTimeSeconds ?? 0,
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
      rodControlMaxPullSpeedMps:
        rodControlResult?.maxPullSpeedMetersPerSecond ?? 0,
      rodControlPhase:
        rodControlResult?.phase || "inactive",
      rodControlVisualControlRatio:
        rodControlResult?.visualControlRatio ?? 0,
      rodControlForceKg: rodControlResult?.forceKg ?? 0,
      rodControlPlayerTensionKg: rodControlResult?.playerTensionKg ?? 0,
      rodControlTensionMultiplier: rodControlResult?.tensionMultiplier ?? 0,
      rodControlDesiredMoveMeters: rodControlResult?.desiredMoveMeters ?? 0,
      rodControlDesiredMovePx: rodControlResult?.desiredMovePx ?? 0,
      rodControlAllowedMoveMeters:
        rodControlResult?.allowedMoveMeters ?? 0,
      rodControlMoveMeters: appliedRodControlMoveMeters,
      rodControlMovePx: appliedRodControlMovePx,
      rodControlAppliedSpeedMps,
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
      staminaPressureRatio:
        isPullMode && Number(fishRetrieveResult?.fishWonYForceKg) > 0
          ? Math.max(
              0,
              Math.min(
                1,
                (Number(fishRetrieveResult?.dragBlockedForceKg) || 0) /
                  Number(fishRetrieveResult.fishWonYForceKg),
              ),
            )
          : forceData.staminaPressureRatio ?? 0,
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
    };
  }

  #lineHasReserve(lineState) {
    if (typeof lineState?.canReleaseLine === "boolean") return lineState.canReleaseLine;
    return (Number(lineState?.remainingMeters) || 0) > 0.001;
  }

  #lineCanAbsorbEscape(lineState) {
    return this.#lineHasReserve(lineState) || !lineState?.isFullyExtended;
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

    const appliedPx = Math.hypot(next.x - position.x, next.y - position.y);
    position.x = next.x;
    position.y = next.y;
    return this.#movementResult({
      meters: appliedPx / scale,
      blockedReason,
      hardBlocked,
    });
  }

  #applyRodControlMovement({
    floatEntity,
    directionX,
    deltaMeters,
    pixelsPerMeter,
    bounds,
    checkWater,
  }) {
    const direction = Math.sign(Number(directionX) || 0);
    const meters = Math.max(0, Number(deltaMeters) || 0);
    if (direction === 0 || meters <= 0) {
      return this.#movementResult();
    }

    const position = floatEntity.getPosition();
    const scale = Math.max(1, Number(pixelsPerMeter) || 50);
    const movePx = meters * scale;
    const rawX = position.x + direction * movePx;
    const rawNext = {
      x: rawX,
      y: position.y,
    };
    const next = this.#clampToBounds(rawNext, bounds);
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

    const appliedPx = Math.abs(next.x - position.x);
    position.x = next.x;
    position.y = next.y;
    return this.#movementResult({
      meters: appliedPx / scale,
      px: appliedPx,
      blockedReason,
      hardBlocked,
    });
  }

  #movementResult({
    meters = 0,
    px = 0,
    blockedReason = "none",
    hardBlocked = false,
  } = {}) {
    return {
      meters: Math.max(0, Number(meters) || 0),
      px: Math.max(0, Number(px) || 0),
      blockedReason,
      hardBlocked: !!hardBlocked,
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
