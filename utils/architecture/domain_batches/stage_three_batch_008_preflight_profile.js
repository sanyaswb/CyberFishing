"use strict";

const {
  BATCH_008_EXECUTION_PROFILE,
} = require("./stage_three_batch_008_execution_profile");
const {
  StageThreeBatchPreflightProfile,
} = require("./stage_three_batch_preflight_profile");

const BATCH_008_PREFLIGHT_PROFILE = new StageThreeBatchPreflightProfile({
  schemaVersion: 1,
  stageLabel: "Stage 3.8.0",
  artifactKind: "cyber-fishing-stage-3-batch-preflight-audit",
  batchId: BATCH_008_EXECUTION_PROFILE.batchId,
  sourceReleaseVersion: BATCH_008_EXECUTION_PROFILE.sourceReleaseVersion,
  executionProfile: BATCH_008_EXECUTION_PROFILE,
  reviewedContracts: {
    "src/core/fishing/reel_hold_load_policy.js": {
      classification: "stateless-load-policy",
      instanceFields: [],
      publicStateShape: [],
      resultShape: [
        "active", "blockedReason", "dragCanHold", "dragLimitKg", "dragLocked", "eligible",
        "enabled", "hasReel", "maxMoveMeters", "playerHoldActive", "rawTensionKg",
        "recoverSpeedMetersPerSecond", "reelLoadReserveRatio", "reelMaxLoadKg",
        "retrieveSpeedMetersPerSecond", "shouldSlipDrag", "tensionBelowDragLimit",
        "tensionBelowMaxLoad",
      ],
      stableResultIdentity: false,
      mutatesCallerInputs: false,
      performanceClassification: "hot-loop-result-allocation-sensitive",
      hotLoopCallSites: [
        "src/core/fishing/reel_hold_recovery_system.js#update:load-policy",
      ],
      callSiteEvidence: [
        { path: "src/core/fishing/reel_hold_recovery_system.js", marker: "#loadPolicy = new ReelHoldLoadPolicy()" },
        { path: "src/core/fishing/reel_hold_recovery_system.js", marker: "this.#loadPolicy.evaluate({" },
      ],
      allocationBaseline: {
        objectExpressions: 4,
        arrayExpressions: 0,
        newExpressions: 0,
        objectFreezeCalls: 0,
        objectAssignCalls: 0,
        roundingCalls: 0,
      },
      semanticRisk: "blocked-reason-precedence-drag-load-gates-retrieve-scaling-and-result-shape",
    },
    "src/core/fishing/rod_stroke_distance_tracker.js": {
      classification: "stateless-distance-calculator",
      instanceFields: [],
      publicStateShape: [],
      resultShape: [
        "currentDistanceMeters", "deltaMeters", "gainedMeters", "lostMeters",
        "previousDistanceMeters", "reason",
      ],
      stableResultIdentity: false,
      mutatesCallerInputs: false,
      performanceClassification: "hot-loop-frozen-result-allocation-sensitive",
      hotLoopCallSites: [
        "src/systems/fight_physics_system.js#updateRodStrokeDistance",
      ],
      callSiteEvidence: [
        { path: "src/systems/fight_physics_system.js", marker: "#rodStrokeDistanceTracker =" },
        { path: "src/systems/fight_physics_system.js", marker: "this.#rodStrokeDistanceTracker.calculate({" },
      ],
      allocationBaseline: {
        objectExpressions: 9,
        arrayExpressions: 0,
        newExpressions: 0,
        objectFreezeCalls: 4,
        objectAssignCalls: 0,
        roundingCalls: 0,
      },
      semanticRisk: "distance-delta-epsilon-reason-shape-freeze-and-position-scale-semantics",
    },
    "src/core/line/line_spool_state.js": {
      classification: "authoritative-instance-state",
      instanceFields: ["#releasedLineMeters", "#totalLineMeters"],
      publicStateShape: [
        "lineHasReserve", "releasedLineMeters", "remainingLineMeters", "spoolEmpty", "totalLineMeters",
      ],
      resultShape: [],
      stableResultIdentity: true,
      mutatesCallerInputs: false,
      performanceClassification: "hot-loop-authoritative-state-mutation",
      hotLoopCallSites: [
        "src/systems/line_system.js#releaseLine",
        "src/systems/line_system.js#recoverLine",
      ],
      callSiteEvidence: [
        { path: "src/systems/line_system.js", marker: "#spoolState = new LineSpoolState({" },
        { path: "src/systems/line_system.js", marker: "this.#spoolState.release(" },
        { path: "src/systems/line_system.js", marker: "this.#spoolState.recover(" },
      ],
      allocationBaseline: {
        objectExpressions: 1,
        arrayExpressions: 0,
        newExpressions: 0,
        objectFreezeCalls: 0,
        objectAssignCalls: 0,
        roundingCalls: 0,
      },
      semanticRisk: "authoritative-line-length-state-clamps-reserve-threshold-release-recover-and-instance-identity",
    },
  },
  migrationGates: [
    "representation-only-source-equivalence",
    "same-authoritative-owner-before-and-after",
    "exact-state-and-result-shape",
    "zero-new-hot-loop-allocations",
    "zero-domain-transport-lookups",
    "exact-formula-default-clamp-rounding-and-blocker-precedence",
  ],
}).value;

module.exports = { BATCH_008_PREFLIGHT_PROFILE };
