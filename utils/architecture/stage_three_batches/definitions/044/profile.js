"use strict";

const { StageThreeBatchExecutionProfile } = require("../../../domain_batches/stage_three_batch_execution_profile");
const { StageThreeBatchPreflightProfile } = require("../../../domain_batches/stage_three_batch_preflight_profile");

const allocation = (objectExpressions, arrayExpressions, newExpressions, objectFreezeCalls,
  objectAssignCalls = 0, roundingCalls = 0) => ({ objectExpressions, arrayExpressions,
  newExpressions, objectFreezeCalls, objectAssignCalls, roundingCalls });
const registry = "src/core/items/progression/item_catalog_baseline_registry.js";
const contract = fields => ({ classification: "authoritative-owner", instanceFields: [],
  publicStateShape: [], resultShape: [], stableResultIdentity: false, mutatesCallerInputs: false,
  hotLoopCallSites: [], ...fields });

// Batch 044 migrates the item catalog baseline registry. Its private instance Map is the only cache of
// catalog baselines (keys built from the group, strategy, metric, stat path and formula); the reviewed
// collection identity proves get/set/clear only and in-place invalidation. Risk level B: no per-frame
// call site, no persisted data. The logger is injected by composition.
const EXECUTION_PROFILE = new StageThreeBatchExecutionProfile({
  schemaVersion: 1,
  batchId: "stage-3.replan-342.batch-044-items-4a1f3966",
  batchNumber: "044",
  executionStageLabel: "Stage 3.45.1",
  auditStageLabel: "Stage 3.45.0",
  focusedStageId: "stage-3.45.2",
  prebuildStageId: "stage-3.45.3",
  sourceReleaseVersion: "0.24.81",
  targetReleaseVersion: "0.24.82",
  auditPath: "architecture/migration/stage_3_batch_044_audit.json",
  executionPlanPath: "architecture/migration/stage_3_batch_044_execution_plan.json",
  testMatrixPath: "architecture/migration/stage_3_batch_044_test_matrix.json",
  expectedTargetCount: 1,
  expectedExportCount: 1,
  expectedActivationCount: 1,
  expectedConsumerCount: 1,
  expectedDependencyEdgeCount: 0,
  expectedTargets: [
    { currentPath: registry, targetPath: "src/game/domain/items/progression/item_catalog_baseline_registry.js",
      exports: ["ItemCatalogBaselineRegistry"] },
  ],
  continuationPlan: { path: "architecture/migration/stage_3_42_graph_review/approved_prefix.json",
    sha256: "dcf3aa4db2927dec3a84658c0f25d1e845339d8d8f71f65c3eb6a05b9f482c8c" },
  expectedImports: [],
  expectedActivationIds: ["activation-ecd31221cae2"],
  expectedActivationPositions: [79],
  expectedBridgeIds: ["bridge-c148fec7119f"],
  expectedRetiredActivationIds: [],
  expectedRetiredBridgeIds: [],
  informationalDocumentsExcluded: true,
  expectedTopology: { beforeProjectModuleCount: 131, afterProjectModuleCount: 132,
    beforeActivationCount: 124, afterActivationCount: 125,
    beforeBridgeCount: 197, afterBridgeCount: 198 },
  includeRuntimeActiveState: true,
  persistActiveBatchPhase: true,
  includeDetailedStatePerformanceGates: true,
  behaviorPhases: ["classic-baseline", "temporary-esm-parity", "post-cutover-esm"],
  compatibilityPhases: ["pre-build-fixture", "temporary-esm-parity", "post-build-runtime"],
  scmCheckpointRequired: true,
  sourceReleaseTag: "v0.24.81",
  bridgeReason: "Preserve the exact item catalog baseline registry consumer until its legacy symbol is removed.",
  rollbackRule: "restore-only-batch-044-delta-and-keep-batches-001-through-043",
  consumerSetSource: "stage-3.42.0-live-observation-and-stage-3.42-frozen-consumer-set",
  operationIds: ["verify-frozen-evidence", "open-batch-044",
    "create-one-named-esm-target-with-one-export", "render-one-candidate-activation-shim",
    "project-one-consumer-bridge", "project-candidate-manifest",
    "validate-candidate-and-commit-atomic-cutover", "validate-identity-timing-state-and-behavior",
    "persist-and-reconcile-observations", "run-full-acceptance", "close-release-0.24.82"],
}).value;

const PREFLIGHT_PROFILE = new StageThreeBatchPreflightProfile({
  schemaVersion: 1,
  stageLabel: "Stage 3.45.0",
  artifactKind: "cyber-fishing-stage-3-batch-preflight-audit",
  batchId: EXECUTION_PROFILE.batchId,
  sourceReleaseVersion: EXECUTION_PROFILE.sourceReleaseVersion,
  executionProfile: EXECUTION_PROFILE,
  sideEffectEvidence: { path: "architecture/migration/stage_3_batch_044_side_effect_review.json",
    sha256: "dbdce1ef485a95ffb0a5cabdeb32cb149271295551267d5fcc7f828d225c569b" },
  reviewedContracts: {
    [registry]: contract({
      instanceFields: ["#cache", "#effectiveStatsResolver", "#itemDb", "#logger", "#strategyRegistry"],
      semanticRisk: "catalog-baseline-range-cache-with-fixed-fallback-and-injected-logger",
      performanceClassification: "existing-item-catalog-baseline-registry",
      callSiteEvidence: [{ path: "src/app/bootstrap.js", marker: "new ItemCatalogBaselineRegistry({" }],
      allocationBaseline: allocation(9, 3, 3, 2),
      stateIdentityReview: { className: "ItemCatalogBaselineRegistry", collections: [
        { owner: "ItemCatalogBaselineRegistry#cache", field: "#cache", scope: "instance", collection: "Map",
          allowedOperations: ["clear", "get", "set"] },
      ] },
    }),
  },
  migrationGates: ["one-exact-source-and-method-shape", "one-export-identity-and-activation",
    "one-reviewed-instance-cache-collection-identity", "one-exact-consumer-relationship",
    "all-legacy-activation-positions-preserved", "zero-config-platform-browser-dev-dependencies",
    "zero-added-hot-loop-allocations"],
}).value;

const RELEASE = Object.freeze({
  title: "Item Catalog Baseline Registry Domain",
  codename: "item-catalog-baseline-registry-domain",
  summary: "Batch 044 migrated the item catalog baseline registry to the item progression Domain.",
  smokeContext: "Automated browser smoke under the owner's 2026-10-01 authorization: game-cycle re-executed without seals, game loaded in the built-in browser, and console errors and warnings counted.",
  notes: [
    "Migrate the item catalog baseline registry with its reviewed baseline cache",
    "Preserve one hundred thirty-two project modules, one hundred twenty-five active activations and one hundred ninety-eight bridges",
  ],
  changelog: [
    "- Migrated the item catalog baseline registry with one named ESM export; its baseline cache keeps the reviewed get, set and clear identity.",
    "- Extended the cumulative runtime from 131 to 132 project modules and the active activation set from 124 to 125 contracts, with 198 exact bridge relationships.",
    "- The next task is batch 045 preflight.",
  ],
});

module.exports = { PREFLIGHT_PROFILE, RELEASE };
