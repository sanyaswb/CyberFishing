class RecoverableLineCalculator {
  calculateRecoverableLineMeters({ releasedMeters, fishDistanceMeters }) {
    return Math.max(
      0,
      (Number(releasedMeters) || 0) - (Number(fishDistanceMeters) || 0),
    );
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

