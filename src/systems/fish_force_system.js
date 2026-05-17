class FishForceSystem {
  #fish;
  #config;
  #scratchA = new Vector2(0, 0);
  #scratchB = new Vector2(0, 0);
  #targetVelocity = new Vector2(0, 0);
  #playerForceSystem;
  #debug = {};

  constructor({ fish, config }) {
    this.#fish = fish;
    this.#config = config || {};
    this.#playerForceSystem = new PlayerForceSystem();
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
      effectiveDragLimitKg: playerData.effectiveDragLimitKg,
      dragLocked: playerData.dragLocked,
      hasReel: playerData.hasReel,
      dragHoldRatio: playerData.dragHoldRatio,
      canDragHoldFish: playerData.canDragHoldFish,
      movementAuthority: playerData.movementAuthority,
      legacyCanWinDistance: playerData.legacyCanWinDistance,
      shouldSlipDrag: playerData.shouldSlipDrag,
      staminaPressureRatio: playerData.staminaPressureRatio,
      pullCapacityKg: playerData.pullCapacityKg,
      legacyNetPullKg: playerData.legacyNetPullKg,
      legacyEffectivePullKg: playerData.legacyEffectivePullKg,
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
    return this.#playerForceSystem.calculate({
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
