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
    const pixelsPerMeter = Math.max(1, Number(physics.pixelsPerMeter) || 50);
    const behavior = this.#fish.getBehavior(dtMs);
    const fishPhysics = this.#fish.getPhysicsConfig?.() || {};

    const staminaRatio = fishCondition?.maxPoints
      ? this.#clamp01(fishCondition.currentStamina / fishCondition.maxPoints)
      : 1;
    const exhaustionProgress = fishCondition?.maxPoints
      ? this.#clamp01(1 - fishCondition.currentExhaustion / fishCondition.maxPoints)
      : 0;

    const moveDir = this.#scratchA.set(
      Number(behavior.moveX) || 0,
      -(Number(behavior.powerRatio ?? behavior.pullMult) || 1),
    );
    if (moveDir.length() <= 0.001) moveDir.set(0, -1);
    moveDir.normalize();

    const awayDir = this.#scratchB
      .set(fishPosition.x - rodTipPosition.x, fishPosition.y - rodTipPosition.y)
      .normalize();

    const currentVelocity = this.#getCurrentVelocityPxPerSec(env, physics);
    const relativeVelocityX = (fishVelocity?.x || 0) - currentVelocity.x;
    const relativeVelocityY = (fishVelocity?.y || 0) - currentVelocity.y;
    const relativeSpeedMps =
      Math.hypot(relativeVelocityX, relativeVelocityY) / pixelsPerMeter;

    const staticForceKg =
      this.#fish.getCurrentStaticPowerKg?.() ||
      this.#fish.getStaticPowerKg?.() ||
      this.#fish.getPower?.() ||
      1;

    const velocityLength = Math.hypot(relativeVelocityX, relativeVelocityY);
    const velocityDirX = velocityLength > 0.001 ? relativeVelocityX / velocityLength : moveDir.x;
    const velocityDirY = velocityLength > 0.001 ? relativeVelocityY / velocityLength : moveDir.y;
    const opposition = velocityDirX * awayDir.x + velocityDirY * awayDir.y;
    const directionMultiplier = this.#directionMultiplier(opposition, physics.directionForce);

    const dynamicForceKg =
      this.#fish.getWeight() *
      relativeSpeedMps *
      (fishPhysics.speedForceMultiplier ?? 0.35) *
      (fishPhysics.waterResistanceMultiplier ?? 1.0) *
      (physics.waterResistanceKgPerKgPerMps ?? 1.0) *
      directionMultiplier;

    const behaviorPowerRatio = Math.max(0, Number(behavior.powerRatio ?? behavior.pullMult) || 1);
    const minPowerRatio = fishPhysics.minPowerRatio ?? 0.25;
    const exhaustionPowerMultiplier = this.#lerp(
      1,
      Math.max(0, minPowerRatio),
      exhaustionProgress,
    );
    const totalFishForceKg = Math.max(
      staticForceKg * minPowerRatio,
      (staticForceKg * behaviorPowerRatio + dynamicForceKg) * exhaustionPowerMultiplier,
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

    const awayFromPlayerRatio = Math.max(0, moveDir.x * awayDir.x + moveDir.y * awayDir.y);
    const minEscape = physics.drag?.yEscapeSpeedAtFullDrag ?? 0.02;
    const escapeSpeedMultiplier =
      1 - playerData.effectiveDragRatio * awayFromPlayerRatio * (1 - minEscape);

    const baseSpeedPxPerSec = this.#fish.getBaseSpeedPxPerSec?.(pixelsPerMeter) || 100;
    const behaviorSpeedRatio = this.#clamp01(behavior.speedRatio ?? Math.abs(behavior.moveX || 0));

    // Stamina is activity fuel, not a hard speed brake. Exhaustion is the real weakening layer.
    const staminaActivityMultiplier = this.#lerp(
      fishPhysics.minStaminaActivityMultiplier ?? 0.75,
      1,
      staminaRatio,
    );
    const exhaustionSpeedMultiplier = this.#lerp(
      1,
      fishPhysics.exhaustedSpeedRatio ?? 0.25,
      exhaustionProgress,
    );

    const speedPxPerSec =
      baseSpeedPxPerSec *
      behaviorSpeedRatio *
      staminaActivityMultiplier *
      exhaustionSpeedMultiplier *
      Math.max(minEscape, escapeSpeedMultiplier);

    this.#targetVelocity.set(moveDir.x * speedPxPerSec, moveDir.y * speedPxPerSec);

    this.#debug = {
      fishState: behavior.name,
      fishBasePower: staticForceKg,
      fishInitialPower: this.#fish.getInitialPower?.() || staticForceKg,
      pullMult: behaviorPowerRatio,
      moveMult: behaviorSpeedRatio,
      staticFishForceKg: staticForceKg,
      dynamicFishForceKg: dynamicForceKg,
      totalFishForceKg,
      fishSpeedPxPerSec: speedPxPerSec,
      staminaRatio,
      staminaActivityMultiplier,
      exhaustionProgress,
      exhaustionPowerMultiplier,
      exhaustionSpeedMultiplier,
      opposition,
      directionResistanceMultiplier: directionMultiplier,
      awayFromPlayerRatio,
      dragRatio: this.#clamp01(dragRatio),
      effectiveDragRatio: playerData.effectiveDragRatio,
      dragLimitKg: playerData.dragLimitKg,
      dragHoldRatio: playerData.dragHoldRatio,
      canDragHoldFish: playerData.canDragHoldFish,
      canWinDistance: playerData.canWinDistance,
      shouldSlipDrag: playerData.shouldSlipDrag,
      staminaPressureRatio: playerData.staminaPressureRatio,
      pullCapacityKg: playerData.pullCapacityKg,
      restrainRatio: playerData.restrainRatio,
      transferRatio: playerData.transferRatio,
      anglePenalty: playerData.anglePenalty,
      angleStressRatio: playerData.angleStressRatio,
      angleDeg: playerData.angleDeg,
      currentVelocityX: currentVelocity.x,
      currentVelocityY: currentVelocity.y,
      relativeSpeedMps,
    };

    return {
      behavior,
      targetVelocity: this.#targetVelocity,
      staticFishForceKg: staticForceKg,
      dynamicFishForceKg: dynamicForceKg,
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
    const dot = Math.max(-1, Math.min(1, lineDir.x * idealDir.x + lineDir.y * idealDir.y));
    const angleDeg = (Math.acos(dot) * 180) / Math.PI;
    const angleCfg = physics.rodAnglePenalty || {};
    const noPenalty = angleCfg.noPenaltyAngleDeg ?? 15;
    const maxPenaltyAngle = angleCfg.maxPenaltyAngleDeg ?? 75;
    const angleStressRatio = this.#clamp01(
      (angleDeg - noPenalty) / Math.max(1, maxPenaltyAngle - noPenalty),
    );
    const maxPenaltyMult = angleCfg.maxPenaltyMultiplier ?? 0.65;
    const anglePenalty = angleCfg.enabled === false
      ? 1
      : this.#lerp(1.0, maxPenaltyMult, angleStressRatio);

    const hasReel = !!reel?.hasReel?.();
    const isRecoverOnly = hasReel && !!input?.retrieve && !input?.pointerDown;
    const isPlayerPulling = !!input?.isPulling && !isRecoverOnly;

    const fallbackRodKg =
      Number(rod?.getEffectiveMaxLoadKg?.()) ||
      Number(rod?.getMaxLoadKg?.()) ||
      0;
    const fallbackReelKg = hasReel
      ? Number(reel?.getEffectiveMaxLoadKg?.()) || Number(reel?.getMaxLoadKg?.()) || fallbackRodKg
      : fallbackRodKg;
    const baseForceKg = Math.max(
      0,
      Number(playerMaxLoadKg) || (hasReel ? (fallbackRodKg + fallbackReelKg) / 2 : fallbackRodKg),
    );
    const maxPlayerForceKg = baseForceKg * anglePenalty * (buffs?.getTotalMultiplier?.() || 1);

    const fishForceKg = Math.max(0.001, Number(totalFishForceKg) || 0.001);
    const clampedDrag = this.#clamp01(dragRatio);
    const dragLimitKg = hasReel
      ? this.#calculateDragLimitKg(reel, clampedDrag)
      : Infinity;

    // Фрикціон — це ліміт у кг, а не множник сили.
    // Якщо dragLimitKg < fishForceKg, котушка здає ліску й гравець не виграє дистанцію.
    const dragHoldRatio = hasReel
      ? this.#clamp01(dragLimitKg / fishForceKg)
      : 1;
    const tackleRestrainRatio = this.#clamp01(maxPlayerForceKg / fishForceKg);
    const isDragLocked = hasReel && clampedDrag >= 0.999;
    const canDragHoldFish = !hasReel || isDragLocked || dragLimitKg >= fishForceKg;
    const pullCapacityKg = hasReel
      ? Math.min(maxPlayerForceKg, dragLimitKg)
      : maxPlayerForceKg;
    const canWinDistance = isPlayerPulling && canDragHoldFish && pullCapacityKg > fishForceKg;
    const netPullKg = canWinDistance ? pullCapacityKg - fishForceKg : 0;

    // Цей тиск використовується для stamina: drag 0% => 0, drag нижче сили риби => слабкий тиск,
    // drag >= сили риби => повний тиск, якщо гравець тягне.
    const staminaPressureRatio = isPlayerPulling
      ? (hasReel ? dragHoldRatio : tackleRestrainRatio)
      : 0;

    this.#playerVector.set(basePullDir.x * netPullKg, basePullDir.y * netPullKg);

    return {
      forceKg: maxPlayerForceKg,
      pullCapacityKg,
      effectivePullKg: isPlayerPulling ? pullCapacityKg : 0,
      netPullKg,
      transferRatio: hasReel ? dragHoldRatio : tackleRestrainRatio,
      restrainRatio: tackleRestrainRatio,
      dragHoldRatio,
      effectiveDragRatio: hasReel ? dragHoldRatio : tackleRestrainRatio,
      dragLimitKg: Number.isFinite(dragLimitKg) ? dragLimitKg : 0,
      canDragHoldFish,
      canWinDistance,
      shouldSlipDrag: hasReel && !isDragLocked && dragLimitKg < fishForceKg,
      staminaPressureRatio,
      vector: this.#playerVector,
      pullDir: basePullDir,
      anglePenalty,
      angleStressRatio,
      angleDeg,
      isPulling: isPlayerPulling,
    };
  }

  #calculateDragLimitKg(reel, dragRatio) {
    const range = reel?.getDragRangeKg?.() || {};
    const minKg = Math.max(0, Number(range.min) || 0);
    const maxFromRange = Number(range.max);
    const fallbackMax =
      Number(reel?.getEffectiveMaxLoadKg?.()) ||
      Number(reel?.getMaxLoadKg?.()) ||
      minKg;
    const maxKg = Math.max(minKg, Number.isFinite(maxFromRange) ? maxFromRange : fallbackMax);
    return minKg + (maxKg - minKg) * this.#clamp01(dragRatio);
  }

  getDebugData() {
    return this.#debug;
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
    const influence = physics.currentResistanceMultiplier ?? 1.0;
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
