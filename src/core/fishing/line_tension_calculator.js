/**
 * Calculates final line tension after drag slip rules.
 */
class LineTensionCalculator {
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
  } = {}) {
    const directTotal = Number(totalTensionKg);
    if (Number.isFinite(directTotal)) {
      const tension = Math.max(0, directTotal);
      return this.#result({
        tensionKg: tension,
        rawTensionKg: tension,
        fishTensionKg,
        playerHoldTensionKg,
        rodLimitKg,
        lineLimitKg,
        hookLimitKg,
        shouldSlipDrag: false,
        mode: "simple_total",
      });
    }

    const fishForce = Math.max(0, Number(fishForceKg) || 0);
    const pullForce = Math.max(0, Number(rodPullForceKg) || 0);
    const rawTension = fishForce + pullForce;
    const dragLimit = Math.max(0, Number(dragLimitKg) || 0);
    const canSlip = !dragLocked && !!lineHasReserve && rawTension > dragLimit;

    if (canSlip) {
      return this.#result({
        tensionKg: dragLimit,
        rawTensionKg: rawTension,
        fishTensionKg: fishForce,
        playerHoldTensionKg: pullForce,
        rodLimitKg,
        lineLimitKg,
        hookLimitKg,
        shouldSlipDrag: true,
        mode: "drag_limit",
      });
    }

    if (hardLineLimit || dragLocked) {
      return this.#result({
        tensionKg: rawTension,
        rawTensionKg: rawTension,
        fishTensionKg: fishForce,
        playerHoldTensionKg: pullForce,
        rodLimitKg,
        lineLimitKg,
        hookLimitKg,
        shouldSlipDrag: false,
        mode: "raw",
      });
    }

    return this.#result({
      tensionKg: rawTension,
      rawTensionKg: rawTension,
      fishTensionKg: fishForce,
      playerHoldTensionKg: pullForce,
      rodLimitKg,
      lineLimitKg,
      hookLimitKg,
      shouldSlipDrag: false,
      mode: "raw",
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
    const resolvedTotal = Math.max(total, fishTension + playerTension);
    return {
      tensionKg: total,
      rawTensionKg: Math.max(0, Number(rawTensionKg) || 0),
      fishTensionKg: fishTension,
      playerHoldTensionKg: playerTension,
      totalTensionKg: resolvedTotal,
      rodStressRatio: this.#stressRatio(resolvedTotal, rodLimitKg),
      lineStressRatio: this.#stressRatio(resolvedTotal, lineLimitKg),
      hookStressRatio: this.#stressRatio(resolvedTotal, hookLimitKg),
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
