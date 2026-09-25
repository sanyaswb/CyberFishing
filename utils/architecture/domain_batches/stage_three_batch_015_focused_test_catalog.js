"use strict";

const { immutableRecord } = require("../guards/core/guard_models");
const { BATCH_015_EXECUTION_PROFILE } = require("./stage_three_batch_015_preflight_profile");

const BATCH_015_MATRIX_DEPENDENCIES = Object.freeze({
  profile: BATCH_015_EXECUTION_PROFILE,
  behaviorCases: immutableRecord({
    EnduranceMovementDebuffCalculator: ["exhaustion-progress-radial-range-and-behavior-weights",
      "inactive-disabled-invalid-and-static-default-range"],
    PlayerPressureGainResolver: ["mode-thresholds-and-multipliers",
      "constructor-and-call-config-defaults-and-invalid-inputs"],
    ActiveEnduranceDrainCalculator: ["pressure-ratio-curve-and-drain-rate",
      "disabled-defaults-and-invalid-inputs"],
    PassiveEnduranceDrainCalculator: ["effort-resistance-taut-and-behavior-drain",
      "disabled-slack-zero-limit-and-invalid-inputs"],
    StaminaLateralPositionResolver: ["offset-side-edge-ratio-and-center-direction",
      "center-defaults-and-invalid-inputs"],
    WeakestTackleLimitResolver: ["weakest-component-order-and-reel-inclusion",
      "fallback-invalid-limits-and-static-effective-load"],
  }),
  compatibilityCases: Object.freeze([
    "six-representation-only-named-esm-targets-and-six-exact-exports",
    "one-esm-evaluation-per-target-with-one-reviewed-frozen-static-initializer",
    "six-exact-classic-activations-at-six-legacy-positions",
    "six-exact-classic-consumer-relationships",
    "five-window-class-exposures-replaced-by-shim-with-exact-identity",
    "static-range-and-static-method-identity-preserved-through-single-class-evaluation",
    "authoritative-state-owners-and-zero-extra-hot-loop-allocations",
    "single-cumulative-runtime-and-preserved-prior-activations",
  ]),
});

module.exports = { BATCH_015_MATRIX_DEPENDENCIES };
