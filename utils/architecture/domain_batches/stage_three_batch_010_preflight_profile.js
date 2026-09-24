"use strict";

const { StageThreeBatchExecutionProfile } = require("./stage_three_batch_execution_profile");
const { StageThreeBatchPreflightProfile } = require("./stage_three_batch_preflight_profile");

const executionProfile = new StageThreeBatchExecutionProfile({
  schemaVersion: 1,
  batchId: "stage-3.candidate-010-inventory-e3dffbe7",
  batchNumber: "010",
  executionStageLabel: "Stage 3.10.1",
  auditStageLabel: "Stage 3.10.0",
  focusedStageId: "stage-3.10.2",
  prebuildStageId: "stage-3.10.3",
  sourceReleaseVersion: "0.24.46",
  targetReleaseVersion: "0.24.47",
  auditPath: "architecture/migration/stage_3_batch_010_audit.json",
  executionPlanPath: "architecture/migration/stage_3_batch_010_execution_plan.json",
  testMatrixPath: "architecture/migration/stage_3_batch_010_test_matrix.json",
  expectedTargetCount: 1,
  expectedExportCount: 1,
  expectedActivationCount: 1,
  expectedConsumerCount: 2,
  expectedDependencyEdgeCount: 0,
  expectedTargets: [{
    currentPath: "src/core/inventory/unlimited_assembly_capacity_policy.js",
    targetPath: "src/game/domain/inventory/unlimited_assembly_capacity_policy.js",
    exports: ["UnlimitedAssemblyCapacityPolicy"],
  }],
  expectedActivationIds: ["activation-18da11a56651"],
  expectedActivationPositions: [148],
  expectedBridgeIds: ["bridge-ae3aff06a790", "bridge-bd8716a31cf4"],
  expectedTopology: {
    beforeProjectModuleCount: 36, afterProjectModuleCount: 37,
    beforeActivationCount: 37, afterActivationCount: 38,
    beforeBridgeCount: 62, afterBridgeCount: 64,
  },
  includeRuntimeActiveState: true,
  persistActiveBatchPhase: true,
  includeDetailedStatePerformanceGates: true,
  behaviorPhases: ["classic-baseline", "temporary-esm-parity", "post-cutover-esm"],
  compatibilityPhases: ["pre-build-fixture", "temporary-esm-parity", "post-build-runtime"],
  scmCheckpointRequired: true,
  sourceReleaseTag: "v0.24.46",
  bridgeReason: "Preserve the exact Inventory capacity policy consumers until their legacy symbols are removed.",
  rollbackRule: "restore-only-batch-010-delta-and-keep-batches-001-through-009",
  consumerSetSource: "stage-3.10.0-live-observation-and-frozen-consumer-set",
  operationIds: [
    "verify-frozen-evidence", "open-batch-010", "create-named-esm-target",
    "render-candidate-activation-shim", "project-two-consumer-bridges",
    "project-candidate-manifest", "validate-candidate-and-commit-atomic-cutover",
    "validate-identity-timing-state-and-behavior", "persist-and-reconcile-observations",
    "run-full-acceptance", "close-release-0.24.47",
  ],
}).value;

const BATCH_010_PREFLIGHT_PROFILE = new StageThreeBatchPreflightProfile({
  schemaVersion: 1,
  stageLabel: "Stage 3.10.0",
  artifactKind: "cyber-fishing-stage-3-batch-preflight-audit",
  batchId: executionProfile.batchId,
  sourceReleaseVersion: executionProfile.sourceReleaseVersion,
  executionProfile,
  reviewedContracts: {
    "src/core/inventory/unlimited_assembly_capacity_policy.js": {
      classification: "stateless",
      instanceFields: [],
      publicStateShape: [],
      resultShape: ["allowed", "reason"],
      stableResultIdentity: false,
      mutatesCallerInputs: false,
      performanceClassification: "one-fresh-object-per-canApply-call",
      hotLoopCallSites: [],
      callSiteEvidence: [
        { path: "src/application/inventory/inventory_v2_composition_root.js", marker: "new UnlimitedAssemblyCapacityPolicy()" },
        { path: "src/core/assemblies/item_assembly_service.js", marker: "new UnlimitedAssemblyCapacityPolicy()" },
      ],
      allocationBaseline: {
        objectExpressions: 1, arrayExpressions: 0, newExpressions: 0,
        objectFreezeCalls: 0, objectAssignCalls: 0, roundingCalls: 0,
      },
      semanticRisk: "exact-allowed-reason-result-and-fresh-object-identity",
    },
  },
  migrationGates: [
    "exact-class-and-canApply-source-shape", "stateless-single-instance-class-identity",
    "fresh-result-per-call", "zero-project-config-browser-dev-platform-dependencies",
    "zero-top-level-effects-and-transport-reads", "exact-two-classic-consumers",
    "exact-position-148-activation", "zero-added-allocations",
  ],
}).value;

module.exports = { BATCH_010_PREFLIGHT_PROFILE };
