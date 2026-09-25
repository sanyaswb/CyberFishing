"use strict";

const { immutableRecord } = require("../guards/core/guard_models");
const { BATCH_020_EXECUTION_PROFILE } = require("./stage_three_batch_020_preflight_profile");

const BATCH_020_MATRIX_DEPENDENCIES = Object.freeze({
  profile: BATCH_020_EXECUTION_PROFILE,
  behaviorCases: immutableRecord({
    AssemblyPreparationStatus: ["frozen-status-table"],
    AssemblyState: ["lifecycle-refill-signatures-and-snapshot", "validation-errors"],
    ExactAssemblyRefillSignaturePolicy: ["ignored-keys-canonical-properties-and-freeze",
      "keys-errors-and-static-privacy"],
    RefillCompatibleSignaturePolicy: ["ignored-keys-canonical-properties-and-freeze",
      "keys-errors-and-static-privacy"],
  }),
  compatibilityCases: Object.freeze([
    "three-representation-only-named-esm-targets-and-four-exact-exports",
    "one-esm-evaluation-per-target-with-three-reviewed-initializers",
    "four-exact-classic-activations-at-three-legacy-positions",
    "five-exact-classic-consumer-relationships",
    "one-global-this-class-exposure-replaced-by-shim-with-exact-identity",
    "private-static-sets-and-status-table-identity-preserved-through-single-evaluation",
    "authoritative-state-owners-and-zero-extra-allocations",
    "single-cumulative-runtime-and-preserved-prior-activations",
  ]),
});

module.exports = { BATCH_020_MATRIX_DEPENDENCIES };
