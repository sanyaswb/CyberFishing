"use strict";

const { StageThreeBatchExecutionProfile } = require("../../../domain_batches/stage_three_batch_execution_profile");
const { StageThreeBatchPreflightProfile } = require("../../../domain_batches/stage_three_batch_preflight_profile");

const allocation = (objectExpressions, arrayExpressions, newExpressions, objectFreezeCalls,
  objectAssignCalls = 0, roundingCalls = 0) => ({ objectExpressions, arrayExpressions,
  newExpressions, objectFreezeCalls, objectAssignCalls, roundingCalls });
const core = "src/core/items/";
const domain = "src/game/domain/items/";
const hook = core + "hook/hook_power_policy.js";
const rarity = core + "rarity/item_rarity_resolver.js";
const contract = fields => ({ classification: "authoritative-owner", instanceFields: [],
  publicStateShape: [], resultShape: [], stableResultIdentity: false, mutatesCallerInputs: false,
  hotLoopCallSites: [], ...fields });

// Batch 030 migrates the hook power policy (reviewed global exposure, owner-created quality
// modifier from batch 027) and the item rarity resolver (owner-created registry with the authored
// strategy from batch 027). The hook quality modifier activation loses its last classic reader.
const EXECUTION_PROFILE = new StageThreeBatchExecutionProfile({
  schemaVersion: 1,
  batchId: "stage-3.replan-322.batch-030-items-a3bf25f7",
  batchNumber: "030",
  executionStageLabel: "Stage 3.31.1",
  auditStageLabel: "Stage 3.31.0",
  focusedStageId: "stage-3.31.2",
  prebuildStageId: "stage-3.31.3",
  sourceReleaseVersion: "0.24.67",
  targetReleaseVersion: "0.24.68",
  auditPath: "architecture/migration/stage_3_batch_030_audit.json",
  executionPlanPath: "architecture/migration/stage_3_batch_030_execution_plan.json",
  testMatrixPath: "architecture/migration/stage_3_batch_030_test_matrix.json",
  expectedTargetCount: 2,
  expectedExportCount: 2,
  expectedActivationCount: 2,
  expectedConsumerCount: 5,
  expectedDependencyEdgeCount: 0,
  expectedTargets: [
    { currentPath: hook, targetPath: domain + "hook/hook_power_policy.js", exports: ["HookPowerPolicy"] },
    { currentPath: rarity, targetPath: domain + "rarity/item_rarity_resolver.js", exports: ["ItemRarityResolver"] },
  ],
  continuationPlan: { path: "architecture/migration/stage_3_22/approved_prefix.json",
    sha256: "4873af4bbc6a11a07a57c17cd198350d8154c0e6eed3a17551b8d02f97eb436c" },
  expectedImports: [
    { consumer: hook, from: domain + "quality/hook_quality_modifier.js", exportName: "HookQualityModifier",
      legacySymbol: "HookQualityModifier", viaShim: core + "quality/hook_quality_modifier.js",
      activationId: "activation-2593d3b2fae5" },
    { consumer: rarity, from: domain + "rarity/authored_item_rarity_strategy.js", exportName: "AuthoredItemRarityStrategy",
      legacySymbol: "AuthoredItemRarityStrategy", viaShim: core + "rarity/authored_item_rarity_strategy.js",
      activationId: "activation-a68a23ce9bf9" },
    { consumer: rarity, from: domain + "rarity/item_rarity_strategy_registry.js", exportName: "ItemRarityStrategyRegistry",
      legacySymbol: "ItemRarityStrategyRegistry", viaShim: core + "rarity/item_rarity_strategy_registry.js",
      activationId: "activation-7b2f08a8cb34" },
  ],
  expectedActivationIds: ["activation-3d418582cb27", "activation-feaf02eaca22"],
  expectedActivationPositions: [49, 70],
  expectedBridgeIds: ["bridge-021cb2032053", "bridge-02d221df87c8", "bridge-3d0eb05d9af6", "bridge-5f6c783bbcd7",
    "bridge-bc38f49d00dc"],
  informationalDocumentsExcluded: true,
  expectedRetiredActivationIds: ["activation-2593d3b2fae5"],
  expectedRetiredBridgeIds: ["bridge-8c89f4ec3943", "bridge-a0e8c122895e", "bridge-a970e658356c"],
  expectedTopology: { beforeProjectModuleCount: 95, afterProjectModuleCount: 97,
    beforeActivationCount: 96, afterActivationCount: 97,
    beforeBridgeCount: 138, afterBridgeCount: 140 },
  includeRuntimeActiveState: true,
  persistActiveBatchPhase: true,
  includeDetailedStatePerformanceGates: true,
  behaviorPhases: ["classic-baseline", "temporary-esm-parity", "post-cutover-esm"],
  compatibilityPhases: ["pre-build-fixture", "temporary-esm-parity", "post-build-runtime"],
  scmCheckpointRequired: true,
  sourceReleaseTag: "v0.24.67",
  bridgeReason: "Preserve the exact hook power and item rarity consumers until their legacy symbols are removed.",
  rollbackRule: "restore-only-batch-030-delta-and-keep-batches-001-through-029",
  consumerSetSource: "stage-3.31.0-live-observation-and-stage-3.22-frozen-consumer-set",
  operationIds: ["verify-frozen-evidence", "open-batch-030",
    "create-two-named-esm-targets-with-three-prefix-imports", "render-two-candidate-activation-shims",
    "project-five-consumer-bridges-and-retire-three", "project-candidate-manifest",
    "validate-candidate-and-commit-atomic-cutover", "validate-identity-timing-state-and-behavior",
    "persist-and-reconcile-observations", "run-full-acceptance", "close-release-0.24.68"],
}).value;

const PREFLIGHT_PROFILE = new StageThreeBatchPreflightProfile({
  schemaVersion: 1,
  stageLabel: "Stage 3.31.0",
  artifactKind: "cyber-fishing-stage-3-batch-preflight-audit",
  batchId: EXECUTION_PROFILE.batchId,
  sourceReleaseVersion: EXECUTION_PROFILE.sourceReleaseVersion,
  executionProfile: EXECUTION_PROFILE,
  sideEffectEvidence: { path: "architecture/migration/stage_3_batch_030_side_effect_review.json",
    sha256: "c63258edc561dd8808c7a8c57b18715e3db014910403610864a18192ff6081be" },
  reviewedContracts: {
    [hook]: contract({
      instanceFields: ["#qualityModifier"],
      semanticRisk: "hook-power-from-grade-weight-and-owned-quality-modifier",
      performanceClassification: "existing-hook-power-policy",
      callSiteEvidence: [{ path: "src/entities/tackle.js", marker: "powerPolicy = new HookPowerPolicy()" }],
      allocationBaseline: allocation(2, 0, 2, 0),
      compositionIdentityReview: true,
      legacyExposure: { symbol: "HookPowerPolicy", location: "19:1", mechanism: "global-this-property" },
    }),
    [rarity]: contract({
      instanceFields: ["#strategyRegistry"],
      semanticRisk: "item-rarity-resolution-through-owned-strategy-registry",
      stableResultIdentity: true,
      performanceClassification: "existing-item-rarity-resolver",
      callSiteEvidence: [{ path: "src/app/bootstrap.js", marker: "new ItemRarityResolver({" }],
      allocationBaseline: allocation(1, 1, 3, 0),
      compositionIdentityReview: true,
    }),
  },
  migrationGates: ["two-exact-source-and-method-shapes", "two-export-identities-and-activations",
    "three-exact-imports-including-two-earlier-batch-exports", "three-owner-created-composition-identities",
    "one-reviewed-global-this-exposure", "five-exact-consumer-relationships-and-three-retired-bridges",
    "one-retired-activation", "all-legacy-activation-positions-preserved",
    "zero-config-platform-browser-dev-dependencies", "zero-added-hot-loop-allocations"],
}).value;

const RELEASE = Object.freeze({
  title: "Items Hook Power and Rarity Resolver Domain",
  codename: "items-hook-power-rarity-resolver-domain",
  summary: "Batch 030 migrated HookPowerPolicy and ItemRarityResolver and retired the hook quality modifier activation.",
  smokeContext: "Automated substitute per the owner's 2026-09-27 authorization: game-cycle loop re-executed without seals and a built-in-browser load of the game (inventory rarity and hook details) with screenshots and console counts.",
  notes: [
    "Migrate the hook power policy and the item rarity resolver",
    "Import the hook quality modifier and the authored rarity strategy from batch 027",
    "Move the reviewed global exposure of HookPowerPolicy to the exact activation shim",
    "Retire the hook quality modifier activation as an inert classic placeholder",
    "Preserve ninety-seven project modules, ninety-seven activations and one hundred forty bridges",
  ],
  changelog: [
    "- Completed batch 030 of the Stage 3.22 approved prefix: HookPowerPolicy and ItemRarityResolver as named ESM exports.",
    "- Three reviewed imports (HookQualityModifier and AuthoredItemRarityStrategy from batch 027, ItemRarityStrategyRegistry); the owner-created defaults are proven Domain compositions and the reviewed global exposure moved to the activation shim.",
    "- Retired the HookQualityModifier activation as an inert classic placeholder.",
    "- Extended the cumulative graph from 95 to 97 project modules and from 96 to 97 activation contracts, with 140 exact bridge relationships (5 added, 3 retired).",
    "- The next task is batch 031 preflight.",
  ],
});

module.exports = { PREFLIGHT_PROFILE, RELEASE };
