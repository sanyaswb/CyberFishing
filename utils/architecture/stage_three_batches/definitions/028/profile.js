"use strict";

const { StageThreeBatchExecutionProfile } = require("../../../domain_batches/stage_three_batch_execution_profile");
const { StageThreeBatchPreflightProfile } = require("../../../domain_batches/stage_three_batch_preflight_profile");

const allocation = (objectExpressions, arrayExpressions, newExpressions, objectFreezeCalls,
  objectAssignCalls = 0, roundingCalls = 0) => ({ objectExpressions, arrayExpressions,
  newExpressions, objectFreezeCalls, objectAssignCalls, roundingCalls });
const service = "src/core/assemblies/item_assembly_service.js";
const imported = (from, exportName, viaShim, activationId) => ({ consumer: service, from, exportName,
  legacySymbol: exportName, viaShim, activationId });
const contract = fields => ({ classification: "authoritative-owner", instanceFields: [],
  publicStateShape: [], resultShape: [], stableResultIdentity: false, mutatesCallerInputs: false,
  hotLoopCallSites: [], ...fields });

// Batch 028 migrates the item assembly service and its domain error. Two of its five reviewed
// imports come from earlier batches of this continuation (022 reader, 026 stacking policy); its
// owner-created default collaborators are proven Domain compositions.
const EXECUTION_PROFILE = new StageThreeBatchExecutionProfile({
  schemaVersion: 1,
  batchId: "stage-3.replan-322.batch-028-assemblies-f4be469e",
  batchNumber: "028",
  executionStageLabel: "Stage 3.29.1",
  auditStageLabel: "Stage 3.29.0",
  focusedStageId: "stage-3.29.2",
  prebuildStageId: "stage-3.29.3",
  sourceReleaseVersion: "0.24.65",
  targetReleaseVersion: "0.24.66",
  auditPath: "architecture/migration/stage_3_batch_028_audit.json",
  executionPlanPath: "architecture/migration/stage_3_batch_028_execution_plan.json",
  testMatrixPath: "architecture/migration/stage_3_batch_028_test_matrix.json",
  expectedTargetCount: 1,
  expectedExportCount: 2,
  expectedActivationCount: 1,
  expectedConsumerCount: 2,
  expectedDependencyEdgeCount: 0,
  expectedTargets: [
    { currentPath: service, targetPath: "src/game/domain/assemblies/item_assembly_service.js",
      exports: ["ItemAssemblyDomainError", "ItemAssemblyService"] },
  ],
  continuationPlan: { path: "architecture/migration/stage_3_22/approved_prefix.json",
    sha256: "4873af4bbc6a11a07a57c17cd198350d8154c0e6eed3a17551b8d02f97eb436c" },
  expectedImports: [
    imported("src/game/domain/assemblies/exact_assembly_refill_signature_policy.js", "ExactAssemblyRefillSignaturePolicy",
      "src/core/assemblies/exact_assembly_refill_signature_policy.js", "activation-28ccfbfa82e2"),
    imported("src/game/domain/assemblies/item_assembly_reader.js", "ItemAssemblyReader",
      "src/core/assemblies/item_assembly_reader.js", "activation-846a4f1261db"),
    imported("src/game/domain/inventory/inventory_item_location.js", "InventoryItemLocation",
      "src/core/inventory/inventory_item_location.js", "activation-c3a8ca11fb0e"),
    imported("src/game/domain/inventory/item_assembly_stacking_policy.js", "ItemAssemblyStackingPolicy",
      "src/core/inventory/item_assembly_stacking_policy.js", "activation-1daa30ad1fef"),
    imported("src/game/domain/inventory/unlimited_assembly_capacity_policy.js", "UnlimitedAssemblyCapacityPolicy",
      "src/core/inventory/unlimited_assembly_capacity_policy.js", "activation-18da11a56651"),
  ],
  expectedActivationIds: ["activation-46387e5f1ebf"],
  expectedActivationPositions: [156],
  expectedBridgeIds: ["bridge-2e917650176f", "bridge-641560fd9441"],
  informationalDocumentsExcluded: true,
  expectedRetiredBridgeIds: ["bridge-0c362ab87767", "bridge-66d8c5b75058", "bridge-ae3aff06a790",
    "bridge-c49ad9e90c8b", "bridge-e01af933a4a4"],
  expectedTopology: { beforeProjectModuleCount: 92, afterProjectModuleCount: 93,
    beforeActivationCount: 97, afterActivationCount: 98,
    beforeBridgeCount: 144, afterBridgeCount: 141 },
  includeRuntimeActiveState: true,
  persistActiveBatchPhase: true,
  includeDetailedStatePerformanceGates: true,
  behaviorPhases: ["classic-baseline", "temporary-esm-parity", "post-cutover-esm"],
  compatibilityPhases: ["pre-build-fixture", "temporary-esm-parity", "post-build-runtime"],
  scmCheckpointRequired: true,
  sourceReleaseTag: "v0.24.65",
  bridgeReason: "Preserve the exact item assembly service consumers until their legacy symbol is removed.",
  rollbackRule: "restore-only-batch-028-delta-and-keep-batches-001-through-027",
  consumerSetSource: "stage-3.29.0-live-observation-and-stage-3.22-frozen-consumer-set",
  operationIds: ["verify-frozen-evidence", "open-batch-028",
    "create-one-named-esm-target-with-five-prefix-imports", "render-one-candidate-activation-shim",
    "project-two-consumer-bridges-and-retire-five", "project-candidate-manifest",
    "validate-candidate-and-commit-atomic-cutover", "validate-identity-timing-state-and-behavior",
    "persist-and-reconcile-observations", "run-full-acceptance", "close-release-0.24.66"],
}).value;

const PREFLIGHT_PROFILE = new StageThreeBatchPreflightProfile({
  schemaVersion: 1,
  stageLabel: "Stage 3.29.0",
  artifactKind: "cyber-fishing-stage-3-batch-preflight-audit",
  batchId: EXECUTION_PROFILE.batchId,
  sourceReleaseVersion: EXECUTION_PROFILE.sourceReleaseVersion,
  executionProfile: EXECUTION_PROFILE,
  sideEffectEvidence: { path: "architecture/migration/stage_3_batch_028_side_effect_review.json",
    sha256: "cd36f66b28a1b48d35094062d200e8c0a82cddcfbaf42a423d5140e40fa99975" },
  reviewedContracts: {
    [service]: contract({
      instanceFields: ["#capacityPolicy", "#profileRegistry", "#reader", "#repository", "#reservationPolicy",
        "#signaturePolicy", "#stackingPolicy", "#stateRepository"],
      semanticRisk: "assembly-tree-operations-with-transactional-snapshots-and-owned-default-collaborators",
      performanceClassification: "existing-item-assembly-service",
      callSiteEvidence: [
        { path: "src/application/inventory/inventory_v2_composition_root.js", marker: "new ItemAssemblyService({" },
        { path: "src/infrastructure/storage/inventory_v2_legacy_migration.js", marker: "new ItemAssemblyService({" },
      ],
      allocationBaseline: allocation(36, 16, 10, 0),
      compositionIdentityReview: true,
    }),
  },
  migrationGates: ["one-exact-source-and-method-shape", "two-export-identities-and-one-activation",
    "five-exact-imports-including-two-earlier-batch-exports", "four-owner-created-composition-identities",
    "two-batch-completion-prerequisites", "two-exact-consumer-relationships-and-five-retired-bridges",
    "all-legacy-activation-positions-preserved", "zero-config-platform-browser-dev-dependencies",
    "zero-added-hot-loop-allocations"],
}).value;

const RELEASE = Object.freeze({
  title: "Assemblies Item Assembly Service Domain",
  codename: "assemblies-item-assembly-service-domain",
  summary: "Batch 028 migrated ItemAssemblyService and ItemAssemblyDomainError with earlier-batch imports.",
  smokeContext: "Automated substitute per the owner's 2026-09-27 authorization: game-cycle loop re-executed without seals and a built-in-browser load of the game (inventory assemblies) with screenshots and console counts.",
  notes: [
    "Migrate the item assembly service and its domain error",
    "Import the assembly reader and stacking policy from earlier batches of this continuation",
    "Keep the owner-created default collaborators as proven Domain compositions",
    "Preserve ninety-three project modules, ninety-eight activations and one hundred forty-one bridges",
  ],
  changelog: [
    "- Completed batch 028 of the Stage 3.22 approved prefix: ItemAssemblyService and ItemAssemblyDomainError as named ESM exports.",
    "- Five reviewed imports, two of them from earlier batches of this continuation (ItemAssemblyReader from 022, ItemAssemblyStackingPolicy from 026); its owner-created default collaborators are proven Domain compositions, and the batch-completion prerequisites resolve from the execution state.",
    "- Extended the cumulative graph from 92 to 93 project modules and from 97 to 98 activation contracts, with 141 exact bridge relationships (2 added, 5 retired).",
    "- The next task is batch 029 preflight.",
  ],
});

module.exports = { PREFLIGHT_PROFILE, RELEASE };
