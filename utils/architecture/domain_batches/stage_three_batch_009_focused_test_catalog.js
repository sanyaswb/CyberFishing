"use strict";
const { immutableRecord } = require("../guards/core/guard_models");
const { BATCH_009_EXECUTABLE_CASES } = require("./stage_three_batch_009_behavior_cases");
const { BATCH_009_EXECUTION_PROFILE: profile } = require("./stage_three_batch_009_execution_profile");
const behaviorCases = immutableRecord(Object.fromEntries(Object.entries(BATCH_009_EXECUTABLE_CASES)
  .map(([name, cases]) => [name, Object.keys(cases)])));
const compatibilityCases = Object.freeze([
  "named-export-representation-only", "native-module-namespace-and-class-identity",
  "globals-absent-before-exact-activation", "globals-equal-exact-export-after-activation",
  "two-relationships-one-bootstrap-consumer", "instance-state-and-result-identity",
  "zero-added-allocation-sites-and-domain-transport-reads", "whole-closure-earlier-evaluation",
  "runtime-relocation-preserves-existing-activation-order",
  "production-shaped-fixed-catch-di-parity",
]);
module.exports = { BATCH_009_MATRIX_DEPENDENCIES: Object.freeze({ profile, behaviorCases, compatibilityCases }) };
