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
    const releasedMeters = lineSystem.releaseForDistance(forceData.effectiveDragRatio ?? dragSystem.value);

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

    const staminaPressureRatio = this.#calculateStaminaPressureRatio({
      forceData,
      lineState: lineStateBeforeRecover,
      hasReel,
      isPullMode,
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
      netPullKg: forceData.player.netPullKg,
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
      staminaPressureRatio,
      hasEffectiveStaminaPressure: staminaPressureRatio > 0.01,
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
      staminaPressureRatio,
      isLineFullyExtended: lineState.isLineFullyExtended,
      forceData: {
        ...forceData,
        staminaPressureRatio,
        isLineFullyExtended: lineState.isLineFullyExtended,
      },
    };
  }

  getDebugData() {
    return this.#debug;
  }

  #calculateStaminaPressureRatio({
    forceData,
    lineState,
    hasReel,
    isPullMode,
    constrained,
  }) {
    if (!isPullMode) return 0;

    const lineLocked = !!lineState?.isFullyExtended || !!constrained;
    const transferRatio = Math.max(
      0,
      Math.min(1, Number(forceData?.player?.transferRatio) || 0),
    );

    // З котушкою і drag = 0% тяга гравця не передається рибі,
    // доки є вільна ліска. Якщо ліска закінчилась, сама довжина
    // ліски стає жорстким обмеженням і знову створює реальний тиск.
    if (hasReel) {
      return lineLocked ? 1 : transferRatio;
    }

    // Без котушки немає вільної здачі ліски фрикціоном, тому тиск
    // залежить від здатності снасті реально стримувати рибу.
    return lineLocked ? Math.max(transferRatio, 1) : transferRatio;
  }

  #calculateTensionKg({ forceData, lineState, dragRatio, hasReel, isPullMode, physics, constrained }) {
    const clampedDrag = Math.max(0, Math.min(1, Number(dragRatio) || 0));
    const isFullyExtended = !!lineState.isFullyExtended;
    const dragPower = physics.drag?.tensionGrowthPower ?? 1.6;

    let lineConstraintRatio = 0;
    if (isFullyExtended || constrained) {
      lineConstraintRatio = 1;
    } else if (hasReel) {
      lineConstraintRatio = Math.pow(clampedDrag, dragPower);
    } else {
      lineConstraintRatio = lineState.lineExtensionRatio;
    }

    const fishOppositionBonus = forceData.opposition > 0
      ? 1 + Math.max(0, forceData.opposition) * 0.35
      : 1;
    const fishComponentKg =
      (forceData.staticFishForceKg + forceData.dynamicFishForceKg * fishOppositionBonus) *
      lineConstraintRatio;

    const pullComponentKg = isPullMode
      ? forceData.player.effectivePullKg * (hasReel ? clampedDrag : 1)
      : 0;

    return Math.max(0, fishComponentKg + pullComponentKg);
  }
}
