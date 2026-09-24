"use strict";

const { immutableRecord } = require("../guards/core/guard_models");
const { BATCH_011_PREFLIGHT_PROFILE } = require("./stage_three_batch_011_preflight_profile");
const { BATCH_011_EXECUTABLE_CASES } = require("./stage_three_batch_011_behavior_cases");

const BATCH_011_MATRIX_DEPENDENCIES = Object.freeze({
  profile: BATCH_011_PREFLIGHT_PROFILE.executionProfile,
  behaviorCases: immutableRecord(Object.fromEntries(Object.entries(BATCH_011_EXECUTABLE_CASES)
    .map(([name, cases]) => [name, Object.keys(cases)]))),
  compatibilityCases: Object.freeze([
    "five-representation-only-named-exports", "five-native-esm-namespaces-and-class-identities",
    "five-activations-at-approved-positions", "ten-exact-classic-consumers",
    "descriptor-freeze-and-optional-own-key-semantics", "single-registry-state-owner-and-registration-order",
    "zero-config-browser-dev-platform-and-transport-dependencies",
    "single-cumulative-runtime-and-preserved-existing-activations",
  ]),
});

module.exports = { BATCH_011_MATRIX_DEPENDENCIES };
