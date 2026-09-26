"use strict";

const { immutableRecord } = require("../guards/core/guard_models");
const { BATCH_022_EXECUTION_PROFILE } = require("./stage_three_batch_022_preflight_profile");

const BATCH_022_MATRIX_DEPENDENCIES = Object.freeze({
  profile: BATCH_022_EXECUTION_PROFILE,
  behaviorCases: immutableRecord({
    ItemAssemblyPath: ["parse-segments-indices-and-errors"],
    ItemAssemblyReader: ["constructor-requirements", "paths-slots-roots-and-state",
      "attachment-cycle-detection"],
  }),
  compatibilityCases: Object.freeze([
    "one-representation-only-named-esm-target-and-two-exact-exports",
    "one-exact-completed-prefix-import-bound-to-the-cumulative-instance",
    "one-esm-evaluation-per-target-without-top-level-effects",
    "two-exact-classic-activations-at-one-legacy-position",
    "four-exact-classic-consumer-relationships-and-one-retired-bridge",
    "authoritative-state-owners-and-zero-extra-allocations",
    "single-cumulative-runtime-and-preserved-prior-activations",
  ]),
});

module.exports = { BATCH_022_MATRIX_DEPENDENCIES };
