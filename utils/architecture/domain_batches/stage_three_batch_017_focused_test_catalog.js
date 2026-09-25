"use strict";

const { immutableRecord } = require("../guards/core/guard_models");
const { BATCH_017_EXECUTION_PROFILE } = require("./stage_three_batch_017_preflight_profile");

const BATCH_017_MATRIX_DEPENDENCIES = Object.freeze({
  profile: BATCH_017_EXECUTION_PROFILE,
  behaviorCases: immutableRecord({
    InventoryItemLocation: ["factories-normalize-and-predicates", "validation-errors-and-unknown-kind"],
    InventoryItemLocationKind: ["frozen-kind-table-values"],
  }),
  compatibilityCases: Object.freeze([
    "one-representation-only-named-esm-target-and-two-exact-exports",
    "one-esm-evaluation-per-target-with-one-reviewed-frozen-constant-initializer",
    "two-exact-classic-activations-at-one-legacy-position",
    "fifteen-exact-classic-consumer-relationships",
    "location-kind-table-identity-shared-by-class-and-activation",
    "authoritative-state-owner-and-zero-extra-allocations",
    "single-cumulative-runtime-and-preserved-prior-activations",
  ]),
});

module.exports = { BATCH_017_MATRIX_DEPENDENCIES };
