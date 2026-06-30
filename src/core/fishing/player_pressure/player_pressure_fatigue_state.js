class PlayerPressureFatigueState {
  enabled = false;
  efficiency = 1;
  pressureHoldMs = 0;
  recoveryIdleMs = 0;
  recoveryState = "full";
  pressureActive = false;
  pressureKg = 0;
  fatigueRatio = 0;
  fatigueProgress = 0;
  controlBreakEnabled = false;
  isControlExhausted = false;
  controlBreakFatigueRatioThreshold = 0.9;
  controlBreakMinContinuousPressureMs = 8000;
  delayAfterPressureMs = 0;
  recoveryPerSecond = 0;

  reset() {
    this.enabled = false;
    this.efficiency = 1;
    this.pressureHoldMs = 0;
    this.recoveryIdleMs = 0;
    this.recoveryState = "full";
    this.pressureActive = false;
    this.pressureKg = 0;
    this.fatigueRatio = 0;
    this.fatigueProgress = 0;
    this.controlBreakEnabled = false;
    this.isControlExhausted = false;
    this.controlBreakFatigueRatioThreshold = 0.9;
    this.controlBreakMinContinuousPressureMs = 8000;
    this.delayAfterPressureMs = 0;
    this.recoveryPerSecond = 0;
  }

  applyFrame(frame = {}) {
    this.enabled = frame.enabled === true;
    this.efficiency = this.#ratio(frame.efficiency, 1);
    this.pressureHoldMs = this.#positive(frame.pressureHoldMs);
    this.recoveryIdleMs = this.#positive(frame.recoveryIdleMs);
    this.recoveryState = frame.recoveryState || "full";
    this.pressureActive = frame.pressureActive === true;
    this.pressureKg = this.#positive(frame.pressureKg);
    this.fatigueRatio = this.#ratio(frame.fatigueRatio);
    this.fatigueProgress = this.#ratio(frame.fatigueProgress);
    this.controlBreakEnabled = frame.controlBreakEnabled === true;
    this.isControlExhausted = frame.isControlExhausted === true;
    this.controlBreakFatigueRatioThreshold = this.#ratio(
      frame.controlBreakFatigueRatioThreshold,
      0.9,
    );
    this.controlBreakMinContinuousPressureMs = this.#positive(
      frame.controlBreakMinContinuousPressureMs,
      8000,
    );
    this.delayAfterPressureMs = this.#positive(frame.delayAfterPressureMs);
    this.recoveryPerSecond = this.#positive(frame.recoveryPerSecond);
  }

  toFrame() {
    return Object.freeze({
      enabled: this.enabled,
      efficiency: this.efficiency,
      pressureHoldMs: this.pressureHoldMs,
      recoveryIdleMs: this.recoveryIdleMs,
      recoveryState: this.recoveryState,
      pressureActive: this.pressureActive,
      pressureKg: this.pressureKg,
      fatigueRatio: this.fatigueRatio,
      fatigueProgress: this.fatigueProgress,
      controlBreakEnabled: this.controlBreakEnabled,
      isControlExhausted: this.isControlExhausted,
      controlBreakFatigueRatioThreshold:
        this.controlBreakFatigueRatioThreshold,
      controlBreakMinContinuousPressureMs:
        this.controlBreakMinContinuousPressureMs,
      delayAfterPressureMs: this.delayAfterPressureMs,
      recoveryPerSecond: this.recoveryPerSecond,
    });
  }

  #positive(value, fallback = 0) {
    const number = Number(value);
    if (Number.isFinite(number) && number >= 0) return number;
    const safeFallback = Number(fallback);
    return Number.isFinite(safeFallback) && safeFallback >= 0
      ? safeFallback
      : 0;
  }

  #ratio(value, fallback = 0) {
    const number = Number(value);
    if (Number.isFinite(number)) return Math.max(0, Math.min(1, number));
    return Math.max(0, Math.min(1, Number(fallback) || 0));
  }
}

if (typeof window !== "undefined") {
  window.PlayerPressureFatigueState = PlayerPressureFatigueState;
}
