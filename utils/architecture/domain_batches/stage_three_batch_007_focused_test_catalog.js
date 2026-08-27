"use strict";

const { immutableRecord } = require("../guards/core/guard_models");

const BATCH_007_BEHAVIOR_CASES = immutableRecord({
  LineConstrainedFishMotionResolver: [
    "default-free-frame",
    "free-velocity-aliases",
    "zero-radius-branch",
    "inward-and-tangent-allowed",
    "outward-radial-projection",
    "delta-time-clamp",
    "exact-result-shape",
    "per-instance-reusable-frame-identity",
    "caller-input-immutability",
  ],
  LineRadialMovementSplitter: [
    "zero-delta-or-radius",
    "already-at-released-radius",
    "no-crossing-free-frame",
    "crossing-time-weighted-velocity",
    "zero-velocity-no-crossing",
    "pixels-per-meter-fallback-and-clamp",
    "velocity-aliases",
    "exact-result-shape",
    "per-instance-reusable-result-identity",
    "caller-input-immutability",
  ],
  ReelRetrieveSpeedCalculator: [
    "default-zero",
    "base-plus-bearing-bonus",
    "independent-positive-clamps",
    "nan-and-infinity-fallback",
    "numeric-string-coercion",
    "fractional-no-rounding",
  ],
  RodPullState: [
    "exact-thirty-two-field-default-shape",
    "mutable-same-instance",
    "reset-return-and-identity",
    "reset-exact-defaults",
    "repeated-reset-idempotence",
    "instance-state-isolation",
    "zero-reset-allocations",
  ],
  RodStrokeState: [
    "initial-state-and-snapshot",
    "capacity-clamp",
    "add-distance-cap",
    "lose-and-recover-distance",
    "compatibility-method-aliases",
    "start-cycle-preserves-unrecovered-stroke",
    "reset-semantics",
    "write-snapshot-target-identity",
    "exact-five-field-snapshot-aliases",
    "get-snapshot-fresh-object-and-instance-isolation",
  ],
  SimpleFightForceCalculator: [
    "passive-active-opposition-formulas",
    "slack-semantics",
    "tension-ceiling-and-rod-hold-clamp",
    "angle-and-ratio-clamps",
    "raw-and-capped-player-tension",
    "movable-cap-gate",
    "total-and-net-force",
    "toward-away-idle-speed",
    "resistance-epsilon-and-defaults",
    "nan-infinity-and-negative-inputs",
    "fractional-no-rounding",
    "exact-frozen-result-shape-and-input-immutability",
  ],
});

const BATCH_007_COMPATIBILITY_CASES = Object.freeze([
  "globals-absent-before-activation",
  "globals-equal-contract-derived-module-export-after-activation",
  "module-evaluation-count-equals-one",
  "class-and-state-identity-preserved",
  "nine-classic-consumers-retain-api",
  "domain-does-not-read-transport-global",
  "transport-surface-derived-from-runtime-contract",
  "activation-shims-match-renderer-output",
]);

module.exports = {
  BATCH_007_BEHAVIOR_CASES,
  BATCH_007_COMPATIBILITY_CASES,
};
