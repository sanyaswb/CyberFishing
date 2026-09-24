"use strict";

const { StageThreeBatchExecutionProfile } = require("./stage_three_batch_execution_profile");
const { StageThreeBatchPreflightProfile } = require("./stage_three_batch_preflight_profile");

const allocation = (objectExpressions, arrayExpressions, newExpressions, objectFreezeCalls) => ({
  objectExpressions, arrayExpressions, newExpressions, objectFreezeCalls,
  objectAssignCalls: 0, roundingCalls: 0,
});

const executionProfile = new StageThreeBatchExecutionProfile({
  schemaVersion: 1,
  batchId: "stage-3.candidate-012-assemblies-2086347a",
  batchNumber: "012",
  executionStageLabel: "Stage 3.12.1",
  auditStageLabel: "Stage 3.12.0",
  focusedStageId: "stage-3.12.2",
  prebuildStageId: "stage-3.12.3",
  sourceReleaseVersion: "0.24.48",
  targetReleaseVersion: "0.24.49",
  auditPath: "architecture/migration/stage_3_batch_012_audit.json",
  executionPlanPath: "architecture/migration/stage_3_batch_012_execution_plan.json",
  testMatrixPath: "architecture/migration/stage_3_batch_012_test_matrix.json",
  expectedTargetCount: 2,
  expectedExportCount: 2,
  expectedActivationCount: 2,
  expectedConsumerCount: 2,
  expectedDependencyEdgeCount: 0,
  expectedTargets: [
    { currentPath: "src/core/assemblies/assembly_attachment_target_resolver.js",
      targetPath: "src/game/domain/assemblies/assembly_attachment_target_resolver.js",
      exports: ["AssemblyAttachmentTargetResolver"] },
    { currentPath: "src/core/assemblies/assembly_completion_policy.js",
      targetPath: "src/game/domain/assemblies/assembly_completion_policy.js",
      exports: ["AssemblyCompletionPolicy"] },
  ],
  expectedActivationIds: ["activation-596779b33d76", "activation-974deda48a6f"],
  expectedActivationPositions: [153, 154],
  expectedBridgeIds: ["bridge-1c1aebb0522e", "bridge-95d3da316a17"],
  expectedTopology: {
    beforeProjectModuleCount: 42, afterProjectModuleCount: 44,
    beforeActivationCount: 43, afterActivationCount: 45,
    beforeBridgeCount: 74, afterBridgeCount: 76,
  },
  includeRuntimeActiveState: true,
  persistActiveBatchPhase: true,
  includeDetailedStatePerformanceGates: true,
  behaviorPhases: ["classic-baseline", "temporary-esm-parity", "post-cutover-esm"],
  compatibilityPhases: ["pre-build-fixture", "temporary-esm-parity", "post-build-runtime"],
  scmCheckpointRequired: true,
  sourceReleaseTag: "v0.24.48",
  bridgeReason: "Preserve the exact Assemblies domain consumers until their legacy symbols are removed.",
  rollbackRule: "restore-only-batch-012-delta-and-keep-batches-001-through-011",
  consumerSetSource: "stage-3.12.0-live-observation-and-frozen-consumer-set",
  operationIds: [
    "verify-frozen-evidence", "open-batch-012", "create-two-named-esm-targets",
    "render-two-candidate-activation-shims", "project-two-consumer-bridges",
    "project-candidate-manifest", "validate-candidate-and-commit-atomic-cutover",
    "validate-identity-timing-state-and-behavior", "persist-and-reconcile-observations",
    "run-full-acceptance", "close-release-0.24.49",
  ],
}).value;

const BATCH_012_PREFLIGHT_PROFILE = new StageThreeBatchPreflightProfile({
  schemaVersion: 1,
  stageLabel: "Stage 3.12.0",
  artifactKind: "cyber-fishing-stage-3-batch-preflight-audit",
  batchId: executionProfile.batchId,
  sourceReleaseVersion: executionProfile.sourceReleaseVersion,
  executionProfile,
  sideEffectEvidence: {
    path: "architecture/migration/stage_3_batch_012_side_effect_review.json",
    sha256: "0f2f7180c4339998be4556d4316878a233988aa34ac9fe47bea0ee23258f4c30",
  },
  reviewedContracts: {
    "src/core/assemblies/assembly_attachment_target_resolver.js": {
      classification: "authoritative-owner",
      instanceFields: ["#profileRegistry", "#reader", "#repository", "#stateRepository"],
      publicStateShape: [],
      resultShape: ["capacity", "depth", "occupied", "parentContext", "parentInstanceId",
        "rootInstanceId", "slotDefinition", "slotId", "slotIndex", "socketId"],
      stableResultIdentity: false, mutatesCallerInputs: false,
      performanceClassification: "existing-recursive-target-discovery-and-frozen-results",
      hotLoopCallSites: [],
      callSiteEvidence: [{ path: "src/application/inventory/inventory_v2_composition_root.js",
        marker: "new AssemblyAttachmentTargetResolver({" }],
      allocationBaseline: allocation(3, 8, 5, 9),
      legacyExposure: { symbol: "AssemblyAttachmentTargetResolver", location: "150:1" },
      semanticRisk: "recursive-target-order-frozen-shapes-and-single-global-exposure",
    },
    "src/core/assemblies/assembly_completion_policy.js": {
      classification: "authoritative-owner",
      instanceFields: ["#assemblyReader", "#profileRegistry", "#repository"],
      publicStateShape: [],
      resultShape: ["filledSlotCount", "hasAnyComponent", "hasSlots", "isComplete", "totalSlotCount"],
      stableResultIdentity: false, mutatesCallerInputs: false,
      performanceClassification: "existing-recursive-analysis-and-frozen-public-result",
      hotLoopCallSites: [],
      callSiteEvidence: [{ path: "src/application/inventory/inventory_v2_composition_root.js",
        marker: "new AssemblyCompletionPolicy({" }],
      allocationBaseline: allocation(5, 0, 3, 2),
      legacyExposure: { symbol: "AssemblyCompletionPolicy", location: "93:1" },
      semanticRisk: "recursive-completion-counting-cycle-detection-and-single-global-exposure",
    },
  },
  migrationGates: [
    "two-exact-class-and-method-shapes", "one-class-identity-per-export-and-activation",
    "single-authoritative-instance-state", "two-reviewed-global-assignments-only",
    "exact-two-classic-consumers", "activation-positions-153-and-154",
    "zero-config-platform-browser-dev-dependencies", "zero-added-hot-loop-allocations",
  ],
}).value;

module.exports = { BATCH_012_PREFLIGHT_PROFILE };
