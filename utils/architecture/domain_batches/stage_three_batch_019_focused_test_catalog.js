"use strict";

const { immutableRecord } = require("../guards/core/guard_models");
const { BATCH_019_EXECUTION_PROFILE } = require("./stage_three_batch_019_preflight_profile");

const BATCH_019_MATRIX_DEPENDENCIES = Object.freeze({
  profile: BATCH_019_EXECUTION_PROFILE,
  behaviorCases: immutableRecord({
    BaitEffectivenessGradePolicy: ["star-grades-and-relative-effectiveness",
      "incompatible-defaults-and-static-maximum"],
    BaitFreshnessDecayPolicy: ["linear-decay-and-clamping", "invalid-percent-errors"],
    ItemQualityGradePolicy: ["normalize-and-unit-scale", "static-limits"],
  }),
  compatibilityCases: Object.freeze([
    "three-representation-only-named-esm-targets-and-three-exact-exports",
    "one-esm-evaluation-per-target-with-primitive-literal-static-fields",
    "three-exact-classic-activations-at-three-legacy-positions",
    "seven-exact-classic-consumer-relationships",
    "three-global-this-class-exposures-replaced-by-shims-with-exact-identity",
    "static-field-values-preserved-through-single-class-evaluation",
    "authoritative-state-owners-and-zero-extra-allocations",
    "single-cumulative-runtime-and-preserved-prior-activations",
  ]),
});

module.exports = { BATCH_019_MATRIX_DEPENDENCIES };
