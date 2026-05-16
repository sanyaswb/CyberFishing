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
    const dtSec = Math.min(
      Math.max(0, Number(dtMs) || 0),
      physics.maxDtMs ?? 50,
    ) / 1000;

    const pullInput = pullInputMapper?.update(input) || {
      pullHeld: !!input?.isPulling,
      pullStartedThisFrame: !!input?.isPulling,
      pullReleasedThisFrame: false,
    };
    dragSystem.update(input, dtSec);

    const hasReel = !!reel?.hasReel?.();
    const isPullMode = !!pullInput.pullHeld;
    const isRecoverMode = hasReel && !isPullMode;

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
      playerMaxLoadKg: stressSystem.getEffectiveMaxTackleLoadKg?.(),
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

    const lineStateBeforePull = lineSystem.updateDistance(
      floatEntity.getPosition(),
      rodTipPosition,
    );
    const slackMeters = this.#slackCalculator.calculate({
      releasedMeters: lineStateBeforePull.releasedMeters,
      fishDistanceMeters: lineStateBeforePull.distanceMeters,
    });
    const clampedDrag = Math.max(0, Math.min(1, Number(dragSystem.value) || 0));
    const dragLocked = hasReel && clampedDrag >= 0.999;
    const rodPullResult = rodPullSystem.update({
      dtSec,
      inputState: pullInput,
      rod,
      slackMeters,
      fishForceKg: forceData.totalFishForceKg,
      dragLimitKg: forceData.player.dragLimitKg,
      maxTackleLoadKg: stressSystem.getEffectiveMaxTackleLoadKg?.() || 0,
      dragLocked,
      hardLineLimit: lineStateBeforePull.isFullyExtended,
      fishDistanceMeters: lineStateBeforePull.distanceMeters,
    });

    const rodPullMoveMeters = this.#applyRodPullMovement({
      floatEntity,
      rodTipPosition,
      deltaMeters: rodPullResult.canMoveFish ? rodPullResult.deltaMeters : 0,
      pixelsPerMeter: physics.pixelsPerMeter || 50,
    });

    const lineStateAfterPull = lineSystem.updateDistance(
      floatEntity.getPosition(),
      rodTipPosition,
    );
    const hardLineLimitBeforeRelease = !!lineStateAfterPull.isFullyExtended;
    const lineHasReserveBeforeRelease = (lineStateAfterPull.remainingMeters || 0) > 0.001;
    const tensionResult = tensionSystem.calculate({
      fishForceKg: forceData.totalFishForceKg,
      rodPullForceKg: rodPullResult.forceKg,
      dragLimitKg: forceData.player.dragLimitKg,
      hardLineLimit: hardLineLimitBeforeRelease,
      lineHasReserve: lineHasReserveBeforeRelease,
      dragLocked,
    });

    stressSystem.updateTarget(tensionResult.tensionKg, dtSec, this.#config.tension || {});

    // Recover mode: reel only takes up slack after rod-pull release. It never moves fish.
    const recoveredMeters = reelSystem.recoverSlack({
      dtSec,
      lineSystem,
      reel,
      tensionKg: stressSystem.getTensionKg(),
      inputRecover: isRecoverMode,
    });

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
    const rodPullDisplay = rodPullSystem.updateReleaseRecovery({
      slackMeters: finalSlackMeters,
    });

    this.#debug = {
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
      slackPenaltyMeters: slackMeters,
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
      availableExtraForceKg: rodPullDisplay.availableExtraForceKg,
      reelRecoveringSlack: recoveredMeters > 0,
      tensionMode: tensionResult.mode,
      rawTensionKg: tensionResult.rawTensionKg,
      playerForceKg: forceData.player.forceKg,
      effectivePullKg: forceData.player.effectivePullKg,
      pullCapacityKg: forceData.player.pullCapacityKg,
      netPullKg: forceData.player.netPullKg,
      dragLimitKg: forceData.player.dragLimitKg,
      dragHoldRatio: forceData.player.dragHoldRatio,
      canDragHoldFish: forceData.player.canDragHoldFish,
      canWinDistance: forceData.player.canWinDistance,
      shouldSlipDrag: forceData.player.shouldSlipDrag,
      staminaPressureRatio: forceData.player.staminaPressureRatio,
      playerForceY: Math.abs(forceData.player.vector.y),
      playerForceX: Math.abs(forceData.player.vector.x),
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
    stressSystem.setDebugData(this.#debug);

    return {
      consumedSwipe: false,
      forces: {
        pX: 0,
        pY: rodPullResult.forceKg,
        fX: forceData.targetVelocity.x,
        fY: forceData.targetVelocity.y,
      },
      pMax: this.#debug.playerMaxPowerY,
      fMag: forceData.totalFishForceKg,
      forceData,
    };
  }

  #applyRodPullMovement({ floatEntity, rodTipPosition, deltaMeters, pixelsPerMeter }) {
    const meters = Math.max(0, Number(deltaMeters) || 0);
    if (meters <= 0) return 0;

    const position = floatEntity.getPosition();
    const dx = rodTipPosition.x - position.x;
    const dy = rodTipPosition.y - position.y;
    const distancePx = Math.hypot(dx, dy);
    if (distancePx <= 0.001) return 0;

    const movePx = Math.min(distancePx, meters * Math.max(1, Number(pixelsPerMeter) || 50));
    position.x += (dx / distancePx) * movePx;
    position.y += (dy / distancePx) * movePx;
    return movePx / Math.max(1, Number(pixelsPerMeter) || 50);
  }

  getDebugData() {
    return this.#debug;
  }

}
