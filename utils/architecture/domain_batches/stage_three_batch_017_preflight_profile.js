"use strict";

const { StageThreeBatchExecutionProfile } = require("./stage_three_batch_execution_profile");
const { StageThreeBatchPreflightProfile } = require("./stage_three_batch_preflight_profile");

const allocation = (objectExpressions, arrayExpressions, newExpressions, objectFreezeCalls,
  objectAssignCalls = 0, roundingCalls = 0) => ({ objectExpressions, arrayExpressions,
  newExpressions, objectFreezeCalls, objectAssignCalls, roundingCalls });
const source = "src/core/inventory/inventory_item_location.js";
const target = "src/game/domain/inventory/inventory_item_location.js";
const repository = "src/core/inventory/flat_inventory_item_repository.js";

const BATCH_017_EXECUTION_PROFILE = new StageThreeBatchExecutionProfile({
  schemaVersion: 1,
  batchId: "stage-3.candidate-017-inventory-fd62478b",
  batchNumber: "017",
  executionStageLabel: "Stage 3.17.1",
  auditStageLabel: "Stage 3.17.0",
  focusedStageId: "stage-3.17.2",
  prebuildStageId: "stage-3.17.3",
  sourceReleaseVersion: "0.24.53",
  targetReleaseVersion: "0.24.54",
  auditPath: "architecture/migration/stage_3_batch_017_audit.json",
  executionPlanPath: "architecture/migration/stage_3_batch_017_execution_plan.json",
  testMatrixPath: "architecture/migration/stage_3_batch_017_test_matrix.json",
  expectedTargetCount: 1,
  expectedExportCount: 2,
  expectedActivationCount: 2,
  expectedConsumerCount: 15,
  expectedDependencyEdgeCount: 0,
  expectedTargets: [
    { currentPath: source, targetPath: target,
      exports: ["InventoryItemLocation", "InventoryItemLocationKind"] },
  ],
  expectedActivationIds: ["activation-1203aa3f3b14", "activation-c3a8ca11fb0e"],
  expectedActivationPositions: [144, 144],
  expectedBridgeIds: ["bridge-0c362ab87767", "bridge-357870b89ad9", "bridge-53764cfb47d0",
    "bridge-61c989dead40", "bridge-65b88accc9a1", "bridge-81fd90ae9bb0", "bridge-8cec1d46f092",
    "bridge-92c7ce13cb8b", "bridge-94443eb8e5b1", "bridge-9ce49a18f3b2", "bridge-a3d545c52d12",
    "bridge-c4dc5b7e33f1", "bridge-d2178f043482", "bridge-d23a9f662ce9", "bridge-e30124e33a3f"],
  expectedTopology: { beforeProjectModuleCount: 63, afterProjectModuleCount: 64,
    beforeActivationCount: 66, afterActivationCount: 68,
    beforeBridgeCount: 96, afterBridgeCount: 111 },
  includeRuntimeActiveState: true,
  persistActiveBatchPhase: true,
  includeDetailedStatePerformanceGates: true,
  behaviorPhases: ["classic-baseline", "temporary-esm-parity", "post-cutover-esm"],
  compatibilityPhases: ["pre-build-fixture", "temporary-esm-parity", "post-build-runtime"],
  scmCheckpointRequired: true,
  sourceReleaseTag: "v0.24.53",
  bridgeReason: "Preserve the exact Inventory domain consumers until their legacy symbols are removed.",
  rollbackRule: "restore-only-batch-017-delta-and-keep-batches-001-through-016",
  consumerSetSource: "stage-3.17.0-live-observation-and-frozen-consumer-set",
  operationIds: ["verify-frozen-evidence", "open-batch-017", "create-one-named-esm-target",
    "render-two-candidate-activation-shims", "project-fifteen-consumer-bridges",
    "project-candidate-manifest", "validate-candidate-and-commit-atomic-cutover",
    "validate-identity-timing-state-and-behavior", "persist-and-reconcile-observations",
    "run-full-acceptance", "close-release-0.24.54"],
}).value;

const BATCH_017_PREFLIGHT_PROFILE = new StageThreeBatchPreflightProfile({
  schemaVersion: 1,
  stageLabel: "Stage 3.17.0",
  artifactKind: "cyber-fishing-stage-3-batch-preflight-audit",
  batchId: BATCH_017_EXECUTION_PROFILE.batchId,
  sourceReleaseVersion: BATCH_017_EXECUTION_PROFILE.sourceReleaseVersion,
  executionProfile: BATCH_017_EXECUTION_PROFILE,
  sideEffectEvidence: { path: "architecture/migration/stage_3_batch_017_side_effect_review.json",
    sha256: "fed3d2df394b3e7cc2ad264c154f7b6dd5ac85dd08ac9975d4575511f35cb856" },
  reviewedContracts: {
    [source]: {
      classification: "authoritative-owner", instanceFields: [], publicStateShape: [],
      resultShape: [], stableResultIdentity: false, mutatesCallerInputs: false,
      semanticRisk: "location-kind-table-identity-validation-errors-and-frozen-location-shapes",
      performanceClassification: "existing-inventory-location-value-construction",
      hotLoopCallSites: [],
      callSiteEvidence: [{ path: repository, marker: "InventoryItemLocation.normalize(location)" }],
      allocationBaseline: allocation(3, 0, 3, 3),
      frozenConstants: { className: "InventoryItemLocation", bindings: {
        InventoryItemLocationKind: { location: "1:35",
          values: { INVENTORY: "INVENTORY", ATTACHED: "ATTACHED", LOADOUT: "LOADOUT" } },
      } },
    },
  },
  migrationGates: ["one-exact-source-and-method-shape", "two-export-identities-and-activations",
    "one-frozen-string-literal-constant-evaluation-effect", "fifteen-exact-consumer-relationships",
    "all-legacy-activation-positions-preserved", "zero-config-platform-browser-dev-dependencies",
    "zero-added-hot-loop-allocations"],
}).value;

module.exports = { BATCH_017_PREFLIGHT_PROFILE, BATCH_017_EXECUTION_PROFILE };
