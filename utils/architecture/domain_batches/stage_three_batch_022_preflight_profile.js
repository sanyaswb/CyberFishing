"use strict";

const { StageThreeBatchExecutionProfile } = require("./stage_three_batch_execution_profile");
const { StageThreeBatchPreflightProfile } = require("./stage_three_batch_preflight_profile");

const allocation = (objectExpressions, arrayExpressions, newExpressions, objectFreezeCalls,
  objectAssignCalls = 0, roundingCalls = 0) => ({ objectExpressions, arrayExpressions,
  newExpressions, objectFreezeCalls, objectAssignCalls, roundingCalls });
const reader = "src/core/assemblies/item_assembly_reader.js";
const domain = "src/game/domain/assemblies/";
const contract = fields => ({ classification: "authoritative-owner", instanceFields: [],
  publicStateShape: [], resultShape: [], stableResultIdentity: false, mutatesCallerInputs: false,
  hotLoopCallSites: [], ...fields });

// Batch 022 is the first continuation batch of the Stage 3.22 approved prefix and the first target
// that imports an export of the completed prefix instead of reading its legacy global.
const BATCH_022_EXECUTION_PROFILE = new StageThreeBatchExecutionProfile({
  schemaVersion: 1,
  batchId: "stage-3.replan-322.batch-022-assemblies-9cb3eecf",
  batchNumber: "022",
  executionStageLabel: "Stage 3.23.1",
  auditStageLabel: "Stage 3.23.0",
  focusedStageId: "stage-3.23.2",
  prebuildStageId: "stage-3.23.3",
  sourceReleaseVersion: "0.24.59",
  targetReleaseVersion: "0.24.60",
  auditPath: "architecture/migration/stage_3_batch_022_audit.json",
  executionPlanPath: "architecture/migration/stage_3_batch_022_execution_plan.json",
  testMatrixPath: "architecture/migration/stage_3_batch_022_test_matrix.json",
  expectedTargetCount: 1,
  expectedExportCount: 2,
  expectedActivationCount: 2,
  expectedConsumerCount: 4,
  expectedDependencyEdgeCount: 0,
  expectedTargets: [
    { currentPath: reader, targetPath: domain + "item_assembly_reader.js",
      exports: ["ItemAssemblyPath", "ItemAssemblyReader"] },
  ],
  continuationPlan: { path: "architecture/migration/stage_3_22/approved_prefix.json",
    sha256: "4873af4bbc6a11a07a57c17cd198350d8154c0e6eed3a17551b8d02f97eb436c" },
  expectedImports: [
    { consumer: reader, from: "src/game/domain/inventory/inventory_item_location.js",
      exportName: "InventoryItemLocation", legacySymbol: "InventoryItemLocation",
      viaShim: "src/core/inventory/inventory_item_location.js", activationId: "activation-c3a8ca11fb0e" },
  ],
  expectedActivationIds: ["activation-846a4f1261db", "activation-b1c0f1f37980"],
  expectedActivationPositions: [152, 152],
  expectedBridgeIds: ["bridge-165cb09a0730", "bridge-7d2a79c0168c", "bridge-a6ee164c50c8",
    "bridge-c49ad9e90c8b"],
  expectedRetiredBridgeIds: ["bridge-d23a9f662ce9"],
  expectedTopology: { beforeProjectModuleCount: 78, afterProjectModuleCount: 79,
    beforeActivationCount: 87, afterActivationCount: 89,
    beforeBridgeCount: 139, afterBridgeCount: 142 },
  includeRuntimeActiveState: true,
  persistActiveBatchPhase: true,
  includeDetailedStatePerformanceGates: true,
  behaviorPhases: ["classic-baseline", "temporary-esm-parity", "post-cutover-esm"],
  compatibilityPhases: ["pre-build-fixture", "temporary-esm-parity", "post-build-runtime"],
  scmCheckpointRequired: true,
  sourceReleaseTag: "v0.24.59",
  bridgeReason: "Preserve the exact Assemblies read-model consumers until their legacy symbols are removed.",
  rollbackRule: "restore-only-batch-022-delta-and-keep-batches-001-through-021",
  consumerSetSource: "stage-3.23.0-live-observation-and-stage-3.22-frozen-consumer-set",
  operationIds: ["verify-frozen-evidence", "open-batch-022-and-adopt-stage-3.22-prefix",
    "create-one-named-esm-target-with-one-prefix-import", "render-two-candidate-activation-shims",
    "project-four-consumer-bridges-and-retire-one", "project-candidate-manifest",
    "validate-candidate-and-commit-atomic-cutover", "validate-identity-timing-state-and-behavior",
    "persist-and-reconcile-observations", "run-full-acceptance", "close-release-0.24.60"],
}).value;

const BATCH_022_PREFLIGHT_PROFILE = new StageThreeBatchPreflightProfile({
  schemaVersion: 1,
  stageLabel: "Stage 3.23.0",
  artifactKind: "cyber-fishing-stage-3-batch-preflight-audit",
  batchId: BATCH_022_EXECUTION_PROFILE.batchId,
  sourceReleaseVersion: BATCH_022_EXECUTION_PROFILE.sourceReleaseVersion,
  executionProfile: BATCH_022_EXECUTION_PROFILE,
  reviewedContracts: {
    [reader]: contract({
      instanceFields: ["#profileRegistry", "#repository", "#stateRepository"],
      semanticRisk: "assembly-path-parsing-root-resolution-and-slot-path-formatting",
      performanceClassification: "existing-assembly-read-model",
      callSiteEvidence: [
        { path: "src/application/inventory/inventory_v2_composition_root.js", marker: "new ItemAssemblyReader({" },
        { path: "src/application/inventory/inventory_v2_refill_ports.js", marker: "ItemAssemblyPath.parse(target.path)" },
      ],
      allocationBaseline: allocation(2, 1, 12, 0),
    }),
  },
  migrationGates: ["one-exact-source-and-method-shape", "two-export-identities-and-activations",
    "one-exact-completed-prefix-import", "four-exact-consumer-relationships", "one-retired-classic-bridge",
    "all-legacy-activation-positions-preserved", "zero-config-platform-browser-dev-dependencies",
    "zero-added-hot-loop-allocations"],
}).value;

module.exports = { BATCH_022_PREFLIGHT_PROFILE, BATCH_022_EXECUTION_PROFILE };
