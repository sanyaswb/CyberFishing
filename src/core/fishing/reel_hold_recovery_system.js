class ReelHoldRecoverySystem {
  #timerMs = 0;
  #state = this.#createState({ blockedReason: "not_checked" });

  update({
    dtMs,
    config = {},
    hasReel,
    playerHoldActive,
    rodPullActive,
    strokeRatio,
    strokeCapacityMeters,
    strokeUnrecoveredMeters,
    rodPullBlockedReason,
    rawTensionKg,
    dragLimitKg,
    dragLocked,
    shouldSlipDrag,
    reelMaxLoadKg,
    retrieveSpeedMetersPerSecond,
    lineRecoverableMeters,
  } = {}) {
    const delayMs = this.#resolveDelayMs(config);
    const requiredStrokeRatio = this.#ratio(config.strokeRatio, 1);
    const strokeToleranceMeters = this.#positive(
      config.strokeToleranceMeters,
      0.001,
    );
    const loadKg = this.#positive(rawTensionKg);
    const maxLoadKg = this.#positive(reelMaxLoadKg);
    const retrieveSpeed = this.#positive(retrieveSpeedMetersPerSecond);
    const recoverableLine = this.#positive(lineRecoverableMeters);
    const loadReserveRatio = maxLoadKg > 0
      ? this.#ratio((maxLoadKg - loadKg) / maxLoadKg, 0)
      : 0;
    const recoverSpeed =
      retrieveSpeed * loadReserveRatio;
    const strokeFull = this.#isStrokeFull({
      requireStrokeFull: config.requireRodStrokeFull !== false,
      strokeRatio,
      requiredStrokeRatio,
      strokeCapacityMeters,
      strokeUnrecoveredMeters,
      strokeToleranceMeters,
      rodPullBlockedReason,
    });
    const tensionBelowDragLimit =
      !!dragLocked || loadKg < this.#positive(dragLimitKg) - 0.001;
    const tensionBelowMaxLoad = loadReserveRatio > 0.01;
    const dragCanHold =
      shouldSlipDrag !== true &&
      tensionBelowDragLimit &&
      tensionBelowMaxLoad;
    const hasRecoverableLine = recoverableLine > 0.001;
    const enabled = config.enabled !== false;
    const eligible =
      enabled &&
      !!hasReel &&
      !!playerHoldActive &&
      !!rodPullActive &&
      strokeFull &&
      dragCanHold &&
      hasRecoverableLine &&
      recoverSpeed > 0.001;

    const blockedReason = this.#blockedReason({
      enabled,
      hasReel,
      playerHoldActive,
      rodPullActive,
      strokeFull,
      dragCanHold,
      tensionBelowDragLimit,
      tensionBelowMaxLoad,
      hasRecoverableLine,
      loadReserveRatio,
      recoverSpeed,
    });

    this.#timerMs = eligible
      ? Math.min(delayMs, this.#timerMs + this.#positive(dtMs))
      : 0;

    const active = eligible && this.#timerMs >= delayMs;
    this.#state = this.#createState({
      eligible,
      active,
      timerMs: this.#timerMs,
      delayMs,
      reelLoadReserveRatio: loadReserveRatio,
      reelMaxLoadKg: maxLoadKg,
      recoverSpeedMetersPerSecond: recoverSpeed,
      maxMoveMeters: recoverSpeed * (this.#positive(dtMs) / 1000),
      blockedReason,
      strokeFull,
      dragCanHold,
      lineRecoverableMeters: recoverableLine,
    });
    return this.#state;
  }

  getState() {
    return { ...this.#state };
  }

  reset() {
    this.#timerMs = 0;
    this.#state = this.#createState({ blockedReason: "reset" });
  }

  #isStrokeFull({
    requireStrokeFull,
    strokeRatio,
    requiredStrokeRatio,
    strokeCapacityMeters,
    strokeUnrecoveredMeters,
    strokeToleranceMeters,
    rodPullBlockedReason,
  }) {
    if (!requireStrokeFull) return true;
    const capacity = this.#positive(strokeCapacityMeters);
    const unrecovered = this.#positive(strokeUnrecoveredMeters);
    return (
      this.#ratio(strokeRatio, 0) >= requiredStrokeRatio ||
      (
        capacity > 0 &&
        unrecovered >= capacity - strokeToleranceMeters
      ) ||
      rodPullBlockedReason === "max_distance_reached"
    );
  }

  #blockedReason({
    enabled,
    hasReel,
    playerHoldActive,
    rodPullActive,
    strokeFull,
    dragCanHold,
    tensionBelowDragLimit,
    tensionBelowMaxLoad,
    hasRecoverableLine,
    loadReserveRatio,
    recoverSpeed,
  }) {
    if (!enabled) return "disabled";
    if (!hasReel) return "no_reel";
    if (!playerHoldActive) return "not_holding";
    if (!rodPullActive) return "rod_pull_inactive";
    if (!strokeFull) return "stroke_not_full";
    if (!dragCanHold) {
      if (!tensionBelowDragLimit) return "at_drag_limit";
      if (!tensionBelowMaxLoad) return "near_max_load";
      return "drag_slipping";
    }
    if (!hasRecoverableLine) return "no_recoverable_line";
    if (loadReserveRatio <= 0.01) return "no_reel_load_reserve";
    if (recoverSpeed <= 0.001) return "zero_recover_speed";
    return "ready";
  }

  #resolveDelayMs(config) {
    const delay = Number(config.delayMs);
    return Number.isFinite(delay) ? Math.max(0, delay) : 0;
  }

  #createState(overrides = {}) {
    return {
      eligible: false,
      active: false,
      timerMs: 0,
      delayMs: 0,
      reelLoadReserveRatio: 0,
      reelMaxLoadKg: 0,
      recoverSpeedMetersPerSecond: 0,
      maxMoveMeters: 0,
      blockedReason: "not_checked",
      strokeFull: false,
      dragCanHold: false,
      lineRecoverableMeters: 0,
      ...overrides,
    };
  }

  #positive(value, fallback = 0) {
    const number = Number(value);
    if (Number.isFinite(number)) return Math.max(0, number);
    return Math.max(0, Number(fallback) || 0);
  }

  #ratio(value, fallback = 0) {
    return Math.max(0, Math.min(1, this.#positive(value, fallback)));
  }
}
