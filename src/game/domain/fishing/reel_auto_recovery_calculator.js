export class ReelAutoRecoveryCalculator {
  calculate({
    hasReel,
    playerHoldActive,
    strokeWonMeters,
    totalTensionKg,
    reelMaxLoadKg,
    retrieveSpeedMetersPerSec,
    releasedLineMeters,
    fishDistanceMeters,
    dtSec,
  } = {}) {
    const strokeWon = this.#positive(strokeWonMeters);
    const retrieveSpeed = this.#positive(retrieveSpeedMetersPerSec);
    const reelMaxLoad = this.#positive(reelMaxLoadKg);
    const tension = this.#positive(totalTensionKg);
    const releasedLine = this.#positive(releasedLineMeters);
    const fishDistance = this.#positive(fishDistanceMeters);
    const maxRecoverByLineMeters = Math.max(0, releasedLine - fishDistance);
    const reelLoadRatio = reelMaxLoad > 0
      ? this.#clamp01(tension / reelMaxLoad)
      : 1;
    const reelEfficiency = reelMaxLoad > 0 && tension < reelMaxLoad - 0.000001
      ? 1
      : 0;
    const recoverSpeedMetersPerSec = retrieveSpeed;
    const desiredRecoverMeters =
      recoverSpeedMetersPerSec * this.#positive(dtSec);

    const blockedReason = this.#blockedReason({
      hasReel,
      playerHoldActive,
      strokeWon,
      retrieveSpeed,
      reelMaxLoad,
      tension,
      maxRecoverByLineMeters,
      desiredRecoverMeters,
    });
    const recoveredMeters = blockedReason === "none"
      ? Math.min(desiredRecoverMeters, strokeWon, maxRecoverByLineMeters)
      : 0;

    return Object.freeze({
      active: recoveredMeters > 0.000001,
      blockedReason: recoveredMeters > 0.000001 ? "none" : blockedReason,
      retrieveSpeedMetersPerSec: retrieveSpeed,
      reelMaxLoadKg: reelMaxLoad,
      tensionKg: tension,
      reelLoadRatio,
      reelEfficiency,
      recoverSpeedMetersPerSec,
      desiredRecoverMeters,
      maxRecoverByLineMeters,
      recoveredMeters,
    });
  }

  #blockedReason({
    hasReel,
    playerHoldActive,
    strokeWon,
    retrieveSpeed,
    reelMaxLoad,
    tension,
    maxRecoverByLineMeters,
    desiredRecoverMeters,
  }) {
    if (!hasReel) return "no_reel";
    if (playerHoldActive) return "hold_active";
    if (strokeWon <= 0.000001) return "no_stroke_credit";
    if (retrieveSpeed <= 0.000001) return "zero_retrieve_speed";
    if (reelMaxLoad <= 0.000001) return "zero_reel_load";
    if (tension >= reelMaxLoad - 0.000001) {
      return "tension_at_or_above_reel_load";
    }
    if (maxRecoverByLineMeters <= 0.000001) return "stroke_line_desync";
    if (desiredRecoverMeters <= 0.000001) return "zero_recover_speed";
    return "none";
  }

  #positive(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, number) : 0;
  }

  #clamp01(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
  }
}
