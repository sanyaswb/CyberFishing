class FishForceSystem {
  #fish;
  #config;
  #scratchA = new Vector2(0, 0);
  #scratchB = new Vector2(0, 0);
  #targetVelocity = new Vector2(0, 0);
  #playerForceSystem;
  #forceCalculator = new SimpleFightForceCalculator();
  #dragForceCalculator = new DragForceCalculator();
  #physicsConfig;
  #debug = {};

  constructor({ fish, config }) {
    this.#fish = fish;
    this.#config = config || {};
    this.#physicsConfig = this.#resolvePhysicsConfigAdapter(this.#config);
    this.#playerForceSystem = new PlayerForceSystem({
      physicsConfig: this.#physicsConfig,
    });
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
    activeRodHoldKg = 0,
    lineHasReserve = true,
    env,
    buffs,
  }) {
    const physics = this.#getRuntimePhysicsConfig();
    const pixelsPerMeter = Math.max(
      1,
      Number(this.#physicsConfig?.getPixelsPerMeter?.()) || 50,
    );
    const behavior = this.#fish.getBehavior(dtMs);
    const rawFishPhysics = this.#fish.getPhysicsConfig?.() || {};
    const fishPhysics =
      typeof FishPhysicsProfile !== "undefined"
        ? FishPhysicsProfile.toRuntimeConfig(rawFishPhysics)
        : rawFishPhysics;
    const lastDashDebug = this.#fish.getLastDashDebugData?.() || {};

    const maxStamina = this.#firstFiniteNumber(
      fishCondition?.maxStamina,
      fishCondition?.maxPoints,
      0,
    );
    const maxEndurance = this.#firstFiniteNumber(
      fishCondition?.maxEndurance,
      fishCondition?.maxPoints,
      0,
    );
    const staminaRatio = maxStamina
      ? this.#clamp01(fishCondition.currentStamina / maxStamina)
      : 1;
    const exhaustionProgress = maxEndurance
      ? this.#clamp01(1 - fishCondition.currentExhaustion / maxEndurance)
      : 0;

    const behaviorPullValue = this.#numberOrDefault(
      behavior.forceMultiplier ?? behavior.pullMult,
      1,
    );
    const moveDir = this.#scratchA.set(
      Number(behavior.moveX) || 0,
      -behaviorPullValue,
    );
    if (moveDir.length() <= 0.001) moveDir.set(0, -1);
    moveDir.normalize();

    const awayDir = this.#scratchB
      .set(fishPosition.x - rodTipPosition.x, fishPosition.y - rodTipPosition.y)
      .normalize();

    const currentVelocity = this.#getCurrentVelocityPxPerSec(env, physics);
    const relativeVelocityX =
      (Number(fishVelocity?.x) || 0) - (Number(currentVelocity?.x) || 0);
    const relativeVelocityY =
      (Number(fishVelocity?.y) || 0) - (Number(currentVelocity?.y) || 0);
    const relativeSpeedMps =
      Math.hypot(relativeVelocityX, relativeVelocityY) / pixelsPerMeter;
    const opposition = this.#calculateOpposition({ moveDir, awayDir });
    const directionInfo = this.#calculateDirectionInfo({
      opposition,
      directionConfig: this.#physicsConfig?.getDirectionForceConfig?.(),
    });
    const directionMultiplier = directionInfo.multiplier;
    const fishBasePower = this.#firstFiniteNumber(
      fishPhysics.forceProfile?.basePower,
      fishPhysics.basePower,
      1,
    );
    const fishBaseSpeed = this.#firstFiniteNumber(
      fishPhysics.movementProfile?.baseSpeed,
      fishPhysics.baseSpeed,
      1,
    );
    const waterConfig = this.#physicsConfig?.getWaterConfig?.() || {};
    const behaviorPowerRatio = Math.max(
      0,
      Number(behavior.forceMultiplier ?? behaviorPullValue) || 0,
    );
    const behaviorSpeedRatio = Math.max(
      0,
      Number(behavior.speedMultiplier ?? Math.abs(behavior.moveX || 0)) || 0,
    );
    const fishForceFrame = this.#forceCalculator.calculate({
      fishWeightKg: this.#fish.getWeight(),
      fishBasePower,
      fishBaseSpeed,
      fishStateForceMultiplier: behaviorPowerRatio,
      fishStateSpeedMultiplier: behaviorSpeedRatio,
      directionMultiplier,
      tautBodyResistancePerKg: waterConfig.tautBodyResistancePerKg,
      rodLimitKg: 0,
      rodHoldKg: 0,
      waterMotionResistance: waterConfig.motionResistance,
      waterSpeedMultiplier: waterConfig.speedMultiplier,
    });
    const staticForceKg = fishForceFrame.fishPassiveKg;
    const totalFishForceKg = fishForceFrame.fishOppositionKg;

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
    const hasReel = !!reel?.hasReel?.();
    const dragSupported = hasReel && reel?.hasDrag?.() !== false;
    const dragLocked = !dragSupported;

    const awayFromPlayerRatio = Math.max(0, moveDir.x * awayDir.x + moveDir.y * awayDir.y);
    const yAwayRatio = this.#calculateYAwayRatio({ moveDir, awayDir });
    const fishWonForceKg = Math.max(
      0,
      totalFishForceKg - Math.max(0, Number(activeRodHoldKg) || 0),
    );

    const staminaActivityMultiplier = this.#lerp(
      fishPhysics.staminaProfile?.minStaminaActivityMultiplier ?? 0.75,
      1,
      staminaRatio,
    );
    const exhaustionSpeedMultiplier = this.#lerp(
      1,
      fishPhysics.staminaProfile?.exhaustedSpeedRatio ?? 0.25,
      exhaustionProgress,
    );

    const speedPxPerSec = this.#dragForceCalculator.speedFromForceKg({
      forceKg: fishWonForceKg,
      waterMotionResistance: waterConfig.motionResistance,
      waterSpeedMultiplier: waterConfig.speedMultiplier,
      fishBaseSpeed,
      fishStateSpeedMultiplier: behaviorSpeedRatio,
      pixelsPerMeter,
    });
    const modelVelocityX = moveDir.x * speedPxPerSec;
    const modelVelocityY = moveDir.y * speedPxPerSec;
    const dragFrame = this.#dragForceCalculator.calculate({
      fishOppositionKg: totalFishForceKg,
      effectiveRodHoldKg: activeRodHoldKg,
      yAwayRatio,
      dragRatio: this.#clamp01(dragRatio),
      dragLimitKg: playerData.effectiveDragLimitKg,
      lineHasReserve,
      dragLocked,
      dragSupported,
      targetXSpeedPxPerSec: modelVelocityX,
      targetYSpeedPxPerSec: modelVelocityY,
      waterMotionResistance: waterConfig.motionResistance,
      waterSpeedMultiplier: waterConfig.speedMultiplier,
      fishBaseSpeed,
      fishStateSpeedMultiplier: behaviorSpeedRatio,
      pixelsPerMeter,
    });

    this.#targetVelocity.set(
      dragFrame.finalXSpeedPxPerSec,
      dragFrame.finalYSpeedPxPerSec,
    );
    const staminaPressureRatio =
      playerData.isPulling && dragFrame.fishWonYForceKg > 0
        ? this.#clamp01(dragFrame.dragBlockedForceKg / dragFrame.fishWonYForceKg)
        : 0;

    this.#debug = {
      fishState: behavior.name,
      fishWeightKg: this.#fish.getWeight(),
      fishBasePower,
      fishBaseSpeed,
      fishInitialPower: this.#fish.getInitialPower?.() || staticForceKg,
      pullMult: behaviorPowerRatio,
      moveMult: behaviorSpeedRatio,
      staticFishForceKg: staticForceKg,
      fishPassiveKg: fishForceFrame.fishPassiveKg,
      fishActiveKg: fishForceFrame.fishActiveKg,
      fishOppositionKg: fishForceFrame.fishOppositionKg,
      fishTensionKg: fishForceFrame.fishTensionKg,
      totalFishForceKg,
      fishSpeedPxPerSec: Math.hypot(this.#targetVelocity.x, this.#targetVelocity.y),
      fishSpeedMps: Math.hypot(this.#targetVelocity.x, this.#targetVelocity.y) / pixelsPerMeter,
      fishWonForceKg: dragFrame.fishWonForceKg,
      fishWonYForceKg: dragFrame.fishWonYForceKg,
      yAwayRatio: dragFrame.yAwayRatio,
      activeRodHoldKgForEscape: Math.max(0, Number(activeRodHoldKg) || 0),
      modelFishEscapeSpeedPxPerSec: speedPxPerSec,
      modelFishEscapeVelocityX: modelVelocityX,
      modelFishEscapeVelocityY: modelVelocityY,
      targetXSpeedPxPerSec: dragFrame.targetXSpeedPxPerSec,
      targetYSpeedPxPerSec: dragFrame.targetYSpeedPxPerSec,
      finalXSpeedPxPerSec: dragFrame.finalXSpeedPxPerSec,
      finalYSpeedPxPerSec: dragFrame.finalYSpeedPxPerSec,
      dragBlockedForceKg: dragFrame.dragBlockedForceKg,
      excessYForceKg: dragFrame.excessYForceKg,
      yEscapeForceKg: dragFrame.yEscapeForceKg,
      dragSlowedYSpeedPxPerSec: dragFrame.dragSlowedYSpeedPxPerSec,
      excessYSpeedPxPerSec: dragFrame.excessYSpeedPxPerSec,
      dragCanBeExceeded: dragFrame.dragCanBeExceeded,
      shouldSlipDrag: dragFrame.shouldSlipDrag,
      staminaPressureRatio,
      staminaRatio,
      staminaActivityMultiplier,
      exhaustionProgress,
      exhaustionSpeedMultiplier,
      opposition,
      directionResistanceMultiplier: directionMultiplier,
      fishDirectionState: directionInfo.name,
      awayFromPlayerRatio,
      dragRatio: this.#clamp01(dragRatio),
      dragLimitKg: playerData.dragLimitKg,
      effectiveDragLimitKg: playerData.effectiveDragLimitKg,
      dragLocked,
      hasReel,
      anglePenalty: playerData.anglePenalty,
      angleStressRatio: playerData.angleStressRatio,
      angleDeg: playerData.angleDeg,
      currentVelocityX: currentVelocity.x,
      currentVelocityY: currentVelocity.y,
      relativeSpeedMps,
      lastDash: lastDashDebug,
      lastDashActive: behavior.name === (lastDashDebug.stateName || "lastDash"),
      lastDashInZone: !!lastDashDebug.inZone,
    };

    return {
      behavior,
      targetVelocity: this.#targetVelocity,
      fishWeightKg: this.#fish.getWeight(),
      fishPhysicsConfig: fishPhysics,
      staticFishForceKg: staticForceKg,
      fishPassiveKg: fishForceFrame.fishPassiveKg,
      fishActiveKg: fishForceFrame.fishActiveKg,
      fishOppositionKg: fishForceFrame.fishOppositionKg,
      fishTensionKg: fishForceFrame.fishTensionKg,
      fishBasePower,
      fishBaseSpeed,
      fishStateForceMultiplier: behaviorPowerRatio,
      fishStateSpeedMultiplier: behaviorSpeedRatio,
      directionResistanceMultiplier: directionMultiplier,
      fishDirectionState: directionInfo.name,
      waterMotionResistance: waterConfig.motionResistance,
      waterSpeedMultiplier: waterConfig.speedMultiplier,
      totalFishForceKg,
      opposition,
      yAwayRatio,
      fishWonForceKg: dragFrame.fishWonForceKg,
      fishWonYForceKg: dragFrame.fishWonYForceKg,
      dragBlockedForceKg: dragFrame.dragBlockedForceKg,
      excessYForceKg: dragFrame.excessYForceKg,
      yEscapeForceKg: dragFrame.yEscapeForceKg,
      finalXSpeedPxPerSec: dragFrame.finalXSpeedPxPerSec,
      finalYSpeedPxPerSec: dragFrame.finalYSpeedPxPerSec,
      shouldSlipDrag: dragFrame.shouldSlipDrag,
      staminaPressureRatio,
      modelFishEscapeSpeedPxPerSec: speedPxPerSec,
      modelFishEscapeVelocityX: modelVelocityX,
      modelFishEscapeVelocityY: modelVelocityY,
      awayFromPlayerRatio,
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
    return this.#playerForceSystem.calculate({
      fishPosition,
      rodTipPosition,
      input,
      rod,
      reel,
      buffs,
      physics,
      physicsConfig: this.#physicsConfig,
      totalFishForceKg,
      playerMaxLoadKg,
      dragRatio,
    });
  }

  getDebugData() {
    return this.#debug;
  }

  evaluateLastDashTrigger(context = {}) {
    return this.#fish.evaluateLastDashTrigger?.(context) || {};
  }

  #getCurrentVelocityPxPerSec(env, physics) {
    const current = env?.current || env?.waterCurrent || null;
    if (!current) return { x: 0, y: 0 };

    const speed =
      Number(current.speedPxPerSec) ||
      Number(current.speed) ||
      Number(current.magnitude) ||
      0;
    const dir = current.direction || current.dir || current.vector || { x: 0, y: 0 };
    const dx = Number(dir.x) || 0;
    const dy = Number(dir.y) || 0;
    const len = Math.hypot(dx, dy) || 1;
    const influence =
      this.#physicsConfig?.getCurrentInfluenceMultiplier?.() ??
      1.0;
    return {
      x: (dx / len) * speed * influence,
      y: (dy / len) * speed * influence,
    };
  }

  #calculateOpposition({ moveDir, awayDir }) {
    return Math.max(
      -1,
      Math.min(
        1,
        (Number(moveDir?.x) || 0) * (Number(awayDir?.x) || 0) +
          (Number(moveDir?.y) || 0) * (Number(awayDir?.y) || 0),
      ),
    );
  }

  #calculateDirectionInfo({ opposition, directionConfig }) {
    const config = directionConfig || {};
    const towardPlayerMultiplier = this.#firstFiniteNumber(
      config.towardPlayerMultiplier,
      0,
    );
    const sideMultiplier = this.#firstFiniteNumber(config.sideMultiplier, 1);
    const awayMultiplier = this.#firstFiniteNumber(config.awayMultiplier, 2.5);
    const value = Number(opposition) || 0;

    if (value <= -0.25) {
      return { name: "toward_player", multiplier: towardPlayerMultiplier };
    }
    if (value >= 0.25) {
      return { name: "away", multiplier: awayMultiplier };
    }
    return { name: "side", multiplier: sideMultiplier };
  }

  #calculateYAwayRatio({ moveDir, awayDir }) {
    const awayYSign = Math.sign(Number(awayDir?.y) || 0);
    if (awayYSign === 0) return 0;
    return this.#clamp01((Number(moveDir?.y) || 0) * awayYSign);
  }

  #lerp(a, b, t) {
    return a + (b - a) * this.#clamp01(t);
  }

  #numberOrDefault(value, fallback) {
    return Number.isFinite(Number(value)) ? Number(value) : fallback;
  }

  #firstFiniteNumber(...values) {
    for (const value of values) {
      if (Number.isFinite(Number(value))) return Math.max(0, Number(value));
    }
    return 0;
  }

  #clamp01(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
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
