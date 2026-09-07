"use strict";

const { immutableRecord } = require("../guards/core/guard_models");

const BATCH_006_BEHAVIOR_CASES = immutableRecord({
  FloatTackleLineBudgetPolicy: [
    "float-and-pole-applicability",
    "selected-depth-clamp",
    "surface-depth-tolerance",
    "line-and-rod-budget",
    "non-float-fallback",
    "constructor-injected-config",
  ],
  HoldOppositionResolver: [
    "positive-and-negative-opposition",
    "zero-force-input",
    "ratio-boundaries",
    "invalid-numeric-inputs",
  ],
  RodControlTensionModeResolver: [
    "same-opposite-and-side-modes",
    "minimum-fish-speed",
    "alignment-thresholds",
    "normalized-control-axis",
    "frozen-result-semantics",
  ],
  LineConstraintStateResolver: [
    "taut-and-slack-line",
    "line-reserve",
    "drag-payout",
    "hard-spool-limit",
    "blocked-reasons",
    "epsilon-boundaries",
  ],
  PoleFightSectorGeometry: [
    "sector-construction",
    "angle-and-radius-calculations",
    "contains-violation-and-point-at",
    "invalid-points",
    "per-instance-reusable-frame-identity",
    "no-module-global-frame",
  ],
  LandingLiftTensionCalculator: [
    "lift-gain-and-release",
    "landing-zone-gate",
    "tackle-load-slowdown",
    "clamp-and-fallback-semantics",
    "frozen-result",
    "delta-time-behavior",
  ],
});

const BATCH_006_COMPATIBILITY_CASES = Object.freeze([
  "globals-absent-before-activation",
  "globals-equal-exact-export-after-activation",
  "module-evaluation-count-equals-one",
  "class-identity-preserved",
  "seven-classic-consumers-retain-api",
  "domain-does-not-read-transport-global",
]);

module.exports = {
  BATCH_006_BEHAVIOR_CASES,
  BATCH_006_COMPATIBILITY_CASES,
};
