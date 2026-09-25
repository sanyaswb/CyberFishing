"use strict";

const { StageThreeBatchExecutionProfile } = require("./stage_three_batch_execution_profile");
const { StageThreeBatchPreflightProfile } = require("./stage_three_batch_preflight_profile");

const allocation = (objectExpressions, arrayExpressions, newExpressions, objectFreezeCalls,
  objectAssignCalls = 0, roundingCalls = 0) => ({ objectExpressions, arrayExpressions,
  newExpressions, objectFreezeCalls, objectAssignCalls, roundingCalls });
const items = "src/core/items/";
const domain = "src/game/domain/items/";
const target = (suffix, exports) => ({ currentPath: items + suffix, targetPath: domain + suffix, exports });
const globalExposure = (symbol, location) => ({ symbol, location, mechanism: "global-this-property" });
const bootstrap = "src/app/bootstrap.js";
const resolver = "src/core/items/bait/bait_effectiveness_resolver.js";
const exposureService = "src/application/inventory/apply_bait_exposure_service.js";
const conditionResolver = "src/core/items/condition/item_condition_resolver.js";
const contract = fields => ({ classification: "authoritative-owner", instanceFields: [],
  publicStateShape: [], resultShape: [], stableResultIdentity: false, mutatesCallerInputs: false,
  hotLoopCallSites: [], ...fields });

const BATCH_018_EXECUTION_PROFILE = new StageThreeBatchExecutionProfile({
  schemaVersion: 1,
  batchId: "stage-3.candidate-018-items-8ea4be10",
  batchNumber: "018",
  executionStageLabel: "Stage 3.18.1",
  auditStageLabel: "Stage 3.18.0",
  focusedStageId: "stage-3.18.2",
  prebuildStageId: "stage-3.18.3",
  sourceReleaseVersion: "0.24.54",
  targetReleaseVersion: "0.24.55",
  auditPath: "architecture/migration/stage_3_batch_018_audit.json",
  executionPlanPath: "architecture/migration/stage_3_batch_018_execution_plan.json",
  testMatrixPath: "architecture/migration/stage_3_batch_018_test_matrix.json",
  expectedTargetCount: 6,
  expectedExportCount: 7,
  expectedActivationCount: 6,
  expectedConsumerCount: 12,
  expectedDependencyEdgeCount: 0,
  expectedTargets: [
    target("bait/bait_effectiveness_knowledge_policy.js",
      ["AlwaysKnownBaitEffectivenessPolicy", "BaitEffectivenessKnowledgePolicy"]),
    target("bait/bait_effectiveness_match.js", ["BaitEffectivenessMatch"]),
    target("freshness/bait_freshness_modifier.js", ["BaitFreshnessModifier"]),
    target("freshness/item_freshness_state_policy.js", ["ItemFreshnessStatePolicy"]),
    target("metrics/item_bounded_metric_resolver.js", ["ItemBoundedMetricResolver"]),
    target("progression/item_rating_tier_resolver.js", ["ItemRatingTierResolver"]),
  ],
  expectedActivationIds: ["activation-7a545a4f3325", "activation-a1c4f48a2220",
    "activation-ab53a7e2f8cc", "activation-ac48840f32b4", "activation-b363ddbc09ea",
    "activation-fa2fa2abbda3"],
  expectedActivationPositions: [53, 57, 59, 62, 64, 81],
  expectedBridgeIds: ["bridge-145734990113", "bridge-1d1043ea5488", "bridge-3479b9326142",
    "bridge-497d2debe2ba", "bridge-52a796afbccb", "bridge-6e95376ecf9f", "bridge-77296222f78c",
    "bridge-783560dad6b0", "bridge-9c79441f163f", "bridge-d1f629c5a0fa", "bridge-d79a992a6af8",
    "bridge-dfd570a5e25e"],
  expectedTopology: { beforeProjectModuleCount: 64, afterProjectModuleCount: 70,
    beforeActivationCount: 68, afterActivationCount: 74,
    beforeBridgeCount: 111, afterBridgeCount: 123 },
  includeRuntimeActiveState: true,
  persistActiveBatchPhase: true,
  includeDetailedStatePerformanceGates: true,
  behaviorPhases: ["classic-baseline", "temporary-esm-parity", "post-cutover-esm"],
  compatibilityPhases: ["pre-build-fixture", "temporary-esm-parity", "post-build-runtime"],
  scmCheckpointRequired: true,
  sourceReleaseTag: "v0.24.54",
  bridgeReason: "Preserve the exact Items domain consumers until their legacy symbols are removed.",
  rollbackRule: "restore-only-batch-018-delta-and-keep-batches-001-through-017",
  consumerSetSource: "stage-3.18.0-live-observation-and-frozen-consumer-set",
  operationIds: ["verify-frozen-evidence", "open-batch-018", "create-six-named-esm-targets",
    "render-six-candidate-activation-shims", "project-twelve-consumer-bridges",
    "project-candidate-manifest", "validate-candidate-and-commit-atomic-cutover",
    "validate-identity-timing-state-and-behavior", "persist-and-reconcile-observations",
    "run-full-acceptance", "close-release-0.24.55"],
}).value;

const BATCH_018_PREFLIGHT_PROFILE = new StageThreeBatchPreflightProfile({
  schemaVersion: 1,
  stageLabel: "Stage 3.18.0",
  artifactKind: "cyber-fishing-stage-3-batch-preflight-audit",
  batchId: BATCH_018_EXECUTION_PROFILE.batchId,
  sourceReleaseVersion: BATCH_018_EXECUTION_PROFILE.sourceReleaseVersion,
  executionProfile: BATCH_018_EXECUTION_PROFILE,
  sideEffectEvidence: { path: "architecture/migration/stage_3_batch_018_side_effect_review.json",
    sha256: "de4cdeab07b74820423539f08e57a8b170615ab7b16fbdce69985b28df1117ce" },
  reviewedContracts: {
    [items + "bait/bait_effectiveness_knowledge_policy.js"]: contract({
      classification: "stateless",
      semanticRisk: "abstract-knowledge-contract-local-inheritance-and-always-known-discovery",
      performanceClassification: "existing-bait-effectiveness-knowledge-lookup",
      callSiteEvidence: [{ path: bootstrap, marker: "new AlwaysKnownBaitEffectivenessPolicy()" }],
      allocationBaseline: allocation(0, 0, 1, 0),
      classFamily: {
        classes: ["BaitEffectivenessKnowledgePolicy", "AlwaysKnownBaitEffectivenessPolicy"],
        localSuperclasses: { AlwaysKnownBaitEffectivenessPolicy: "BaitEffectivenessKnowledgePolicy" },
        exposures: [
          { symbol: "BaitEffectivenessKnowledgePolicy", location: "13:1" },
          { symbol: "AlwaysKnownBaitEffectivenessPolicy", location: "14:1" },
        ],
      },
    }),
    [items + "bait/bait_effectiveness_match.js"]: contract({
      semanticRisk: "bait-match-score-fields-defaults-and-global-exposure",
      performanceClassification: "existing-bait-effectiveness-match-value",
      callSiteEvidence: [{ path: resolver, marker: "new BaitEffectivenessMatch()" }],
      allocationBaseline: allocation(1, 0, 0, 1),
      legacyExposure: globalExposure("BaitEffectivenessMatch", "22:1"),
    }),
    [items + "freshness/bait_freshness_modifier.js"]: contract({
      classification: "stateless",
      semanticRisk: "bait-freshness-multiplier-curve-and-global-exposure",
      performanceClassification: "existing-bait-freshness-modifier",
      callSiteEvidence: [{ path: bootstrap, marker: "new BaitFreshnessModifier()" }],
      allocationBaseline: allocation(1, 0, 1, 0),
      legacyExposure: globalExposure("BaitFreshnessModifier", "12:1"),
    }),
    [items + "freshness/item_freshness_state_policy.js"]: contract({
      instanceFields: ["#defaultPercent", "#maximum", "#minimum"],
      semanticRisk: "freshness-percent-bounds-defaults-and-global-exposure",
      performanceClassification: "existing-item-freshness-state-normalization",
      callSiteEvidence: [{ path: exposureService,
        marker: "freshnessStatePolicy = new ItemFreshnessStatePolicy()" }],
      allocationBaseline: allocation(6, 0, 5, 1, 0, 1),
      legacyExposure: globalExposure("ItemFreshnessStatePolicy", "54:1"),
    }),
    [items + "metrics/item_bounded_metric_resolver.js"]: contract({
      instanceFields: ["#capabilityId", "#descriptorFactory", "#profileProvider"],
      semanticRisk: "bounded-metric-resolution-subclass-contract-and-global-exposure",
      performanceClassification: "existing-bounded-item-metric-resolution",
      callSiteEvidence: [{ path: conditionResolver,
        marker: "class ItemConditionResolver extends ItemBoundedMetricResolver" }],
      allocationBaseline: allocation(4, 0, 3, 0),
      legacyExposure: globalExposure("ItemBoundedMetricResolver", "98:1"),
    }),
    [items + "progression/item_rating_tier_resolver.js"]: contract({
      classification: "state-participant",
      semanticRisk: "item-rating-tier-thresholds-rounding-and-global-exposure",
      performanceClassification: "existing-item-rating-tier-resolution",
      callSiteEvidence: [{ path: bootstrap, marker: "new ItemRatingTierResolver()" }],
      allocationBaseline: allocation(4, 0, 0, 3, 0, 1),
      legacyExposure: globalExposure("ItemRatingTierResolver", "49:1"),
    }),
  },
  migrationGates: ["six-exact-source-and-method-shapes", "seven-export-identities-six-activations",
    "one-reviewed-local-class-family-with-two-global-exposures",
    "five-reviewed-global-this-class-exposures", "twelve-exact-consumer-relationships",
    "all-legacy-activation-positions-preserved", "zero-config-platform-browser-dev-dependencies",
    "zero-added-hot-loop-allocations"],
}).value;

module.exports = { BATCH_018_PREFLIGHT_PROFILE, BATCH_018_EXECUTION_PROFILE };
