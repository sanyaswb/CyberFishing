"use strict";

const { StageThreeBatchExecutionProfile } = require("../../../domain_batches/stage_three_batch_execution_profile");
const { StageThreeBatchPreflightProfile } = require("../../../domain_batches/stage_three_batch_preflight_profile");

const allocation = (objectExpressions, arrayExpressions, newExpressions, objectFreezeCalls,
  objectAssignCalls = 0, roundingCalls = 0) => ({ objectExpressions, arrayExpressions,
  newExpressions, objectFreezeCalls, objectAssignCalls, roundingCalls });
const repository = "src/core/loadouts/equipment_loadout_repository.js";
const contract = fields => ({ classification: "authoritative-owner", instanceFields: [],
  publicStateShape: [], resultShape: [], stableResultIdentity: false, mutatesCallerInputs: false,
  hotLoopCallSites: [], ...fields });

// Batch 049 adopts the Stage 3.50.0 repeated review and migrates the equipment loadout repository: the
// authoritative loadout Map (atomic local replacement by snapshot restore, proven by the review's collection
// contract), loadouts created from the batch 045 EquipmentLoadout import (two composition identities) and its
// reviewed global-this exposure moved to the activation shim. Risk level B: no per-frame call site; the
// persisted loadout snapshots are unchanged.
const EXECUTION_PROFILE = new StageThreeBatchExecutionProfile({
  schemaVersion: 1,
  batchId: "stage-3.replan-350.batch-049-loadouts-8df79db8",
  batchNumber: "049",
  executionStageLabel: "Stage 3.50.1",
  auditStageLabel: "Stage 3.50.0",
  focusedStageId: "stage-3.50.2",
  prebuildStageId: "stage-3.50.3",
  sourceReleaseVersion: "0.24.86",
  targetReleaseVersion: "0.24.87",
  auditPath: "architecture/migration/stage_3_batch_049_audit.json",
  executionPlanPath: "architecture/migration/stage_3_batch_049_execution_plan.json",
  testMatrixPath: "architecture/migration/stage_3_batch_049_test_matrix.json",
  expectedTargetCount: 1,
  expectedExportCount: 1,
  expectedActivationCount: 1,
  expectedConsumerCount: 2,
  expectedDependencyEdgeCount: 0,
  expectedTargets: [
    { currentPath: repository, targetPath: "src/game/domain/loadouts/equipment_loadout_repository.js",
      exports: ["EquipmentLoadoutRepository"] },
  ],
  continuationPlan: { path: "architecture/migration/stage_3_50_graph_review/approved_prefix.json",
    sha256: "a40f25ee0a6d671d12fb77b46e42ec102f3ba96ad5a550de2a6da45eba5057a7" },
  expectedImports: [
    { consumer: repository, from: "src/game/domain/loadouts/equipment_loadout.js", exportName: "EquipmentLoadout",
      legacySymbol: "EquipmentLoadout", viaShim: "src/core/loadouts/equipment_loadout.js",
      activationId: "activation-6088d7e23f95" },
  ],
  expectedActivationIds: ["activation-cc1097105d17"],
  expectedActivationPositions: [169],
  expectedBridgeIds: ["bridge-32ecd6bd8f9d", "bridge-d2cb57446440"],
  expectedRetiredBridgeIds: ["bridge-551355d4d947"],
  informationalDocumentsExcluded: true,
  expectedTopology: { beforeProjectModuleCount: 142, afterProjectModuleCount: 143,
    beforeActivationCount: 132, afterActivationCount: 133,
    beforeBridgeCount: 197, afterBridgeCount: 198 },
  includeRuntimeActiveState: true,
  persistActiveBatchPhase: true,
  includeDetailedStatePerformanceGates: true,
  behaviorPhases: ["classic-baseline", "temporary-esm-parity", "post-cutover-esm"],
  compatibilityPhases: ["pre-build-fixture", "temporary-esm-parity", "post-build-runtime"],
  scmCheckpointRequired: true,
  sourceReleaseTag: "v0.24.86",
  bridgeReason: "Preserve the exact equipment loadout repository consumers until their legacy symbol is removed.",
  rollbackRule: "restore-only-batch-049-delta-and-keep-batches-001-through-048",
  consumerSetSource: "stage-3.50.0-live-observation-and-stage-3.50-frozen-consumer-set",
  operationIds: ["verify-frozen-evidence", "adopt-stage-3.50-repeated-review-prefix-and-open-batch-049",
    "create-one-named-esm-target-with-one-export", "render-one-candidate-activation-shim",
    "project-two-consumer-bridges-and-retire-one", "project-candidate-manifest",
    "validate-candidate-and-commit-atomic-cutover", "validate-identity-timing-state-and-behavior",
    "persist-and-reconcile-observations", "run-full-acceptance", "close-release-0.24.87"],
}).value;

const PREFLIGHT_PROFILE = new StageThreeBatchPreflightProfile({
  schemaVersion: 1,
  stageLabel: "Stage 3.50.0",
  artifactKind: "cyber-fishing-stage-3-batch-preflight-audit",
  batchId: EXECUTION_PROFILE.batchId,
  sourceReleaseVersion: EXECUTION_PROFILE.sourceReleaseVersion,
  executionProfile: EXECUTION_PROFILE,
  sideEffectEvidence: { path: "architecture/migration/stage_3_batch_049_side_effect_review.json",
    sha256: "854f1c8015382b94ae784dfe3c92553e53321bb68e52a0df2fc9328a0900cbc2" },
  reviewedContracts: {
    [repository]: contract({
      instanceFields: ["#loadouts"],
      semanticRisk: "authoritative-loadout-map-with-atomic-snapshot-restore-and-owner-created-loadouts",
      performanceClassification: "existing-equipment-loadout-repository",
      callSiteEvidence: [
        { path: "src/application/inventory/inventory_v2_composition_root.js", marker: "new EquipmentLoadoutRepository({" },
        { path: "src/infrastructure/storage/inventory_v2_legacy_migration.js", marker: "new EquipmentLoadoutRepository();" },
      ],
      allocationBaseline: allocation(2, 4, 7, 0),
      stateIdentityReview: { className: "EquipmentLoadoutRepository", collections: [
        { owner: "EquipmentLoadoutRepository#loadouts", field: "#loadouts", scope: "instance", collection: "Map",
          allowedOperations: ["delete", "get", "has", "set", "values"], replacement: "atomic-local" },
      ] },
      compositionIdentityReview: true,
      legacyExposure: { symbol: "EquipmentLoadoutRepository", location: "71:1", mechanism: "global-this-property" },
    }),
  },
  migrationGates: ["one-exact-source-and-method-shape", "one-export-identity-and-activation",
    "one-exact-completed-prefix-import", "two-owner-created-composition-identities",
    "one-collection-identity-with-atomic-local-replacement", "one-reviewed-global-this-exposure",
    "two-exact-consumer-relationships-and-one-retired-bridge", "persisted-loadout-snapshots-unchanged",
    "all-legacy-activation-positions-preserved", "zero-config-platform-browser-dev-dependencies",
    "zero-added-hot-loop-allocations"],
}).value;

const RELEASE = Object.freeze({
  title: "Equipment Loadout Repository Domain",
  codename: "equipment-loadout-repository-domain",
  summary: "Batch 049 adopted the Stage 3.50.0 repeated review and migrated the equipment loadout repository.",
  smokeContext: "Automated browser smoke under the owner's 2026-10-01 authorization: game-cycle re-executed without seals and compared with the pre-cutover output, game loaded in the built-in browser, and console errors and warnings counted.",
  notes: [
    "Adopt the Stage 3.50.0 repeated review",
    "Migrate the equipment loadout repository with its reviewed loadout map and global exposure",
    "Preserve one hundred forty-three project modules, one hundred thirty-three active activations and one hundred ninety-eight bridges",
  ],
  // Short format (owner decision 2026-10-01): 1-3 lines per release.
  changelog: [
    "- Migrated EquipmentLoadoutRepository to the loadouts Domain (Stage 3.50.0 repeated review adopted); saved loadouts are unchanged.",
  ],
});

module.exports = { PREFLIGHT_PROFILE, RELEASE };
