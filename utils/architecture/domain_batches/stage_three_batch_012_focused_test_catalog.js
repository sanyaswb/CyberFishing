"use strict";

const { immutableRecord } = require("../guards/core/guard_models");
const { BATCH_012_PREFLIGHT_PROFILE } = require("./stage_three_batch_012_preflight_profile");
const { BATCH_012_EXECUTABLE_CASES } = require("./stage_three_batch_012_behavior_cases");

const BATCH_012_MATRIX_DEPENDENCIES = Object.freeze({
  profile: BATCH_012_PREFLIGHT_PROFILE.executionProfile,
  behaviorCases: immutableRecord(Object.fromEntries(Object.entries(BATCH_012_EXECUTABLE_CASES)
    .map(([name, cases]) => [name, Object.keys(cases)]))),
  compatibilityCases: Object.freeze([
    "two-representation-only-named-exports", "two-native-esm-class-identities",
    "two-classic-global-assignments-at-positions-153-and-154",
    "two-exact-composition-root-consumers", "single-instance-state-owner-per-class",
    "zero-other-evaluation-effects-and-transport-reads",
    "single-cumulative-runtime-and-preserved-prior-activations",
  ]),
});

module.exports = { BATCH_012_MATRIX_DEPENDENCIES };
