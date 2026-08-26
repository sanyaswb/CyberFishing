export class LineConstraintStateResolver {
  // Normalizes facts prepared by line and drag orchestration.
  // It deliberately does not calculate force, drag thresholds or payout.
  resolve({
    lineState,
    payoutContext,
    config = {},
  } = {}) {
    const epsilonMeters = Math.max(
      0.000001,
      this.#number(config.epsilonMeters, 0.001),
    );
    const tautThresholdRatio = this.#clamp(
      this.#number(config.tautThresholdRatio, 0.995),
      0,
      1,
    );
    const releasedMeters = Math.max(
      0,
      this.#number(lineState?.releasedMeters),
    );
    const distanceMeters = Math.max(
      0,
      this.#number(lineState?.distanceMeters),
    );
    const remainingMeters = Math.max(
      0,
      this.#number(lineState?.remainingMeters),
    );
    const lineHasReserve =
      typeof lineState?.canReleaseLine === "boolean"
        ? lineState.canReleaseLine
        : remainingMeters > epsilonMeters;
    const lineExtensionRatio =
      releasedMeters > epsilonMeters
        ? this.#clamp(distanceMeters / releasedMeters, 0, 1.5)
        : 1;
    const tautLine = lineExtensionRatio >= tautThresholdRatio;

    const dragCanPayout =
      lineHasReserve && payoutContext?.dragCanPayout === true;
    const hardLineLimit = !lineHasReserve && tautLine;
    const dragPayoutBlocked =
      lineHasReserve &&
      !dragCanPayout &&
      payoutContext?.dragPayoutBlocked !== false;
    const lineLengthLocked = !dragCanPayout;
    const radialConstraintActive = tautLine && lineLengthLocked;
    const reason = hardLineLimit
      ? "spool_empty"
      : dragPayoutBlocked
        ? payoutContext?.reason || "drag_holding"
        : "none";

    return Object.freeze({
      releasedMeters,
      distanceMeters,
      remainingMeters,
      lineHasReserve,
      lineExtensionRatio,
      tautLine,
      dragCanPayout,
      dragPayoutBlocked,
      hardLineLimit,
      lineLengthLocked,
      radialConstraintActive,
      lockedLengthMeters: releasedMeters,
      epsilonMeters,
      reason,
      payoutOccurred: payoutContext?.payoutOccurred === true,
      payoutBlockedReason:
        payoutContext?.payoutBlockedReason || "none",
    });
  }

  #number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  #clamp(value, min, max) {
    return Math.max(min, Math.min(max, this.#number(value, min)));
  }
}
