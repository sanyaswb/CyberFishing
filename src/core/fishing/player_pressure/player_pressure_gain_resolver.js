class PlayerPressureGainResolver {
  #config;

  constructor(config = {}) {
    this.#config = config || {};
  }

  resolve({
    holdActive = false,
    controlActive = false,
    holdForceKg = 0,
    controlForceKg = 0,
    controlInputRatio = 0,
    config = null,
  } = {}) {
    const cfg = config || this.#config || {};
    const thresholds = cfg.inputThresholds || {};
    const multipliers = cfg.multipliers || {};
    const enabled = cfg.enabled === true;
    const holdThresholdKg = this.#positive(thresholds.holdForceKg, 0.01);
    const controlInputThreshold = this.#clamp01(
      thresholds.controlInputRatio ?? 0.05,
    );
    const controlForceThresholdKg = this.#positive(
      thresholds.controlForceKg,
      0.01,
    );
    const resolvedHoldActive =
      holdActive === true &&
      this.#positive(holdForceKg) >= holdThresholdKg;
    const resolvedControlActive =
      controlActive === true &&
      this.#clamp01(controlInputRatio) >= controlInputThreshold &&
      this.#positive(controlForceKg) >= controlForceThresholdKg;
    const mode = this.#mode({
      holdActive: resolvedHoldActive,
      controlActive: resolvedControlActive,
    });
    const multiplier = enabled
      ? this.#multiplier({ mode, multipliers })
      : 1;

    return Object.freeze({
      source: "player_pressure_gain",
      enabled,
      mode,
      multiplier,
      holdActive: resolvedHoldActive,
      controlActive: resolvedControlActive,
      holdForceKg: this.#positive(holdForceKg),
      controlForceKg: this.#positive(controlForceKg),
      controlInputRatio: this.#clamp01(controlInputRatio),
      holdForceThresholdKg: holdThresholdKg,
      controlInputThreshold,
      controlForceThresholdKg,
    });
  }

  #mode({ holdActive, controlActive }) {
    if (holdActive && controlActive) return "hold_and_control";
    if (holdActive) return "hold_only";
    if (controlActive) return "control_only";
    return "none";
  }

  #multiplier({ mode, multipliers }) {
    if (mode === "hold_and_control") {
      return this.#positive(multipliers.holdAndControl, 1.5);
    }
    if (mode === "hold_only") {
      return this.#positive(multipliers.holdOnly, 1.0);
    }
    if (mode === "control_only") {
      return this.#positive(multipliers.controlOnly, 1.0);
    }
    return 1;
  }

  #positive(value, fallback = 0) {
    const number = Number(value);
    if (Number.isFinite(number) && number >= 0) return number;
    const safeFallback = Number(fallback);
    return Number.isFinite(safeFallback) && safeFallback >= 0
      ? safeFallback
      : 0;
  }

  #clamp01(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.max(0, Math.min(1, number));
  }
}

if (typeof window !== "undefined") {
  window.PlayerPressureGainResolver = PlayerPressureGainResolver;
}
