class PlayerPressureFatigueSourceResolver {
  #config;

  constructor(config = {}) {
    this.#config = config || {};
  }

  resolve({
    reelHoldActive = false,
    rodHoldActive = false,
    controlActive = false,
    effectivePressureKg = 0,
    config = null,
  } = {}) {
    const cfg = config || this.#config || {};
    const source = cfg.source || {};
    const enabled = cfg.enabled === true;
    const sourceMode = source.mode || "reel_hold";

    if (!enabled) {
      return this.#frame({
        sourceMode,
        active: false,
        reason: "disabled",
        reelHoldActive,
        rodHoldActive,
        controlActive,
        effectivePressureKg,
      });
    }

    if (sourceMode === "reel_hold") {
      const active = reelHoldActive === true;
      return this.#frame({
        sourceMode,
        active,
        reason: active ? "reel_hold_active" : "reel_hold_inactive",
        reelHoldActive,
        rodHoldActive,
        controlActive,
        effectivePressureKg,
      });
    }

    return this.#frame({
      sourceMode,
      active: false,
      reason: "unsupported_source_mode",
      reelHoldActive,
      rodHoldActive,
      controlActive,
      effectivePressureKg,
    });
  }

  #frame({
    sourceMode,
    active,
    reason,
    reelHoldActive,
    rodHoldActive,
    controlActive,
    effectivePressureKg,
  }) {
    return Object.freeze({
      source: "player_pressure_fatigue_source",
      sourceMode,
      active: active === true,
      reason,
      reelHoldActive: reelHoldActive === true,
      rodHoldActive: rodHoldActive === true,
      controlActive: controlActive === true,
      effectivePressureKg: this.#positive(effectivePressureKg),
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
}

if (typeof window !== "undefined") {
  window.PlayerPressureFatigueSourceResolver =
    PlayerPressureFatigueSourceResolver;
}
