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
    const liftTimeSeconds = this.#positive(config.liftTimeSeconds, 0.35);
    const releaseTimeSeconds = this.#positive(config.releaseTimeSeconds, 0.2);
    const dt = this.#positive(dtSec);
    const waterTension = this.#positive(waterFightTensionKg);
    const liftMaxKg =
      enabled && inLandingZone
        ? this.#positive(fishWeightKg) * liftWeightTensionRatio
        : 0;

    let liftHoldKg = Math.min(
      this.#positive(previousLiftHoldKg),
      liftMaxKg,
    );

    if (enabled && inLandingZone && playerHoldActive) {
      const gainTime = Math.max(0.000001, liftTimeSeconds);
      liftHoldKg += (liftMaxKg / gainTime) * dt;
    } else {
      const releaseTime = Math.max(0.000001, releaseTimeSeconds);
      const releaseMax = Math.max(liftMaxKg, this.#positive(previousLiftHoldKg));
      liftHoldKg -= (releaseMax / releaseTime) * dt;
    }

    liftHoldKg = this.#clamp(liftHoldKg, 0, liftMaxKg);
    const active = enabled && inLandingZone && liftHoldKg > 0;
    const fishTensionKg = active
      ? Math.max(waterTension, liftHoldKg)
      : waterTension;

    return Object.freeze({
      enabled,
      inLandingZone: !!inLandingZone,
      playerHoldActive: !!playerHoldActive,
      active,
      liftHoldKg,
      liftMaxKg,
      liftWeightTensionRatio,
      liftTimeSeconds,
      releaseTimeSeconds,
      waterFightTensionKg: waterTension,
      fishTensionKg,
      totalTensionKg: active ? fishTensionKg : null,
    });
  }

  #positive(value, fallback = 0) {
    const number = Number(value);
    if (Number.isFinite(number)) return Math.max(0, number);
    return Math.max(0, Number(fallback) || 0);
  }

  #clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || 0));
  }
}
