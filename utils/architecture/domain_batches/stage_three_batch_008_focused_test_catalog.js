"use strict";

const { immutableRecord } = require("../guards/core/guard_models");

const BATCH_008_BEHAVIOR_CASES = immutableRecord({
  LineSpoolState: [
    "constructor-clamps",
    "total-released-and-remaining-line",
    "line-reserve-threshold",
    "spool-empty",
    "set-total-line",
    "set-released-line",
    "release",
    "recover",
    "minimum-released-line",
    "invalid-numeric-inputs",
    "same-instance-state-mutation",
    "private-state-isolation",
  ],
  RodStrokeDistanceTracker: [
    "gained-distance",
    "lost-distance",
    "stable-distance",
    "exact-epsilon-boundary",
    "default-epsilon",
    "custom-reason-prefix",
    "invalid-numeric-inputs",
    "position-distance-calculation",
    "pixels-per-meter-fallback",
    "exact-frozen-result-shape",
  ],
  ReelHoldLoadPolicy: [
    "disabled",
    "no-reel",
    "not-holding",
    "drag-slipping",
    "at-drag-limit",
    "near-max-load",
    "zero-recover-speed",
    "ready",
    "drag-locked-semantics",
    "drag-limit-epsilon",
    "load-reserve-ratio-and-one-percent-gate",
    "retrieve-speed-scaling-and-delta-time",
    "invalid-numeric-coercion",
    "exact-blocked-reason-precedence-and-result-shape",
  ],
});

const BATCH_008_COMPATIBILITY_CASES = Object.freeze([
  "globals-absent-before-activation",
  "globals-equal-contract-derived-module-export-after-activation",
  "module-evaluation-count-equals-one",
  "class-and-state-identity-preserved",
  "three-classic-consumers-retain-api",
  "domain-does-not-read-transport-global",
  "transport-surface-derived-from-runtime-contract",
  "activation-shims-match-renderer-output",
]);

module.exports = {
  BATCH_008_BEHAVIOR_CASES,
  BATCH_008_COMPATIBILITY_CASES,
};
