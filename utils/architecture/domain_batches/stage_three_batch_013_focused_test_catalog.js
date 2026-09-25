"use strict";

const { immutableRecord } = require("../guards/core/guard_models");
const { BATCH_013_EXECUTION_PROFILE } = require("./stage_three_batch_013_preflight_profile");

const BATCH_013_MATRIX_DEPENDENCIES = Object.freeze({
  profile: BATCH_013_EXECUTION_PROFILE,
  behaviorCases: immutableRecord({
    DEFAULT_FISH_RADIAL_RANGE: ["frozen-values-and-reference"],
    DEFAULT_FISH_LATERAL_RANGE: ["frozen-values-and-reference"],
    FishDirectionIntentSampler: ["default-range-rng-order", "reversed-and-invalid-ranges"],
    FishingCastExposureResolver: ["elapsed-cast-time-and-inactive-edge-cases"],
    PlayerForceBudgetAllocator: ["hold-control-allocation-and-clamps"],
    PlayerPressureFatigueCalculator: ["pressure-fatigue-and-recovery-frames"],
    RodControlAngleResolver: ["rod-angle-clamping-and-directions"],
    StaminaRegenCalculator: ["regen-phase-and-configuration-boundaries"],
  }),
  compatibilityCases: Object.freeze([
    "six-representation-only-named-esm-targets-and-eight-exact-exports",
    "one-esm-evaluation-per-target-with-two-reviewed-frozen-initializers",
    "eight-exact-classic-activations-at-six-legacy-positions",
    "three-symbols-one-provider-at-position-124",
    "seven-exact-classic-consumer-relationships",
    "five-class-exposures-replaced-by-shim-with-exact-identity",
    "one-authoritative-state-owner-and-zero-extra-hot-loop-allocations",
    "single-cumulative-runtime-and-preserved-prior-activations",
  ]),
});

module.exports = { BATCH_013_MATRIX_DEPENDENCIES };
