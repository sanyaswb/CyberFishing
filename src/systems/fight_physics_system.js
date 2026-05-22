class FightPhysicsSystem {
  #config;
  #velocityScratch = new Vector2(0, 0);
  #waterProbePoint = { x: 0, y: 0 };
  #pumpCreditCalculator = new PumpCreditCalculator();
  #looseLineCalculator = new LooseLineCalculator();
  #landingPolicyResolver = new LandingPolicyResolver();
  #fishRetrieveSystem;
  #debug = {};

  constructor(config) {
    this.#config = config || {};
    this.#fishRetrieveSystem = new FishRetrieveSystem(
      this.#config.physics?.fishRetrieve || {},
    );
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
    const physics = this.#config.physics || {};
    const dtSec = this.#getDtSec(dtMs, physics);
    const pullInput = this.#updateInput({ input, pullInputMapper, dragSystem, dtSec });
    const hasReel = !!reel?.hasReel?.();
    const dragSupported = hasReel && reel?.hasDrag?.() !== false;
    const isPullMode = !!pullInput.pullHeld;
    const isRecoverMode = hasReel && !isPullMode;
    const maxTackleLoadKg = stressSystem.getEffectiveMaxTackleLoadKg?.() || 0;
    const motion = this.#updateFishMotion({
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
      fishCondition,
      buffs,
      playerMaxLoadKg: maxTackleLoadKg,
    });
    const forceData = motion.forceData;
    const dragContext = this.#resolveDragContext({
      hasReel,
      dragSupported,
      dragSystem,
      forceData,
      maxTackleLoadKg,
    });

    const rodPullFrame = this.#updateRodPull({
      dtSec,
      pullInput,
      floatEntity,
      rodTipPosition,
      rod,
      lineSystem,
      rodPullSystem,
      fishRetrieveSystem: this.#fishRetrieveSystem,
      forceData,
      dragContext,
      physics,
      bounds,
      checkWater,
    });
    const tensionPreview = this.#calculateTension({
      tensionSystem,
      forceData,
      rodPullResult: rodPullFrame.rodPullResult,
      fishRetrieveResult: rodPullFrame.fishRetrieveResult,
      dragContext,
      lineState: rodPullFrame.lineStateAfterPull,
      hardLineLimit: rodPullFrame.hardLineLimitBeforeRelease,
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
      isRecoverMode,
    });
    rodPullSystem.recoverStroke?.({ recoveredMeters });
    const lineLimit = this.#resolveLineLimit({
      floatEntity,
      rodTipPosition,
      lineSystem,
      dragSystem,
      tensionResult: tensionPreview,
      physics,
      velocity: motion.velocity,
      hardLineLimitBeforeRelease: rodPullFrame.hardLineLimitBeforeRelease,
    });
    rodPullSystem.syncStrokeToPumpCredit?.({ pumpCreditMeters: lineLimit.finalPumpCreditMeters });
    const tensionResult = this.#updateTension({
      tensionSystem,
      stressSystem,
      forceData,
      rodPullResult: rodPullFrame.rodPullResult,
      fishRetrieveResult: rodPullFrame.fishRetrieveResult,
      dragContext,
      lineState: lineLimit.lineState,
      hardLineLimit: lineLimit.hardLineLimit,
      dtSec,
    });
    const rodPullDisplay = rodPullSystem.getState();

    this.#debug = this.#buildDebugSnapshot({
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
      fishRetrieveResult: rodPullFrame.fishRetrieveResult,
      tensionResult,
      stressSystem,
      physics,
      isPullMode,
      isRecoverMode,
      dragContext,
    });
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
      physics.maxDtMs ?? 50,
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
    fishCondition,
    buffs,
    playerMaxLoadKg,
  }) {
    const fishPosition = floatEntity.getPosition();
    const fishVelocity = floatEntity.getVelocity?.() || this.#velocityScratch.set(0, 0);
    const lineState = lineSystem.updateDistance(fishPosition, rodTipPosition);
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
      env,
      buffs,
    });

    const velocity = floatEntity.getVelocity?.() || fishVelocity;
    const agility = Math.max(0, forceData.behavior.agility ?? 1);
    const approach = 1 - Math.exp(-Math.max(0.1, agility * 3) * dtSec);
    velocity.x += (forceData.targetVelocity.x - velocity.x) * approach;
    velocity.y += (forceData.targetVelocity.y - velocity.y) * approach;

    floatEntity.update(
      bounds,
      dtMs,
      env,
      checkWater,
      input,
      0,
      forceData.player.pullDir,
    );

    return { forceData, velocity };
  }

  #resolveDragContext({ hasReel, dragSupported, dragSystem, forceData, maxTackleLoadKg }) {
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
      effectiveDragLimitKg,
      dragLocked,
      hasReel,
      dragSupported,
    };
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
    dragContext,
    physics,
    bounds,
    checkWater,
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
      dragLimitKg: dragContext.effectiveDragLimitKg,
      maxTackleLoadKg: dragContext.maxTackleLoadKg,
      dragLocked: dragContext.dragLocked,
      hardLineLimit: lineStateBeforePull.isFullyExtended,
      lineHasReserve: this.#lineHasReserve(lineStateBeforePull),
      fishDistanceMeters: lineStateBeforePull.distanceMeters,
    });
    const fishRetrieveFrame = fishRetrieveSystem.calculate({
      dtSec,
      rodPullResult,
      forceData,
      movementBlocked: !!lineStateBeforePull.isFullyExtended,
    });
    const remainingStrokeMeters = Math.max(
      0,
      (Number(rodPullResult.maxDistanceMeters) || 0) -
        (Number(rodPullResult.rodStrokeUsedMeters) || 0),
    );
    const hasPullMovement =
      rodPullResult.active &&
      fishRetrieveFrame.actualFishPullSpeedMetersPerSecond > 0.001;
    const desiredMoveMeters = hasPullMovement
      ? Math.min(remainingStrokeMeters, fishRetrieveFrame.desiredMoveMeters)
      : 0;
    const rodPullMoveMeters = this.#applyRodPullMovement({
      floatEntity,
      rodTipPosition,
      deltaMeters: desiredMoveMeters,
      pixelsPerMeter: physics.pixelsPerMeter || 50,
      bounds,
      checkWater,
    });
    const movementBlocked =
      desiredMoveMeters > rodPullMoveMeters + 0.001 ||
      !!lineStateBeforePull.isFullyExtended;
    const fishRetrieveResult = fishRetrieveFrame
      .withAppliedMovement({
        appliedMoveMeters: rodPullMoveMeters,
        movementBlocked,
      });
    rodPullSystem.recordAppliedStroke?.({ movedMeters: rodPullMoveMeters });
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
      hardLineLimitBeforeRelease: !!lineStateAfterPull.isFullyExtended,
    };
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
  }) {
    const tensionResult = this.#calculateTension({
      tensionSystem,
      forceData,
      rodPullResult,
      fishRetrieveResult,
      dragContext,
      lineState,
      hardLineLimit,
    });

    stressSystem.updateTarget(tensionResult.tensionKg, dtSec, this.#config.tension || {});
    return tensionResult;
  }

  #calculateTension({
    tensionSystem,
    forceData,
    rodPullResult,
    fishRetrieveResult,
    dragContext,
    lineState,
    hardLineLimit,
  }) {
    const lineHasReserve = this.#lineHasReserve(lineState);
    return tensionSystem.calculate({
      fishForceKg: fishRetrieveResult.lineTensionKg,
      rodPullForceKg: 0,
      dragLimitKg: dragContext.effectiveDragLimitKg,
      hardLineLimit: !!hardLineLimit,
      lineHasReserve,
      dragLocked: dragContext.dragLocked,
    });
  }

  #recoverLineCredit({ dtSec, reelSystem, lineSystem, reel, tensionKg, isRecoverMode }) {
    const recover = reelSystem.recoverLineCredit || reelSystem.recoverSlack;
    return recover.call(reelSystem, {
      dtSec,
      lineSystem,
      reel,
      tensionKg,
      inputRecover: isRecoverMode,
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
      creepReleaseRatio: physics.drag?.creepReleaseRatio ?? 0,
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
    fishRetrieveResult,
    tensionResult,
    stressSystem,
    physics,
    isPullMode,
    isRecoverMode,
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
      playerDemandForceKg: rodPullResult.forceKg,
      playerPullPressureKg: fishRetrieveResult?.playerPullPressureKg,
      effectivePlayerPressureKg: fishRetrieveResult?.effectivePlayerPressureKg,
      pressureTransferRatio: fishRetrieveResult?.pressureTransferRatio,
      fishRetrieveHoldRatio: fishRetrieveResult?.holdRatio,
      desiredPullSpeedMps: fishRetrieveResult?.desiredPullSpeedMetersPerSecond,
      actualPullSpeedMps: fishRetrieveResult?.actualPullSpeedMetersPerSecond,
      pullIntentSpeedMps: fishRetrieveResult?.pullIntentSpeedMetersPerSecond,
      actualFishPullSpeedMps:
        fishRetrieveResult?.actualFishPullSpeedMetersPerSecond,
      fishActiveForceAwayKg: fishRetrieveResult?.fishActiveForceAwayKg,
      activeAwayForceKg: fishRetrieveResult?.activeAwayForceKg,
      bodyResistanceKg: fishRetrieveResult?.bodyResistanceKg,
      tautBodyResistanceKg: fishRetrieveResult?.tautBodyResistanceKg,
      bodyStaticResistanceKg: fishRetrieveResult?.bodyStaticResistanceKg,
      fishStaticResistanceKg: fishRetrieveResult?.fishStaticResistanceKg,
      fishOppositionKg: fishRetrieveResult?.fishOppositionKg,
      fishRetrievePullSpeedRatio: fishRetrieveResult?.pullSpeedRatio,
      fishRetrieveIntentPullSpeedRatio: fishRetrieveResult?.intentPullSpeedRatio,
      fishRetrieveMovementAuthorityLoadKg: fishRetrieveResult?.movementAuthorityLoadKg,
      fishRetrievePotentialWaterDragKg: fishRetrieveResult?.potentialWaterDragKg,
      fishRetrievePotentialAccelerationLoadKg: fishRetrieveResult?.potentialAccelerationLoadKg,
      passiveRetrieveTensionKg:
        fishRetrieveResult?.passiveRetrieveTensionKg,
      fishRetrieveWaterDragKg: fishRetrieveResult?.waterDragKg,
      fishRetrieveWaterDragCapacityKg:
        fishRetrieveResult?.waterDragCapacityKg,
      fishRetrieveWaterDragKgPerKgAtReferenceSpeed:
        fishRetrieveResult?.waterDragKgPerKgAtReferenceSpeed,
      fishRetrieveAccelerationLoadKg:
        fishRetrieveResult?.accelerationLoadKg,
      fishRetrievePositiveAccelerationMps2:
        fishRetrieveResult?.positiveAccelerationMetersPerSecond2,
      fishRetrieveAccelerationRatio: fishRetrieveResult?.accelerationRatio,
      fishRetrieveStartAccelerationLoadKgPerKg:
        fishRetrieveResult?.startAccelerationLoadKgPerKg,
      fishRetrieveUsefulPullForceKg: fishRetrieveResult?.usefulPullForceKg,
      fishRetrieveSpeedMps: fishRetrieveResult?.retrieveSpeedMetersPerSecond,
      fishRetrieveMovementControlRatio:
        fishRetrieveResult?.movementControlRatio,
      fishRetrieveTerminalSpeedMps: fishRetrieveResult?.terminalRetrieveSpeedMetersPerSecond,
      fishRetrieveTerminalReached: fishRetrieveResult?.terminalSpeedReached,
      fishRetrieveSurplusForceKg: fishRetrieveResult?.surplusForceKg,
      fishRetrieveBlockedSurplusForceKg:
        fishRetrieveResult?.blockedSurplusForceKg,
      fishRetrieveLineTensionKg: fishRetrieveResult?.lineTensionKg,
      fishRetrieveBalanceState: fishRetrieveResult?.balanceState,
      fishRetrieveMovementBlocked: fishRetrieveResult?.movementBlocked,
      fishRetrieveDesiredMoveMeters: fishRetrieveResult?.desiredMoveMeters,
      fishRetrieveAppliedMoveMeters: fishRetrieveResult?.appliedMoveMeters,
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
      tensionMode: tensionResult.mode,
      rawTensionKg: tensionResult.rawTensionKg,
      movementAuthority: forceData.player.movementAuthority,
      playerForceKg: forceData.player.forceKg,
      activeEffectivePullKg: fishRetrieveResult?.passiveRetrieveTensionKg ?? 0,
      activeNetPullKg: fishRetrieveResult?.passiveRetrieveTensionKg ?? 0,
      pullCapacityKg: forceData.player.pullCapacityKg,
      effectivePullKg: fishRetrieveResult?.usefulPullForceKg ?? 0,
      netPullKg: fishRetrieveResult?.usefulPullForceKg ?? 0,
      legacyEffectivePullKg: forceData.player.legacyEffectivePullKg,
      legacyNetPullKg: forceData.player.legacyNetPullKg,
      dragLimitKg: dragContext.effectiveDragLimitKg,
      rawDragLimitKg: forceData.player.dragLimitKg,
      dragLocked: dragContext.dragLocked,
      dragHoldRatio: forceData.player.dragHoldRatio,
      canDragHoldFish: forceData.player.canDragHoldFish,
      rodPullCanWinDistance: rodPullResult.canMoveFish,
      legacyCanWinDistance: forceData.player.legacyCanWinDistance,
      shouldSlipDrag: forceData.player.shouldSlipDrag,
      staminaPressureRatio: forceData.player.staminaPressureRatio,
      playerForceY: Math.abs(rodPullResult.forceKg),
      playerForceX: 0,
      fishForceY: Math.abs(forceData.totalFishForceKg * (forceData.targetVelocity.y < 0 ? -1 : 1)),
      fishForceX: Math.abs(forceData.totalFishForceKg * (forceData.targetVelocity.x ? Math.sign(forceData.targetVelocity.x) : 0)),
      playerMaxPowerY: stressSystem.getEffectiveMaxTackleLoadKg?.() || 0,
      playerMaxPowerX:
        (stressSystem.getEffectiveMaxTackleLoadKg?.() || 0) *
        (physics.playerSteeringMultiplier ?? 1.5),
      lineConstrained: constraintResult.constrained,
      fightMode: isPullMode ? "pull" : isRecoverMode ? "recover" : "free",
      retrieveActive: isRecoverMode,
      playerPulling: forceData.player.isPulling,
      currentTensionKg: stressSystem.getTensionKg(),
      fishForceKg: forceData.totalFishForceKg,
      calculatedTensionKg: tensionResult.tensionKg,
    };
  }

  #lineHasReserve(lineState) {
    if (typeof lineState?.canReleaseLine === "boolean") return lineState.canReleaseLine;
    return (Number(lineState?.remainingMeters) || 0) > 0.001;
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

}
