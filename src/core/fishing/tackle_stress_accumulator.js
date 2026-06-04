class TackleStressAccumulator {
  #stressValue = 0;
  #rollTimerMs = 0;
  #lastRollValue = null;
  #lastRollPassed = false;
  #lastGuaranteedFailure = false;
  #lastFailureSource = null;
  #lastStressGainPerSecond = 0;
  #lastFailureChance = 0;
  #lastOverloadKg = 0;

  update({
    effectiveTensionKg = 0,
    mainTackleLimitKg = 1,
    dtSec = 0,
    config = {},
    rng = null,
  } = {}) {
    const stressConfig = config.stress || {};
    const rollConfig = config.failureRoll || {};
    const capacity = this.#positive(stressConfig.capacity, 1);
    const baseGainPerSecond = this.#nonNegative(
      stressConfig.baseGainPerSecond,
      0.45,
    );
    const recoveryPerSecond = this.#nonNegative(
      stressConfig.recoveryPerSecond,
      0.35,
    );
    const minStressToRoll = this.#nonNegative(
      stressConfig.minStressToRoll,
      0.01,
    );
    const intervalMs = this.#positive(rollConfig.intervalMs, 500);
    const chanceScale = this.#nonNegative(rollConfig.chanceScale, 1);
    const limit = this.#positive(mainTackleLimitKg, 1);
    const dt = this.#nonNegative(dtSec, 0);
    const effectiveTension = this.#nonNegative(effectiveTensionKg, 0);
    const overloadKg = Math.max(0, effectiveTension - limit);
    const stressGainPerSecond = baseGainPerSecond * (overloadKg / limit);

    this.#lastGuaranteedFailure = false;
    this.#lastFailureSource = null;
    this.#lastStressGainPerSecond = stressGainPerSecond;
    this.#lastOverloadKg = overloadKg;

    if (overloadKg > 0) {
      this.#stressValue += stressGainPerSecond * dt;
    } else {
      this.#stressValue -= recoveryPerSecond * dt;
    }
    this.#stressValue = this.#clamp(this.#stressValue, 0, capacity);

    const stressRatio = this.getStressRatio(capacity);
    const failureChance = this.calculateFailureChance({
      stressRatio,
      chanceScale,
    });
    this.#lastFailureChance = failureChance;

    if (stressRatio >= 1) {
      this.#lastGuaranteedFailure = true;
      this.#lastFailureSource = "guaranteed";
      this.#lastRollPassed = true;
      return this.#result({
        capacity,
        recoveryPerSecond,
        intervalMs,
        failureTriggered: true,
        guaranteed: true,
      });
    }

    if (stressRatio <= minStressToRoll) {
      this.#rollTimerMs = 0;
      this.#lastRollPassed = false;
      return this.#result({ capacity, recoveryPerSecond, intervalMs });
    }

    this.#rollTimerMs += dt * 1000;
    if (this.#rollTimerMs >= intervalMs) {
      this.#rollTimerMs = 0;
      const rollValue = this.#roll(rng);
      this.#lastRollValue = rollValue;
      this.#lastRollPassed = rollValue < failureChance;
      this.#lastFailureSource = this.#lastRollPassed ? "roll" : null;
      return this.#result({
        capacity,
        recoveryPerSecond,
        intervalMs,
        failureTriggered: this.#lastRollPassed,
        guaranteed: false,
      });
    }

    this.#lastRollPassed = false;
    return this.#result({ capacity, recoveryPerSecond, intervalMs });
  }

  reset() {
    this.#stressValue = 0;
    this.#rollTimerMs = 0;
    this.#lastRollValue = null;
    this.#lastRollPassed = false;
    this.#lastGuaranteedFailure = false;
    this.#lastFailureSource = null;
    this.#lastStressGainPerSecond = 0;
    this.#lastFailureChance = 0;
    this.#lastOverloadKg = 0;
  }

  setStressValue(value) {
    this.#stressValue = Math.max(0, Number(value) || 0);
  }

  getStressValue() {
    return this.#stressValue;
  }

  getStressRatio(capacity = 1) {
    return this.#clamp(this.#stressValue / this.#positive(capacity, 1), 0, 1);
  }

  calculateFailureChance({ stressRatio = null, chanceScale = 1 } = {}) {
    const ratio = stressRatio === null ? this.getStressRatio() : Number(stressRatio);
    return this.#clamp((Number(ratio) || 0) * this.#nonNegative(chanceScale, 1), 0, 1);
  }

  getDebugData({
    capacity = 1,
    recoveryPerSecond = 0.35,
    intervalMs = 500,
  } = {}) {
    return {
      stressValue: this.#stressValue,
      stressCapacity: capacity,
      stressRatio: this.getStressRatio(capacity),
      overloadKg: this.#lastOverloadKg,
      stressWasOverloaded: this.#lastOverloadKg > 0,
      stressGainPerSecond: this.#lastStressGainPerSecond,
      stressRecoveryPerSecond: recoveryPerSecond,
      failureRollTimerMs: this.#rollTimerMs,
      failureRollIntervalMs: intervalMs,
      failureChance: this.#lastFailureChance,
      failureRollChance: this.#lastFailureChance,
      lastRollValue: this.#lastRollValue,
      lastRollPassed: this.#lastRollPassed,
      guaranteedFailure: this.#lastGuaranteedFailure,
      failureSource: this.#lastFailureSource,
    };
  }

  #result({
    capacity,
    recoveryPerSecond,
    intervalMs,
    failureTriggered = false,
    guaranteed = false,
  }) {
    return {
      failureTriggered,
      guaranteed,
      ...this.getDebugData({ capacity, recoveryPerSecond, intervalMs }),
    };
  }

  #roll(rng) {
    const value = typeof rng === "function"
      ? rng()
      : typeof rng?.next === "function"
        ? rng.next()
        : Math.random();
    return this.#clamp(Number(value) || 0, 0, 1);
  }

  #positive(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  #nonNegative(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
  }

  #clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || 0));
  }
}
