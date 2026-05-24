/**
 * Calculates the load created by fish movement through water.
 *
 * Responsibility boundary:
 * - input: runtime velocity/current/direction data + fish resistance profile;
 * - output: relative speed, direction multiplier and dynamic motion load;
 * - no mutation of entity state and no dependency on Canvas/DOM.
 */
class FishMotionLoadCalculator {
  calculate({
    fishWeightKg,
    fishVelocity,
    currentVelocity,
    pixelsPerMeter,
    fishPhysicsConfig,
    fishPosition,
    rodTipPosition,
    fallbackDirection,
    physicsConfig,
  } = {}) {
    const scale = Math.max(1, Number(pixelsPerMeter) || 50);
    const relativeVelocityX =
      (Number(fishVelocity?.x) || 0) - (Number(currentVelocity?.x) || 0);
    const relativeVelocityY =
      (Number(fishVelocity?.y) || 0) - (Number(currentVelocity?.y) || 0);
    const relativeSpeedMps = Math.hypot(relativeVelocityX, relativeVelocityY) / scale;
    const directionMultiplier = this.#calculateDirectionMultiplier({
      relativeVelocityX,
      relativeVelocityY,
      fishPosition,
      rodTipPosition,
      fallbackDirection,
      directionConfig: physicsConfig?.getDirectionMultiplierConfig?.(),
    });
    const enabled = physicsConfig?.isFishMotionDynamicLoadEnabled?.() !== false;
    const speedLoadKgPerKgPerMps =
      physicsConfig?.getFishMotionSpeedLoadKgPerKgPerMps?.() ?? 1;
    const resistanceProfile = fishPhysicsConfig?.resistanceProfile || {};
    const speedForceMultiplier = this.#positive(
      resistanceProfile.speedForceMultiplier ?? 0.35,
    );
    const waterResistanceMultiplier = this.#positive(
      resistanceProfile.waterResistanceMultiplier ?? 1,
    );
    const dynamicForceKg = enabled
      ? this.#positive(fishWeightKg) *
        relativeSpeedMps *
        speedForceMultiplier *
        waterResistanceMultiplier *
        this.#positive(speedLoadKgPerKgPerMps) *
        directionMultiplier
      : 0;

    return Object.freeze({
      dynamicForceKg,
      dynamicLoadEnabled: enabled,
      fishMotionSpeedLoadKgPerKgPerMps: this.#positive(speedLoadKgPerKgPerMps),
      relativeVelocityX,
      relativeVelocityY,
      relativeSpeedMps,
      directionMultiplier,
      opposition: this.#calculateOpposition({
        relativeVelocityX,
        relativeVelocityY,
        fishPosition,
        rodTipPosition,
        fallbackDirection,
      }),
      speedForceMultiplier,
      waterResistanceMultiplier,
    });
  }

  #calculateDirectionMultiplier({
    relativeVelocityX,
    relativeVelocityY,
    fishPosition,
    rodTipPosition,
    fallbackDirection,
    directionConfig,
  }) {
    const opposition = this.#calculateOpposition({
      relativeVelocityX,
      relativeVelocityY,
      fishPosition,
      rodTipPosition,
      fallbackDirection,
    });
    const config = directionConfig || {};
    const sameDirection = this.#positive(config.sameDirection ?? 0.4);
    const sideDirection = this.#positive(config.sideDirection ?? 1);
    const oppositeDirection = this.#positive(config.oppositeDirection ?? 1.8);

    if (opposition >= 0) {
      return this.#lerp(sideDirection, oppositeDirection, Math.min(1, opposition));
    }
    return this.#lerp(sideDirection, sameDirection, Math.min(1, -opposition));
  }

  #calculateOpposition({
    relativeVelocityX,
    relativeVelocityY,
    fishPosition,
    rodTipPosition,
    fallbackDirection,
  }) {
    const velocityLength = Math.hypot(relativeVelocityX, relativeVelocityY);
    const velocityDirX = velocityLength > 0.001
      ? relativeVelocityX / velocityLength
      : Number(fallbackDirection?.x) || 0;
    const velocityDirY = velocityLength > 0.001
      ? relativeVelocityY / velocityLength
      : Number(fallbackDirection?.y) || -1;
    const awayX = (Number(fishPosition?.x) || 0) - (Number(rodTipPosition?.x) || 0);
    const awayY = (Number(fishPosition?.y) || 0) - (Number(rodTipPosition?.y) || 0);
    const awayLength = Math.hypot(awayX, awayY) || 1;
    return velocityDirX * (awayX / awayLength) + velocityDirY * (awayY / awayLength);
  }

  #lerp(a, b, t) {
    return a + (b - a) * Math.max(0, Math.min(1, Number(t) || 0));
  }

  #positive(value) {
    return Math.max(0, Number(value) || 0);
  }
}
