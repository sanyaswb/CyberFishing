export class ReelRetrieveSpeedCalculator {
  calculate({
    baseSpeedMetersPerSec,
    bearingCount,
    bearingBonusMetersPerSec,
  } = {}) {
    return (
      this.#positive(baseSpeedMetersPerSec) +
      this.#positive(bearingCount) *
        this.#positive(bearingBonusMetersPerSec)
    );
  }

  #positive(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }
}
