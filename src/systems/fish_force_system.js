class FishForceSystem {
  #fish;
  #config;
  #scratchA = new Vector2(0, 0);
  #scratchB = new Vector2(0, 0);
  #scratchC = new Vector2(0, 0);
  #targetVelocity = new Vector2(0, 0);
  #playerVector = new Vector2(0, 0);
  #playerPullDir = new Vector2(0, 0);
  #lineDir = new Vector2(0, 0);
  #debug = {};

  constructor({ fish, config }) {
    this.#fish = fish;
    this.#config = config || {};
  }

  calculate({
    dtMs,
    fishPosition,
    fishVelocity,
    rodTipPosition,
    fishCondition,
    dragRatio,
    input,
    rod,
    reel,
    playerMaxLoadKg,
    env,
    buffs,
  }) {
    const physics = this.#config.physics || {};
    const fishPhysics = this.#fish.getPhysicsConfig?.() || {};
    const pixelsPerMeter = Math.max(1, Number(physics.pixelsPerMeter) || 50);
    const behavior = this.#fish.getBehavior(dtMs);

    const behaviorPowerRatio = Math.max(
      0,
      Number(behavior.powerRatio ?? behavior.pullMult) || 1,
    );
    const behaviorSpeedRatio = this.#clamp01(
      behavior.speedRatio ?? Math.abs(behavior.moveX || 0),
    );

    const staminaRatio = fishCondition?.maxPoints
      ? this.#clamp01(fishCondition.currentStamina / fishCondition.maxPoints)
      : 1;
    const exhaustionProgress = fishCondition?.maxPoints
      ? this.#clamp01(
          1 - fishCondition.currentExhaustion / fishCondition.maxPoints,
        )
      : 0;

    const awayDir = this.#scratchB
      .set(fishPosition.x - rodTipPosition.x, fishPosition.y - rodTipPosition.y)
      .normalize();
    if (awayDir.length() <= 0.001) awayDir.set(0, -1);

    const lateralSign = Math.sign(Number(behavior.moveX) || 0) || 1;
    const lateralDir = this.#scratchC.set(-awayDir.y, awayDir.x).normalize();
    lateralDir.multiplyScalar(lateralSign);

    const awayIntent = this.#clamp01(
      (fishPhysics.awayIntentBase ?? physics.fishAwayIntentBase ?? 0.25) +
        behaviorPowerRatio *
          (fishPhysics.awayIntentPowerScale ??
            physics.fishAwayIntentPowerScale ??
            0.45),
    );
    const lateralIntent =
      Math.abs(Number(behavior.moveX) || 0) *
      (fishPhysics.lateralIntentMultiplier ??
        physics.fishLateralIntentMultiplier ??
        0.9);

    const moveDir = this.#scratchA.set(
      awayDir.x * awayIntent + lateralDir.x * lateralIntent,
      awayDir.y * awayIntent + lateralDir.y * lateralIntent,
    );
    if (moveDir.length() <= 0.001) moveDir.set(awayDir.x, awayDir.y);
    moveDir.normalize();

    const currentVelocity = this.#getCurrentVelocityPxPerSec(
      env,
      physics,
      fishPhysics,
    );
    const relativeVelocityX = (fishVelocity?.x || 0) - currentVelocity.x;
    const relativeVelocityY = (fishVelocity?.y || 0) - currentVelocity.y;
    const relativeSpeedMps =
      Math.hypot(relativeVelocityX, relativeVelocityY) / pixelsPerMeter;

    const velocityLength = Math.hypot(relativeVelocityX, relativeVelocityY);
    const velocityDirX =
      velocityLength > 0.001 ? relativeVelocityX / velocityLength : moveDir.x;
    const velocityDirY =
      velocityLength > 0.001 ? relativeVelocityY / velocityLength : moveDir.y;
    const opposition = velocityDirX * awayDir.x + velocityDirY * awayDir.y;
    const directionMultiplier = this.#directionMultiplier(
      opposition,
      physics.directionForce,
    );

    const staticForceKg =
      this.#fish.getCurrentStaticPowerKg?.() ||
      this.#fish.getStaticPowerKg?.() ||
      this.#fish.getPower?.() ||
      1;

    const fishWeightKg = Math.max(0.001, Number(this.#fish.getWeight?.()) || 1);
    const baseSpeedPxPerSec =
      this.#fish.getBaseSpeedPxPerSec?.(pixelsPerMeter) || 100;
    const baseSpeedMps = baseSpeedPxPerSec / pixelsPerMeter;

    // Stamina is only activity efficiency. It must not turn the fish into a dead object.
    const staminaActivityMultiplier = this.#lerp(
      fishPhysics.minStaminaActivityMultiplier ??
        physics.fishMinStaminaActivityMultiplier ??
        0.8,
      1,
      staminaRatio,
    );

    // Exhaustion slows active movement, while real kg weakening comes from Fish powerDebuff.
    const exhaustionSpeedMultiplier = this.#lerp(
      1,
      fishPhysics.exhaustedSpeedRatio ?? physics.fishExhaustedSpeedRatio ?? 0.6,
      exhaustionProgress,
    );

    const behaviorTargetSpeedPxPerSec =
      baseSpeedPxPerSec *
      behaviorSpeedRatio *
      staminaActivityMultiplier *
      exhaustionSpeedMultiplier;

    const stateMovementForceMultiplier =
      fishPhysics.stateMovementForceMultiplier ??
      physics.fishStateMovementForceMultiplier ??
      0.35;
    const velocityForceMultiplier =
      fishPhysics.velocityForceMultiplier ??
      physics.fishVelocityForceMultiplier ??
      1.0;
    const speedForceMultiplier = fishPhysics.speedForceMultiplier ?? 0.35;
    const waterResistanceMultiplier =
      (fishPhysics.waterResistanceMultiplier ?? 1.0) *
      (physics.waterResistanceKgPerKgPerMps ?? 0.08);

    // This is the missing layer: states must create active kg pressure, not only velocity.
    // rest/idle/swim/dash now produce different force even before the velocity catches up.
    const stateMovementForceKg =
      staticForceKg *
      behaviorSpeedRatio *
      Math.max(0.1, behaviorPowerRatio) *
      stateMovementForceMultiplier *
      directionMultiplier;

    const velocityDynamicForceKg =
      fishWeightKg *
      relativeSpeedMps *
      speedForceMultiplier *
      waterResistanceMultiplier *
      velocityForceMultiplier *
      directionMultiplier;

    const dynamicFishForceKg = Math.max(
      0,
      stateMovementForceKg + velocityDynamicForceKg,
    );

    const minPowerRatio = fishPhysics.minPowerRatio ?? 0.25;
    const behaviorStaticForceKg = staticForceKg * behaviorPowerRatio;
    const totalFishForceKg = Math.max(
      staticForceKg * minPowerRatio,
      behaviorStaticForceKg + dynamicFishForceKg,
    );

    const playerData = this.calculatePlayerForce({
      fishPosition,
      rodTipPosition,
      input,
      rod,
      reel,
      buffs,
      physics,
      totalFishForceKg,
      playerMaxLoadKg,
      dragRatio,
    });

    const awayFromPlayerRatio = Math.max(
      0,
      moveDir.x * awayDir.x + moveDir.y * awayDir.y,
    );
    const minEscape = physics.drag?.yEscapeSpeedAtFullDrag ?? 0.02;
    const escapeSpeedMultiplier =
      1 -
      playerData.effectiveDragRatio * awayFromPlayerRatio * (1 - minEscape);

    const speedPxPerSec =
      behaviorTargetSpeedPxPerSec * Math.max(minEscape, escapeSpeedMultiplier);

    this.#targetVelocity.set(moveDir.x * speedPxPerSec, moveDir.y * speedPxPerSec);

    this.#debug = {
      fishState: behavior.name,
      fishBasePower: staticForceKg,
      fishInitialPower: this.#fish.getInitialPower?.() || staticForceKg,
      pullMult: behaviorPowerRatio,
      moveMult: behaviorSpeedRatio,
      behaviorStaticForceKg,
      stateMovementForceKg,
      velocityDynamicForceKg,
      staticFishForceKg: staticForceKg,
      dynamicFishForceKg,
      totalFishForceKg,
      fishSpeedPxPerSec: speedPxPerSec,
      behaviorTargetSpeedPxPerSec,
      staminaRatio,
      staminaActivityMultiplier,
      exhaustionProgress,
      exhaustionSpeedMultiplier,
      opposition,
      directionResistanceMultiplier: directionMultiplier,
      awayFromPlayerRatio,
      dragRatio: this.#clamp01(dragRatio),
      effectiveDragRatio: playerData.effectiveDragRatio,
      restrainRatio: playerData.restrainRatio,
      transferRatio: playerData.transferRatio,
      anglePenalty: playerData.anglePenalty,
      angleStressRatio: playerData.angleStressRatio,
      angleDeg: playerData.angleDeg,
      currentVelocityX: currentVelocity.x,
      currentVelocityY: currentVelocity.y,
      relativeSpeedMps,
      baseSpeedMps,
    };

    return {
      behavior,
      targetVelocity: this.#targetVelocity,
      staticFishForceKg: staticForceKg,
      behaviorStaticForceKg,
      stateMovementForceKg,
      velocityDynamicForceKg,
      dynamicFishForceKg,
      totalFishForceKg,
      opposition,
      awayFromPlayerRatio,
      effectiveDragRatio: playerData.effectiveDragRatio,
      linePullRatio: playerData.transferRatio,
      player: playerData,
      debug: this.#debug,
    };
  }

  calculatePlayerForce({
    fishPosition,
    rodTipPosition,
    input,
    rod,
    reel,
    buffs,
    physics,
    totalFishForceKg,
    playerMaxLoadKg,
    dragRatio,
  }) {
    const basePullDir = this.#playerPullDir
      .set(rodTipPosition.x - fishPosition.x, rodTipPosition.y - fishPosition.y)
      .normalize();

    const inputDir = input?.pullDirection;
    const steerX = Number(inputDir?.x) || 0;
    if (Math.abs(steerX) > 0.001) {
      basePullDir.x += steerX * (physics.inputSteeringBlend ?? 0.35);
      basePullDir.normalize();
    }

    const lineDir = this.#lineDir
      .set(fishPosition.x - rodTipPosition.x, fishPosition.y - rodTipPosition.y)
      .normalize();
    const idealDir = { x: 0, y: -1 };
    const dot = Math.max(
      -1,
      Math.min(1, lineDir.x * idealDir.x + lineDir.y * idealDir.y),
    );
    const angleDeg = (Math.acos(dot) * 180) / Math.PI;
    const angleCfg = physics.rodAnglePenalty || {};
    const noPenalty = angleCfg.noPenaltyAngleDeg ?? 15;
    const maxPenaltyAngle = angleCfg.maxPenaltyAngleDeg ?? 75;
    const angleStressRatio = this.#clamp01(
      (angleDeg - noPenalty) / Math.max(1, maxPenaltyAngle - noPenalty),
    );
    const maxPenaltyMult = angleCfg.maxPenaltyMultiplier ?? 0.65;
    const anglePenalty =
      angleCfg.enabled === false
        ? 1
        : this.#lerp(1.0, maxPenaltyMult, angleStressRatio);

    const hasReel = !!reel?.hasReel?.();
    const isRecoverOnly = hasReel && !!input?.retrieve && !input?.pointerDown;
    const isPlayerPulling = !!input?.isPulling && !isRecoverOnly;

    const fallbackRodKg =
      Number(rod?.getEffectiveMaxLoadKg?.()) || Number(rod?.getMaxLoadKg?.()) || 0;
    const fallbackReelKg = hasReel
      ? Number(reel?.getEffectiveMaxLoadKg?.()) ||
        Number(reel?.getMaxLoadKg?.()) ||
        fallbackRodKg
      : fallbackRodKg;
    const baseForceKg = Math.max(
      0,
      Number(playerMaxLoadKg) ||
        (hasReel ? (fallbackRodKg + fallbackReelKg) / 2 : fallbackRodKg),
    );
    const maxPlayerForceKg =
      baseForceKg * anglePenalty * (buffs?.getTotalMultiplier?.() || 1);

    const restrainRatio = this.#clamp01(
      maxPlayerForceKg / Math.max(0.001, totalFishForceKg || 0),
    );
    const clampedDrag = this.#clamp01(dragRatio);
    const transferRatio = hasReel ? clampedDrag * restrainRatio : restrainRatio;
    const effectiveDragRatio = hasReel ? clampedDrag * restrainRatio : restrainRatio;
    const effectivePullKg = isPlayerPulling ? maxPlayerForceKg * transferRatio : 0;
    const netPullKg = isPlayerPulling
      ? Math.max(0, effectivePullKg - Math.max(0, totalFishForceKg || 0))
      : 0;

    this.#playerVector.set(basePullDir.x * netPullKg, basePullDir.y * netPullKg);

    return {
      forceKg: maxPlayerForceKg,
      effectivePullKg,
      netPullKg,
      transferRatio,
      restrainRatio,
      effectiveDragRatio,
      vector: this.#playerVector,
      pullDir: basePullDir,
      anglePenalty,
      angleStressRatio,
      angleDeg,
      isPulling: isPlayerPulling,
    };
  }

  getDebugData() {
    return this.#debug;
  }

  #getCurrentVelocityPxPerSec(env, physics, fishPhysics) {
    const current = env?.current;
    if (!current) return { x: 0, y: 0 };

    const speed =
      Number(current.speedPxPerSec) ||
      Number(current.speed) ||
      Number(current.power) ||
      0;
    const dir = current.direction || current.dir || current.vector || { x: 0, y: 0 };
    const dx = Number(dir.x) || 0;
    const dy = Number(dir.y) || 0;
    const len = Math.hypot(dx, dy) || 1;
    const influence =
      (physics.currentResistanceMultiplier ?? 1.0) *
      (fishPhysics.currentInfluenceMultiplier ?? 1.0);

    return {
      x: (dx / len) * speed * influence,
      y: (dy / len) * speed * influence,
    };
  }

  #directionMultiplier(opposition, config = {}) {
    const same = config.sameDirectionMultiplier ?? 0.4;
    const side = config.sideDirectionMultiplier ?? 1.0;
    const opposite = config.oppositeDirectionMultiplier ?? 1.8;
    if (opposition < 0) {
      return same + (side - same) * (opposition + 1);
    }
    return side + (opposite - side) * opposition;
  }

  #lerp(a, b, t) {
    return a + (b - a) * this.#clamp01(t);
  }

  #clamp01(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
  }
}
