"use strict";

const { StageThreeBatchExecutionProfile } = require("./stage_three_batch_execution_profile");
const { StageThreeBatchPreflightProfile } = require("./stage_three_batch_preflight_profile");

const allocation = (objectExpressions, arrayExpressions, newExpressions, objectFreezeCalls,
  objectAssignCalls = 0, roundingCalls = 0) => ({ objectExpressions, arrayExpressions,
  newExpressions, objectFreezeCalls, objectAssignCalls, roundingCalls });
const source = "src/core/items/progression/";
const domain = "src/game/domain/items/progression/";
const derived = source + "derived_stat_metric_strategy.js";
const numeric = source + "numeric_stat_metric_strategy.js";
const targetRange = source + "target_range_metric_strategy.js";
const base = { from: domain + "item_metric_strategy.js", exportName: "ItemMetricStrategy",
  legacySymbol: "ItemMetricStrategy", viaShim: source + "item_metric_strategy.js",
  activationId: "activation-597e6786200f" };
const contract = fields => ({ classification: "authoritative-owner", instanceFields: [],
  publicStateShape: [], resultShape: [], stableResultIdentity: false, mutatesCallerInputs: false,
  hotLoopCallSites: [], ...fields });
const bootstrap = marker => [{ path: "src/app/bootstrap.js", marker }];

// Batch 023 migrates three metric strategies whose shared superclass ItemMetricStrategy is an
// export of the completed prefix: each target imports it as its reviewed eager superclass.
const BATCH_023_EXECUTION_PROFILE = new StageThreeBatchExecutionProfile({
  schemaVersion: 1,
  batchId: "stage-3.replan-322.batch-023-items-c91fce82",
  batchNumber: "023",
  executionStageLabel: "Stage 3.24.1",
  auditStageLabel: "Stage 3.24.0",
  focusedStageId: "stage-3.24.2",
  prebuildStageId: "stage-3.24.3",
  sourceReleaseVersion: "0.24.60",
  targetReleaseVersion: "0.24.61",
  auditPath: "architecture/migration/stage_3_batch_023_audit.json",
  executionPlanPath: "architecture/migration/stage_3_batch_023_execution_plan.json",
  testMatrixPath: "architecture/migration/stage_3_batch_023_test_matrix.json",
  expectedTargetCount: 3,
  expectedExportCount: 3,
  expectedActivationCount: 3,
  expectedConsumerCount: 3,
  expectedDependencyEdgeCount: 0,
  expectedTargets: [
    { currentPath: derived, targetPath: domain + "derived_stat_metric_strategy.js",
      exports: ["DerivedStatMetricStrategy"] },
    { currentPath: numeric, targetPath: domain + "numeric_stat_metric_strategy.js",
      exports: ["NumericStatMetricStrategy"] },
    { currentPath: targetRange, targetPath: domain + "target_range_metric_strategy.js",
      exports: ["TargetRangeMetricStrategy"] },
  ],
  continuationPlan: { path: "architecture/migration/stage_3_22/approved_prefix.json",
    sha256: "4873af4bbc6a11a07a57c17cd198350d8154c0e6eed3a17551b8d02f97eb436c" },
  expectedImports: [
    { consumer: derived, ...base }, { consumer: numeric, ...base }, { consumer: targetRange, ...base },
  ],
  expectedActivationIds: ["activation-0937f80ab214", "activation-4cdf0ce1fb18", "activation-80378caca1ef"],
  expectedActivationPositions: [74, 75, 76],
  expectedBridgeIds: ["bridge-465e746a78c9", "bridge-5021e2c92869", "bridge-ed528b9594f7"],
  expectedRetiredBridgeIds: ["bridge-56ef92067f39", "bridge-8133cc83f778", "bridge-fa5b133d275d"],
  expectedTopology: { beforeProjectModuleCount: 79, afterProjectModuleCount: 82,
    beforeActivationCount: 89, afterActivationCount: 92,
    beforeBridgeCount: 142, afterBridgeCount: 142 },
  includeRuntimeActiveState: true,
  persistActiveBatchPhase: true,
  includeDetailedStatePerformanceGates: true,
  behaviorPhases: ["classic-baseline", "temporary-esm-parity", "post-cutover-esm"],
  compatibilityPhases: ["pre-build-fixture", "temporary-esm-parity", "post-build-runtime"],
  scmCheckpointRequired: true,
  sourceReleaseTag: "v0.24.60",
  bridgeReason: "Preserve the exact item metric strategy consumers until their legacy symbols are removed.",
  rollbackRule: "restore-only-batch-023-delta-and-keep-batches-001-through-022",
  consumerSetSource: "stage-3.24.0-live-observation-and-stage-3.22-frozen-consumer-set",
  operationIds: ["verify-frozen-evidence", "open-batch-023",
    "create-three-named-esm-targets-with-imported-superclass", "render-three-candidate-activation-shims",
    "project-three-consumer-bridges-and-retire-three", "project-candidate-manifest",
    "validate-candidate-and-commit-atomic-cutover", "validate-identity-timing-state-and-behavior",
    "persist-and-reconcile-observations", "run-full-acceptance", "close-release-0.24.61"],
}).value;

const BATCH_023_PREFLIGHT_PROFILE = new StageThreeBatchPreflightProfile({
  schemaVersion: 1,
  stageLabel: "Stage 3.24.0",
  artifactKind: "cyber-fishing-stage-3-batch-preflight-audit",
  batchId: BATCH_023_EXECUTION_PROFILE.batchId,
  sourceReleaseVersion: BATCH_023_EXECUTION_PROFILE.sourceReleaseVersion,
  executionProfile: BATCH_023_EXECUTION_PROFILE,
  reviewedContracts: {
    [derived]: contract({
      semanticRisk: "ratio-and-upgrade-level-derived-stat-metrics",
      performanceClassification: "existing-item-metric-evaluation",
      callSiteEvidence: bootstrap("new DerivedStatMetricStrategy()"),
      allocationBaseline: allocation(8, 0, 0, 2),
    }),
    [numeric]: contract({
      semanticRisk: "numeric-stat-path-metric",
      performanceClassification: "existing-item-metric-evaluation",
      callSiteEvidence: bootstrap("new NumericStatMetricStrategy()"),
      allocationBaseline: allocation(3, 0, 0, 0),
    }),
    [targetRange]: contract({
      semanticRisk: "target-range-falloff-normalization-and-out-of-range-classification",
      performanceClassification: "existing-item-metric-evaluation",
      callSiteEvidence: bootstrap("new TargetRangeMetricStrategy()"),
      allocationBaseline: allocation(5, 1, 0, 0),
    }),
  },
  migrationGates: ["three-exact-source-and-method-shapes", "three-export-identities-and-activations",
    "three-exact-imported-superclass-bindings", "three-exact-consumer-relationships",
    "three-retired-classic-bridges", "all-legacy-activation-positions-preserved",
    "zero-config-platform-browser-dev-dependencies", "zero-added-hot-loop-allocations"],
}).value;

module.exports = { BATCH_023_PREFLIGHT_PROFILE, BATCH_023_EXECUTION_PROFILE };
