"use strict";

const { StageThreeBatchExecutionProfile } = require("./stage_three_batch_execution_profile");
const { StageThreeBatchPreflightProfile } = require("./stage_three_batch_preflight_profile");

const allocation = (objectExpressions, arrayExpressions, newExpressions, objectFreezeCalls) => ({
  objectExpressions, arrayExpressions, newExpressions, objectFreezeCalls,
  objectAssignCalls: 0, roundingCalls: 0,
});

const executionProfile = new StageThreeBatchExecutionProfile({
  schemaVersion: 1,
  batchId: "stage-3.candidate-011-items-11818ee5",
  batchNumber: "011",
  executionStageLabel: "Stage 3.11.1",
  auditStageLabel: "Stage 3.11.0",
  focusedStageId: "stage-3.11.2",
  prebuildStageId: "stage-3.11.3",
  sourceReleaseVersion: "0.24.47",
  targetReleaseVersion: "0.24.48",
  auditPath: "architecture/migration/stage_3_batch_011_audit.json",
  executionPlanPath: "architecture/migration/stage_3_batch_011_execution_plan.json",
  testMatrixPath: "architecture/migration/stage_3_batch_011_test_matrix.json",
  expectedTargetCount: 5,
  expectedExportCount: 5,
  expectedActivationCount: 5,
  expectedConsumerCount: 10,
  expectedDependencyEdgeCount: 0,
  expectedTargets: [
    { currentPath: "src/core/items/progression/item_metric_strategy.js", targetPath: "src/game/domain/items/progression/item_metric_strategy.js", exports: ["ItemMetricStrategy"] },
    { currentPath: "src/core/items/progression/item_progression_descriptor.js", targetPath: "src/game/domain/items/progression/item_progression_descriptor.js", exports: ["ItemProgressionDescriptor"] },
    { currentPath: "src/core/items/rarity/item_rarity_descriptor.js", targetPath: "src/game/domain/items/rarity/item_rarity_descriptor.js", exports: ["ItemRarityDescriptor"] },
    { currentPath: "src/core/items/rarity/item_rarity_strategy_registry.js", targetPath: "src/game/domain/items/rarity/item_rarity_strategy_registry.js", exports: ["ItemRarityStrategyRegistry"] },
    { currentPath: "src/core/items/rarity/item_rarity_strategy.js", targetPath: "src/game/domain/items/rarity/item_rarity_strategy.js", exports: ["ItemRarityStrategy"] },
  ],
  expectedActivationIds: [
    "activation-249fe0228439", "activation-597e6786200f", "activation-7b2f08a8cb34",
    "activation-b63d6fa4a955", "activation-edee20d9f6f3",
  ],
  expectedActivationPositions: [45, 46, 48, 73, 84],
  expectedBridgeIds: [
    "bridge-51b5e7e42e77", "bridge-56ef92067f39", "bridge-8133cc83f778",
    "bridge-9e3953224164", "bridge-a9380f14d75c", "bridge-a970e658356c",
    "bridge-cd92209bac28", "bridge-eea627bb5a05", "bridge-eec98f962cb7",
    "bridge-fa5b133d275d",
  ],
  expectedTopology: {
    beforeProjectModuleCount: 37, afterProjectModuleCount: 42,
    beforeActivationCount: 38, afterActivationCount: 43,
    beforeBridgeCount: 64, afterBridgeCount: 74,
  },
  includeRuntimeActiveState: true,
  persistActiveBatchPhase: true,
  includeDetailedStatePerformanceGates: true,
  behaviorPhases: ["classic-baseline", "temporary-esm-parity", "post-cutover-esm"],
  compatibilityPhases: ["pre-build-fixture", "temporary-esm-parity", "post-build-runtime"],
  scmCheckpointRequired: true,
  sourceReleaseTag: "v0.24.47",
  bridgeReason: "Preserve the exact Items domain consumers until their legacy symbols are removed.",
  rollbackRule: "restore-only-batch-011-delta-and-keep-batches-001-through-010",
  consumerSetSource: "stage-3.11.0-live-observation-and-frozen-consumer-set",
  operationIds: [
    "verify-frozen-evidence", "open-batch-011", "create-five-named-esm-targets",
    "render-five-candidate-activation-shims", "project-ten-consumer-bridges",
    "project-candidate-manifest", "validate-candidate-and-commit-atomic-cutover",
    "validate-identity-timing-state-and-behavior", "persist-and-reconcile-observations",
    "run-full-acceptance", "close-release-0.24.48",
  ],
}).value;

const BATCH_011_PREFLIGHT_PROFILE = new StageThreeBatchPreflightProfile({
  schemaVersion: 1,
  stageLabel: "Stage 3.11.0",
  artifactKind: "cyber-fishing-stage-3-batch-preflight-audit",
  batchId: executionProfile.batchId,
  sourceReleaseVersion: executionProfile.sourceReleaseVersion,
  executionProfile,
  reviewedContracts: {
    "src/core/items/progression/item_metric_strategy.js": {
      classification: "authoritative-owner", instanceFields: ["#id"], publicStateShape: ["id"],
      resultShape: ["available", "reason", "strategyId"], stableResultIdentity: false,
      mutatesCallerInputs: false, performanceClassification: "existing-frozen-results-per-evaluation",
      hotLoopCallSites: [],
      callSiteEvidence: [{ path: "src/core/items/progression/composite_metric_strategy.js", marker: "extends ItemMetricStrategy" }],
      allocationBaseline: allocation(4, 1, 2, 2),
      semanticRisk: "private-id-owner-subclass-identity-path-and-frozen-result-semantics",
    },
    "src/core/items/progression/item_progression_descriptor.js": {
      classification: "authoritative-owner", instanceFields: [], publicStateShape: [],
      resultShape: ["available", "capacity", "groupId", "quality", "rating", "ratingTier", "reason"],
      stableResultIdentity: true, mutatesCallerInputs: false,
      performanceClassification: "one-frozen-descriptor-per-resolution",
      hotLoopCallSites: [],
      callSiteEvidence: [{ path: "src/core/items/progression/item_progression_resolver.js", marker: "new ItemProgressionDescriptor({" }],
      allocationBaseline: allocation(1, 0, 0, 1),
      semanticRisk: "optional-own-property-shape-and-frozen-descriptor-identity",
    },
    "src/core/items/rarity/item_rarity_descriptor.js": {
      classification: "authoritative-owner", instanceFields: [], publicStateShape: [],
      resultShape: ["isUnique", "maxTier", "mode", "normalized", "tier", "uniqueId"],
      stableResultIdentity: true, mutatesCallerInputs: false,
      performanceClassification: "one-frozen-descriptor-per-resolution",
      hotLoopCallSites: [],
      callSiteEvidence: [{ path: "src/core/items/rarity/authored_item_rarity_strategy.js", marker: "new ItemRarityDescriptor({" }],
      allocationBaseline: allocation(0, 0, 0, 1),
      semanticRisk: "frozen-rarity-descriptor-values-and-class-identity",
    },
    "src/core/items/rarity/item_rarity_strategy.js": {
      classification: "stateless", instanceFields: [], publicStateShape: [], resultShape: [],
      stableResultIdentity: false, mutatesCallerInputs: false,
      performanceClassification: "contract-methods-only",
      hotLoopCallSites: [],
      callSiteEvidence: [{ path: "src/core/items/rarity/authored_item_rarity_strategy.js", marker: "extends ItemRarityStrategy" }],
      allocationBaseline: allocation(0, 0, 1, 0),
      semanticRisk: "subclass-identity-and-default-abstract-method-behavior",
    },
    "src/core/items/rarity/item_rarity_strategy_registry.js": {
      classification: "authoritative-owner", instanceFields: ["#strategies"], publicStateShape: [], resultShape: [],
      stableResultIdentity: true, mutatesCallerInputs: false,
      performanceClassification: "registration-on-construction-and-linear-resolution",
      hotLoopCallSites: [],
      callSiteEvidence: [{ path: "src/app/bootstrap.js", marker: "new ItemRarityStrategyRegistry([" }],
      allocationBaseline: allocation(0, 2, 2, 0),
      semanticRisk: "single-private-strategy-array-registration-order-and-resolution-lifetime",
    },
  },
  migrationGates: [
    "five-exact-class-and-method-shapes", "one-class-identity-per-export-and-activation",
    "single-authoritative-instance-state", "descriptor-own-keys-and-frozen-identity",
    "registry-registration-order-and-lifetime", "exact-ten-classic-consumers",
    "five-approved-activation-positions", "zero-config-platform-browser-dev-dependencies",
    "zero-top-level-effects-and-transport-reads", "zero-added-hot-loop-allocations",
  ],
}).value;

module.exports = { BATCH_011_PREFLIGHT_PROFILE };
