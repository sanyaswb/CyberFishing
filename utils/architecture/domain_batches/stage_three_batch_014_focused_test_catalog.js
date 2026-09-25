"use strict";

const { immutableRecord } = require("../guards/core/guard_models");
const { BATCH_014_EXECUTION_PROFILE } = require("./stage_three_batch_014_preflight_profile");

const BATCH_014_MATRIX_DEPENDENCIES = Object.freeze({
  profile: BATCH_014_EXECUTION_PROFILE,
  behaviorCases: immutableRecord({
    LandingLiftReadinessPolicy: ["readiness-reason-ladder", "disabled-invalid-and-epsilon-edges"],
    PlayerPressureFatigueState: ["defaults-apply-frame-and-reset", "fallbacks-clamps-and-alias-fields"],
    PlayerTensionBuildRateResolver: ["mode-multipliers-and-thresholds", "constructor-and-call-config-precedence"],
    StaminaDrainCalculator: ["advantage-curve-drain", "threshold-disabled-and-invalid-inputs"],
    StaminaTransitionResolver: ["stamina-to-exhaustion-and-recovery", "locked-phase-and-invalid-inputs"],
    TackleFailureSelector: ["weakest-component-and-tie-break", "static-frozen-tables-and-fallback"],
  }),
  compatibilityCases: Object.freeze([
    "six-representation-only-named-esm-targets-and-six-exact-exports",
    "one-esm-evaluation-per-target-with-two-reviewed-frozen-static-initializers",
    "six-exact-classic-activations-at-six-legacy-positions",
    "six-exact-classic-consumer-relationships",
    "five-window-class-exposures-replaced-by-shim-with-exact-identity",
    "static-table-identity-preserved-through-single-class-evaluation",
    "authoritative-state-owners-and-zero-extra-hot-loop-allocations",
    "single-cumulative-runtime-and-preserved-prior-activations",
  ]),
});

module.exports = { BATCH_014_MATRIX_DEPENDENCIES };
