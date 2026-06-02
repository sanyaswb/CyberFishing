class PumpCreditCalculator {
  calculateRecoverableLineMeters({ releasedMeters, fishDistanceMeters }) {
    return Math.max(
      0,
      (Number(releasedMeters) || 0) - (Number(fishDistanceMeters) || 0),
    );
  }

  // Backward-compatible shorthand for older checks/build scripts.
  calculate(args) {
    return this.calculateRecoverableLineMeters(args || {});
  }
}

class LooseLineCalculator {
  calculateActualSlackMeters({
    releasedMeters,
    fishDistanceMeters,
    fishMovingTowardPlayer = false,
    playerPulling = false,
    reelRecovering = false,
  }) {
    if (!fishMovingTowardPlayer || playerPulling || reelRecovering) return 0;
    return Math.max(
      0,
      (Number(releasedMeters) || 0) - (Number(fishDistanceMeters) || 0),
    );
  }
}

// Deprecated compatibility alias.
// Historically this value was called "slack", but in the fight loop it is used
// as recoverable line / pump credit: the distance won by rod stroke that a reel
// can later take up. Real loose line is modelled separately by LooseLineCalculator.
// TODO(actual-loose-line): use LooseLineCalculator only for visual sag/debug or
// a future hook-control mechanic. Do not feed pump credit into TensionSystem.
class SlackCalculator extends PumpCreditCalculator {}
