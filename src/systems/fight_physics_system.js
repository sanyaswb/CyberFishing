class FightPhysicsSystem {
  #config;
  #velocityScratch = new Vector2(0, 0);
  #slackCalculator = new SlackCalculator();
  #debug = {};

  constructor(config) {
    this.#config = config || {};
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
      dragContext,
      lineState: rodPullFrame.lineStateAfterPull,
      hardLineLimit: rodPullFrame.hardLineLimitBeforeRelease,
    });
    const recoveredMeters = this.#recoverSlack({
      dtSec,
      reelSystem,
      lineSystem,
      reel,
      tensionKg: tensionPreview.tensionKg,
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
    rodPullSystem.syncStrokeToSlack?.({ slackMeters: lineLimit.finalSlackMeters });
    const tensionResult = this.#updateTension({
      tensionSystem,
      stressSystem,
      forceData,
      rodPullResult: rodPullFrame.rodPullResult,
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
      finalSlackMeters: lineLimit.finalSlackMeters,
      initialSlackMeters: rodPullFrame.slackMeters,
      releaseResult: lineLimit.releaseResult,
      recoveredMeters,
      hardLineLimit: lineLimit.hardLineLimit,
      constraintResult: lineLimit.constraintResult,
      rodPullDisplay,
      rodPullResult: rodPullFrame.rodPullResult,
      rodPullMoveMeters: rodPullFrame.rodPullMoveMeters,
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
    lineSystem.updateDistance(fishPosition, rodTipPosition);

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

  #resolveDragContext({ hasReel, dragSystem, forceData, maxTackleLoadKg }) {
    const clampedDrag = Math.max(0, Math.min(1, Number(dragSystem.value) || 0));
    const player = forceData?.player || {};
    const fallbackDragLimitKg = hasReel
      ? Number(player.dragLimitKg) || 0
      : maxTackleLoadKg;
    const effectiveDragLimitKg = Number.isFinite(Number(player.effectiveDragLimitKg))
      ? Number(player.effectiveDragLimitKg)
      : fallbackDragLimitKg;
    const dragLocked = typeof player.dragLocked === "boolean"
      ? player.dragLocked
      : (!hasReel || clampedDrag >= 0.999);

    return {
      clampedDrag,
      maxTackleLoadKg,
      effectiveDragLimitKg,
      dragLocked,
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
    const slackMeters = this.#slackCalculator.calculate({
      releasedMeters: lineStateBeforePull.releasedMeters,
      fishDistanceMeters: lineStateBeforePull.distanceMeters,
    });
    const rodPullResult = rodPullSystem.update({
      dtSec,
      inputState: pullInput,
      rod,
      slackMeters,
      fishForceKg: forceData.totalFishForceKg,
      dragLimitKg: dragContext.effectiveDragLimitKg,
      maxTackleLoadKg: dragContext.maxTackleLoadKg,
      dragLocked: dragContext.dragLocked,
      hardLineLimit: lineStateBeforePull.isFullyExtended,
      fishDistanceMeters: lineStateBeforePull.distanceMeters,
    });
    const rodPullMoveMeters = this.#applyRodPullMovement({
      floatEntity,
      rodTipPosition,
      deltaMeters: rodPullResult.canMoveFish ? rodPullResult.deltaMeters : 0,
      pixelsPerMeter: physics.pixelsPerMeter || 50,
      bounds,
      checkWater,
    });
    rodPullSystem.recordAppliedStroke?.({ movedMeters: rodPullMoveMeters });
    const lineStateAfterPull = lineSystem.updateDistance(
      floatEntity.getPosition(),
      rodTipPosition,
    );

    return {
      lineStateBeforePull,
      lineStateAfterPull,
      slackMeters,
      rodPullResult,
      rodPullMoveMeters,
      hardLineLimitBeforeRelease: !!lineStateAfterPull.isFullyExtended,
    };
  }

  #updateTension({
    tensionSystem,
    stressSystem,
    forceData,
    rodPullResult,
    dragContext,
    lineState,
    hardLineLimit,
    dtSec,
  }) {
    const tensionResult = this.#calculateTension({
      tensionSystem,
      forceData,
      rodPullResult,
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
    dragContext,
    lineState,
    hardLineLimit,
  }) {
    const lineHasReserve = (lineState.remainingMeters || 0) > 0.001;
    return tensionSystem.calculate({
      fishForceKg: forceData.totalFishForceKg,
      rodPullForceKg: rodPullResult.forceKg,
      dragLimitKg: dragContext.effectiveDragLimitKg,
      hardLineLimit: !!hardLineLimit,
      lineHasReserve,
      dragLocked: dragContext.dragLocked,
      slackMeters: lineState.slackMeters,
    });
  }

  #recoverSlack({ dtSec, reelSystem, lineSystem, reel, tensionKg, isRecoverMode }) {
    return reelSystem.recoverSlack({
      dtSec,
      lineSystem,
      reel,
      tensionKg,
      inputRecover: isRecoverMode,
    });
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
    const finalSlackMeters = this.#slackCalculator.calculate({
      releasedMeters: lineState.releasedMeters,
      fishDistanceMeters: lineState.distanceMeters,
    });

    return {
      releaseResult,
      constraintResult,
      lineState,
      hardLineLimit,
      finalSlackMeters,
    };
  }

  #buildDebugSnapshot({
    forceData,
    dragSystem,
    lineState,
    finalSlackMeters,
    initialSlackMeters,
    releaseResult,
    recoveredMeters,
    hardLineLimit,
    constraintResult,
    rodPullDisplay,
    rodPullResult,
    rodPullMoveMeters,
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
      lineReleasedMeters: lineState.releasedMeters,
      lineRemainingMeters: lineState.remainingMeters,
      lineMaxRemainingMeters: lineState.maxRemainingMeters,
      lineBaseReachMeters: lineState.baseReachMeters,
      lineTotalLengthMeters: lineState.totalLengthMeters,
      lineSlackMeters: lineState.slackMeters,
      isLineFullyExtended: lineState.isFullyExtended,
      lineExtensionRatio: lineState.lineExtensionRatio,
      lineDistanceMeters: lineState.distanceMeters,
      slackMeters: finalSlackMeters,
      slackPenaltyMeters: initialSlackMeters,
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
      activeEffectivePullKg: rodPullResult.forceKg,
      activeNetPullKg: rodPullResult.forceKg,
      pullCapacityKg: forceData.player.pullCapacityKg,
      effectivePullKg: forceData.player.legacyEffectivePullKg,
      netPullKg: forceData.player.legacyNetPullKg,
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
      return 0;
    }

    const appliedPx = Math.hypot(next.x - position.x, next.y - position.y);
    position.x = next.x;
    position.y = next.y;
    return appliedPx / scale;
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
