"use strict";

const { StageThreeBatchExecutionProfile } = require("../../../domain_batches/stage_three_batch_execution_profile");
const { StageThreeBatchPreflightProfile } = require("../../../domain_batches/stage_three_batch_preflight_profile");

const allocation = (objectExpressions, arrayExpressions, newExpressions, objectFreezeCalls,
  objectAssignCalls = 0, roundingCalls = 0) => ({ objectExpressions, arrayExpressions,
  newExpressions, objectFreezeCalls, objectAssignCalls, roundingCalls });
const resolver = "src/core/items/effective_item_stats_resolver.js";
const policy = "src/core/items/item_stat_override_policy.js";
const contract = fields => ({ classification: "authoritative-owner", instanceFields: [],
  publicStateShape: [], resultShape: [], stableResultIdentity: false, mutatesCallerInputs: false,
  hotLoopCallSites: [], ...fields });

// Batch 036 migrates the item stat override policy and the effective item stats resolver, both
// composed by GameCompositionRoot since prerequisite 002; their reviewed globalThis exposures move
// to the activation shims.
const EXECUTION_PROFILE = new StageThreeBatchExecutionProfile({
  schemaVersion: 1,
  batchId: "stage-3.replan-336.batch-036-items-e1a5aaa4",
  batchNumber: "036",
  executionStageLabel: "Stage 3.37.1",
  auditStageLabel: "Stage 3.37.0",
  focusedStageId: "stage-3.37.2",
  prebuildStageId: "stage-3.37.3",
  sourceReleaseVersion: "0.24.73",
  targetReleaseVersion: "0.24.74",
  auditPath: "architecture/migration/stage_3_batch_036_audit.json",
  executionPlanPath: "architecture/migration/stage_3_batch_036_execution_plan.json",
  testMatrixPath: "architecture/migration/stage_3_batch_036_test_matrix.json",
  expectedTargetCount: 2,
  expectedExportCount: 2,
  expectedActivationCount: 2,
  expectedConsumerCount: 2,
  expectedDependencyEdgeCount: 0,
  expectedTargets: [
    { currentPath: resolver, targetPath: "src/game/domain/items/effective_item_stats_resolver.js",
      exports: ["EffectiveItemStatsResolver"] },
    { currentPath: policy, targetPath: "src/game/domain/items/item_stat_override_policy.js",
      exports: ["ItemStatOverridePolicy"] },
  ],
  continuationPlan: { path: "architecture/migration/stage_3_36_graph_review/approved_prefix.json",
    sha256: "f5b2071225b846440768ad90468855bed202510285727263680327bfd6b287b7" },
  expectedImports: [],
  expectedActivationIds: ["activation-83027557e714", "activation-d4bfb713b7de"],
  expectedActivationPositions: [51, 52],
  expectedBridgeIds: ["bridge-74ff3d1ea14b", "bridge-c17208d5e755"],
  informationalDocumentsExcluded: true,
  expectedTopology: { beforeProjectModuleCount: 107, afterProjectModuleCount: 109,
    beforeActivationCount: 99, afterActivationCount: 101,
    beforeBridgeCount: 143, afterBridgeCount: 145 },
  includeRuntimeActiveState: true,
  persistActiveBatchPhase: true,
  includeDetailedStatePerformanceGates: true,
  behaviorPhases: ["classic-baseline", "temporary-esm-parity", "post-cutover-esm"],
  compatibilityPhases: ["pre-build-fixture", "temporary-esm-parity", "post-build-runtime"],
  scmCheckpointRequired: true,
  sourceReleaseTag: "v0.24.73",
  bridgeReason: "Preserve the exact item stat consumers until their legacy symbols are removed.",
  rollbackRule: "restore-only-batch-036-delta-and-keep-batches-001-through-035",
  consumerSetSource: "stage-3.37.0-live-observation-and-stage-3.36-frozen-consumer-set",
  operationIds: ["verify-frozen-evidence", "open-batch-036",
    "create-two-named-esm-targets", "render-two-candidate-activation-shims",
    "project-two-consumer-bridges", "project-candidate-manifest",
    "validate-candidate-and-commit-atomic-cutover", "validate-identity-timing-state-and-behavior",
    "persist-and-reconcile-observations", "run-full-acceptance", "close-release-0.24.74"],
}).value;

const PREFLIGHT_PROFILE = new StageThreeBatchPreflightProfile({
  schemaVersion: 1,
  stageLabel: "Stage 3.37.0",
  artifactKind: "cyber-fishing-stage-3-batch-preflight-audit",
  batchId: EXECUTION_PROFILE.batchId,
  sourceReleaseVersion: EXECUTION_PROFILE.sourceReleaseVersion,
  executionProfile: EXECUTION_PROFILE,
  sideEffectEvidence: { path: "architecture/migration/stage_3_batch_036_side_effect_review.json",
    sha256: "d468bce1ece19ff212010f3899219a32a2f5c3215cff9db0ea36b970a1ed2056" },
  reviewedContracts: {
    [resolver]: contract({
      instanceFields: ["#overridePolicy"],
      semanticRisk: "authored-stats-with-injected-override-policy-and-deep-freeze",
      performanceClassification: "existing-effective-item-stats-resolver",
      callSiteEvidence: [{ path: "src/app/bootstrap.js", marker: "new EffectiveItemStatsResolver({ overridePolicy: itemStatOverridePolicy })" }],
      allocationBaseline: allocation(8, 1, 1, 1),
      legacyExposure: { symbol: "EffectiveItemStatsResolver", location: "76:1", mechanism: "global-this-property" },
    }),
    [policy]: contract({
      instanceFields: ["#config"],
      semanticRisk: "runtime-override-schema-validation-and-normalization-with-injected-table",
      performanceClassification: "existing-item-stat-override-policy",
      callSiteEvidence: [{ path: "src/app/bootstrap.js", marker: "new ItemStatOverridePolicy({ config: this.#config.itemStatOverrides })" }],
      allocationBaseline: allocation(7, 6, 26, 0),
      legacyExposure: { symbol: "ItemStatOverridePolicy", location: "178:1", mechanism: "global-this-property" },
    }),
  },
  migrationGates: ["two-exact-sources-and-method-shapes", "two-export-identities-and-activations",
    "two-reviewed-global-this-exposures", "two-exact-consumer-relationships",
    "all-legacy-activation-positions-preserved", "zero-config-platform-browser-dev-dependencies",
    "zero-added-hot-loop-allocations"],
}).value;

const RELEASE = Object.freeze({
  title: "Items Effective Stats Domain",
  codename: "items-effective-stats-domain",
  summary: "Batch 036 migrated ItemStatOverridePolicy and EffectiveItemStatsResolver.",
  smokeContext: "Automated substitute per the owner's 2026-09-27 authorization: game-cycle loop re-executed without seals and a built-in-browser load of the game (inventory effective stats, line length and save/reload) with screenshots and console counts.",
  notes: [
    "Migrate the item stat override policy",
    "Migrate the effective item stats resolver",
    "Move the reviewed globalThis exposures to the exact activation shims",
    "Preserve one hundred nine project modules, one hundred one activations and one hundred forty-five bridges",
  ],
  changelog: [
    "- Completed batch 036: ItemStatOverridePolicy and EffectiveItemStatsResolver as named ESM exports, composed by GameCompositionRoot from the injected override table; their reviewed globalThis exposures moved to the activation shims.",
    "- Extended the cumulative graph from 107 to 109 project modules and from 99 to 101 activation contracts, with 145 exact bridge relationships (2 added).",
    "- The next task is batch 037 preflight.",
  ],
});

module.exports = { PREFLIGHT_PROFILE, RELEASE };
