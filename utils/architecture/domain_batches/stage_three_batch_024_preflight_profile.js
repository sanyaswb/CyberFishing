"use strict";

const { StageThreeBatchExecutionProfile } = require("./stage_three_batch_execution_profile");
const { StageThreeBatchPreflightProfile } = require("./stage_three_batch_preflight_profile");

const allocation = (objectExpressions, arrayExpressions, newExpressions, objectFreezeCalls,
  objectAssignCalls = 0, roundingCalls = 0) => ({ objectExpressions, arrayExpressions,
  newExpressions, objectFreezeCalls, objectAssignCalls, roundingCalls });
const policy = "src/core/inventory/inventory_item_reservation_policy.js";
const domain = "src/game/domain/inventory/";
const contract = fields => ({ classification: "authoritative-owner", instanceFields: [],
  publicStateShape: [], resultShape: [], stableResultIdentity: false, mutatesCallerInputs: false,
  hotLoopCallSites: [], ...fields });

// Batch 024 migrates the inventory reservation policy: its reviewed `globalThis` exposure moves to
// the exact activation shim and its InventoryItemLocation read becomes a reviewed import.
const BATCH_024_EXECUTION_PROFILE = new StageThreeBatchExecutionProfile({
  schemaVersion: 1,
  batchId: "stage-3.replan-322.batch-024-inventory-21307d68",
  batchNumber: "024",
  executionStageLabel: "Stage 3.25.1",
  auditStageLabel: "Stage 3.25.0",
  focusedStageId: "stage-3.25.2",
  prebuildStageId: "stage-3.25.3",
  sourceReleaseVersion: "0.24.61",
  targetReleaseVersion: "0.24.62",
  auditPath: "architecture/migration/stage_3_batch_024_audit.json",
  executionPlanPath: "architecture/migration/stage_3_batch_024_execution_plan.json",
  testMatrixPath: "architecture/migration/stage_3_batch_024_test_matrix.json",
  expectedTargetCount: 1,
  expectedExportCount: 1,
  expectedActivationCount: 1,
  expectedConsumerCount: 1,
  expectedDependencyEdgeCount: 0,
  expectedTargets: [
    { currentPath: policy, targetPath: domain + "inventory_item_reservation_policy.js",
      exports: ["InventoryItemReservationPolicy"] },
  ],
  continuationPlan: { path: "architecture/migration/stage_3_22/approved_prefix.json",
    sha256: "4873af4bbc6a11a07a57c17cd198350d8154c0e6eed3a17551b8d02f97eb436c" },
  expectedImports: [
    { consumer: policy, from: domain + "inventory_item_location.js", exportName: "InventoryItemLocation",
      legacySymbol: "InventoryItemLocation", viaShim: "src/core/inventory/inventory_item_location.js",
      activationId: "activation-c3a8ca11fb0e" },
  ],
  expectedActivationIds: ["activation-490b698c2a9d"],
  expectedActivationPositions: [145],
  expectedBridgeIds: ["bridge-1d4e09922abc"],
  expectedRetiredBridgeIds: ["bridge-c4dc5b7e33f1"],
  expectedTopology: { beforeProjectModuleCount: 82, afterProjectModuleCount: 83,
    beforeActivationCount: 92, afterActivationCount: 93,
    beforeBridgeCount: 142, afterBridgeCount: 142 },
  includeRuntimeActiveState: true,
  persistActiveBatchPhase: true,
  includeDetailedStatePerformanceGates: true,
  behaviorPhases: ["classic-baseline", "temporary-esm-parity", "post-cutover-esm"],
  compatibilityPhases: ["pre-build-fixture", "temporary-esm-parity", "post-build-runtime"],
  scmCheckpointRequired: true,
  sourceReleaseTag: "v0.24.61",
  bridgeReason: "Preserve the exact inventory reservation consumer until its legacy symbol is removed.",
  rollbackRule: "restore-only-batch-024-delta-and-keep-batches-001-through-023",
  consumerSetSource: "stage-3.25.0-live-observation-and-stage-3.22-frozen-consumer-set",
  operationIds: ["verify-frozen-evidence", "open-batch-024",
    "create-one-named-esm-target-with-one-prefix-import", "render-one-candidate-activation-shim",
    "project-one-consumer-bridge-and-retire-one", "project-candidate-manifest",
    "validate-candidate-and-commit-atomic-cutover", "validate-identity-timing-state-and-behavior",
    "persist-and-reconcile-observations", "run-full-acceptance", "close-release-0.24.62"],
}).value;

const BATCH_024_PREFLIGHT_PROFILE = new StageThreeBatchPreflightProfile({
  schemaVersion: 1,
  stageLabel: "Stage 3.25.0",
  artifactKind: "cyber-fishing-stage-3-batch-preflight-audit",
  batchId: BATCH_024_EXECUTION_PROFILE.batchId,
  sourceReleaseVersion: BATCH_024_EXECUTION_PROFILE.sourceReleaseVersion,
  executionProfile: BATCH_024_EXECUTION_PROFILE,
  sideEffectEvidence: { path: "architecture/migration/stage_3_batch_024_side_effect_review.json",
    sha256: "0a0c1dd19d4e1213869dc01ec0885d344d76a1dc569d6dff3efb21df8fe9e550" },
  reviewedContracts: {
    [policy]: contract({
      instanceFields: ["#equipmentState", "#loadouts"],
      semanticRisk: "equipment-and-loadout-reservation-and-merge-eligibility",
      performanceClassification: "existing-inventory-reservation-policy",
      callSiteEvidence: [{ path: "src/application/inventory/inventory_v2_composition_root.js",
        marker: "new InventoryItemReservationPolicy({" }],
      allocationBaseline: allocation(1, 0, 0, 0),
      legacyExposure: { symbol: "InventoryItemReservationPolicy", location: "42:1",
        mechanism: "global-this-property" },
    }),
  },
  migrationGates: ["one-exact-source-and-method-shape", "one-export-identity-and-activation",
    "one-reviewed-global-this-exposure", "one-exact-completed-prefix-import",
    "one-exact-consumer-relationship-and-one-retired-bridge", "all-legacy-activation-positions-preserved",
    "zero-config-platform-browser-dev-dependencies", "zero-added-hot-loop-allocations"],
}).value;

module.exports = { BATCH_024_PREFLIGHT_PROFILE, BATCH_024_EXECUTION_PROFILE };
