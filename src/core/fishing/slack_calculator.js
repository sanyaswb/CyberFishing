class SlackCalculator {
  calculate({ releasedMeters, fishDistanceMeters }) {
    return Math.max(0, (Number(releasedMeters) || 0) - (Number(fishDistanceMeters) || 0));
  }
}
