"use strict";

const { immutableRecord } = require("../guards/core/guard_models");
const { BATCH_024_EXECUTION_PROFILE } = require("./stage_three_batch_024_preflight_profile");

const BATCH_024_MATRIX_DEPENDENCIES = Object.freeze({
  profile: BATCH_024_EXECUTION_PROFILE,
  behaviorCases: immutableRecord({
    InventoryItemReservationPolicy: ["equipment-loadout-and-location-reservation",
      "missing-collaborators-and-defaults"],
  }),
  compatibilityCases: Object.freeze([
    "one-representation-only-named-esm-target-and-one-exact-export",
    "one-exact-completed-prefix-import-bound-to-the-cumulative-instance",
    "reviewed-global-this-exposure-moved-to-the-exact-activation-shim",
    "one-esm-evaluation-without-top-level-effects",
    "one-exact-classic-activation-at-its-legacy-position",
    "one-exact-classic-consumer-relationship-and-one-retired-bridge",
    "authoritative-state-owners-and-zero-extra-allocations",
    "single-cumulative-runtime-and-preserved-prior-activations",
  ]),
});

module.exports = { BATCH_024_MATRIX_DEPENDENCIES };
