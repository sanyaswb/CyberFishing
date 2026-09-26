"use strict";

const { immutableRecord } = require("../guards/core/guard_models");
const { BATCH_021_EXECUTION_PROFILE } = require("./stage_three_batch_021_preflight_profile");

const BATCH_021_MATRIX_DEPENDENCIES = Object.freeze({
  profile: BATCH_021_EXECUTION_PROFILE,
  behaviorCases: immutableRecord({
    AutoRefillMemory: ["remember-forget-clone-and-snapshot"],
    AutoRefillPolicy: ["trigger-scope-resolution"],
    AutoRefillScope: ["frozen-scope-table"],
    AutoRefillSettings: ["defaults-toggles-and-snapshot"],
    AutoRefillTrigger: ["frozen-trigger-table"],
    ExactItemSignaturePolicy: ["ignored-keys-canonical-properties-and-freeze",
      "keys-errors-and-static-privacy"],
  }),
  compatibilityCases: Object.freeze([
    "two-representation-only-named-esm-targets-and-six-exact-exports",
    "one-esm-evaluation-per-target-with-three-reviewed-initializers",
    "six-exact-classic-activations-at-two-legacy-positions",
    "four-exact-classic-consumer-relationships",
    "trigger-scope-tables-and-private-set-identity-preserved-through-single-evaluation",
    "per-instance-signature-memory-state-identity-preserved",
    "authoritative-state-owners-and-zero-extra-allocations",
    "single-cumulative-runtime-and-preserved-prior-activations",
  ]),
});

module.exports = { BATCH_021_MATRIX_DEPENDENCIES };
