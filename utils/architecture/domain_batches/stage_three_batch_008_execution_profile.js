"use strict";

const {
  StageThreeBatchExecutionProfile,
} = require("./stage_three_batch_execution_profile");

const BATCH_008_EXECUTION_PROFILE = new StageThreeBatchExecutionProfile({
  schemaVersion: 1,
  batchId: "stage-3.candidate-008-fishing-f859ccd3",
  batchNumber: "008",
  executionStageLabel: "Stage 3.8.1",
  auditStageLabel: "Stage 3.8.0",
  focusedStageId: "stage-3.8.2",
  prebuildStageId: "stage-3.8.3",
  sourceReleaseVersion: "0.24.44",
  targetReleaseVersion: "0.24.45",
  auditPath: "architecture/migration/stage_3_batch_008_audit.json",
  executionPlanPath: "architecture/migration/stage_3_batch_008_execution_plan.json",
  testMatrixPath: "architecture/migration/stage_3_batch_008_test_matrix.json",
  expectedTargetCount: 3,
  expectedExportCount: 3,
  expectedActivationCount: 3,
  expectedConsumerCount: 3,
  expectedDependencyEdgeCount: 0,
  expectedTargets: [
    { currentPath: "src/core/fishing/reel_hold_load_policy.js", targetPath: "src/game/domain/fishing/reel_hold_load_policy.js", exports: ["ReelHoldLoadPolicy"] },
    { currentPath: "src/core/fishing/rod_stroke_distance_tracker.js", targetPath: "src/game/domain/fishing/rod_stroke_distance_tracker.js", exports: ["RodStrokeDistanceTracker"] },
    { currentPath: "src/core/line/line_spool_state.js", targetPath: "src/game/domain/fishing/line_spool_state.js", exports: ["LineSpoolState"] },
  ],
  expectedActivationIds: [
    "activation-4d4619b15e3c",
    "activation-7f67db779ead",
    "activation-868e1186ae29",
  ],
  expectedActivationPositions: [90, 94, 114],
  expectedBridgeIds: [
    "bridge-19607c8ce243",
    "bridge-3d9abab097f9",
    "bridge-8b99e1c44103",
  ],
  expectedTopology: {
    beforeProjectModuleCount: 31,
    afterProjectModuleCount: 34,
    beforeActivationCount: 32,
    afterActivationCount: 35,
    beforeBridgeCount: 57,
    afterBridgeCount: 60,
  },
  includeRuntimeActiveState: true,
  persistActiveBatchPhase: true,
  includeDetailedStatePerformanceGates: true,
  behaviorPhases: ["classic-baseline", "temporary-esm-parity", "post-cutover-esm"],
  compatibilityPhases: ["pre-build-fixture", "temporary-esm-parity", "post-build-runtime"],
  scmCheckpointRequired: true,
  sourceReleaseTag: "v0.24.44",
  bridgeReason: "Preserve the exact synchronous Line Spool, Rod Stroke Distance and Reel Hold Load consumer set until its approved migration stage removes the legacy symbols.",
  rollbackRule: "restore-only-batch-008-delta-and-keep-batches-001-through-007",
  consumerSetSource: "stage-3.8.1-planned-canonical-bridge-records",
  operationIds: [
    "verify-frozen-evidence",
    "open-batch-008",
    "create-three-named-esm-targets",
    "render-three-activation-shims",
    "register-three-consumer-bridges",
    "project-preliminary-manifest-metadata",
    "build-single-cumulative-runtime",
    "validate-identity-timing-state-and-behavior",
    "persist-and-reconcile-observations",
    "run-full-acceptance",
    "close-release-0.24.45",
  ],
}).value;

module.exports = { BATCH_008_EXECUTION_PROFILE };
