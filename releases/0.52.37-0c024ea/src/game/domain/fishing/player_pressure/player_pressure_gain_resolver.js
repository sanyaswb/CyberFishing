import { clampUnitFinite, nonNegativeOr } from "../../../../engine/math/number_normalization.js";

export class PlayerPressureGainResolver {
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
    const holdThresholdKg = nonNegativeOr(thresholds.holdForceKg, 0.01);
    const controlInputThreshold = clampUnitFinite(
      thresholds.controlInputRatio ?? 0.05,
    );
    const controlForceThresholdKg = nonNegativeOr(
      thresholds.controlForceKg,
      0.01,
    );
    const resolvedHoldActive =
      holdActive === true &&
      nonNegativeOr(holdForceKg) >= holdThresholdKg;
    const resolvedControlActive =
      controlActive === true &&
      clampUnitFinite(controlInputRatio) >= controlInputThreshold &&
      nonNegativeOr(controlForceKg) >= controlForceThresholdKg;
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
      holdForceKg: nonNegativeOr(holdForceKg),
      controlForceKg: nonNegativeOr(controlForceKg),
      controlInputRatio: clampUnitFinite(controlInputRatio),
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
      return nonNegativeOr(multipliers.holdAndControl, 1.5);
    }
    if (mode === "hold_only") {
      return nonNegativeOr(multipliers.holdOnly, 1.0);
    }
    if (mode === "control_only") {
      return nonNegativeOr(multipliers.controlOnly, 1.0);
    }
    return 1;
  }
}
