"use strict";

const { StageThreeBatchExecutionProfile } = require("../../../domain_batches/stage_three_batch_execution_profile");
const { StageThreeBatchPreflightProfile } = require("../../../domain_batches/stage_three_batch_preflight_profile");

const allocation = (objectExpressions, arrayExpressions, newExpressions, objectFreezeCalls,
  objectAssignCalls = 0, roundingCalls = 0) => ({ objectExpressions, arrayExpressions,
  newExpressions, objectFreezeCalls, objectAssignCalls, roundingCalls });
const policy = "src/core/inventory/item_assembly_stacking_policy.js";
const domain = "src/game/domain/inventory/";
const contract = fields => ({ classification: "authoritative-owner", instanceFields: [],
  publicStateShape: [], resultShape: [], stableResultIdentity: false, mutatesCallerInputs: false,
  hotLoopCallSites: [], ...fields });

// Batch 026 migrates the assembly stacking policy: its private static ignored-key Set is a
// reviewed class-definition effect, and its InventoryItemLocation read becomes a reviewed import.
const EXECUTION_PROFILE = new StageThreeBatchExecutionProfile({
  schemaVersion: 1,
  batchId: "stage-3.replan-322.batch-026-inventory-ad73f2fb",
  batchNumber: "026",
  executionStageLabel: "Stage 3.27.1",
  auditStageLabel: "Stage 3.27.0",
  focusedStageId: "stage-3.27.2",
  prebuildStageId: "stage-3.27.3",
  sourceReleaseVersion: "0.24.63",
  targetReleaseVersion: "0.24.64",
  auditPath: "architecture/migration/stage_3_batch_026_audit.json",
  executionPlanPath: "architecture/migration/stage_3_batch_026_execution_plan.json",
  testMatrixPath: "architecture/migration/stage_3_batch_026_test_matrix.json",
  expectedTargetCount: 1,
  expectedExportCount: 1,
  expectedActivationCount: 1,
  expectedConsumerCount: 3,
  expectedDependencyEdgeCount: 0,
  expectedTargets: [
    { currentPath: policy, targetPath: domain + "item_assembly_stacking_policy.js",
      exports: ["ItemAssemblyStackingPolicy"] },
  ],
  continuationPlan: { path: "architecture/migration/stage_3_22/approved_prefix.json",
    sha256: "4873af4bbc6a11a07a57c17cd198350d8154c0e6eed3a17551b8d02f97eb436c" },
  expectedImports: [
    { consumer: policy, from: domain + "inventory_item_location.js", exportName: "InventoryItemLocation",
      legacySymbol: "InventoryItemLocation", viaShim: "src/core/inventory/inventory_item_location.js",
      activationId: "activation-c3a8ca11fb0e" },
  ],
  expectedActivationIds: ["activation-1daa30ad1fef"],
  expectedActivationPositions: [147],
  expectedBridgeIds: ["bridge-37d65c5560c2", "bridge-53d26f4f68c6", "bridge-66d8c5b75058"],
  informationalDocumentsExcluded: true,
  expectedRetiredBridgeIds: ["bridge-357870b89ad9"],
  expectedTopology: { beforeProjectModuleCount: 86, afterProjectModuleCount: 87,
    beforeActivationCount: 94, afterActivationCount: 95,
    beforeBridgeCount: 141, afterBridgeCount: 143 },
  includeRuntimeActiveState: true,
  persistActiveBatchPhase: true,
  includeDetailedStatePerformanceGates: true,
  behaviorPhases: ["classic-baseline", "temporary-esm-parity", "post-cutover-esm"],
  compatibilityPhases: ["pre-build-fixture", "temporary-esm-parity", "post-build-runtime"],
  scmCheckpointRequired: true,
  sourceReleaseTag: "v0.24.63",
  bridgeReason: "Preserve the exact assembly stacking consumers until their legacy symbol is removed.",
  rollbackRule: "restore-only-batch-026-delta-and-keep-batches-001-through-025",
  consumerSetSource: "stage-3.27.0-live-observation-and-stage-3.22-frozen-consumer-set",
  operationIds: ["verify-frozen-evidence", "open-batch-026",
    "create-one-named-esm-target-with-one-prefix-import", "render-one-candidate-activation-shim",
    "project-three-consumer-bridges-and-retire-one", "project-candidate-manifest",
    "validate-candidate-and-commit-atomic-cutover", "validate-identity-timing-state-and-behavior",
    "persist-and-reconcile-observations", "run-full-acceptance", "close-release-0.24.64"],
}).value;

const PREFLIGHT_PROFILE = new StageThreeBatchPreflightProfile({
  schemaVersion: 1,
  stageLabel: "Stage 3.27.0",
  artifactKind: "cyber-fishing-stage-3-batch-preflight-audit",
  batchId: EXECUTION_PROFILE.batchId,
  sourceReleaseVersion: EXECUTION_PROFILE.sourceReleaseVersion,
  executionProfile: EXECUTION_PROFILE,
  sideEffectEvidence: { path: "architecture/migration/stage_3_batch_026_side_effect_review.json",
    sha256: "72126d790748a85fd559a21eb8ac45be67658262dd564178997e055538496144" },
  reviewedContracts: {
    [policy]: contract({
      instanceFields: ["#ignoredKeys"],
      semanticRisk: "assembly-stack-eligibility-with-private-static-ignored-keys-and-stable-serialization",
      performanceClassification: "existing-item-assembly-stacking-policy",
      callSiteEvidence: [
        { path: "src/application/inventory/inventory_v2_command_service.js", marker: "new ItemAssemblyStackingPolicy()" },
        { path: "src/application/inventory/inventory_v2_composition_root.js", marker: "new ItemAssemblyStackingPolicy()" },
        { path: "src/core/assemblies/item_assembly_service.js", marker: "new ItemAssemblyStackingPolicy()" },
      ],
      allocationBaseline: allocation(0, 2, 2, 0),
      stateIdentityReview: { className: "ItemAssemblyStackingPolicy", collections: [
        { owner: "ItemAssemblyStackingPolicy.ignoredKeys", field: "#ignoredKeys", scope: "static",
          collection: "Set", allowedOperations: ["has"] },
      ] },
      privateStaticSets: { className: "ItemAssemblyStackingPolicy", bindings: {
        "#ignoredKeys": { location: "2:25", values: ["instanceId", "quantity"] },
      } },
    }),
  },
  migrationGates: ["one-exact-source-and-method-shape", "one-export-identity-and-activation",
    "one-reviewed-private-static-literal-set", "one-exact-completed-prefix-import",
    "three-exact-consumer-relationships-and-one-retired-bridge", "all-legacy-activation-positions-preserved",
    "zero-config-platform-browser-dev-dependencies", "zero-added-hot-loop-allocations"],
}).value;

const RELEASE = Object.freeze({
  title: "Inventory Assembly Stacking Policy Domain",
  codename: "inventory-assembly-stacking-policy-domain",
  summary: "Batch 026 migrated ItemAssemblyStackingPolicy with its reviewed private static ignored-key Set.",
  smokeContext: "Response to the Stage 3.27.8 Inventory checklist: stacking identical assemblies and items, keeping different or attached/loadout items apart, moving and equipping stacks, save/reload of the inventory and zero console errors/warnings.",
  notes: [
    "Migrate the item assembly stacking policy",
    "Keep its private static ignored-key Set as a reviewed class-definition effect",
    "Import InventoryItemLocation from its completed ESM owner",
    "Preserve eighty-seven project modules, ninety-five activations and one hundred forty-three bridges",
  ],
  changelog: [
    "- Completed batch 026 of the Stage 3.22 approved prefix: ItemAssemblyStackingPolicy as a named ESM export.",
    "- Its private static ignored-key Set stays a reviewed class-definition effect evaluated once, and its InventoryItemLocation read is a reviewed import from the completed ESM owner.",
    "- Extended the cumulative graph from 86 to 87 project modules and from 94 to 95 activation contracts, with 143 exact bridge relationships (3 added, 1 retired).",
    "- The next task is batch 027 preflight.",
  ],
});

module.exports = { PREFLIGHT_PROFILE, RELEASE };
