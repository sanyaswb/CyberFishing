class FightPhysicsSystem {
  #config;
  #velocityScratch = new Vector2(0, 0);
  #playerVelocityDelta = new Vector2(0, 0);
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
    stressSystem,
    fishCondition,
    buffs,
  }) {
    const physics = this.#config.physics || {};
    const dtSec = Math.min(
      Math.max(0, Number(dtMs) || 0),
      physics.maxDtMs ?? 50,
    ) / 1000;

    dragSystem.update(input, dtSec);

    const hasReel = !!reel?.hasReel?.();
    const isPullMode = !!input?.isPulling;
    const isRecoverMode =
      hasReel &&
      !isPullMode &&
      (!!input?.retrieve || (!input?.pointerDown && physics.drag?.autoRetrieveEnabled !== false));

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

    // Pull mode: the rod can move fish only with the net won force. With reel drag 0%,
    // FishForceSystem returns netPullKg = 0, so pulling does not move fish.
    const forceToAcceleration = physics.forceKgToPxPerSec2 ?? 75;
    this.#playerVelocityDelta.set(
      forceData.player.vector.x * forceToAcceleration * dtSec,
      forceData.player.vector.y * forceToAcceleration * dtSec,
    );
    velocity.add(this.#playerVelocityDelta);

    floatEntity.update(
      bounds,
      dtMs,
      env,
      checkWater,
      input,
      0,
      forceData.player.pullDir,
    );

    // After natural/fish movement, the reel may give line. At drag 0%, it gives all
    // demanded excess while line remains, so no tension/constraint is created.
    lineSystem.updateDistance(floatEntity.getPosition(), rodTipPosition);
    const releasedMeters = lineSystem.releaseForDistance({
      dragRatio: dragSystem.value,
      shouldSlip: forceData.player.shouldSlipDrag,
      slipReleaseRatio: forceData.player.shouldSlipDrag ? 1 : 0,
      creepReleaseRatio: physics.drag?.creepReleaseRatio ?? 0,
    });

    const constrained = lineSystem.constrainPosition(
      floatEntity.getPosition(),
      floatEntity.getVelocity?.() || velocity,
      rodTipPosition,
    );
    const lineStateBeforeRecover = lineSystem.updateDistance(
      floatEntity.getPosition(),
      rodTipPosition,
    );

    const tensionKg = this.#calculateTensionKg({
      forceData,
      lineState: lineStateBeforeRecover,
      dragRatio: dragSystem.value,
      hasReel,
      isPullMode,
      physics,
      constrained,
    });

    stressSystem.updateTarget(tensionKg, dtSec, this.#config.tension || {});

    // Recover mode: reel only takes up slack that already exists. It never pulls fish
    // below current distance. No reel => release finger does nothing.
    const recoveredMeters = lineSystem.recoverSlack({
      hasReel,
      inputRecover: isRecoverMode,
      reel,
      tensionKg: stressSystem.getTensionKg(),
      dtSec,
    });

    const lineState = lineSystem.updateDistance(floatEntity.getPosition(), rodTipPosition);

    this.#debug = {
      ...forceData.debug,
      ...dragSystem.getDebugData(),
      lineReleasedMeters: lineState.releasedMeters,
      lineRemainingMeters: lineState.remainingMeters,
      lineTotalLengthMeters: lineState.totalLengthMeters,
      lineSlackMeters: lineState.slackMeters,
      isLineFullyExtended: lineState.isFullyExtended,
      lineExtensionRatio: lineState.lineExtensionRatio,
      lineDistanceMeters: lineState.distanceMeters,
      lineReleasedThisFrameMeters: releasedMeters,
      lineRecoveredThisFrameMeters: recoveredMeters,
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
      lineConstrained: constrained,
      fightMode: isPullMode ? "pull" : isRecoverMode ? "recover" : "free",
      retrieveActive: isRecoverMode,
      playerPulling: forceData.player.isPulling,
      calculatedTensionKg: tensionKg,
    };
    stressSystem.setDebugData(this.#debug);

    return {
      consumedSwipe: false,
      forces: {
        pX: forceData.player.vector.x,
        pY: forceData.player.vector.y,
        fX: forceData.targetVelocity.x,
        fY: forceData.targetVelocity.y,
      },
      pMax: this.#debug.playerMaxPowerY,
      fMag: forceData.totalFishForceKg,
      forceData,
    };
  }

  getDebugData() {
    return this.#debug;
  }

  #calculateTensionKg({ forceData, lineState, dragRatio, hasReel, isPullMode, physics, constrained }) {
    const fishForceKg = Math.max(0, Number(forceData.totalFishForceKg) || 0);
    const pullCapacityKg = isPullMode
      ? Math.max(0, Number(forceData.player.pullCapacityKg) || 0)
      : 0;

    // Line tension is the currently resisted load, not fish + player added together.
    // Example: fish pulls 5kg, drag limit is 10kg => tension is 5kg, not 15kg.
    const rawDemandKg = Math.max(fishForceKg, pullCapacityKg);

    if (!hasReel) {
      const lineConstraintRatio = lineState.isFullyExtended || constrained
        ? 1
        : Math.max(lineState.lineExtensionRatio || 0, isPullMode ? 1 : 0);
      return rawDemandKg * lineConstraintRatio;
    }

    const dragLimitKg = Math.max(0, Number(forceData.player.dragLimitKg) || 0);
    const reelCanGiveLine = (lineState.remainingMeters || 0) > 0.001;

    // While the reel can give line, drag is a hard kg limiter:
    // drag 10% of 10kg => tension cannot exceed 1kg; all excess force spools line.
    if (reelCanGiveLine && !lineState.isFullyExtended && !constrained) {
      return Math.min(rawDemandKg, dragLimitKg);
    }

    // If the line is fully out, the reel can no longer compensate. Now the rig takes
    // the actual demand and can break even with low drag.
    return rawDemandKg;
  }
}
