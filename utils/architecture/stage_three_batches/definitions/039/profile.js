"use strict";

const { StageThreeBatchExecutionProfile } = require("../../../domain_batches/stage_three_batch_execution_profile");
const { StageThreeBatchPreflightProfile } = require("../../../domain_batches/stage_three_batch_preflight_profile");

const allocation = (objectExpressions, arrayExpressions, newExpressions, objectFreezeCalls,
  objectAssignCalls = 0, roundingCalls = 0) => ({ objectExpressions, arrayExpressions,
  newExpressions, objectFreezeCalls, objectAssignCalls, roundingCalls });
const capacity = "src/core/equipment/inventory_capacity_policy.js";
const stamina = "src/systems/stamina_system.js";
const contract = fields => ({ classification: "authoritative-owner", instanceFields: [],
  publicStateShape: [], resultShape: [], stableResultIdentity: false, mutatesCallerInputs: false,
  hotLoopCallSites: [], ...fields });

// Batch 039 is the first batch of the Stage 3.40.0 approved prefix (grouped batches): the inventory
// capacity policies (text injected since prerequisite 009) and the fight StaminaController
// (reclassified cohesive in prerequisite 016). Neither reads a classic global.
const EXECUTION_PROFILE = new StageThreeBatchExecutionProfile({
  schemaVersion: 1,
  batchId: "stage-3.replan-340.batch-039-fishing-inventory-f92b17ea",
  batchNumber: "039",
  executionStageLabel: "Stage 3.40.1",
  auditStageLabel: "Stage 3.40.0",
  focusedStageId: "stage-3.40.2",
  prebuildStageId: "stage-3.40.3",
  sourceReleaseVersion: "0.24.76",
  targetReleaseVersion: "0.24.77",
  auditPath: "architecture/migration/stage_3_batch_039_audit.json",
  executionPlanPath: "architecture/migration/stage_3_batch_039_execution_plan.json",
  testMatrixPath: "architecture/migration/stage_3_batch_039_test_matrix.json",
  expectedTargetCount: 2,
  expectedExportCount: 4,
  expectedActivationCount: 2,
  expectedConsumerCount: 5,
  expectedDependencyEdgeCount: 0,
  expectedTargets: [
    { currentPath: capacity, targetPath: "src/game/domain/inventory/inventory_capacity_policy.js",
      exports: ["DelegatingInventoryCapacityPolicy", "InventoryCapacityPolicy", "UnlimitedInventoryCapacityPolicy"] },
    { currentPath: stamina, targetPath: "src/game/domain/fishing/stamina_system.js",
      exports: ["StaminaController"] },
  ],
  continuationPlan: { path: "architecture/migration/stage_3_40_graph_review/approved_prefix.json",
    sha256: "11f805c929ce92b57d38d9c0eaf62a8da21eac0eaf944a946b4233c9ffd27135" },
  expectedImports: [],
  expectedActivationIds: ["activation-58191715ba45", "activation-fae9ef46057a"],
  expectedActivationPositions: [162, 207],
  expectedBridgeIds: ["bridge-289f736e1af7", "bridge-2aa2248bbfc4", "bridge-a481c78efd89", "bridge-c38c025ddc66",
    "bridge-eec9b2477622"],
  informationalDocumentsExcluded: true,
  expectedTopology: { beforeProjectModuleCount: 114, afterProjectModuleCount: 116,
    beforeActivationCount: 103, afterActivationCount: 105,
    beforeBridgeCount: 163, afterBridgeCount: 168 },
  includeRuntimeActiveState: true,
  persistActiveBatchPhase: true,
  includeDetailedStatePerformanceGates: true,
  behaviorPhases: ["classic-baseline", "temporary-esm-parity", "post-cutover-esm"],
  compatibilityPhases: ["pre-build-fixture", "temporary-esm-parity", "post-build-runtime"],
  scmCheckpointRequired: true,
  sourceReleaseTag: "v0.24.76",
  bridgeReason: "Preserve the exact inventory capacity and stamina consumers until their legacy symbols are removed.",
  rollbackRule: "restore-only-batch-039-delta-and-keep-batches-001-through-038",
  consumerSetSource: "stage-3.40.0-live-observation-and-stage-3.40-frozen-consumer-set",
  operationIds: ["verify-frozen-evidence", "adopt-stage-3.40-approved-prefix-and-open-batch-039",
    "create-two-named-esm-targets-with-four-exports", "render-two-candidate-activation-shims",
    "project-five-consumer-bridges", "project-candidate-manifest",
    "validate-candidate-and-commit-atomic-cutover", "validate-identity-timing-state-and-behavior",
    "persist-and-reconcile-observations", "run-full-acceptance", "close-release-0.24.77"],
}).value;

const PREFLIGHT_PROFILE = new StageThreeBatchPreflightProfile({
  schemaVersion: 1,
  stageLabel: "Stage 3.40.0",
  artifactKind: "cyber-fishing-stage-3-batch-preflight-audit",
  batchId: EXECUTION_PROFILE.batchId,
  sourceReleaseVersion: EXECUTION_PROFILE.sourceReleaseVersion,
  executionProfile: EXECUTION_PROFILE,
  sideEffectEvidence: { path: "architecture/migration/stage_3_batch_039_side_effect_review.json",
    sha256: "4edd10378e429cf8fbd397aedc6bf30142dcf2f6bf7a2c1265f678cd611d1dae" },
  reviewedContracts: {
    [capacity]: contract({
      instanceFields: ["#evaluator", "#messages"],
      semanticRisk: "inventory-capacity-transition-results-with-injected-warning-text",
      performanceClassification: "existing-inventory-capacity-policy",
      callSiteEvidence: [
        { path: "src/application/inventory/inventory_v2_composition_root.js", marker: "new UnlimitedInventoryCapacityPolicy()" },
        { path: "src/application/inventory/loadout_application_service.js", marker: "new UnlimitedInventoryCapacityPolicy()" },
        { path: "src/core/equipment/equipment_transition_planner.js", marker: "new UnlimitedInventoryCapacityPolicy()" },
        { path: "src/core/loadouts/loadout_equipment_transition_planner.js", marker: "new UnlimitedInventoryCapacityPolicy()" },
      ],
      allocationBaseline: allocation(8, 2, 4, 3),
    }),
    [stamina]: contract({
      instanceFields: ["#condition", "#fish", "#isMasteryActive", "#lastStaminaBalanceFrame", "#masteryTimer",
        "#mechanicsConfig"],
      semanticRisk: "fight-stamina-and-endurance-frames-with-mastery-window-over-injected-condition-and-fish",
      performanceClassification: "existing-stamina-controller",
      callSiteEvidence: [{ path: "src/app/fishing.js", marker: "new StaminaController(" }],
      allocationBaseline: allocation(7, 0, 0, 0),
    }),
  },
  migrationGates: ["two-exact-sources-and-method-shapes", "four-export-identities-and-two-activations",
    "two-exact-owner-identities", "five-exact-consumer-relationships",
    "all-legacy-activation-positions-preserved", "zero-config-platform-browser-dev-dependencies",
    "zero-added-hot-loop-allocations"],
}).value;

const RELEASE = Object.freeze({
  title: "Inventory Capacity And Stamina Domain",
  codename: "inventory-capacity-and-stamina-domain",
  summary: "Batch 039 migrated the inventory capacity policies and the fight StaminaController, opening the Stage 3.40.0 approved prefix.",
  smokeContext: "Owner browser check of the batch: inventory transfers and equipping (capacity), a fight through stamina, exhaustion and mastery, with console counts.",
  notes: [
    "Migrate the inventory capacity policies",
    "Migrate the fight stamina controller",
    "Open the Stage 3.40.0 approved prefix",
    "Preserve one hundred sixteen project modules, one hundred five activations and one hundred sixty-eight bridges",
  ],
  changelog: [
    "- Opened the Stage 3.40.0 approved prefix (grouped batches after the six decompositions and Vector2 Engine ownership) with batch 039: InventoryCapacityPolicy, UnlimitedInventoryCapacityPolicy, DelegatingInventoryCapacityPolicy and StaminaController as named ESM exports.",
    "- Extended the cumulative graph from 114 to 116 project modules and from 103 to 105 activation contracts, with 168 exact bridge relationships (5 added).",
    "- The next batch is 040 of the Stage 3.40.0 approved prefix.",
  ],
});

module.exports = { PREFLIGHT_PROFILE, RELEASE };
