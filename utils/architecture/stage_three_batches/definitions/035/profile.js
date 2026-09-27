"use strict";

const { StageThreeBatchExecutionProfile } = require("../../../domain_batches/stage_three_batch_execution_profile");
const { StageThreeBatchPreflightProfile } = require("../../../domain_batches/stage_three_batch_preflight_profile");

const allocation = (objectExpressions, arrayExpressions, newExpressions, objectFreezeCalls,
  objectAssignCalls = 0, roundingCalls = 0) => ({ objectExpressions, arrayExpressions,
  newExpressions, objectFreezeCalls, objectAssignCalls, roundingCalls });
const resolver = "src/core/items/condition/item_condition_resolver.js";
const contract = fields => ({ classification: "authoritative-owner", instanceFields: [],
  publicStateShape: [], resultShape: [], stableResultIdentity: false, mutatesCallerInputs: false,
  hotLoopCallSites: [], ...fields });

// Batch 035 is the first batch of the Stage 3.36.0 approved prefix: the item condition resolver,
// whose presentation descriptor factory is injected since prerequisite 003. It extends the
// completed-prefix ItemBoundedMetricResolver through a reviewed import.
const EXECUTION_PROFILE = new StageThreeBatchExecutionProfile({
  schemaVersion: 1,
  batchId: "stage-3.replan-336.batch-035-items-48cb5bbc",
  batchNumber: "035",
  executionStageLabel: "Stage 3.36.1",
  auditStageLabel: "Stage 3.36.0",
  focusedStageId: "stage-3.36.2",
  prebuildStageId: "stage-3.36.3",
  sourceReleaseVersion: "0.24.72",
  targetReleaseVersion: "0.24.73",
  auditPath: "architecture/migration/stage_3_batch_035_audit.json",
  executionPlanPath: "architecture/migration/stage_3_batch_035_execution_plan.json",
  testMatrixPath: "architecture/migration/stage_3_batch_035_test_matrix.json",
  expectedTargetCount: 1,
  expectedExportCount: 1,
  expectedActivationCount: 1,
  expectedConsumerCount: 1,
  expectedDependencyEdgeCount: 0,
  expectedTargets: [
    { currentPath: resolver, targetPath: "src/game/domain/items/condition/item_condition_resolver.js",
      exports: ["ItemConditionResolver"] },
  ],
  continuationPlan: { path: "architecture/migration/stage_3_36_graph_review/approved_prefix.json",
    sha256: "f5b2071225b846440768ad90468855bed202510285727263680327bfd6b287b7" },
  expectedImports: [
    { consumer: resolver, from: "src/game/domain/items/metrics/item_bounded_metric_resolver.js",
      exportName: "ItemBoundedMetricResolver", legacySymbol: "ItemBoundedMetricResolver",
      viaShim: "src/core/items/metrics/item_bounded_metric_resolver.js", activationId: "activation-a1c4f48a2220" },
  ],
  expectedActivationIds: ["activation-7d1f057c4c36"],
  expectedActivationPositions: [55],
  expectedBridgeIds: ["bridge-30af1aabaaa6"],
  informationalDocumentsExcluded: true,
  expectedRetiredBridgeIds: ["bridge-783560dad6b0"],
  expectedTopology: { beforeProjectModuleCount: 106, afterProjectModuleCount: 107,
    beforeActivationCount: 98, afterActivationCount: 99,
    beforeBridgeCount: 143, afterBridgeCount: 143 },
  includeRuntimeActiveState: true,
  persistActiveBatchPhase: true,
  includeDetailedStatePerformanceGates: true,
  behaviorPhases: ["classic-baseline", "temporary-esm-parity", "post-cutover-esm"],
  compatibilityPhases: ["pre-build-fixture", "temporary-esm-parity", "post-build-runtime"],
  scmCheckpointRequired: true,
  sourceReleaseTag: "v0.24.72",
  bridgeReason: "Preserve the exact item condition resolver consumer until its legacy symbol is removed.",
  rollbackRule: "restore-only-batch-035-delta-and-keep-batches-001-through-034",
  consumerSetSource: "stage-3.36.0-live-observation-and-stage-3.36-frozen-consumer-set",
  operationIds: ["verify-frozen-evidence", "adopt-stage-3.36-approved-prefix-and-open-batch-035",
    "create-one-named-esm-target-with-one-prefix-import", "render-one-candidate-activation-shim",
    "project-one-consumer-bridge-and-retire-one", "project-candidate-manifest",
    "validate-candidate-and-commit-atomic-cutover", "validate-identity-timing-state-and-behavior",
    "persist-and-reconcile-observations", "run-full-acceptance", "close-release-0.24.73"],
}).value;

const PREFLIGHT_PROFILE = new StageThreeBatchPreflightProfile({
  schemaVersion: 1,
  stageLabel: "Stage 3.36.0",
  artifactKind: "cyber-fishing-stage-3-batch-preflight-audit",
  batchId: EXECUTION_PROFILE.batchId,
  sourceReleaseVersion: EXECUTION_PROFILE.sourceReleaseVersion,
  executionProfile: EXECUTION_PROFILE,
  sideEffectEvidence: { path: "architecture/migration/stage_3_batch_035_side_effect_review.json",
    sha256: "e0221fcddb7d6c4a0ffa535068f63837764063bbeff16becb377391d8cfcfc87" },
  reviewedContracts: {
    [resolver]: contract({
      semanticRisk: "bounded-condition-metric-descriptors-through-an-injected-presentation-factory",
      performanceClassification: "existing-item-condition-resolver",
      callSiteEvidence: [{ path: "src/app/bootstrap.js", marker: "new ItemConditionResolver({" }],
      allocationBaseline: allocation(2, 0, 0, 0),
    }),
  },
  migrationGates: ["one-exact-source-and-method-shape", "one-export-identity-and-activation",
    "one-exact-completed-prefix-import-as-superclass", "injected-presentation-descriptor-factory",
    "one-exact-consumer-relationship-and-one-retired-bridge", "all-legacy-activation-positions-preserved",
    "zero-config-platform-browser-dev-dependencies", "zero-added-hot-loop-allocations"],
}).value;

const RELEASE = Object.freeze({
  title: "Items Condition Resolver Domain",
  codename: "items-condition-resolver-domain",
  summary: "Batch 035 adopted the Stage 3.36.0 approved prefix and migrated ItemConditionResolver.",
  smokeContext: "Automated substitute per the owner's 2026-09-27 authorization: game-cycle loop re-executed without seals and a built-in-browser load of the game (item condition in the inventory details) with screenshots and console counts.",
  notes: [
    "Adopt the Stage 3.36.0 approved prefix (batches 035 to 038)",
    "Migrate the item condition resolver",
    "Extend the completed-prefix ItemBoundedMetricResolver through a reviewed import",
    "Keep the presentation descriptor factory injected by composition",
    "Preserve one hundred seven project modules, ninety-nine activations and one hundred forty-three bridges",
  ],
  changelog: [
    "- Prerequisite transitions 001-005 (config injection of AssemblyProfileRegistry and ItemStatOverridePolicy, descriptor boundaries of the condition, freshness and bait-effectiveness resolvers) and the Stage 3.36.0 repeated graph review froze batches 035-038.",
    "- Completed batch 035: ItemConditionResolver as a named ESM export extending the imported ItemBoundedMetricResolver; its descriptor factory stays injected by GameCompositionRoot.",
    "- Extended the cumulative graph from 106 to 107 project modules and from 98 to 99 activation contracts, with 143 exact bridge relationships (1 added, 1 retired).",
    "- The next task is batch 036 preflight.",
  ],
});

module.exports = { PREFLIGHT_PROFILE, RELEASE };
