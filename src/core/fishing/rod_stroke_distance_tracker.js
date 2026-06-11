class RodStrokeDistanceTracker {
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

  calculateFromPositions({
    previousFishPosition,
    currentFishPosition,
    rodTipPosition,
    pixelsPerMeter,
    epsilonMeters,
    reasonPrefix,
  } = {}) {
    const scale = Math.max(1, Number(pixelsPerMeter) || 50);
    return this.calculate({
      previousDistanceMeters: this.#distanceMeters({
        fishPosition: previousFishPosition,
        rodTipPosition,
        scale,
      }),
      currentDistanceMeters: this.#distanceMeters({
        fishPosition: currentFishPosition,
        rodTipPosition,
        scale,
      }),
      epsilonMeters,
      reasonPrefix,
    });
  }

  #distanceMeters({ fishPosition, rodTipPosition, scale }) {
    const fishX = Number(fishPosition?.x);
    const fishY = Number(fishPosition?.y);
    const rodX = Number(rodTipPosition?.x);
    const rodY = Number(rodTipPosition?.y);
    if (
      !Number.isFinite(fishX) ||
      !Number.isFinite(fishY) ||
      !Number.isFinite(rodX) ||
      !Number.isFinite(rodY)
    ) {
      return 0;
    }
    return Math.hypot(fishX - rodX, fishY - rodY) / scale;
  }

  #positive(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return NaN;
    return Math.max(0, number);
  }
}
