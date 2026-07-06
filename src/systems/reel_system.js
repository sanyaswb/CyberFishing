class ReelSystem {
  #config;
  #autoRecoveryCalculator = new ReelAutoRecoveryCalculator();

  constructor(config = {}) {
    this.#config = config || {};
  }

  recoverLineCredit({
    dtSec,
    lineSystem,
    reel,
    tensionKg,
    inputRecover = true,
    loadLimitKg = null,
    maxRecoverMeters = null,
  }) {
    if (this.#config.autoRecoverLineCredit === false) return 0;
    if (!lineSystem || !reel?.hasReel?.()) return 0;
    return lineSystem.recoverLineCredit({
      hasReel: true,
      inputRecover,
      reel,
      tensionKg,
      dtSec,
      loadLimitKg,
      maxRecoverMeters,
    });
  }

  recoverRodStrokeCredit({
    dtSec,
    lineSystem,
    reel,
    tensionKg,
    blockedReason,
    playerHoldActive,
    strokeWonMeters,
    fishDistanceMeters,
  } = {}) {
    const lineState = lineSystem?.getState?.() || {};
    const reelMaxLoadKg =
      reel?.getEffectiveMaxLoadKg?.() ??
      reel?.getMaxLoadKg?.() ??
      0;
    const retrieveSpeedMetersPerSec =
      reel?.getRetrieveSpeedMetersPerSec?.() ?? 0;

    if (blockedReason) {
      return {
        active: false,
        blockedReason,
        retrieveSpeedMetersPerSec,
        reelMaxLoadKg,
        tensionKg: Math.max(0, Number(tensionKg) || 0),
        reelLoadRatio: 1,
        reelEfficiency: 0,
        recoverSpeedMetersPerSec: 0,
        desiredRecoverMeters: 0,
        maxRecoverByLineMeters: Math.max(
          0,
          (Number(lineState.releasedMeters) || 0) -
            (Number(fishDistanceMeters ?? lineState.distanceMeters) || 0),
        ),
        recoveredMeters: 0,
      };
    }

    const result = this.#autoRecoveryCalculator.calculate({
      hasReel: !!reel?.hasReel?.(),
      playerHoldActive,
      strokeWonMeters,
      totalTensionKg: tensionKg,
      reelMaxLoadKg,
      retrieveSpeedMetersPerSec,
      releasedLineMeters: lineState.releasedMeters,
      fishDistanceMeters:
        fishDistanceMeters ?? lineState.distanceMeters,
      dtSec,
    });

    const recoveredMeters = result.recoveredMeters > 0 && lineSystem
      ? lineSystem.recoverReleasedLine({
          meters: result.recoveredMeters,
          minReleasedMeters:
            fishDistanceMeters ?? lineState.distanceMeters,
        })
      : 0;

    return {
      ...result,
      recoveredMeters,
      active: recoveredMeters > 0.000001,
      blockedReason:
        recoveredMeters > 0.000001 ? "none" : result.blockedReason,
    };
  }
}
