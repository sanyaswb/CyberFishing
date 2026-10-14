import { clampUnitFinite, nonNegativeOr } from "../../../../engine/math/number_normalization.js";

export class PlayerTensionBuildRateResolver {
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
    const holdForceThresholdKg = nonNegativeOr(
      thresholds.holdForceKg,
      0.01,
    );
    const controlForceThresholdKg = nonNegativeOr(
      thresholds.controlForceKg,
      0.01,
    );
    const holdInputThreshold = clampUnitFinite(
      thresholds.holdInputRatio ?? 0.05,
    );
    const controlInputThreshold = clampUnitFinite(
      thresholds.controlInputRatio ?? 0.05,
    );
    const resolvedHoldActive =
      holdActive === true &&
      nonNegativeOr(holdForceKg) >= holdForceThresholdKg &&
      clampUnitFinite(holdInputRatio) >= holdInputThreshold;
    const resolvedControlActive =
      controlActive === true &&
      nonNegativeOr(controlForceKg) >= controlForceThresholdKg &&
      clampUnitFinite(controlInputRatio) >= controlInputThreshold;
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
      holdForceKg: nonNegativeOr(holdForceKg),
      controlForceKg: nonNegativeOr(controlForceKg),
      holdInputRatio: clampUnitFinite(holdInputRatio),
      controlInputRatio: clampUnitFinite(controlInputRatio),
      rodControlBuildPerSecond: nonNegativeOr(
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
      return nonNegativeOr(multipliers.holdAndControl, 1.5);
    }
    if (mode === "hold_only") {
      return nonNegativeOr(multipliers.holdOnly, 1.0);
    }
    if (mode === "control_only") {
      return nonNegativeOr(multipliers.controlOnly, 1.0);
    }
    return nonNegativeOr(multipliers.none, 1.0);
  }
}
