/**
 * Converts surplus pull into retrieve speed through water drag capacity.
 */
class PullWaterDragCalculator {
  calculate({
    fishWeightKg,
    surplusPullKg,
    referencePullSpeedMetersPerSecond,
    waterDragKgPerKgAtReferenceSpeed,
    waterDragMultiplier,
    landingLift,
  } = {}) {
    const weight = this.#positive(fishWeightKg);
    const referencePullSpeed = this.#positive(referencePullSpeedMetersPerSecond);
    const dragPerKg = this.#positive(waterDragKgPerKgAtReferenceSpeed);
    const speciesMultiplier = this.#positive(waterDragMultiplier ?? 1);
    const waterDragCapacityKg = weight * dragPerKg * speciesMultiplier;
    const targetFishPullSpeedMetersPerSecond = this.#pullSpeedFromSurplus({
      surplusPullKg,
      waterDragCapacityKg,
      referencePullSpeedMetersPerSecond: referencePullSpeed,
    });
    const pullSpeedRatio = referencePullSpeed > 0
      ? Math.max(0, targetFishPullSpeedMetersPerSecond / referencePullSpeed)
      : 0;
    const waterDragKg = landingLift?.inZone
      ? 0
      : weight * dragPerKg * speciesMultiplier * pullSpeedRatio * pullSpeedRatio;

    return Object.freeze({
      waterDragCapacityKg,
      targetFishPullSpeedMetersPerSecond,
      waterDragKg,
      pullSpeedRatio,
      waterDragKgPerKgAtReferenceSpeed: dragPerKg,
      waterDragMultiplier: speciesMultiplier,
    });
  }

  #pullSpeedFromSurplus({
    surplusPullKg,
    waterDragCapacityKg,
    referencePullSpeedMetersPerSecond,
  }) {
    const surplus = this.#positive(surplusPullKg);
    const referenceSpeed = this.#positive(referencePullSpeedMetersPerSecond);
    if (surplus <= 0.001 || referenceSpeed <= 0) return 0;
    return referenceSpeed * Math.sqrt(surplus / Math.max(0.001, waterDragCapacityKg));
  }

  #positive(value) {
    return Math.max(0, Number(value) || 0);
  }
}
