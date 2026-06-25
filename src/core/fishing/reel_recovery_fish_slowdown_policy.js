class ReelRecoveryFishSlowdownPolicy {
  createState() {
    return {
      active: false,
      multiplier: 1,
      source: "none",
      recoveredMeters: 0,
    };
  }

  reset(target = null) {
    const state = target || this.createState();
    state.active = false;
    state.multiplier = 1;
    state.source = "none";
    state.recoveredMeters = 0;
    return state;
  }

  update({
    target = null,
    autoRecoveredMeters = 0,
    holdRecoveredMeters = 0,
    config = {},
  } = {}) {
    const state = target || this.createState();
    const autoRecovered = this.#positive(autoRecoveredMeters);
    const holdRecovered = this.#positive(holdRecoveredMeters);
    const recoveredMeters = autoRecovered + holdRecovered;

    if (recoveredMeters <= 0.000001) {
      return this.reset(state);
    }

    state.active = true;
    state.multiplier = this.#resolveMultiplier(config);
    state.source = this.#resolveSource(autoRecovered, holdRecovered);
    state.recoveredMeters = recoveredMeters;
    return state;
  }

  getMotionMultiplier(state = null) {
    if (!state?.active) return 1;
    const multiplier = Number(state.multiplier);
    return Number.isFinite(multiplier) ? Math.max(0, multiplier) : 1;
  }

  #resolveSource(autoRecovered, holdRecovered) {
    if (autoRecovered > 0.000001 && holdRecovered > 0.000001) {
      return "mixed_line_recovery";
    }
    if (autoRecovered > 0.000001) return "auto_recovery";
    return "hold_reel_recovery";
  }

  #resolveMultiplier(config = {}) {
    const multiplier = Number(config.fishSpeedMultiplier);
    return Number.isFinite(multiplier) ? Math.max(0, multiplier) : 0.5;
  }

  #positive(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, number) : 0;
  }
}
