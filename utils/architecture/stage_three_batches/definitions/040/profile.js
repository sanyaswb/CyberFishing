"use strict";

const { StageThreeBatchExecutionProfile } = require("../../../domain_batches/stage_three_batch_execution_profile");
const { StageThreeBatchPreflightProfile } = require("../../../domain_batches/stage_three_batch_preflight_profile");

const allocation = (objectExpressions, arrayExpressions, newExpressions, objectFreezeCalls,
  objectAssignCalls = 0, roundingCalls = 0) => ({ objectExpressions, arrayExpressions,
  newExpressions, objectFreezeCalls, objectAssignCalls, roundingCalls });
const rules = "src/app/rules.js";
const converter = "src/core/distance_unit_converter.js";
const composite = "src/core/items/progression/composite_metric_strategy.js";
const capacity = "src/core/items/progression/item_capacity_resolver.js";
const rating = "src/core/items/progression/item_rating_resolver.js";
const line = "src/core/line/line_allocation_policy.js";
const contract = fields => ({ classification: "authoritative-owner", instanceFields: [],
  publicStateShape: [], resultShape: [], stableResultIdentity: false, mutatesCallerInputs: false,
  hotLoopCallSites: [], ...fields });

// Batch 040 opens the Stage 3.41.0 replacement suffix after the normalizeDistance Engine
// prerequisite. The rules target imports that Engine owner; the two item strategies import the
// completed-prefix ItemMetricStrategy. All six classic sources are effect-free.
const EXECUTION_PROFILE = new StageThreeBatchExecutionProfile({
  schemaVersion: 1,
  batchId: "stage-3.replan-341.batch-040-casting-items-line-rules-1fef9b89",
  batchNumber: "040",
  executionStageLabel: "Stage 3.41.1",
  auditStageLabel: "Stage 3.41.0",
  focusedStageId: "stage-3.41.2",
  prebuildStageId: "stage-3.41.3",
  sourceReleaseVersion: "0.24.77",
  targetReleaseVersion: "0.24.78",
  auditPath: "architecture/migration/stage_3_batch_040_audit.json",
  executionPlanPath: "architecture/migration/stage_3_batch_040_execution_plan.json",
  testMatrixPath: "architecture/migration/stage_3_batch_040_test_matrix.json",
  expectedTargetCount: 6,
  expectedExportCount: 12,
  expectedActivationCount: 12,
  expectedConsumerCount: 10,
  expectedDependencyEdgeCount: 0,
  expectedTargets: [
    { currentPath: rules, targetPath: "src/game/domain/rules/gameplay_rules.js",
      exports: ["BaitRules", "BiteRules", "BoatRules", "CastRules", "ChumRules", "EquipmentRules", "PlayerCastRules"] },
    { currentPath: converter, targetPath: "src/game/domain/casting/distance_unit_converter.js",
      exports: ["DistanceUnitConverter"] },
    { currentPath: composite, targetPath: "src/game/domain/items/progression/composite_metric_strategy.js",
      exports: ["CompositeMetricStrategy"] },
    { currentPath: capacity, targetPath: "src/game/domain/items/progression/item_capacity_resolver.js",
      exports: ["ItemCapacityResolver"] },
    { currentPath: rating, targetPath: "src/game/domain/items/progression/item_rating_resolver.js",
      exports: ["ItemRatingResolver"] },
    { currentPath: line, targetPath: "src/game/domain/line/line_allocation_policy.js",
      exports: ["LineAllocationPolicy"] },
  ],
  continuationPlan: { path: "architecture/migration/stage_3_41_graph_review/approved_prefix.json",
    sha256: "2f7e455d4f2636b7b8c6f79760380e4120534959c1b5ff627be21c89408100b4" },
  expectedImports: [
    { consumer: rules, from: "src/engine/math/normalize_distance.js", exportName: "normalizeDistance",
      legacySymbol: "normalizeDistance", viaShim: "src/core/math/normalize_distance.js",
      activationId: "activation-138f54238b60" },
    { consumer: composite, from: "src/game/domain/items/progression/item_metric_strategy.js",
      exportName: "ItemMetricStrategy", legacySymbol: "ItemMetricStrategy",
      viaShim: "src/core/items/progression/item_metric_strategy.js", activationId: "activation-597e6786200f" },
    { consumer: rating, from: "src/game/domain/items/progression/item_metric_strategy.js",
      exportName: "ItemMetricStrategy", legacySymbol: "ItemMetricStrategy",
      viaShim: "src/core/items/progression/item_metric_strategy.js", activationId: "activation-597e6786200f" },
  ],
  expectedActivationIds: ["activation-27de2804d152", "activation-649929a35f50",
    "activation-71f9e7f66e9c", "activation-7939598a66ae", "activation-80e73205e0e8",
    "activation-8706d223cc0c", "activation-a461979f2c52", "activation-aad64fe0f08c",
    "activation-b01073370443", "activation-b35709a3491d", "activation-f7878fbddced",
    "activation-f80b8eeb5a75"],
  expectedActivationPositions: [77, 80, 83, 89, 142, 397, 397, 397, 397, 397, 397, 397],
  expectedBridgeIds: ["bridge-105324aeeccc", "bridge-25641a86cf5e", "bridge-3532db04f7d4",
    "bridge-4cb8f19fc834", "bridge-526e8682588c", "bridge-82a56896293e", "bridge-a2b9c6ef214b",
    "bridge-a45682b300a1", "bridge-dbceecaa5bdc", "bridge-ea578f08c07c"],
  expectedRetiredActivationIds: ["activation-138f54238b60", "activation-597e6786200f"],
  expectedRetiredBridgeIds: ["bridge-51b5e7e42e77", "bridge-cd92209bac28", "bridge-ec7cf54d1931"],
  informationalDocumentsExcluded: true,
  expectedTopology: { beforeProjectModuleCount: 117, afterProjectModuleCount: 123,
    beforeActivationCount: 106, afterActivationCount: 116,
    beforeBridgeCount: 169, afterBridgeCount: 176 },
  includeRuntimeActiveState: true,
  persistActiveBatchPhase: true,
  includeDetailedStatePerformanceGates: true,
  behaviorPhases: ["classic-baseline", "temporary-esm-parity", "post-cutover-esm"],
  compatibilityPhases: ["pre-build-fixture", "temporary-esm-parity", "post-build-runtime"],
  scmCheckpointRequired: true,
  sourceReleaseTag: "v0.24.77",
  bridgeReason: "Preserve the exact rules, distance, item-progression and line consumers until their legacy symbols are removed.",
  rollbackRule: "restore-only-batch-040-delta-and-keep-batches-001-through-039",
  consumerSetSource: "stage-3.41.0-live-observation-and-stage-3.41-frozen-consumer-set",
  operationIds: ["verify-frozen-evidence", "adopt-stage-3.41-replacement-prefix-and-open-batch-040",
    "create-six-named-esm-targets-with-twelve-exports", "render-twelve-candidate-activation-shims",
    "project-ten-consumer-bridges-and-retire-three", "project-candidate-manifest",
    "validate-candidate-and-commit-atomic-cutover", "validate-identity-timing-state-and-behavior",
    "persist-and-reconcile-observations", "run-full-acceptance", "close-release-0.24.78"],
}).value;

const PREFLIGHT_PROFILE = new StageThreeBatchPreflightProfile({
  schemaVersion: 1,
  stageLabel: "Stage 3.41.0",
  artifactKind: "cyber-fishing-stage-3-batch-preflight-audit",
  batchId: EXECUTION_PROFILE.batchId,
  sourceReleaseVersion: EXECUTION_PROFILE.sourceReleaseVersion,
  executionProfile: EXECUTION_PROFILE,
  sideEffectEvidence: { path: "architecture/migration/stage_3_batch_040_side_effect_review.json",
    sha256: "1ecb3fbe212bc8a0c42883dc6c8f705133e552634b23819a3bb5f7f8cfe0619e" },
  reviewedContracts: {
    [rules]: contract({
      instanceFields: ["#castDistanceCalculator", "#config", "#messages"],
      semanticRisk: "equipment-bait-cast-bite-chum-boat-and-player-cast-rules-with-injected-config-and-messages",
      performanceClassification: "existing-gameplay-rules",
      callSiteEvidence: [{ path: "src/app/bootstrap.js", marker: "new EquipmentRules(" },
        { path: "src/app/bootstrap.js", marker: "new PlayerCastRules(" }],
      allocationBaseline: allocation(7, 2, 0, 0),
    }),
    [converter]: contract({
      instanceFields: ["#pixelsPerMeter"], publicStateShape: ["pixelsPerMeter"],
      semanticRisk: "pixel-and-metre-conversion-over-composed-physics-scale",
      performanceClassification: "existing-distance-unit-converter",
      callSiteEvidence: [{ path: "src/core/casting_distance.js", marker: "new DistanceUnitConverter(" },
        { path: "src/entities/tackle.js", marker: "new DistanceUnitConverter(" }],
      allocationBaseline: allocation(2, 0, 0, 0),
    }),
    [composite]: contract({
      semanticRisk: "weighted-item-metric-composition-and-baseline-normalization",
      performanceClassification: "existing-item-composite-metric-strategy",
      callSiteEvidence: [{ path: "src/app/bootstrap.js", marker: "new CompositeMetricStrategy()" }],
      allocationBaseline: allocation(10, 2, 0, 2),
    }),
    [capacity]: contract({
      instanceFields: ["#effectiveStatsResolver", "#messages"],
      semanticRisk: "line-capacity-progress-over-catalog-equipped-and-active-line-state",
      performanceClassification: "existing-item-capacity-resolver",
      callSiteEvidence: [{ path: "src/app/bootstrap.js", marker: "new ItemCapacityResolver({" }],
      allocationBaseline: allocation(8, 0, 0, 2, 0, 1),
    }),
    [rating]: contract({
      instanceFields: ["#baselineRegistry", "#strategyRegistry"],
      semanticRisk: "item-rating-strategy-baseline-normalization-and-range-reporting",
      performanceClassification: "existing-item-rating-resolver",
      callSiteEvidence: [{ path: "src/app/bootstrap.js", marker: "new ItemRatingResolver({" }],
      allocationBaseline: allocation(7, 3, 2, 4, 0, 1),
    }),
    [line]: contract({
      instanceFields: ["#lineConfig", "#messages"],
      semanticRisk: "line-allocation-minimum-capacity-split-and-reel-winding-with-injected-messages",
      performanceClassification: "existing-line-allocation-policy",
      callSiteEvidence: [
        { path: "src/application/inventory/inventory_v2_composition_root.js", marker: "new LineAllocationPolicy(" },
        { path: "src/core/line/line_inventory_controller.js", marker: "new LineAllocationPolicy(" },
      ],
      allocationBaseline: allocation(13, 0, 0, 0),
    }),
  },
  migrationGates: ["six-exact-sources-and-method-shapes", "twelve-export-identities-and-activations",
    "three-exact-reviewed-imports-and-three-retired-bridges", "ten-exact-consumer-relationships",
    "all-legacy-activation-positions-preserved", "zero-config-platform-browser-dev-dependencies",
    "zero-added-hot-loop-allocations"],
}).value;

const RELEASE = Object.freeze({
  title: "Casting Items Line And Rules Domain",
  codename: "casting-items-line-rules-domain",
  summary: "Batch 040 adopted the Stage 3.41.0 replacement prefix and migrated six casting, item, line and gameplay-rules modules.",
  smokeContext: "Automated browser smoke under the owner's 2026-09-30 authorization: game-cycle re-executed without seals, game loaded in the browser, screenshot saved, and console errors and warnings counted.",
  notes: [
    "Adopt the Stage 3.41.0 replacement prefix",
    "Migrate gameplay rules, distance conversion, item metric composition, capacity and rating, and line allocation",
    "Use the Engine normalizeDistance owner and completed-prefix ItemMetricStrategy through reviewed imports",
    "Preserve one hundred twenty-three project modules, one hundred sixteen active activations and one hundred seventy-six bridges",
  ],
  changelog: [
    "- Adopted the Stage 3.41.0 replacement suffix after the normalizeDistance Engine prerequisite and migrated six Domain sources with twelve named ESM exports.",
    "- Replaced three legacy dependency bridges with reviewed ESM imports while preserving ten exact classic consumer bridges.",
    "- Extended the cumulative runtime from 117 to 123 project modules and the active activation set from 106 to 116 contracts, with 176 exact bridge relationships (10 added, 3 retired); the review ledger contains 139 activations including retired history.",
    "- The next task is batch 041 preflight.",
  ],
});

module.exports = { PREFLIGHT_PROFILE, RELEASE };
