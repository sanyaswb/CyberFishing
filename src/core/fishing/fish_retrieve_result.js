/**
 * Runtime result for the simplified rodHold/reelHold fight model.
 *
 * Name kept for compatibility with the existing pipeline, but the data is no
 * longer the old pressure-transfer / water-drag retrieve model.
 */
class FishRetrieveResult {
  constructor(data = {}) {
    this.holdRatio = this.#ratio(data.holdRatio);

    this.playerPullPressureKg = this.#positive(data.playerPullPressureKg);
    this.fishPassiveKg = this.#positive(data.fishPassiveKg);
    this.fishActiveKg = this.#positive(data.fishActiveKg);
    this.fishOppositionKg = this.#positive(data.fishOppositionKg);
    this.fishTensionKg = this.#positive(data.fishTensionKg);

    this.rodHoldTensionCeilingMultiplier = this.#positive(
      data.rodHoldTensionCeilingMultiplier ?? 1,
    );
    this.rodHoldTensionCeilingKg = this.#positive(
      data.rodHoldTensionCeilingKg,
    );
    this.rodHoldMaxKg = this.#positive(data.rodHoldMaxKg);
    this.effectiveRodHoldKg = this.#positive(data.effectiveRodHoldKg);
    this.rawPlayerHoldTensionKg = this.#positive(
      data.rawPlayerHoldTensionKg ?? data.playerHoldTensionKg,
    );
    this.movableHoldTensionCapKg = this.#positive(
      data.movableHoldTensionCapKg,
    );
    this.movableHoldTensionCapRatio = this.#positive(
      data.movableHoldTensionCapRatio ?? 1,
    );
    this.movableHoldTensionCapApplied =
      !!data.movableHoldTensionCapApplied;
    this.fishCanMoveTowardPlayer = data.fishCanMoveTowardPlayer !== false;
    this.playerHoldTensionKg = this.#positive(data.playerHoldTensionKg);
    this.totalTensionKg = this.#positive(data.totalTensionKg);

    this.netForceKg = Number.isFinite(Number(data.netForceKg))
      ? Number(data.netForceKg)
      : 0;
    this.fishWonForceKg = this.#positive(data.fishWonForceKg);
    this.fishWonRadialForceKg = this.#positive(
      data.fishWonRadialForceKg ?? data.fishWonYForceKg,
    );
    this.fishWonYForceKg = this.#positive(data.fishWonYForceKg);
    this.yAwayRatio = this.#ratio(data.yAwayRatio ?? 1);
    this.dragBlockedForceKg = this.#positive(
      data.dragBlockedForceKg ?? data.fishTensionKg,
    );
    this.excessYForceKg = this.#positive(data.excessYForceKg);
    this.yEscapeForceKg = this.#positive(data.yEscapeForceKg ?? data.excessYForceKg);
    this.radialEscapeForceKg = this.#positive(
      data.radialEscapeForceKg ?? data.yEscapeForceKg ?? data.excessYForceKg,
    );
    this.radialSpeedPxPerSec = Number(data.radialSpeedPxPerSec) || 0;
    this.outwardRadialSpeedPxPerSec = this.#positive(
      data.outwardRadialSpeedPxPerSec,
    );
    this.tangentSpeedPxPerSec = this.#positive(
      data.tangentSpeedPxPerSec,
    );
    this.shouldSlipDrag = !!data.shouldSlipDrag;
    this.speedMps = this.#positive(data.speedMps);
    this.towardPlayerSpeedMps = this.#positive(data.towardPlayerSpeedMps);
    this.awaySpeedMps = this.#positive(data.awaySpeedMps);

    this.desiredMoveMeters = this.#positive(data.desiredMoveMeters);
    this.appliedMoveMeters = this.#positive(data.appliedMoveMeters);
    this.movementControlRatio = this.#ratio(data.movementControlRatio);
    this.movementBlocked = !!data.movementBlocked;
    this.tensionBlocked = !!data.tensionBlocked;
    this.balanceState = data.balanceState || "idle";
    this.actualSlackMeters = this.#positive(data.actualSlackMeters);
    this.lineTaut = data.lineTaut !== false;

    // Narrow compatibility aliases used by the existing pipeline/debug names.
    this.lineTensionKg = this.totalTensionKg;
    this.usefulPullForceKg = this.effectiveRodHoldKg;
    this.retrieveSpeedMetersPerSecond = this.speedMps;
    this.actualFishPullSpeedMetersPerSecond = this.towardPlayerSpeedMps;
    this.targetFishPullSpeedMetersPerSecond = this.towardPlayerSpeedMps;
  }

  withAppliedMovement({
    appliedMoveMeters,
    movementBlocked,
    tensionBlocked = false,
    hardTensionBlocked = tensionBlocked,
    disableMovableHoldCap = hardTensionBlocked,
  } = {}) {
    const capDisabled = !!disableMovableHoldCap;
    if (capDisabled && this.movableHoldTensionCapApplied) {
      const playerHoldTensionKg = this.rawPlayerHoldTensionKg;
      const totalTensionKg = this.fishTensionKg + playerHoldTensionKg;
      return new FishRetrieveResult({
        ...this,
        appliedMoveMeters,
        movementBlocked,
        tensionBlocked: true,
        fishCanMoveTowardPlayer: false,
        movableHoldTensionCapApplied: false,
        playerHoldTensionKg,
        totalTensionKg,
      });
    }

    return new FishRetrieveResult({
      ...this,
      appliedMoveMeters,
      movementBlocked,
      tensionBlocked: capDisabled,
    });
  }

  #positive(value) {
    return Math.max(0, Number(value) || 0);
  }

  #ratio(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
  }
}
