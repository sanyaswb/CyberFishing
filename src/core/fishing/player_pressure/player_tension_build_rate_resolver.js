class PlayerTensionBuildRateResolver {
  #config;

  constructor(config = {}) {
    this.#config = config || {};
  }

  resolve({
    holdActive = false,
    controlActive = false,
    holdForceKg = 0,
    controlForceKg = 0,
    holdInputRatio = 0,
    controlInputRatio = 0,
    config = null,
  } = {}) {
    const cfg = config || this.#config || {};
    const thresholds = cfg.inputThresholds || {};
    const multipliers = cfg.multipliers || {};
    const enabled = cfg.enabled === true;
    const holdForceThresholdKg = this.#positive(
      thresholds.holdForceKg,
      0.01,
    );
    const controlForceThresholdKg = this.#positive(
      thresholds.controlForceKg,
      0.01,
    );
    const holdInputThreshold = this.#clamp01(
      thresholds.holdInputRatio ?? 0.05,
    );
    const controlInputThreshold = this.#clamp01(
      thresholds.controlInputRatio ?? 0.05,
    );
    const resolvedHoldActive =
      holdActive === true &&
      this.#positive(holdForceKg) >= holdForceThresholdKg &&
      this.#clamp01(holdInputRatio) >= holdInputThreshold;
    const resolvedControlActive =
      controlActive === true &&
      this.#positive(controlForceKg) >= controlForceThresholdKg &&
      this.#clamp01(controlInputRatio) >= controlInputThreshold;
    const mode = this.#mode({
      holdActive: resolvedHoldActive,
      controlActive: resolvedControlActive,
    });
    const buildRateMultiplier = enabled
      ? this.#multiplier({ mode, multipliers })
      : 1;

    return Object.freeze({
      source: "player_tension_build_rate",
      enabled,
      mode,
      buildRateMultiplier,
      holdActive: resolvedHoldActive,
      controlActive: resolvedControlActive,
      holdForceKg: this.#positive(holdForceKg),
      controlForceKg: this.#positive(controlForceKg),
      holdInputRatio: this.#clamp01(holdInputRatio),
      controlInputRatio: this.#clamp01(controlInputRatio),
      rodControlBuildPerSecond: this.#positive(
        cfg.rodControlBuildPerSecond,
        4,
      ),
      holdForceThresholdKg,
      controlForceThresholdKg,
      holdInputThreshold,
      controlInputThreshold,
      applyTo: Object.freeze({
        rodHoldCharge: cfg.applyTo?.rodHoldCharge !== false,
        rodControlBuild: cfg.applyTo?.rodControlBuild !== false,
      }),
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
    return this.#positive(multipliers.none, 1.0);
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
  window.PlayerTensionBuildRateResolver = PlayerTensionBuildRateResolver;
}
