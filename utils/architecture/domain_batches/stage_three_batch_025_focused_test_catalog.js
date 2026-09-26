"use strict";

const { immutableRecord } = require("../guards/core/guard_models");
const { BATCH_025_EXECUTION_PROFILE } = require("./stage_three_batch_025_preflight_profile");

const BATCH_025_MATRIX_DEPENDENCIES = Object.freeze({
  profile: BATCH_025_EXECUTION_PROFILE,
  behaviorCases: immutableRecord({
    FishRetrieveSystem: ["retrieve-forces-caller-mutation-and-config-sources"],
    PoleFightSectorConstraint: ["default-geometry-clamping-recovery-and-frame-reuse", "injected-geometry-frame"],
    StaminaPressureResolver: ["pressure-inputs-lateral-position-and-control-direction"],
  }),
  compatibilityCases: Object.freeze([
    "three-representation-only-named-esm-targets-and-three-exact-exports",
    "five-exact-completed-prefix-imports-bound-to-the-cumulative-instances",
    "five-owner-created-composition-identities-preserved",
    "reviewed-guarded-window-exposure-moved-to-the-exact-activation-shim",
    "one-esm-evaluation-per-target-without-top-level-effects",
    "three-exact-classic-activations-at-their-legacy-positions",
    "four-exact-classic-consumer-relationships-and-five-retired-bridges",
    "reused-sector-frame-identity-and-caller-input-mutation-preserved",
    "two-consumerless-activations-retired-as-inert-classic-placeholders",
    "single-cumulative-runtime-and-preserved-prior-activations",
  ]),
});

module.exports = { BATCH_025_MATRIX_DEPENDENCIES };
