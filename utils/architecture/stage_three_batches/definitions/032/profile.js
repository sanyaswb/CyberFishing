"use strict";

const { StageThreeBatchExecutionProfile } = require("../../../domain_batches/stage_three_batch_execution_profile");
const { StageThreeBatchPreflightProfile } = require("../../../domain_batches/stage_three_batch_preflight_profile");

const allocation = (objectExpressions, arrayExpressions, newExpressions, objectFreezeCalls,
  objectAssignCalls = 0, roundingCalls = 0) => ({ objectExpressions, arrayExpressions,
  newExpressions, objectFreezeCalls, objectAssignCalls, roundingCalls });
const resolver = "src/core/items/rarity/effective_item_rarity_resolver.js";
const contract = fields => ({ classification: "authoritative-owner", instanceFields: [],
  publicStateShape: [], resultShape: [], stableResultIdentity: false, mutatesCallerInputs: false,
  hotLoopCallSites: [], ...fields });

// Batch 032 migrates the effective item rarity resolver: its owner-created item rarity resolver
// (batch 030) is a reviewed import and its reviewed global exposure moves to the activation shim.
const EXECUTION_PROFILE = new StageThreeBatchExecutionProfile({
  schemaVersion: 1,
  batchId: "stage-3.replan-322.batch-032-items-096b3398",
  batchNumber: "032",
  executionStageLabel: "Stage 3.33.1",
  auditStageLabel: "Stage 3.33.0",
  focusedStageId: "stage-3.33.2",
  prebuildStageId: "stage-3.33.3",
  sourceReleaseVersion: "0.24.69",
  targetReleaseVersion: "0.24.70",
  auditPath: "architecture/migration/stage_3_batch_032_audit.json",
  executionPlanPath: "architecture/migration/stage_3_batch_032_execution_plan.json",
  testMatrixPath: "architecture/migration/stage_3_batch_032_test_matrix.json",
  expectedTargetCount: 1,
  expectedExportCount: 1,
  expectedActivationCount: 1,
  expectedConsumerCount: 2,
  expectedDependencyEdgeCount: 0,
  expectedTargets: [
    { currentPath: resolver, targetPath: "src/game/domain/items/rarity/effective_item_rarity_resolver.js",
      exports: ["EffectiveItemRarityResolver"] },
  ],
  continuationPlan: { path: "architecture/migration/stage_3_22/approved_prefix.json",
    sha256: "4873af4bbc6a11a07a57c17cd198350d8154c0e6eed3a17551b8d02f97eb436c" },
  expectedImports: [
    { consumer: resolver, from: "src/game/domain/items/rarity/item_rarity_resolver.js", exportName: "ItemRarityResolver",
      legacySymbol: "ItemRarityResolver", viaShim: "src/core/items/rarity/item_rarity_resolver.js",
      activationId: "activation-feaf02eaca22" },
  ],
  expectedActivationIds: ["activation-91c2b60ce51e"],
  expectedActivationPositions: [50],
  expectedBridgeIds: ["bridge-b894531e5b91", "bridge-ff8fc75f21d2"],
  informationalDocumentsExcluded: true,
  expectedRetiredBridgeIds: ["bridge-02d221df87c8"],
  expectedTopology: { beforeProjectModuleCount: 98, afterProjectModuleCount: 99,
    beforeActivationCount: 95, afterActivationCount: 96,
    beforeBridgeCount: 138, afterBridgeCount: 139 },
  includeRuntimeActiveState: true,
  persistActiveBatchPhase: true,
  includeDetailedStatePerformanceGates: true,
  behaviorPhases: ["classic-baseline", "temporary-esm-parity", "post-cutover-esm"],
  compatibilityPhases: ["pre-build-fixture", "temporary-esm-parity", "post-build-runtime"],
  scmCheckpointRequired: true,
  sourceReleaseTag: "v0.24.69",
  bridgeReason: "Preserve the exact effective item rarity consumers until their legacy symbol is removed.",
  rollbackRule: "restore-only-batch-032-delta-and-keep-batches-001-through-031",
  consumerSetSource: "stage-3.33.0-live-observation-and-stage-3.22-frozen-consumer-set",
  operationIds: ["verify-frozen-evidence", "open-batch-032",
    "create-one-named-esm-target-with-one-prefix-import", "render-one-candidate-activation-shim",
    "project-two-consumer-bridges-and-retire-one", "project-candidate-manifest",
    "validate-candidate-and-commit-atomic-cutover", "validate-identity-timing-state-and-behavior",
    "persist-and-reconcile-observations", "run-full-acceptance", "close-release-0.24.70"],
}).value;

const PREFLIGHT_PROFILE = new StageThreeBatchPreflightProfile({
  schemaVersion: 1,
  stageLabel: "Stage 3.33.0",
  artifactKind: "cyber-fishing-stage-3-batch-preflight-audit",
  batchId: EXECUTION_PROFILE.batchId,
  sourceReleaseVersion: EXECUTION_PROFILE.sourceReleaseVersion,
  executionProfile: EXECUTION_PROFILE,
  sideEffectEvidence: { path: "architecture/migration/stage_3_batch_032_side_effect_review.json",
    sha256: "bf3c22d0690b446c42eb7862ad03de591646e30fad9fbbd5c2102aee095471fe" },
  reviewedContracts: {
    [resolver]: contract({
      instanceFields: ["#itemRarityResolver"],
      semanticRisk: "effective-rarity-from-instance-or-definition-through-owned-item-rarity-resolver",
      stableResultIdentity: true,
      performanceClassification: "existing-effective-item-rarity-resolver",
      callSiteEvidence: [{ path: "src/systems/inventory_item_view_factory.js",
        marker: "effectiveRarityResolver = new EffectiveItemRarityResolver()" }],
      allocationBaseline: allocation(2, 0, 2, 0),
      compositionIdentityReview: true,
      legacyExposure: { symbol: "EffectiveItemRarityResolver", location: "29:1", mechanism: "global-this-property" },
    }),
  },
  migrationGates: ["one-exact-source-and-method-shape", "one-export-identity-and-activation",
    "one-exact-earlier-batch-import", "one-owner-created-composition-identity",
    "one-reviewed-global-this-exposure", "two-exact-consumer-relationships-and-one-retired-bridge",
    "all-legacy-activation-positions-preserved", "zero-config-platform-browser-dev-dependencies",
    "zero-added-hot-loop-allocations"],
}).value;

const RELEASE = Object.freeze({
  title: "Items Effective Rarity Resolver Domain",
  codename: "items-effective-rarity-resolver-domain",
  summary: "Batch 032 migrated EffectiveItemRarityResolver, completing the Stage 3.22 approved prefix.",
  smokeContext: "Automated substitute per the owner's 2026-09-27 authorization: game-cycle loop re-executed without seals and a built-in-browser load of the game (inventory rarity) with screenshots and console counts.",
  notes: [
    "Migrate the effective item rarity resolver",
    "Import the item rarity resolver from batch 030",
    "Move the reviewed global exposure of EffectiveItemRarityResolver to the exact activation shim",
    "Complete the Stage 3.22 approved continuation prefix",
    "Preserve ninety-nine project modules, ninety-six activations and one hundred thirty-nine bridges",
  ],
  changelog: [
    "- Completed batch 032, the last batch of the Stage 3.22 approved prefix: EffectiveItemRarityResolver as a named ESM export.",
    "- Its owner-created ItemRarityResolver (batch 030) is a reviewed import proven by composition identity, and the reviewed global exposure moved to the activation shim.",
    "- Extended the cumulative graph from 98 to 99 project modules and from 95 to 96 activation contracts, with 139 exact bridge relationships (2 added, 1 retired).",
    "- The next task is the post-prefix review: the review queue (033, 034) evidence prerequisites and the prerequisite backlog.",
  ],
});

module.exports = { PREFLIGHT_PROFILE, RELEASE };
