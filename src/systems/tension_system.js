class TensionSystem {
  calculate({
    fishForceKg,
    rodPullForceKg,
    dragLimitKg,
    hardLineLimit,
    lineHasReserve,
    dragLocked,
    slackMeters,
  }) {
    const fishForce = Math.max(0, Number(fishForceKg) || 0);
    const pullForce = Math.max(0, Number(rodPullForceKg) || 0);
    const rawTension = fishForce + pullForce;
    const dragLimit = Math.max(0, Number(dragLimitKg) || 0);
    const slack = Math.max(0, Number(slackMeters) || 0);
    const canSlip = !dragLocked && !!lineHasReserve && rawTension > dragLimit;

    if (!hardLineLimit && pullForce <= 0.000001 && slack > 0.001) {
      return this.#result(0, false, rawTension, "slack");
    }

    if (hardLineLimit || dragLocked) {
      return this.#result(rawTension, false, rawTension, "raw");
    }

    if (canSlip) {
      return this.#result(dragLimit, true, rawTension, "drag_limit");
    }

    return this.#result(rawTension, false, rawTension, "raw");
  }

  #result(tensionKg, shouldSlipDrag, rawTensionKg, mode) {
    return {
      tensionKg: Math.max(0, Number(tensionKg) || 0),
      rawTensionKg: Math.max(0, Number(rawTensionKg) || 0),
      shouldSlipDrag: !!shouldSlipDrag,
      mode,
    };
  }
}
