class FightPhysicsSystem {
  #config;
  #physicsConfig;
  #velocityScratch = new Vector2(0, 0);
  #waterProbePoint = { x: 0, y: 0 };
  #pumpCreditCalculator = new PumpCreditCalculator();
  #looseLineCalculator = new LooseLineCalculator();
  #landingPolicyResolver = new LandingPolicyResolver();
  #landingLiftCalculator = new LandingLiftTensionCalculator();
  #pipeline = new FightPhysicsPipeline();
  #fishRetrieveSystem;
  #landingLiftHoldKg = 0;
  #holdReelRecoverTimerMs = 0;
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
    rod,
    reel,
    fishForceSystem,
    lineSystem,
    dragSystem,
    pullInputMapper,
    rodPullSystem,
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
    const tensionPreview = pipelineFrame.run(
      "preview_tension",
      () => this.#calculateTension({
      tensionSystem,
      stressSystem,
      forceData,
      rodPullResult: rodPullFrame.rodPullResult,
      fishRetrieveResult: rodPullFrame.fishRetrieveResult,
      dragContext,
      lineState: rodPullFrame.lineStateAfterPull,
      hardLineLimit: rodPullFrame.hardLineLimitBeforeRelease,
    }),
    );
    const recoverFrame = pipelineFrame.run("recover_line", () => {
      const holdReelRecover = this.#updateHoldReelRecovery({
      dtMs,
      isPullMode,
      hasReel,
      reel,
      rodPullResult: rodPullFrame.rodPullResult,
      tensionPreview,
      dragContext,
      physics,
    });
      const recoveredMeters = this.#recoverLineCredit({
      dtSec,
      reelSystem,
      lineSystem,
      reel,
      tensionKg: this.#resolveReelRecoveryLoad({
        tensionResult: tensionPreview,
        dragContext,
      }),
      isRecoverMode: isRecoverMode || holdReelRecover.active,
      loadLimitKg: holdReelRecover.active ? holdReelRecover.reelMaxLoadKg : null,
      maxRecoverMeters: holdReelRecover.active
        ? rodPullFrame.holdReelRecoverMoveMeters
        : null,
    });
      return { holdReelRecover, recoveredMeters };
    });
    const holdReelRecover = recoverFrame.holdReelRecover;
    const recoveredMeters = recoverFrame.recoveredMeters;
    if (!holdReelRecover.active) {
      rodPullSystem.recoverStroke?.({ recoveredMeters });
    }
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
    if (!holdReelRecover.active) {
      rodPullSystem.syncStrokeToPumpCredit?.({
        pumpCreditMeters: lineLimit.finalPumpCreditMeters,
      });
    }
    const tensionResult = pipelineFrame.run(
      "update_final_tension",
      () => this.#updateTension({
      tensionSystem,
      stressSystem,
      forceData,
      rodPullResult: rodPullFrame.rodPullResult,
      fishRetrieveResult: rodPullFrame.fishRetrieveResult,
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
      hardLineLimit: lineLimit.hardLineLimit,
      constraintResult: lineLimit.constraintResult,
      rodPullDisplay,
      rodPullResult: rodPullFrame.rodPullResult,
      rodPullMoveMeters: rodPullFrame.rodPullMoveMeters,
      holdReelRecoverMoveMeters: rodPullFrame.holdReelRecoverMoveMeters,
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
        pX: 0,
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
    const dragLocked = typeof player.dragLocked === "boolean"
      ? player.dragLocked
      : (!dragSupported);

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
        (Number(rodPullResult.rodStrokeUsedMeters) || 0),
    );
    const rodStrokeMovementBlocked = this.#isRodStrokeMovementBlocked(
      rodPullResult,
      remainingStrokeMeters,
    );
    const holdReelRecoverActive =
      !!holdReelRecover?.active &&
      !!dragContext.hasReel;
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
        ? remainingStrokeMeters
        : 0;
    const holdReelRecoverMoveMeters = this.#calculateHoldReelRecoverMoveMeters({
      dtSec,
      fishRetrieveResult: fishRetrieveFrame,
      holdReelRecover,
      holdReelRecoverActive,
    });
    const requestedMoveMeters = holdReelRecoverActive
      ? holdReelRecoverMoveMeters
      : Math.min(
          fishRetrieveFrame.desiredMoveMeters,
          rodStrokeMoveCapacityMeters,
        );
    const desiredMoveMeters = requestedMoveMeters;
    const rodPullMoveMeters = this.#applyRodPullMovement({
      floatEntity,
      rodTipPosition,
      deltaMeters: desiredMoveMeters,
      pixelsPerMeter:
        this.#physicsConfig?.getPixelsPerMeter?.() ||
        50,
      bounds,
      checkWater,
    });
    const movementBlocked =
      desiredMoveMeters > rodPullMoveMeters + 0.001 ||
      (
        rodStrokeMovementBlocked &&
        !holdReelRecoverActive
      );
    const tensionBlocked =
      desiredMoveMeters > rodPullMoveMeters + 0.001;
    const fishRetrieveResult = fishRetrieveFrame
      .withAppliedMovement({
        appliedMoveMeters: rodPullMoveMeters,
        movementBlocked,
        tensionBlocked,
      });
    if (rodPullResult.active) {
      rodPullSystem.recordAppliedStroke?.({
        movedMeters: Math.min(rodPullMoveMeters, rodStrokeMoveCapacityMeters),
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
      holdReelRecoverMoveMeters: holdReelRecoverActive
        ? rodPullMoveMeters
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
    if (reason === "pump_credit_too_high") return true;
    if (reason === "max_distance_reached") {
      if (remainingStrokeMeters !== null) {
        return Math.max(0, Number(remainingStrokeMeters) || 0) <= 0.001;
      }
      return true;
    }
    if (remainingStrokeMeters === null) return false;
    return Math.max(0, Number(remainingStrokeMeters) || 0) <= 0.001;
  }

  #updateTension({
    tensionSystem,
    stressSystem,
    forceData,
    rodPullResult,
    fishRetrieveResult,
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
      landingLift,
      dragContext,
      lineState,
      hardLineLimit,
    });
    const tensionResult = {
      ...calculatedTension,
      landingLift,
    };

    stressSystem.updateTarget(tensionResult.tensionKg, dtSec, this.#config.tension || {});
    return tensionResult;
  }

  #calculateTension({
    tensionSystem,
    stressSystem,
    forceData,
    rodPullResult,
    fishRetrieveResult,
    landingLift,
    dragContext,
    lineState,
    hardLineLimit,
  }) {
    const lineHasReserve = this.#lineHasReserve(lineState);
    const baseFishTensionKg =
      fishRetrieveResult.fishTensionKg ?? forceData.fishTensionKg;
    const basePlayerHoldTensionKg = fishRetrieveResult.playerHoldTensionKg ?? 0;
    const baseTotalTensionKg =
      fishRetrieveResult.totalTensionKg ?? fishRetrieveResult.lineTensionKg;
    const landingLiftActive = !!landingLift?.active;
    const fishTensionKg = landingLiftActive
      ? landingLift.fishTensionKg
      : baseFishTensionKg;
    const playerHoldTensionKg = landingLiftActive
      ? 0
      : basePlayerHoldTensionKg;
    const totalTensionKg = landingLiftActive
      ? landingLift.totalTensionKg
      : baseTotalTensionKg;
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

  #resolveReelRecoveryLoad({ tensionResult, dragContext }) {
    const rawLoadKg = Math.max(0, Number(tensionResult?.rawTensionKg) || 0);
    const dragLimitKg = Math.max(0, Number(dragContext?.effectiveDragLimitKg) || 0);
    if (!dragContext?.dragLocked && rawLoadKg > dragLimitKg + 0.001) {
      return Infinity;
    }
    return rawLoadKg;
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
  }) {
    const reelConfig = this.#physicsConfig?.getReelConfig?.() || {};
    const configuredDelayMs = Number(reelConfig.holdRecoverAfterFullStrokeMs);
    const delayMs = Number.isFinite(configuredDelayMs)
      ? Math.max(0, configuredDelayMs)
      : 0;
    const configuredStrokeRatio = Number(reelConfig.holdRecoverStrokeRatio);
    const requiredStrokeRatio = Number.isFinite(configuredStrokeRatio)
      ? Math.max(0, Math.min(1, configuredStrokeRatio))
      : 1;
    const configuredStrokeToleranceMeters = Number(
      reelConfig.holdRecoverStrokeToleranceMeters,
    );
    const strokeToleranceMeters = Number.isFinite(configuredStrokeToleranceMeters)
      ? Math.max(0, configuredStrokeToleranceMeters)
      : Math.max(
          0.001,
          Number(this.#physicsConfig?.getRodPullConfig?.()?.minStrokeMeters) ||
            0.001,
        );
    const rawLoadKg = Math.max(0, Number(tensionPreview?.rawTensionKg) || 0);
    const reelMaxLoadKg = Math.max(
      0,
      Number(reel?.getEffectiveMaxLoadKg?.()) ||
        Number(reel?.getMaxLoadKg?.()) ||
        0,
    );
    const reelLoadReserveRatio =
      reelMaxLoadKg > 0
        ? Math.max(0, Math.min(1, (reelMaxLoadKg - rawLoadKg) / reelMaxLoadKg))
        : 0;
    const reelRetrieveSpeedMetersPerSecond = Math.max(
      0,
      Number(reel?.getRetrieveSpeedMetersPerSec?.()) || 0,
    );
    const recoverSpeedMetersPerSecond =
      reelRetrieveSpeedMetersPerSecond * reelLoadReserveRatio;
    const strokeRatio = Math.max(
      0,
      Math.min(1, Number(rodPullResult?.rodStrokeRatio) || 0),
    );
    const strokeCapacityMeters = Math.max(
      0,
      Number(rodPullResult?.rodStrokeCapacityMeters) || 0,
    );
    const strokeUnrecoveredMeters = Math.max(
      0,
      Number(rodPullResult?.rodStrokeUnrecoveredMeters) || 0,
    );
    const strokeFull =
      strokeRatio >= requiredStrokeRatio ||
      (
        strokeCapacityMeters > 0 &&
        strokeUnrecoveredMeters >= strokeCapacityMeters - strokeToleranceMeters
      ) ||
      rodPullResult?.blockedReason === "max_distance_reached";
    const dragLimitKg = Math.max(
      0,
      Number(dragContext?.effectiveDragLimitKg) || 0,
    );
    const tensionBelowDragLimit =
      !!dragContext?.dragLocked || rawLoadKg < dragLimitKg - 0.001;
    const tensionBelowMaxLoad = reelLoadReserveRatio > 0.01;
    const dragCanHold =
      tensionPreview?.shouldSlipDrag !== true &&
      tensionBelowDragLimit &&
      tensionBelowMaxLoad;
    const eligible =
      reelConfig.holdRecoverAfterFullStrokeMs !== false &&
      !!hasReel &&
      !!isPullMode &&
      !!rodPullResult?.active &&
      strokeFull &&
      dragCanHold &&
      recoverSpeedMetersPerSecond > 0.001;
    const blockedReason = this.#resolveHoldReelRecoverBlockedReason({
      reelConfig,
      hasReel,
      isPullMode,
      rodPullResult,
      strokeFull,
      dragCanHold,
      reelLoadReserveRatio,
      tensionBelowDragLimit,
      tensionBelowMaxLoad,
      recoverSpeedMetersPerSecond,
    });

    this.#holdReelRecoverTimerMs = eligible
      ? Math.min(
          delayMs,
          this.#holdReelRecoverTimerMs + Math.max(0, Number(dtMs) || 0),
        )
      : 0;

    const active = eligible && this.#holdReelRecoverTimerMs >= delayMs;
    this.#holdReelRecoverState = {
      eligible,
      active,
      timerMs: this.#holdReelRecoverTimerMs,
      delayMs,
      reelLoadReserveRatio,
      reelMaxLoadKg,
      recoverSpeedMetersPerSecond,
      maxMoveMeters: recoverSpeedMetersPerSecond *
        (Math.max(0, Number(dtMs) || 0) / 1000),
      blockedReason,
    };
    return this.#holdReelRecoverState;
  }

  #resolveHoldReelRecoverBlockedReason({
    reelConfig,
    hasReel,
    isPullMode,
    rodPullResult,
    strokeFull,
    dragCanHold,
    reelLoadReserveRatio,
    tensionBelowDragLimit,
    tensionBelowMaxLoad,
    recoverSpeedMetersPerSecond,
  }) {
    if (reelConfig.holdRecoverAfterFullStrokeMs === false) return "disabled";
    if (!hasReel) return "no_reel";
    if (!isPullMode) return "not_holding";
    if (!rodPullResult?.active) return "rod_pull_inactive";
    if (!strokeFull) return "stroke_not_full";
    if (!dragCanHold) {
      if (!tensionBelowDragLimit) return "at_drag_limit";
      if (!tensionBelowMaxLoad) return "near_max_load";
      return "drag_slipping";
    }
    if (reelLoadReserveRatio <= 0.01) return "no_reel_load_reserve";
    if (recoverSpeedMetersPerSecond <= 0.001) return "zero_recover_speed";
    return "ready";
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
    hardLineLimit,
    constraintResult,
    rodPullDisplay,
    rodPullResult,
    rodPullMoveMeters,
    holdReelRecoverMoveMeters,
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
    return {
      ...forceData.debug,
      ...dragSystem.getDebugData(),
      dragSupported: !!dragContext.dragSupported,
      lineReleasedMeters: lineState.releasedMeters,
      lineRemainingMeters: lineState.remainingMeters,
      lineCanRelease: this.#lineHasReserve(lineState),
      lineSpoolEmpty: !this.#lineHasReserve(lineState),
      lineReserveEmpty: !this.#lineHasReserve(lineState),
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
      fishRetrieveUsefulPullForceKg: fishRetrieveResult?.effectiveRodHoldKg,
      fishRetrieveSpeedMps: fishRetrieveResult?.speedMps,
      simpleFightSpeedMps: fishRetrieveResult?.speedMps,
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
      rodPullMoveMeters,
      rodPullCanMoveFish: rodPullResult.canMoveFish,
      rodPullBlockedReason: rodPullDisplay.blockedReason,
      rodPullDragSlipping: rodPullDisplay.dragSlipping,
      rodPullReleaseRecovering: rodPullDisplay.releaseRecovering,
      rodPullReleaseRecoveryRatio: rodPullDisplay.releaseRecoveryRatio,
      rodPullChargeSpeedMultiplier: rodPullDisplay.chargeSpeedMultiplier,
      rodPullChargePerSecond: rodPullDisplay.chargePerSecond,
      activeRodPullForceKg: rodPullResult.forceKg,
      rodStrokeCapacityMeters: rodPullDisplay.rodStrokeCapacityMeters,
      rodStrokeUsedMeters: rodPullDisplay.rodStrokeUsedMeters,
      rodStrokeUnrecoveredMeters: rodPullDisplay.rodStrokeUnrecoveredMeters,
      rodStrokeRatio: rodPullDisplay.rodStrokeRatio,
      availableExtraForceKg: rodPullDisplay.availableExtraForceKg,
      reelRecoveringSlack: recoveredMeters > 0,
      holdReelRecoverEligible: !!holdReelRecover?.eligible,
      holdReelRecoverActive: !!holdReelRecover?.active,
      holdReelRecoverTimerMs: holdReelRecover?.timerMs ?? 0,
      holdReelRecoverDelayMs: holdReelRecover?.delayMs ?? 0,
      holdReelRecoverLoadReserveRatio:
        holdReelRecover?.reelLoadReserveRatio ?? 0,
      holdReelRecoverReelMaxLoadKg: holdReelRecover?.reelMaxLoadKg ?? 0,
      holdReelRecoverSpeedMps:
        holdReelRecover?.recoverSpeedMetersPerSecond ?? 0,
      holdReelRecoverMoveMeters: holdReelRecoverMoveMeters ?? 0,
      holdReelRecoverBlockedReason:
        holdReelRecover?.blockedReason || "not_checked",
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
      movementAuthority: forceData.player.movementAuthority,
      playerForceKg: forceData.player.forceKg,
      activeEffectivePullKg: fishRetrieveResult?.effectiveRodHoldKg ?? 0,
      activeNetPullKg: Math.max(0, Number(fishRetrieveResult?.netForceKg) || 0),
      pullCapacityKg: forceData.player.pullCapacityKg,
      effectivePullKg: fishRetrieveResult?.usefulPullForceKg ?? 0,
      netPullKg: fishRetrieveResult?.netForceKg ?? 0,
      legacyEffectivePullKg: forceData.player.legacyEffectivePullKg,
      legacyNetPullKg: forceData.player.legacyNetPullKg,
      dragLimitKg: dragContext.effectiveDragLimitKg,
      rawDragLimitKg: forceData.player.dragLimitKg,
      dragLocked: dragContext.dragLocked,
      dragHoldRatio: forceData.player.dragHoldRatio,
      canDragHoldFish: forceData.player.canDragHoldFish,
      rodPullCanWinDistance: rodPullResult.canMoveFish,
      legacyCanWinDistance: forceData.player.legacyCanWinDistance,
      shouldSlipDrag:
        fishRetrieveResult?.shouldSlipDrag ?? forceData.player.shouldSlipDrag,
      staminaPressureRatio: forceData.player.staminaPressureRatio,
      playerForceY: Math.abs(rodPullResult.forceKg),
      playerForceX: 0,
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

  #applyRodPullMovement({
    floatEntity,
    rodTipPosition,
    deltaMeters,
    pixelsPerMeter,
    bounds,
    checkWater,
  }) {
    const meters = Math.max(0, Number(deltaMeters) || 0);
    if (meters <= 0) return 0;

    const position = floatEntity.getPosition();
    const dx = rodTipPosition.x - position.x;
    const dy = rodTipPosition.y - position.y;
    const distancePx = Math.hypot(dx, dy);
    if (distancePx <= 0.001) return 0;

    const scale = Math.max(1, Number(pixelsPerMeter) || 50);
    const movePx = Math.min(distancePx, meters * scale);
    const next = this.#clampToBounds(
      {
        x: position.x + (dx / distancePx) * movePx,
        y: position.y + (dy / distancePx) * movePx,
      },
      bounds,
    );

    if (typeof checkWater === "function" && !checkWater(next.x, next.y)) {
      const waterEdgePoint = this.#findLastWaterPoint({
        from: position,
        to: next,
        checkWater,
      });
      if (!waterEdgePoint) return 0;
      next.x = waterEdgePoint.x;
      next.y = waterEdgePoint.y;
    }

    const appliedPx = Math.hypot(next.x - position.x, next.y - position.y);
    position.x = next.x;
    position.y = next.y;
    return appliedPx / scale;
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
