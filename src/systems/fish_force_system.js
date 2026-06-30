class FishForceSystem {
  #fish;
  #config;
  #scratchB = new Vector2(0, 0);
  #directionResolver = new FishFightDirectionResolver();
  #targetVelocity = new Vector2(0, 0);
  #tautTargetVelocity = new Vector2(0, 0);
  #playerForceSystem;
  #forceCalculator = new SimpleFightForceCalculator();
  #holdOppositionResolver = new HoldOppositionResolver();
  #dragForceCalculator = new DragForceCalculator();
  #enduranceMovementDebuffCalculator =
    typeof EnduranceMovementDebuffCalculator !== "undefined"
      ? new EnduranceMovementDebuffCalculator()
      : null;
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
    lineTaut = true,
    env,
    buffs,
    fishSpeedMultiplier = 1,
  }) {
    const physics = this.#getRuntimePhysicsConfig();
    const pixelsPerMeter = Math.max(
      1,
      Number(this.#physicsConfig?.getPixelsPerMeter?.()) || 50,
    );
    const rawFishPhysics = this.#fish.getPhysicsConfig?.() || {};
    const fishPhysics =
      typeof FishPhysicsProfile !== "undefined"
        ? FishPhysicsProfile.toRuntimeConfig(rawFishPhysics)
        : rawFishPhysics;

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
    const enduranceMovementDebuff = this.#calculateEnduranceMovementDebuff({
      fishCondition,
      maxEndurance,
      fishPhysics,
    });
    const behavior = this.#fish.getBehavior(dtMs, enduranceMovementDebuff);
    const enduranceMovementDebug =
      this.#enduranceMovementDebugFields(enduranceMovementDebuff, behavior);
    const lastDashDebug = this.#fish.getLastDashDebugData?.() || {};

    const behaviorPullValue = this.#numberOrDefault(
      behavior.forceMultiplier ?? behavior.pullMult,
      1,
    );
    const movementIntent = behavior.movementIntent || {
      radial: behaviorPullValue,
      lateral: Number(behavior.moveX) || 0,
    };
    const moveDir = this.#directionResolver.resolve({
      fishPosition,
      rodTipPosition,
      radialIntent: movementIntent.radial,
      lateralIntent: movementIntent.lateral,
    });

    const awayDir = this.#scratchB
      .set(fishPosition.x - rodTipPosition.x, fishPosition.y - rodTipPosition.y);
    if (awayDir.length() <= 0.001) {
      awayDir.set(0, -1);
    } else {
      awayDir.normalize();
    }

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
    const holdOpposition = this.#holdOppositionResolver.resolve({
      activeRodHoldKg,
      fishDirectionState: directionInfo.name,
      directionConfig: this.#physicsConfig?.getDirectionForceConfig?.(),
    });
    const directionMultiplier = directionInfo.multiplier;
    const configuredFishBasePower = this.#firstFiniteNumber(
      fishPhysics.forceProfile?.basePower,
      fishPhysics.basePower,
      1,
    );
    const fishInitialPower = this.#firstFiniteNumber(
      this.#fish.getInitialPower?.(),
      configuredFishBasePower,
    );
    const fishCurrentPower = this.#firstFiniteNumber(
      this.#fish.getPower?.(),
      fishInitialPower,
    );
    const fishPowerBeforeMastery = this.#firstFiniteNumber(
      this.#fish.getPowerBeforeMastery?.(),
      fishCurrentPower,
    );
    const fishPowerDebuff = this.#firstFiniteNumber(
      this.#fish.getPowerDebuff?.(),
      Math.max(0, fishInitialPower - fishPowerBeforeMastery),
      0,
    );
    const fishPowerRatio = fishInitialPower > 0
      ? Math.max(0, fishCurrentPower / fishInitialPower)
      : 1;
    const fishBasePower = configuredFishBasePower * fishPowerRatio;
    const rawFishBaseSpeed = this.#firstFiniteNumber(
      fishPhysics.movementProfile?.baseSpeed,
      fishPhysics.baseSpeed,
      1,
    );
    const fishBaseSpeedMultiplier = this.#positiveOrDefault(
      fishSpeedMultiplier,
      1,
    );
    const fishBaseSpeed = rawFishBaseSpeed * fishBaseSpeedMultiplier;
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
    const fishForceBeforeExhaustionFrame = this.#forceCalculator.calculate({
      fishWeightKg: this.#fish.getWeight(),
      fishBasePower: configuredFishBasePower,
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

    const outwardRatio = Math.max(
      0,
      moveDir.x * awayDir.x + moveDir.y * awayDir.y,
    );
    const fishWonForceKg = Math.max(
      0,
      totalFishForceKg - holdOpposition.forceKg,
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
      effectiveRodHoldKg: holdOpposition.forceKg,
      awayDir,
      dragRatio: this.#clamp01(dragRatio),
      dragLimitKg: playerData.effectiveDragLimitKg,
      lineHasReserve,
      lineTaut,
      dragLocked,
      dragSupported,
      targetVelocity: {
        x: modelVelocityX,
        y: modelVelocityY,
      },
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
    this.#tautTargetVelocity.set(
      dragFrame.tautFinalXSpeedPxPerSec,
      dragFrame.tautFinalYSpeedPxPerSec,
    );
    const fishOwnTowardSpeedMps =
      directionInfo.name === "toward_player"
        ? Math.hypot(this.#targetVelocity.x, this.#targetVelocity.y) /
          pixelsPerMeter
        : 0;
    const staminaPressureRatio =
      playerData.isPulling && dragFrame.fishWonRadialForceKg > 0
        ? this.#clamp01(
            dragFrame.dragBlockedForceKg /
              dragFrame.fishWonRadialForceKg,
          )
        : 0;

    this.#debug = {
      fishState: behavior.name,
      fishWeightKg: this.#fish.getWeight(),
      fishBasePower,
      fishConfiguredBasePower: configuredFishBasePower,
      fishInitialPower,
      fishCurrentPower,
      fishPowerBeforeMastery,
      fishPowerRatio,
      fishPowerDebuff,
      fishBasePowerExhaustionLoss: Math.max(
        0,
        configuredFishBasePower - fishBasePower,
      ),
      fishBaseSpeed,
      rawFishBaseSpeed,
      fishBaseSpeedMultiplier,
      pullMult: behaviorPowerRatio,
      moveMult: behaviorSpeedRatio,
      staticFishForceKg: staticForceKg,
      fishPassiveKg: fishForceFrame.fishPassiveKg,
      fishActiveKg: fishForceFrame.fishActiveKg,
      fishOppositionKg: fishForceFrame.fishOppositionKg,
      fishPassiveWithoutExhaustionKg:
        fishForceBeforeExhaustionFrame.fishPassiveKg,
      fishActiveWithoutExhaustionKg:
        fishForceBeforeExhaustionFrame.fishActiveKg,
      fishOppositionWithoutExhaustionKg:
        fishForceBeforeExhaustionFrame.fishOppositionKg,
      fishPassiveExhaustionLossKg: Math.max(
        0,
        fishForceBeforeExhaustionFrame.fishPassiveKg -
          fishForceFrame.fishPassiveKg,
      ),
      fishActiveExhaustionLossKg: Math.max(
        0,
        fishForceBeforeExhaustionFrame.fishActiveKg -
          fishForceFrame.fishActiveKg,
      ),
      fishOppositionExhaustionLossKg: Math.max(
        0,
        fishForceBeforeExhaustionFrame.fishOppositionKg -
          fishForceFrame.fishOppositionKg,
      ),
      fishTensionKg: fishForceFrame.fishTensionKg,
      totalFishForceKg,
      fishSpeedPxPerSec: Math.hypot(this.#targetVelocity.x, this.#targetVelocity.y),
      fishSpeedMps: Math.hypot(this.#targetVelocity.x, this.#targetVelocity.y) / pixelsPerMeter,
      fishWonForceKg: dragFrame.fishWonForceKg,
      fishWonRadialForceKg: dragFrame.fishWonRadialForceKg,
      fishWonYForceKg: dragFrame.fishWonYForceKg,
      yAwayRatio: dragFrame.yAwayRatio,
      fishMoveIntentRadial: Number(movementIntent.radial) || 0,
      fishMoveIntentLateral: Number(movementIntent.lateral) || 0,
      fishMoveDirX: moveDir.x,
      fishMoveDirY: moveDir.y,
      fishRadialSpeedPxPerSec: dragFrame.radialSpeedPxPerSec,
      finalRadialSpeedPxPerSec: dragFrame.finalRadialSpeedPxPerSec,
      fishTangentSpeedPxPerSec: dragFrame.tangentSpeedPxPerSec,
      radialEscapeForceKg: dragFrame.radialEscapeForceKg,
      activeRodHoldKgForEscape: Math.max(0, Number(activeRodHoldKg) || 0),
      escapeOpposingHoldKg: holdOpposition.forceKg,
      holdOppositionRatio: holdOpposition.ratio,
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
      dragEngaged: dragFrame.dragEngaged,
      shouldSlipDrag: dragFrame.shouldSlipDrag,
      staminaPressureRatio,
      staminaRatio,
      staminaActivityMultiplier,
      exhaustionProgress,
      exhaustionSpeedMultiplier,
      ...enduranceMovementDebug,
      opposition,
      directionResistanceMultiplier: directionMultiplier,
      fishDirectionState: directionInfo.name,
      fishOwnTowardSpeedMps,
      escapeOpposingHoldKg: holdOpposition.forceKg,
      holdOppositionRatio: holdOpposition.ratio,
      awayFromPlayerRatio: outwardRatio,
      dragRatio: this.#clamp01(dragRatio),
      dragLimitKg: playerData.dragLimitKg,
      effectiveDragLimitKg: playerData.effectiveDragLimitKg,
      dragLocked,
      lineTaut: dragFrame.lineTaut,
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
      lastDashBlockedByCatchZone:
        !!lastDashDebug.blockedByCatchZone,
    };

    return {
      behavior,
      targetVelocity: this.#targetVelocity,
      tautTargetVelocity: this.#tautTargetVelocity,
      fishWeightKg: this.#fish.getWeight(),
      fishPhysicsConfig: fishPhysics,
      staticFishForceKg: staticForceKg,
      fishPassiveKg: fishForceFrame.fishPassiveKg,
      fishActiveKg: fishForceFrame.fishActiveKg,
      fishOppositionKg: fishForceFrame.fishOppositionKg,
      fishPassiveWithoutExhaustionKg:
        fishForceBeforeExhaustionFrame.fishPassiveKg,
      fishActiveWithoutExhaustionKg:
        fishForceBeforeExhaustionFrame.fishActiveKg,
      fishOppositionWithoutExhaustionKg:
        fishForceBeforeExhaustionFrame.fishOppositionKg,
      fishPassiveExhaustionLossKg: Math.max(
        0,
        fishForceBeforeExhaustionFrame.fishPassiveKg -
          fishForceFrame.fishPassiveKg,
      ),
      fishActiveExhaustionLossKg: Math.max(
        0,
        fishForceBeforeExhaustionFrame.fishActiveKg -
          fishForceFrame.fishActiveKg,
      ),
      fishOppositionExhaustionLossKg: Math.max(
        0,
        fishForceBeforeExhaustionFrame.fishOppositionKg -
          fishForceFrame.fishOppositionKg,
      ),
      fishTensionKg: fishForceFrame.fishTensionKg,
      fishBasePower,
      fishConfiguredBasePower: configuredFishBasePower,
      fishInitialPower,
      fishCurrentPower,
      fishPowerBeforeMastery,
      fishPowerRatio,
      fishPowerDebuff,
      fishBasePowerExhaustionLoss: Math.max(
        0,
        configuredFishBasePower - fishBasePower,
      ),
      fishBaseSpeed,
      rawFishBaseSpeed,
      fishBaseSpeedMultiplier,
      fishStateForceMultiplier: behaviorPowerRatio,
      fishStateSpeedMultiplier: behaviorSpeedRatio,
      directionResistanceMultiplier: directionMultiplier,
      fishDirectionState: directionInfo.name,
      fishOwnTowardSpeedMps,
      waterMotionResistance: waterConfig.motionResistance,
      waterSpeedMultiplier: waterConfig.speedMultiplier,
      totalFishForceKg,
      opposition,
      yAwayRatio: outwardRatio,
      radialAwayRatio: outwardRatio,
      awayDirX: awayDir.x,
      awayDirY: awayDir.y,
      fishWonForceKg: dragFrame.fishWonForceKg,
      fishWonRadialForceKg: dragFrame.fishWonRadialForceKg,
      fishWonYForceKg: dragFrame.fishWonYForceKg,
      radialEscapeForceKg: dragFrame.radialEscapeForceKg,
      finalRadialSpeedPxPerSec: dragFrame.finalRadialSpeedPxPerSec,
      radialSpeedPxPerSec: dragFrame.radialSpeedPxPerSec,
      outwardRadialSpeedPxPerSec:
        dragFrame.outwardRadialSpeedPxPerSec,
      tangentSpeedPxPerSec: dragFrame.tangentSpeedPxPerSec,
      fishMoveIntentRadial: Number(movementIntent.radial) || 0,
      fishMoveIntentLateral: Number(movementIntent.lateral) || 0,
      fishMoveDirX: moveDir.x,
      fishMoveDirY: moveDir.y,
      enduranceMovementDebuff,
      ...enduranceMovementDebug,
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
      awayFromPlayerRatio: outwardRatio,
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

  handleFightEvent(event = {}) {
    this.#fish.handleFightEvent?.(event);
  }

  #calculateEnduranceMovementDebuff({
    fishCondition,
    maxEndurance,
    fishPhysics,
  }) {
    if (!this.#enduranceMovementDebuffCalculator) {
      return Object.freeze({
        enabled: false,
        active: false,
        enduranceProgress: 0,
        debuffPower: 0,
        baseRadialRange: null,
        directionEnabled: false,
        exhaustedRadialRange: null,
        radialRangeOverride: null,
        behaviorWeightMultipliers: Object.freeze({}),
      });
    }

    return this.#enduranceMovementDebuffCalculator.calculate({
      phase: fishCondition?.phase || "stamina",
      currentExhaustion: fishCondition?.currentExhaustion ?? maxEndurance,
      maxEndurance,
      baseRadialRange:
        fishPhysics?.movementProfile?.radialRange ??
        fishPhysics?.radialRange,
      config:
        this.#config?.stamina?.mechanics?.enduranceMovementDebuff || {},
    });
  }

  #enduranceMovementDebugFields(frame = {}, behavior = null) {
    const movementDebug = behavior?.movementDebuffDebug || {};
    const base = movementDebug.baseRadialRange || frame?.baseRadialRange;
    const effective =
      movementDebug.effectiveRadialRange || frame?.radialRangeOverride;
    const multipliers = frame?.behaviorWeightMultipliers || {};
    const target = frame?.exhaustedRadialRange;
    return {
      enduranceMovementDebuffEnabled: frame?.enabled === true,
      enduranceMovementDebuffActive: frame?.active === true,
      enduranceMovementDebuffProgress: frame?.enduranceProgress ?? 0,
      enduranceMovementDebuffPower: frame?.debuffPower ?? 0,
      enduranceLastSelectedBehavior:
        movementDebug.selectedBehavior || behavior?.name || "unknown",
      enduranceLastSampledRadialIntent:
        movementDebug.sampledRadialIntent ?? null,
      enduranceLastSampledLateralIntent:
        movementDebug.sampledLateralIntent ?? null,
      enduranceTargetRadialMin: Array.isArray(target) ? target[0] : null,
      enduranceTargetRadialMax: Array.isArray(target) ? target[1] : null,
      enduranceBaseRadialMin: Array.isArray(base) ? base[0] : null,
      enduranceBaseRadialMax: Array.isArray(base) ? base[1] : null,
      enduranceEffectiveRadialMin: Array.isArray(effective)
        ? effective[0]
        : null,
      enduranceEffectiveRadialMax: Array.isArray(effective)
        ? effective[1]
        : null,
      enduranceDashWeightMultiplier: multipliers.dash ?? 1,
      enduranceLastDashWeightMultiplier: multipliers.lastDash ?? 1,
      enduranceSwimWeightMultiplier: multipliers.swim ?? 1,
      enduranceIdleWeightMultiplier: multipliers.idle ?? 1,
      enduranceRestWeightMultiplier: multipliers.rest ?? 1,
    };
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

  #positiveOrDefault(value, fallback) {
    const number = Number(value);
    if (Number.isFinite(number)) return Math.max(0, number);
    return Math.max(0, Number(fallback) || 0);
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
