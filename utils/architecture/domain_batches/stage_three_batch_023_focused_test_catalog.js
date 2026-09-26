"use strict";

const { immutableRecord } = require("../guards/core/guard_models");
const { BATCH_023_EXECUTION_PROFILE } = require("./stage_three_batch_023_preflight_profile");

const BATCH_023_MATRIX_DEPENDENCIES = Object.freeze({
  profile: BATCH_023_EXECUTION_PROFILE,
  behaviorCases: immutableRecord({
    DerivedStatMetricStrategy: ["ratio-upgrade-level-and-unsupported-formulas"],
    NumericStatMetricStrategy: ["stat-path-values-and-missing-metrics"],
    TargetRangeMetricStrategy: ["target-falloff-normalization-and-invalid-ranges"],
  }),
  compatibilityCases: Object.freeze([
    "three-representation-only-named-esm-targets-and-three-exact-exports",
    "three-exact-imported-superclass-bindings-to-the-cumulative-instance",
    "one-esm-evaluation-per-target-after-its-imported-superclass",
    "three-exact-classic-activations-at-three-legacy-positions",
    "three-exact-classic-consumer-relationships-and-three-retired-bridges",
    "authoritative-state-owners-and-zero-extra-allocations",
    "single-cumulative-runtime-and-preserved-prior-activations",
  ]),
});

module.exports = { BATCH_023_MATRIX_DEPENDENCIES };
