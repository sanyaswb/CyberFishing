import { clampUnit, nonNegative } from "../../../engine/math/number_normalization.js";

/**
 * Runtime result for the simplified rodHold/reelHold fight model.
 *
 * Name kept for compatibility with the existing pipeline, but the data is no
 * longer the old pressure-transfer / water-drag retrieve model.
 */
export class FishRetrieveResult {
  constructor(data = {}) {
    this.holdRatio = clampUnit(data.holdRatio);

    this.playerPullPressureKg = nonNegative(data.playerPullPressureKg);
    this.fishPassiveKg = nonNegative(data.fishPassiveKg);
    this.fishActiveKg = nonNegative(data.fishActiveKg);
    this.fishOppositionKg = nonNegative(data.fishOppositionKg);
    this.fishTensionKg = nonNegative(data.fishTensionKg);

    this.rodHoldTensionCeilingMultiplier = nonNegative(
      data.rodHoldTensionCeilingMultiplier ?? 1,
    );
    this.rodHoldTensionCeilingKg = nonNegative(
      data.rodHoldTensionCeilingKg,
    );
    this.rodHoldMaxKg = nonNegative(data.rodHoldMaxKg);
    this.effectiveRodHoldKg = nonNegative(data.effectiveRodHoldKg);
    this.rawPlayerHoldTensionKg = nonNegative(
      data.rawPlayerHoldTensionKg ?? data.playerHoldTensionKg,
    );
    this.movableHoldTensionCapKg = nonNegative(
      data.movableHoldTensionCapKg,
    );
    this.movableHoldTensionCapRatio = nonNegative(
      data.movableHoldTensionCapRatio ?? 1,
    );
    this.movableHoldTensionCapApplied =
      !!data.movableHoldTensionCapApplied;
    this.fishCanMoveTowardPlayer = data.fishCanMoveTowardPlayer !== false;
    this.playerHoldTensionKg = nonNegative(data.playerHoldTensionKg);
    this.totalTensionKg = nonNegative(data.totalTensionKg);

    this.netForceKg = Number.isFinite(Number(data.netForceKg))
      ? Number(data.netForceKg)
      : 0;
    this.fishWonForceKg = nonNegative(data.fishWonForceKg);
    this.fishWonRadialForceKg = nonNegative(
      data.fishWonRadialForceKg ?? data.fishWonYForceKg,
    );
    this.fishWonYForceKg = nonNegative(data.fishWonYForceKg);
    this.radialAwayRatio = clampUnit(
      data.radialAwayRatio ?? data.yAwayRatio ?? 1,
    );
    this.yAwayRatio = this.radialAwayRatio;
    this.dragBlockedForceKg = nonNegative(
      data.dragBlockedForceKg ?? data.fishTensionKg,
    );
    this.excessYForceKg = nonNegative(data.excessYForceKg);
    this.yEscapeForceKg = nonNegative(data.yEscapeForceKg ?? data.excessYForceKg);
    this.radialEscapeForceKg = nonNegative(
      data.radialEscapeForceKg ?? data.yEscapeForceKg ?? data.excessYForceKg,
    );
    this.radialSpeedPxPerSec = Number(data.radialSpeedPxPerSec) || 0;
    this.finalRadialSpeedPxPerSec =
      Number(data.finalRadialSpeedPxPerSec) || 0;
    this.outwardRadialSpeedPxPerSec = nonNegative(
      data.outwardRadialSpeedPxPerSec,
    );
    this.tangentSpeedPxPerSec = nonNegative(
      data.tangentSpeedPxPerSec,
    );
    this.shouldSlipDrag = !!data.shouldSlipDrag;
    this.speedMps = nonNegative(data.speedMps);
    this.towardPlayerSpeedMps = nonNegative(data.towardPlayerSpeedMps);
    this.awaySpeedMps = nonNegative(data.awaySpeedMps);

    this.desiredMoveMeters = nonNegative(data.desiredMoveMeters);
    this.appliedMoveMeters = nonNegative(data.appliedMoveMeters);
    this.movementControlRatio = clampUnit(data.movementControlRatio);
    this.movementBlocked = !!data.movementBlocked;
    this.tensionBlocked = !!data.tensionBlocked;
    this.balanceState = data.balanceState || "idle";
    this.actualSlackMeters = nonNegative(data.actualSlackMeters);
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
}
