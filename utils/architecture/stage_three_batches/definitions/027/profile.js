"use strict";

const { StageThreeBatchExecutionProfile } = require("../../../domain_batches/stage_three_batch_execution_profile");
const { StageThreeBatchPreflightProfile } = require("../../../domain_batches/stage_three_batch_preflight_profile");

const allocation = (objectExpressions, arrayExpressions, newExpressions, objectFreezeCalls,
  objectAssignCalls = 0, roundingCalls = 0) => ({ objectExpressions, arrayExpressions,
  newExpressions, objectFreezeCalls, objectAssignCalls, roundingCalls });
const core = "src/core/items/";
const domain = "src/game/domain/items/";
const registry = core + "progression/item_metric_strategy_registry.js";
const environmental = core + "quality/environmental_compensation_modifier.js";
const hook = core + "quality/hook_quality_modifier.js";
const net = core + "quality/net_quality_modifier.js";
const authored = core + "rarity/authored_item_rarity_strategy.js";
const gradePolicy = consumer => ({ consumer, from: domain + "quality/item_quality_grade_policy.js",
  exportName: "ItemQualityGradePolicy", legacySymbol: "ItemQualityGradePolicy",
  viaShim: core + "quality/item_quality_grade_policy.js", activationId: "activation-f247ec6b1d17" });
const contract = fields => ({ classification: "authoritative-owner", instanceFields: [],
  publicStateShape: [], resultShape: [], stableResultIdentity: false, mutatesCallerInputs: false,
  hotLoopCallSites: [], ...fields });
const exposure = (symbol, location) => ({ symbol, location, mechanism: "global-this-property" });

// Batch 027 migrates the item metric strategy registry, three quality modifiers (each with an
// owner-created default grade policy) and the authored rarity strategy (imported superclass). The
// grade policy, rarity descriptor and rarity strategy lose their last classic readers and retire.
const EXECUTION_PROFILE = new StageThreeBatchExecutionProfile({
  schemaVersion: 1,
  batchId: "stage-3.replan-322.batch-027-items-e8f84667",
  batchNumber: "027",
  executionStageLabel: "Stage 3.28.1",
  auditStageLabel: "Stage 3.28.0",
  focusedStageId: "stage-3.28.2",
  prebuildStageId: "stage-3.28.3",
  sourceReleaseVersion: "0.24.64",
  targetReleaseVersion: "0.24.65",
  auditPath: "architecture/migration/stage_3_batch_027_audit.json",
  executionPlanPath: "architecture/migration/stage_3_batch_027_execution_plan.json",
  testMatrixPath: "architecture/migration/stage_3_batch_027_test_matrix.json",
  expectedTargetCount: 5,
  expectedExportCount: 5,
  expectedActivationCount: 5,
  expectedConsumerCount: 6,
  expectedDependencyEdgeCount: 0,
  expectedTargets: [
    { currentPath: registry, targetPath: domain + "progression/item_metric_strategy_registry.js",
      exports: ["ItemMetricStrategyRegistry"] },
    { currentPath: environmental, targetPath: domain + "quality/environmental_compensation_modifier.js",
      exports: ["EnvironmentalCompensationModifier"] },
    { currentPath: hook, targetPath: domain + "quality/hook_quality_modifier.js", exports: ["HookQualityModifier"] },
    { currentPath: net, targetPath: domain + "quality/net_quality_modifier.js", exports: ["NetQualityModifier"] },
    { currentPath: authored, targetPath: domain + "rarity/authored_item_rarity_strategy.js",
      exports: ["AuthoredItemRarityStrategy"] },
  ],
  continuationPlan: { path: "architecture/migration/stage_3_22/approved_prefix.json",
    sha256: "4873af4bbc6a11a07a57c17cd198350d8154c0e6eed3a17551b8d02f97eb436c" },
  expectedImports: [
    gradePolicy(environmental), gradePolicy(hook), gradePolicy(net),
    { consumer: authored, from: domain + "rarity/item_rarity_descriptor.js", exportName: "ItemRarityDescriptor",
      legacySymbol: "ItemRarityDescriptor", viaShim: core + "rarity/item_rarity_descriptor.js",
      activationId: "activation-249fe0228439" },
    { consumer: authored, from: domain + "rarity/item_rarity_strategy.js", exportName: "ItemRarityStrategy",
      legacySymbol: "ItemRarityStrategy", viaShim: core + "rarity/item_rarity_strategy.js",
      activationId: "activation-edee20d9f6f3" },
  ],
  expectedActivationIds: ["activation-2593d3b2fae5", "activation-6debdbdd2ee1", "activation-a68a23ce9bf9",
    "activation-c4363cf3a576", "activation-e0d0ff620077"],
  expectedActivationPositions: [47, 69, 71, 72, 78],
  expectedBridgeIds: ["bridge-2640efa3c6fa", "bridge-625fc87b2709", "bridge-779213470262",
    "bridge-8c89f4ec3943", "bridge-a0e8c122895e", "bridge-ed9a7b5a4edc"],
  informationalDocumentsExcluded: true,
  expectedRetiredActivationIds: ["activation-249fe0228439", "activation-edee20d9f6f3", "activation-f247ec6b1d17"],
  expectedRetiredBridgeIds: ["bridge-9760dcaad25d", "bridge-9e3953224164", "bridge-d1e27da200fa",
    "bridge-e50e375b68f8", "bridge-eec98f962cb7"],
  expectedTopology: { beforeProjectModuleCount: 87, afterProjectModuleCount: 92,
    beforeActivationCount: 95, afterActivationCount: 97,
    beforeBridgeCount: 143, afterBridgeCount: 144 },
  includeRuntimeActiveState: true,
  persistActiveBatchPhase: true,
  includeDetailedStatePerformanceGates: true,
  behaviorPhases: ["classic-baseline", "temporary-esm-parity", "post-cutover-esm"],
  compatibilityPhases: ["pre-build-fixture", "temporary-esm-parity", "post-build-runtime"],
  scmCheckpointRequired: true,
  sourceReleaseTag: "v0.24.64",
  bridgeReason: "Preserve the exact item metric, quality modifier and authored rarity consumers until their legacy symbols are removed.",
  rollbackRule: "restore-only-batch-027-delta-and-keep-batches-001-through-026",
  consumerSetSource: "stage-3.28.0-live-observation-and-stage-3.22-frozen-consumer-set",
  operationIds: ["verify-frozen-evidence", "open-batch-027",
    "create-five-named-esm-targets-with-five-prefix-imports", "render-five-candidate-activation-shims",
    "project-six-consumer-bridges-and-retire-five", "project-candidate-manifest",
    "validate-candidate-and-commit-atomic-cutover", "validate-identity-timing-state-and-behavior",
    "persist-and-reconcile-observations", "run-full-acceptance", "close-release-0.24.65"],
}).value;

const PREFLIGHT_PROFILE = new StageThreeBatchPreflightProfile({
  schemaVersion: 1,
  stageLabel: "Stage 3.28.0",
  artifactKind: "cyber-fishing-stage-3-batch-preflight-audit",
  batchId: EXECUTION_PROFILE.batchId,
  sourceReleaseVersion: EXECUTION_PROFILE.sourceReleaseVersion,
  executionProfile: EXECUTION_PROFILE,
  sideEffectEvidence: { path: "architecture/migration/stage_3_batch_027_side_effect_review.json",
    sha256: "d57ae1a21a5d4cca1e9a0ac81ec530a91cc18a2f11557df23a1644c2463eac14" },
  reviewedContracts: {
    [registry]: contract({
      instanceFields: ["#strategies"],
      publicStateShape: ["ids"],
      semanticRisk: "item-metric-strategy-registration-lookup-and-frozen-id-snapshots",
      performanceClassification: "existing-item-metric-strategy-registry",
      callSiteEvidence: [{ path: "src/app/bootstrap.js", marker: "new ItemMetricStrategyRegistry([" }],
      allocationBaseline: allocation(0, 1, 3, 1),
      stateIdentityReview: { className: "ItemMetricStrategyRegistry", collections: [
        { owner: "ItemMetricStrategyRegistry#strategies", field: "#strategies", scope: "instance",
          collection: "Map", allowedOperations: ["get", "has", "keys", "set"] },
      ] },
    }),
    [environmental]: contract({
      instanceFields: ["#gradePolicy"],
      semanticRisk: "environmental-compensation-coefficient-with-owned-grade-policy",
      performanceClassification: "existing-environmental-compensation-modifier",
      callSiteEvidence: [{ path: "src/entities/tackle.js", marker: "new EnvironmentalCompensationModifier()" }],
      allocationBaseline: allocation(1, 1, 1, 0),
      compositionIdentityReview: true,
      legacyExposure: exposure("EnvironmentalCompensationModifier", "18:1"),
    }),
    [hook]: contract({
      instanceFields: ["#gradePolicy"],
      semanticRisk: "hook-quality-power-bonus-with-owned-grade-policy",
      performanceClassification: "existing-hook-quality-modifier",
      callSiteEvidence: [{ path: "src/core/items/hook/hook_power_policy.js", marker: "new HookQualityModifier()" }],
      allocationBaseline: allocation(1, 0, 1, 0),
      compositionIdentityReview: true,
      legacyExposure: exposure("HookQualityModifier", "13:1"),
    }),
    [net]: contract({
      instanceFields: ["#gradePolicy"],
      semanticRisk: "net-quality-catch-chance-bonus-with-owned-grade-policy",
      performanceClassification: "existing-net-quality-modifier",
      callSiteEvidence: [{ path: "src/entities/tackle.js", marker: "new NetQualityModifier()" }],
      allocationBaseline: allocation(1, 0, 1, 0, 0, 1),
      compositionIdentityReview: true,
      legacyExposure: exposure("NetQualityModifier", "14:1"),
    }),
    [authored]: contract({
      instanceFields: ["#descriptors"],
      semanticRisk: "authored-rarity-validation-and-cached-descriptor-identity",
      stableResultIdentity: true,
      performanceClassification: "existing-authored-item-rarity-strategy",
      callSiteEvidence: [{ path: "src/app/bootstrap.js", marker: "new AuthoredItemRarityStrategy()" }],
      allocationBaseline: allocation(1, 1, 9, 0),
      compositionIdentityReview: true,
      stateIdentityReview: { className: "AuthoredItemRarityStrategy", collections: [
        { owner: "AuthoredItemRarityStrategy#descriptors", field: "#descriptors", scope: "instance",
          collection: "Map", allowedOperations: ["get", "set"] },
      ] },
    }),
  },
  migrationGates: ["five-exact-source-and-method-shapes", "five-export-identities-and-activations",
    "three-reviewed-global-this-exposures", "five-exact-completed-prefix-imports",
    "three-owner-created-composition-identities", "two-reviewed-private-collections",
    "six-exact-consumer-relationships-and-five-retired-bridges", "three-retired-activations",
    "all-legacy-activation-positions-preserved", "zero-config-platform-browser-dev-dependencies",
    "zero-added-hot-loop-allocations"],
}).value;

const RELEASE = Object.freeze({
  title: "Items Metric Registry, Quality Modifiers and Authored Rarity Domain",
  codename: "items-metric-registry-quality-rarity-domain",
  summary: "Batch 027 migrated the item metric strategy registry, three quality modifiers and the authored rarity strategy.",
  smokeContext: "Automated substitute per the owner's 2026-09-27 authorization: game-cycle loop re-executed without seals and a built-in-browser load of the game with a screenshot and console counts.",
  notes: [
    "Migrate the item metric strategy registry, the environmental, hook and net quality modifiers and the authored rarity strategy",
    "Import the grade policy, rarity descriptor and rarity strategy from their completed ESM owners",
    "Move three reviewed global exposures to the exact activation shims",
    "Retire the grade policy, rarity descriptor and rarity strategy activations as inert classic placeholders",
    "Preserve ninety-two project modules, ninety-seven activations and one hundred forty-four bridges",
  ],
  changelog: [
    "- Completed batch 027 of the Stage 3.22 approved prefix: ItemMetricStrategyRegistry, EnvironmentalCompensationModifier, HookQualityModifier, NetQualityModifier and AuthoredItemRarityStrategy as named ESM exports.",
    "- Their completed-prefix collaborators (ItemQualityGradePolicy, ItemRarityDescriptor and the imported superclass ItemRarityStrategy) are reviewed imports; the owner-created default grade policies keep their composition identity, and three reviewed global exposures moved to the activation shims.",
    "- Retired the ItemQualityGradePolicy, ItemRarityDescriptor and ItemRarityStrategy activations as inert classic placeholders: their last classic readers migrated.",
    "- Extended the cumulative graph from 87 to 92 project modules and from 95 to 97 activation contracts, with 144 exact bridge relationships (6 added, 5 retired).",
    "- The next task is batch 028 preflight.",
  ],
});

module.exports = { PREFLIGHT_PROFILE, RELEASE };
