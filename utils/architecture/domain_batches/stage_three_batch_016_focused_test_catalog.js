"use strict";

const { immutableRecord } = require("../guards/core/guard_models");
const { BATCH_016_EXECUTION_PROFILE } = require("./stage_three_batch_016_preflight_profile");

const BATCH_016_MATRIX_DEPENDENCIES = Object.freeze({
  profile: BATCH_016_EXECUTION_PROFILE,
  behaviorCases: immutableRecord({
    PlayerPressureFatigueSourceResolver: ["source-modes-and-activity-reasons",
      "disabled-defaults-config-precedence-and-invalid-inputs"],
  }),
  compatibilityCases: Object.freeze([
    "one-representation-only-named-esm-target-and-one-exact-export",
    "one-esm-evaluation-per-target-without-reviewed-initializers",
    "one-exact-classic-activation-at-its-legacy-position",
    "one-exact-classic-consumer-relationship",
    "one-window-class-exposure-replaced-by-shim-with-exact-identity",
    "authoritative-state-owner-and-zero-extra-hot-loop-allocations",
    "single-cumulative-runtime-and-preserved-prior-activations",
  ]),
});

module.exports = { BATCH_016_MATRIX_DEPENDENCIES };
