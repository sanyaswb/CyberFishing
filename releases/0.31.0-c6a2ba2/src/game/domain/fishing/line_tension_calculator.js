/**
 * Calculates final line tension after drag slip rules.
 */
export class LineTensionCalculator {
  calculate({
    totalTensionKg,
    fishTensionKg,
    playerHoldTensionKg,
    rodLimitKg,
    lineLimitKg,
    hookLimitKg,
    fishForceKg,
    rodPullForceKg,
    dragLimitKg,
    hardLineLimit,
    lineHasReserve,
    dragLocked,
    dragAlreadyResolved = false,
    shouldSlipDrag = false,
  } = {}) {
    const directTotal = Number(totalTensionKg);
    const fishForce = Math.max(0, Number(fishForceKg) || 0);
    const pullForce = Math.max(0, Number(rodPullForceKg) || 0);
    const rawTension = Number.isFinite(directTotal)
      ? Math.max(0, directTotal)
      : fishForce + pullForce;
    const resolvedFishTension = Number.isFinite(Number(fishTensionKg))
      ? fishTensionKg
      : fishForce;
    const resolvedPlayerTension = Number.isFinite(Number(playerHoldTensionKg))
      ? playerHoldTensionKg
      : pullForce;
    const dragLimit = Math.max(0, Number(dragLimitKg) || 0);
    const canSlip =
      !hardLineLimit &&
      !dragLocked &&
      !!lineHasReserve &&
      rawTension > dragLimit;

    if (canSlip) {
      return this.#result({
        tensionKg: dragLimit,
        rawTensionKg: rawTension,
        fishTensionKg: resolvedFishTension,
        playerHoldTensionKg: resolvedPlayerTension,
        rodLimitKg,
        lineLimitKg,
        hookLimitKg,
        shouldSlipDrag: true,
        mode: dragAlreadyResolved ? "drag_resolved_limit" : "drag_limit",
      });
    }

    if (hardLineLimit || dragLocked) {
      return this.#result({
        tensionKg: rawTension,
        rawTensionKg: rawTension,
        fishTensionKg: resolvedFishTension,
        playerHoldTensionKg: resolvedPlayerTension,
        rodLimitKg,
        lineLimitKg,
        hookLimitKg,
        shouldSlipDrag,
        mode: "raw",
      });
    }

    return this.#result({
      tensionKg: rawTension,
      rawTensionKg: rawTension,
      fishTensionKg: resolvedFishTension,
      playerHoldTensionKg: resolvedPlayerTension,
      rodLimitKg,
      lineLimitKg,
      hookLimitKg,
      shouldSlipDrag,
      mode: dragAlreadyResolved ? "drag_resolved" : "raw",
    });
  }

  #result({
    tensionKg,
    rawTensionKg,
    fishTensionKg,
    playerHoldTensionKg,
    rodLimitKg,
    lineLimitKg,
    hookLimitKg,
    shouldSlipDrag,
    mode,
  }) {
    const total = Math.max(0, Number(tensionKg) || 0);
    const fishTension = Math.max(0, Number(fishTensionKg) || 0);
    const playerTension = Math.max(0, Number(playerHoldTensionKg) || 0);
    return {
      tensionKg: total,
      rawTensionKg: Math.max(0, Number(rawTensionKg) || 0),
      fishTensionKg: fishTension,
      playerHoldTensionKg: playerTension,
      totalTensionKg: total,
      rawTotalTensionKg: Math.max(0, Number(rawTensionKg) || 0),
      rodStressRatio: this.#stressRatio(total, rodLimitKg),
      lineStressRatio: this.#stressRatio(total, lineLimitKg),
      hookStressRatio: this.#stressRatio(total, hookLimitKg),
      shouldSlipDrag: !!shouldSlipDrag,
      mode,
    };
  }

  #stressRatio(tensionKg, limitKg) {
    const limit = Number(limitKg);
    if (!Number.isFinite(limit) || limit <= 0) return 0;
    return Math.max(0, Number(tensionKg) || 0) / limit;
  }
}
