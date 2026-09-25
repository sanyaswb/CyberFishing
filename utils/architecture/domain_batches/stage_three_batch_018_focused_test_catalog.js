"use strict";

const { immutableRecord } = require("../guards/core/guard_models");
const { BATCH_018_EXECUTION_PROFILE } = require("./stage_three_batch_018_preflight_profile");

const BATCH_018_MATRIX_DEPENDENCIES = Object.freeze({
  profile: BATCH_018_EXECUTION_PROFILE,
  behaviorCases: immutableRecord({
    AlwaysKnownBaitEffectivenessPolicy: ["always-discovered", "local-inheritance-chain"],
    BaitEffectivenessKnowledgePolicy: ["abstract-contract-throws", "prototype-shape-and-identity"],
    BaitEffectivenessMatch: ["normalized-frozen-fields", "invalid-and-empty-inputs"],
    BaitFreshnessModifier: ["freshness-multiplier-curve", "invalid-floor-errors"],
    ItemFreshnessStatePolicy: ["normalize-create-defaults-and-rounding", "state-and-bounds-errors"],
    ItemBoundedMetricResolver: ["resolution-sources-clamping-and-reasons", "constructor-errors-and-subclassing"],
    ItemRatingTierResolver: ["equal-segment-tiers", "invalid-config-and-unavailable-rating"],
  }),
  compatibilityCases: Object.freeze([
    "six-representation-only-named-esm-targets-and-seven-exact-exports",
    "one-esm-evaluation-per-target-with-one-reviewed-local-superclass",
    "six-exact-classic-activations-at-six-legacy-positions",
    "twelve-exact-classic-consumer-relationships",
    "six-global-this-class-exposures-replaced-by-shims-with-exact-identity",
    "unactivated-abstract-knowledge-contract-kept-as-module-export-only",
    "authoritative-state-owners-and-zero-extra-allocations",
    "single-cumulative-runtime-and-preserved-prior-activations",
  ]),
});

module.exports = { BATCH_018_MATRIX_DEPENDENCIES };
