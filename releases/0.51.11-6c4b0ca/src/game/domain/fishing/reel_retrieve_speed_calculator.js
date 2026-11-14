import { nonNegativeFinite } from "../../../engine/math/number_normalization.js";

export class ReelRetrieveSpeedCalculator {
  calculate({
    baseSpeedMetersPerSec,
    bearingCount,
    bearingBonusMetersPerSec,
  } = {}) {
    return (
      nonNegativeFinite(baseSpeedMetersPerSec) +
      nonNegativeFinite(bearingCount) *
        nonNegativeFinite(bearingBonusMetersPerSec)
    );
  }
}
