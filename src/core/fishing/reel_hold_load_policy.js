class ReelHoldLoadPolicy {
  evaluate({
    dtMs,
    config = {},
    hasReel = false,
    playerHoldActive = false,
    rawTensionKg = 0,
    dragLimitKg = 0,
    dragLocked = false,
    shouldSlipDrag = false,
    reelMaxLoadKg = 0,
    retrieveSpeedMetersPerSecond = 0,
  } = {}) {
    const enabled = config.enabled !== false;
    const loadKg = this.#positive(rawTensionKg);
    const maxLoadKg = this.#positive(reelMaxLoadKg);
    const retrieveSpeed = this.#positive(retrieveSpeedMetersPerSecond);
    const loadReserveRatio = maxLoadKg > 0
      ? this.#ratio((maxLoadKg - loadKg) / maxLoadKg)
      : 0;
    const tensionBelowDragLimit =
      !!dragLocked || loadKg < this.#positive(dragLimitKg) - 0.001;
    const tensionBelowMaxLoad = loadReserveRatio > 0.01;
    const dragCanHold =
      shouldSlipDrag !== true &&
      tensionBelowDragLimit &&
      tensionBelowMaxLoad;
    const recoverSpeedMetersPerSecond =
      retrieveSpeed * loadReserveRatio;
    const eligible =
      enabled &&
      !!hasReel &&
      !!playerHoldActive &&
      dragCanHold &&
      recoverSpeedMetersPerSecond > 0.001;

    return {
      eligible,
      active: eligible,
      reelLoadReserveRatio: loadReserveRatio,
      reelMaxLoadKg: maxLoadKg,
      recoverSpeedMetersPerSecond,
      maxMoveMeters:
        recoverSpeedMetersPerSecond *
        (this.#positive(dtMs) / 1000),
      blockedReason: this.#blockedReason({
        enabled,
        hasReel,
        playerHoldActive,
        shouldSlipDrag,
        tensionBelowDragLimit,
        tensionBelowMaxLoad,
        recoverSpeedMetersPerSecond,
      }),
      dragCanHold,
    };
  }

  #blockedReason({
    enabled,
    hasReel,
    playerHoldActive,
    shouldSlipDrag,
    tensionBelowDragLimit,
    tensionBelowMaxLoad,
    recoverSpeedMetersPerSecond,
  }) {
    if (!enabled) return "disabled";
    if (!hasReel) return "no_reel";
    if (!playerHoldActive) return "not_holding";
    if (shouldSlipDrag) return "drag_slipping";
    if (!tensionBelowDragLimit) return "at_drag_limit";
    if (!tensionBelowMaxLoad) return "near_max_load";
    if (recoverSpeedMetersPerSecond <= 0.001) return "zero_recover_speed";
    return "ready";
  }

  #positive(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number)
      ? Math.max(0, number)
      : Math.max(0, Number(fallback) || 0);
  }

  #ratio(value) {
    return Math.max(0, Math.min(1, this.#positive(value)));
  }
}
