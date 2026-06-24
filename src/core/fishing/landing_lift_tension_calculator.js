/**
 * Calculates real-weight tension transfer while lifting fish in the landing zone.
 *
 * This calculator is intentionally stateless: FightPhysicsSystem owns the
 * accumulated lift pressure for the current fight session.
 */
class LandingLiftTensionCalculator {
  calculate({
    previousLiftHoldKg = 0,
    fishWeightKg = 0,
    maxTackleLoadKg = 0,
    waterFightTensionKg = 0,
    inLandingZone = false,
    playerHoldActive = false,
    dtSec = 0,
    config = {},
  } = {}) {
    const enabled = config.enabled !== false;
    const liftWeightTensionRatio = this.#positive(
      config.liftWeightTensionRatio,
      1,
    );
    const fastLiftTimeSeconds = this.#positive(
      config.fastLiftTimeSeconds,
      this.#positive(config.liftTimeSeconds, 0.25),
    );
    const releaseTimeSeconds = this.#positive(config.releaseTimeSeconds, 0.2);
    const slowdownStartRatio = this.#clamp(
      this.#number(config.slowdownStartRatio, 0.75),
      0,
      0.999999,
    );
    const endSpeedRatio = this.#clamp(
      this.#number(config.endSpeedRatio, 0.08),
      0.000001,
      1,
    );
    const slowdownCurvePower = this.#positive(
      config.slowdownCurvePower,
      2.5,
    );
    const dt = this.#positive(dtSec);
    const waterTension = this.#positive(waterFightTensionKg);
    const liftMaxKg =
      enabled && inLandingZone
        ? this.#positive(fishWeightKg) * liftWeightTensionRatio
        : 0;
    const maxLoadKg = this.#positive(maxTackleLoadKg);
    let liftHoldKg = Math.min(
      this.#positive(previousLiftHoldKg),
      liftMaxKg,
    );
    const progressRatio = liftMaxKg > 0
      ? this.#clamp(liftHoldKg / liftMaxKg, 0, 1)
      : 0;
    const tackleLoadProgressRatio =
      maxLoadKg > 0
        ? this.#clamp(liftHoldKg / maxLoadKg, 0, 1)
        : progressRatio;
    const slowdownRatio =
      tackleLoadProgressRatio <= slowdownStartRatio
        ? 0
        : this.#clamp(
            (tackleLoadProgressRatio - slowdownStartRatio) /
              Math.max(0.000001, 1 - slowdownStartRatio),
            0,
            1,
          );
    const smoothSlowdown =
      slowdownRatio <= 0
        ? 0
        : 0.5 - 0.5 * Math.cos(Math.PI * slowdownRatio);
    const slowdownCurve = Math.pow(smoothSlowdown, slowdownCurvePower);
    const speedRatio =
      1 + (endSpeedRatio - 1) * this.#clamp(slowdownCurve, 0, 1);
    const gainKgPerSecond =
      liftMaxKg > 0 && fastLiftTimeSeconds > 0
        ? (liftMaxKg / fastLiftTimeSeconds) * speedRatio
        : 0;

    if (enabled && inLandingZone && playerHoldActive) {
      liftHoldKg += gainKgPerSecond * dt;
    } else {
      const releaseTime = Math.max(0.000001, releaseTimeSeconds);
      const releaseMax = Math.max(liftMaxKg, this.#positive(previousLiftHoldKg));
      liftHoldKg -= (releaseMax / releaseTime) * dt;
    }

    liftHoldKg = this.#clamp(liftHoldKg, 0, liftMaxKg);
    const active = enabled && inLandingZone && liftHoldKg > 0;
    const fishTensionKg = active ? liftHoldKg : waterTension;

    return Object.freeze({
      enabled,
      inLandingZone: !!inLandingZone,
      playerHoldActive: !!playerHoldActive,
      active,
      liftHoldKg,
      liftMaxKg,
      maxTackleLoadKg: maxLoadKg,
      progressRatio,
      tackleLoadProgressRatio,
      slowdownRatio,
      speedRatio,
      liftWeightTensionRatio,
      fastLiftTimeSeconds,
      releaseTimeSeconds,
      slowdownStartRatio,
      endSpeedRatio,
      slowdownCurvePower,
      gainKgPerSecond,
      waterFightTensionKg: waterTension,
      fishTensionKg,
      totalTensionKg: active ? fishTensionKg : null,
    });
  }

  #positive(value, fallback = 0) {
    const number = this.#number(value, fallback);
    return Math.max(0, number);
  }

  #number(value, fallback = 0) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
    return Math.max(0, Number(fallback) || 0);
  }

  #clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || 0));
  }

}
