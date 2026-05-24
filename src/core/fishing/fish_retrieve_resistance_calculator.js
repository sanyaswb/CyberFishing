/**
 * Calculates fish opposition against player retrieve.
 */
class FishRetrieveResistanceCalculator {
  calculate({
    fishWeightKg,
    totalFishForceKg,
    awayFromPlayerRatio,
    isLineTaut,
    landingLift,
    retrieveConfig,
    globalRetrieveConfig,
    modifiers,
    settingReader,
  } = {}) {
    const weight = this.#positive(fishWeightKg);
    const waterBodyResistance = isLineTaut
      ? weight *
        this.#positive(
          settingReader(
            retrieveConfig,
            "tautBodyResistanceKgPerKg",
            settingReader(
              retrieveConfig,
              "staticBodyResistanceKgPerKg",
              0.1,
              globalRetrieveConfig,
            ),
            globalRetrieveConfig,
          ),
        ) *
        this.#positive(modifiers?.staticMultiplier ?? 1)
      : 0;
    const tautBodyResistance = landingLift?.inZone
      ? this.#lerp(waterBodyResistance, weight, landingLift.ratio)
      : waterBodyResistance;
    const activeAwayMultiplier = this.#positive(
      modifiers?.activeAwayMultiplier ??
        settingReader(
          retrieveConfig,
          "activeAwayForceMultiplier",
          1,
          globalRetrieveConfig,
        ),
    );
    const activeAwayForce = landingLift?.disableActiveForces
      ? 0
      : this.#positive(totalFishForceKg) *
        this.#clamp01(awayFromPlayerRatio) *
        activeAwayMultiplier;
    const fishOpposition = tautBodyResistance + activeAwayForce;

    return Object.freeze({
      waterBodyResistanceKg: waterBodyResistance,
      tautBodyResistanceKg: tautBodyResistance,
      bodyResistanceKg: tautBodyResistance,
      activeAwayForceKg: activeAwayForce,
      fishOppositionKg: fishOpposition,
      activeAwayMultiplier,
      passiveBodyResistanceMultiplier: this.#positive(modifiers?.staticMultiplier ?? 1),
    });
  }

  #positive(value) {
    return Math.max(0, Number(value) || 0);
  }

  #clamp01(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
  }

  #lerp(a, b, t) {
    return a + (b - a) * this.#clamp01(t);
  }
}
