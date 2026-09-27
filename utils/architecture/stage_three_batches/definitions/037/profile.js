"use strict";

const { StageThreeBatchExecutionProfile } = require("../../../domain_batches/stage_three_batch_execution_profile");
const { StageThreeBatchPreflightProfile } = require("../../../domain_batches/stage_three_batch_preflight_profile");

const allocation = (objectExpressions, arrayExpressions, newExpressions, objectFreezeCalls,
  objectAssignCalls = 0, roundingCalls = 0) => ({ objectExpressions, arrayExpressions,
  newExpressions, objectFreezeCalls, objectAssignCalls, roundingCalls });
const bait = "src/core/items/bait/bait_effectiveness_resolver.js";
const freshness = "src/core/items/freshness/item_freshness_resolver.js";
const progression = "src/core/items/progression/item_progression_resolver.js";
const imported = (consumer, from, name, viaShim, activationId) => ({ consumer, from: `src/game/domain/items/${from}`,
  exportName: name, legacySymbol: name, viaShim: `src/core/items/${viaShim}`, activationId });
const contract = fields => ({ classification: "authoritative-owner", instanceFields: [],
  publicStateShape: [], resultShape: [], stableResultIdentity: false, mutatesCallerInputs: false,
  hotLoopCallSites: [], ...fields });

// Batch 037 migrates the bait effectiveness, item freshness and item progression resolvers; their
// descriptor factories are injected since prerequisites 004–005, their owner-created policies are
// completed-prefix imports, and the progression memo cache keeps one owner. BaitEffectivenessMatch,
// ItemBoundedMetricResolver and ItemProgressionDescriptor lose their last classic readers and retire.
const EXECUTION_PROFILE = new StageThreeBatchExecutionProfile({
  schemaVersion: 1,
  batchId: "stage-3.replan-336.batch-037-items-5fccd461",
  batchNumber: "037",
  executionStageLabel: "Stage 3.38.1",
  auditStageLabel: "Stage 3.38.0",
  focusedStageId: "stage-3.38.2",
  prebuildStageId: "stage-3.38.3",
  sourceReleaseVersion: "0.24.74",
  targetReleaseVersion: "0.24.75",
  auditPath: "architecture/migration/stage_3_batch_037_audit.json",
  executionPlanPath: "architecture/migration/stage_3_batch_037_execution_plan.json",
  testMatrixPath: "architecture/migration/stage_3_batch_037_test_matrix.json",
  expectedTargetCount: 3,
  expectedExportCount: 3,
  expectedActivationCount: 3,
  expectedConsumerCount: 3,
  expectedDependencyEdgeCount: 0,
  expectedTargets: [
    { currentPath: bait, targetPath: "src/game/domain/items/bait/bait_effectiveness_resolver.js",
      exports: ["BaitEffectivenessResolver"] },
    { currentPath: freshness, targetPath: "src/game/domain/items/freshness/item_freshness_resolver.js",
      exports: ["ItemFreshnessResolver"] },
    { currentPath: progression, targetPath: "src/game/domain/items/progression/item_progression_resolver.js",
      exports: ["ItemProgressionResolver"] },
  ],
  continuationPlan: { path: "architecture/migration/stage_3_36_graph_review/approved_prefix.json",
    sha256: "f5b2071225b846440768ad90468855bed202510285727263680327bfd6b287b7" },
  expectedImports: [
    imported(bait, "bait/bait_effectiveness_grade_policy.js", "BaitEffectivenessGradePolicy",
      "bait/bait_effectiveness_grade_policy.js", "activation-b7cb0e61096d"),
    imported(bait, "bait/bait_effectiveness_knowledge_policy.js", "AlwaysKnownBaitEffectivenessPolicy",
      "bait/bait_effectiveness_knowledge_policy.js", "activation-fa2fa2abbda3"),
    imported(bait, "bait/bait_effectiveness_match.js", "BaitEffectivenessMatch",
      "bait/bait_effectiveness_match.js", "activation-7a545a4f3325"),
    imported(bait, "freshness/bait_freshness_modifier.js", "BaitFreshnessModifier",
      "freshness/bait_freshness_modifier.js", "activation-b363ddbc09ea"),
    imported(freshness, "freshness/bait_freshness_decay_policy.js", "BaitFreshnessDecayPolicy",
      "freshness/bait_freshness_decay_policy.js", "activation-e5ee66b391d6"),
    imported(freshness, "metrics/item_bounded_metric_resolver.js", "ItemBoundedMetricResolver",
      "metrics/item_bounded_metric_resolver.js", "activation-a1c4f48a2220"),
    imported(progression, "progression/item_progression_descriptor.js", "ItemProgressionDescriptor",
      "progression/item_progression_descriptor.js", "activation-b63d6fa4a955"),
  ],
  expectedActivationIds: ["activation-15138a00826c", "activation-32c2b6cd025d", "activation-527be2eff1e7"],
  expectedActivationPositions: [60, 65, 85],
  expectedBridgeIds: ["bridge-06a78b1b4e3b", "bridge-6440a19d970c", "bridge-69e08a840e34"],
  informationalDocumentsExcluded: true,
  expectedRetiredActivationIds: ["activation-7a545a4f3325", "activation-a1c4f48a2220", "activation-b63d6fa4a955"],
  expectedRetiredBridgeIds: ["bridge-17302d0ad53c", "bridge-1d1043ea5488", "bridge-77296222f78c", "bridge-92ff45540824",
    "bridge-d1f629c5a0fa", "bridge-dfd570a5e25e", "bridge-eea627bb5a05"],
  expectedTopology: { beforeProjectModuleCount: 109, afterProjectModuleCount: 112,
    beforeActivationCount: 101, afterActivationCount: 101,
    beforeBridgeCount: 145, afterBridgeCount: 141 },
  includeRuntimeActiveState: true,
  persistActiveBatchPhase: true,
  includeDetailedStatePerformanceGates: true,
  behaviorPhases: ["classic-baseline", "temporary-esm-parity", "post-cutover-esm"],
  compatibilityPhases: ["pre-build-fixture", "temporary-esm-parity", "post-build-runtime"],
  scmCheckpointRequired: true,
  sourceReleaseTag: "v0.24.74",
  bridgeReason: "Preserve the exact item resolver consumers until their legacy symbols are removed.",
  rollbackRule: "restore-only-batch-037-delta-and-keep-batches-001-through-036",
  consumerSetSource: "stage-3.38.0-live-observation-and-stage-3.36-frozen-consumer-set",
  operationIds: ["verify-frozen-evidence", "open-batch-037",
    "create-three-named-esm-targets-with-seven-prefix-imports", "render-three-candidate-activation-shims",
    "project-three-consumer-bridges-and-retire-seven", "project-candidate-manifest",
    "validate-candidate-and-commit-atomic-cutover", "validate-identity-timing-state-and-behavior",
    "persist-and-reconcile-observations", "run-full-acceptance", "close-release-0.24.75"],
}).value;

const PREFLIGHT_PROFILE = new StageThreeBatchPreflightProfile({
  schemaVersion: 1,
  stageLabel: "Stage 3.38.0",
  artifactKind: "cyber-fishing-stage-3-batch-preflight-audit",
  batchId: EXECUTION_PROFILE.batchId,
  sourceReleaseVersion: EXECUTION_PROFILE.sourceReleaseVersion,
  executionProfile: EXECUTION_PROFILE,
  sideEffectEvidence: { path: "architecture/migration/stage_3_batch_037_side_effect_review.json",
    sha256: "87cd26f0d21d7a5a7facded39d46c4ae9085c49a38060b0e05c468089983bed1" },
  reviewedContracts: {
    [bait]: contract({
      instanceFields: ["#descriptorFactory", "#freshnessModifier", "#freshnessResolver", "#gradePolicy", "#knowledgePolicy"],
      semanticRisk: "bait-effectiveness-matches-and-descriptors-through-an-injected-factory",
      performanceClassification: "existing-bait-effectiveness-resolver",
      callSiteEvidence: [{ path: "src/app/bootstrap.js", marker: "new BaitEffectivenessResolver({" }],
      allocationBaseline: allocation(15, 1, 7, 0),
      compositionIdentityReview: true,
      legacyExposure: { symbol: "BaitEffectivenessResolver", location: "169:1", mechanism: "global-this-property" },
    }),
    [freshness]: contract({
      instanceFields: ["#decayPolicy", "#descriptorFactory", "#profileProvider"],
      semanticRisk: "bounded-freshness-metric-with-exposure-decay-through-an-injected-factory",
      performanceClassification: "existing-item-freshness-resolver",
      callSiteEvidence: [{ path: "src/app/bootstrap.js", marker: "new ItemFreshnessResolver({" }],
      allocationBaseline: allocation(5, 0, 1, 0),
      compositionIdentityReview: true,
      legacyExposure: { symbol: "ItemFreshnessResolver", location: "55:1", mechanism: "global-this-property" },
    }),
    [progression]: contract({
      instanceFields: ["#baselineRegistry", "#cache", "#capacityResolver", "#configProvider", "#effectiveStatsResolver",
        "#qualityResolver", "#ratingResolver", "#ratingTierResolver", "#revision"],
      semanticRisk: "progression-descriptors-with-signature-memo-cache-and-explicit-invalidation",
      performanceClassification: "existing-item-progression-resolver",
      callSiteEvidence: [{ path: "src/app/bootstrap.js", marker: "new ItemProgressionResolver({" }],
      allocationBaseline: allocation(14, 8, 8, 2),
      stateIdentityReview: { className: "ItemProgressionResolver", collections: [
        { owner: "ItemProgressionResolver#cache", field: "#cache", scope: "instance", collection: "Map",
          allowedOperations: ["clear", "get", "set"] },
      ] },
      compositionIdentityReview: true,
      legacyExposure: { symbol: "ItemProgressionResolver", location: "194:1", mechanism: "global-this-property" },
    }),
  },
  migrationGates: ["three-exact-sources-and-method-shapes", "three-export-identities-and-activations",
    "seven-exact-completed-prefix-imports", "owner-created-composition-identities",
    "one-memo-cache-collection-identity", "three-reviewed-global-this-exposures",
    "three-exact-consumer-relationships-and-seven-retired-bridges", "three-retired-activations", "all-legacy-activation-positions-preserved",
    "zero-config-platform-browser-dev-dependencies", "zero-added-hot-loop-allocations"],
}).value;

const RELEASE = Object.freeze({
  title: "Items Bait, Freshness and Progression Resolvers Domain",
  codename: "items-bait-freshness-progression-resolvers-domain",
  summary: "Batch 037 migrated BaitEffectivenessResolver, ItemFreshnessResolver and ItemProgressionResolver.",
  smokeContext: "Automated substitute per the owner's 2026-09-27 authorization: game-cycle loop re-executed without seals and a built-in-browser load of the game (bait effectiveness and freshness details, item progression tooltips) with screenshots and console counts.",
  notes: [
    "Migrate the bait effectiveness, item freshness and item progression resolvers",
    "Import their owner-created policies and descriptors from the completed prefix",
    "Keep the presentation descriptor factories injected by composition",
    "Move the reviewed globalThis exposures to the exact activation shims",
    "Retire the BaitEffectivenessMatch, ItemBoundedMetricResolver and ItemProgressionDescriptor activations",
    "Preserve one hundred twelve project modules, one hundred one activations and one hundred forty-one bridges",
  ],
  changelog: [
    "- Completed batch 037: BaitEffectivenessResolver, ItemFreshnessResolver and ItemProgressionResolver as named ESM exports with seven reviewed completed-prefix imports; descriptor factories stay injected; the progression memo cache keeps one owner.",
    "- Retired the BaitEffectivenessMatch, ItemBoundedMetricResolver and ItemProgressionDescriptor activations as inert classic placeholders.",
    "- Extended the cumulative graph from 109 to 112 project modules (101 activation contracts), with 141 exact bridge relationships (3 added, 7 retired).",
    "- The next task is batch 038 preflight.",
  ],
});

module.exports = { PREFLIGHT_PROFILE, RELEASE };
