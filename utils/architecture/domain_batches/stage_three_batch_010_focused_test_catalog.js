"use strict";

const { immutableRecord } = require("../guards/core/guard_models");
const { BATCH_010_PREFLIGHT_PROFILE } = require("./stage_three_batch_010_preflight_profile");
const { BATCH_010_EXECUTABLE_CASES } = require("./stage_three_batch_010_behavior_cases");

const BATCH_010_MATRIX_DEPENDENCIES = Object.freeze({
  profile: BATCH_010_PREFLIGHT_PROFILE.executionProfile,
  behaviorCases: immutableRecord(Object.fromEntries(Object.entries(BATCH_010_EXECUTABLE_CASES)
    .map(([name, cases]) => [name, Object.keys(cases)]))),
  compatibilityCases: Object.freeze([
    "representation-only-named-export", "native-esm-namespace-and-class-identity",
    "one-activation-at-position-148", "two-exact-classic-consumers",
    "fresh-result-identity-and-one-object-allocation-per-call",
    "zero-config-browser-dev-platform-and-transport-dependencies",
    "single-cumulative-runtime-and-preserved-existing-activations",
  ]),
});

module.exports = { BATCH_010_MATRIX_DEPENDENCIES };
