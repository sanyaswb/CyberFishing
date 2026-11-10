export class RodStrokeDistanceTracker {
  calculate({
    previousDistanceMeters,
    currentDistanceMeters,
    epsilonMeters = 0.000001,
    reasonPrefix = "line_distance",
  } = {}) {
    const previous = this.#positive(previousDistanceMeters);
    const current = this.#positive(currentDistanceMeters);
    const epsilon = Math.max(0, Number(epsilonMeters) || 0.000001);

    if (!Number.isFinite(previous) || !Number.isFinite(current)) {
      return Object.freeze({
        previousDistanceMeters: 0,
        currentDistanceMeters: 0,
        deltaMeters: 0,
        gainedMeters: 0,
        lostMeters: 0,
        reason: `${reasonPrefix}_invalid_distance`,
      });
    }

    const delta = previous - current;
    if (delta > epsilon) {
      return Object.freeze({
        previousDistanceMeters: previous,
        currentDistanceMeters: current,
        deltaMeters: delta,
        gainedMeters: delta,
        lostMeters: 0,
        reason: `${reasonPrefix}_distance_gained`,
      });
    }

    if (delta < -epsilon) {
      return Object.freeze({
        previousDistanceMeters: previous,
        currentDistanceMeters: current,
        deltaMeters: delta,
        gainedMeters: 0,
        lostMeters: Math.abs(delta),
        reason: `${reasonPrefix}_distance_lost`,
      });
    }

    return Object.freeze({
      previousDistanceMeters: previous,
      currentDistanceMeters: current,
      deltaMeters: 0,
      gainedMeters: 0,
      lostMeters: 0,
      reason: `${reasonPrefix}_stable_distance`,
    });
  }

  #positive(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return NaN;
    return Math.max(0, number);
  }
}
