"use strict";

const { StageThreeBatchExecutionProfile } = require("../../../domain_batches/stage_three_batch_execution_profile");
const { StageThreeBatchPreflightProfile } = require("../../../domain_batches/stage_three_batch_preflight_profile");

const allocation = (objectExpressions, arrayExpressions, newExpressions, objectFreezeCalls,
  objectAssignCalls = 0, roundingCalls = 0) => ({ objectExpressions, arrayExpressions,
  newExpressions, objectFreezeCalls, objectAssignCalls, roundingCalls });
const policy = "src/core/equipment/equipment_compatibility_policy.js";
const domain = "src/game/domain/equipment/";
const contract = fields => ({ classification: "authoritative-owner", instanceFields: [],
  publicStateShape: [], resultShape: [], stableResultIdentity: false, mutatesCallerInputs: false,
  hotLoopCallSites: [], ...fields });
const imported = (exportName, from, viaShim, activationId) =>
  ({ consumer: policy, from, exportName, legacySymbol: exportName, viaShim, activationId });

// Batch 048 migrates the equipment compatibility policy. It composes its default capability resolver,
// slot visibility policy and terminal-line resolver from reviewed Domain imports (batch 047 and the
// completed prefix): reviewed composition identities. Its classic global-this exposure is reviewed and
// moves to the activation shim. Risk level B: no per-frame call site, no persisted data.
const EXECUTION_PROFILE = new StageThreeBatchExecutionProfile({
  schemaVersion: 1,
  batchId: "stage-3.replan-342.batch-048-equipment-1d22d745",
  batchNumber: "048",
  executionStageLabel: "Stage 3.49.1",
  auditStageLabel: "Stage 3.49.0",
  focusedStageId: "stage-3.49.2",
  prebuildStageId: "stage-3.49.3",
  sourceReleaseVersion: "0.24.85",
  targetReleaseVersion: "0.24.86",
  auditPath: "architecture/migration/stage_3_batch_048_audit.json",
  executionPlanPath: "architecture/migration/stage_3_batch_048_execution_plan.json",
  testMatrixPath: "architecture/migration/stage_3_batch_048_test_matrix.json",
  expectedTargetCount: 1,
  expectedExportCount: 1,
  expectedActivationCount: 1,
  expectedConsumerCount: 1,
  expectedDependencyEdgeCount: 0,
  expectedTargets: [
    { currentPath: policy, targetPath: `${domain}equipment_compatibility_policy.js`,
      exports: ["EquipmentCompatibilityPolicy"] },
  ],
  continuationPlan: { path: "architecture/migration/stage_3_42_graph_review/approved_prefix.json",
    sha256: "dcf3aa4db2927dec3a84658c0f25d1e845339d8d8f71f65c3eb6a05b9f482c8c" },
  expectedImports: [
    imported("EQUIPMENT_SLOT_CONFIG", `${domain}equipment_slot_catalog.js`, "src/config/inventory/equipment_slot_config.js",
      "activation-177bcf26ae86"),
    imported("EquipmentSlotVisibilityPolicy", `${domain}equipment_slot_visibility_policy.js`,
      "src/core/equipment/equipment_slot_visibility_policy.js", "activation-f06b98f0ba90"),
    imported("RodCapabilityResolver", `${domain}rod_capability_resolver.js`, "src/core/equipment/rod_capability_resolver.js",
      "activation-59bd96059da6"),
    imported("TerminalLineSlotResolver", `${domain}terminal_line_slot_resolver.js`,
      "src/core/equipment/terminal_line_slot_resolver.js", "activation-82fd44d25663"),
  ],
  expectedActivationIds: ["activation-a88f2b193e63"],
  expectedActivationPositions: [167],
  expectedBridgeIds: ["bridge-33d4356e3078"],
  expectedRetiredBridgeIds: ["bridge-4c97028596c9", "bridge-4e3ebadf8b3a", "bridge-b26ba8739153", "bridge-f71c63330b1b"],
  informationalDocumentsExcluded: true,
  expectedTopology: { beforeProjectModuleCount: 141, afterProjectModuleCount: 142,
    beforeActivationCount: 131, afterActivationCount: 132,
    beforeBridgeCount: 200, afterBridgeCount: 197 },
  includeRuntimeActiveState: true,
  persistActiveBatchPhase: true,
  includeDetailedStatePerformanceGates: true,
  behaviorPhases: ["classic-baseline", "temporary-esm-parity", "post-cutover-esm"],
  compatibilityPhases: ["pre-build-fixture", "temporary-esm-parity", "post-build-runtime"],
  scmCheckpointRequired: true,
  sourceReleaseTag: "v0.24.85",
  bridgeReason: "Preserve the exact equipment compatibility policy consumer until its legacy symbol is removed.",
  rollbackRule: "restore-only-batch-048-delta-and-keep-batches-001-through-047",
  consumerSetSource: "stage-3.42.0-live-observation-and-stage-3.42-frozen-consumer-set",
  operationIds: ["verify-frozen-evidence", "open-batch-048",
    "create-one-named-esm-target-with-one-export", "render-one-candidate-activation-shim",
    "project-one-consumer-bridge-and-retire-four", "project-candidate-manifest",
    "validate-candidate-and-commit-atomic-cutover", "validate-identity-timing-state-and-behavior",
    "persist-and-reconcile-observations", "run-full-acceptance", "close-release-0.24.86"],
}).value;

const PREFLIGHT_PROFILE = new StageThreeBatchPreflightProfile({
  schemaVersion: 1,
  stageLabel: "Stage 3.49.0",
  artifactKind: "cyber-fishing-stage-3-batch-preflight-audit",
  batchId: EXECUTION_PROFILE.batchId,
  sourceReleaseVersion: EXECUTION_PROFILE.sourceReleaseVersion,
  executionProfile: EXECUTION_PROFILE,
  sideEffectEvidence: { path: "architecture/migration/stage_3_batch_048_side_effect_review.json",
    sha256: "7b3b9ca25118d3ceee57bad807a4d97448d91b07f838d369f98c4e0e4bcdc245" },
  reviewedContracts: {
    [policy]: contract({
      instanceFields: ["#capabilityResolver", "#messages", "#readinessPolicy", "#slotConfig", "#terminalLineResolver",
        "#visibilityPolicy"],
      semanticRisk: "slot-item-rod-compatibility-over-owned-visibility-terminal-and-capability-collaborators",
      performanceClassification: "existing-equipment-compatibility-policy",
      callSiteEvidence: [{ path: "src/application/inventory/inventory_v2_composition_root.js",
        marker: "new EquipmentCompatibilityPolicy({" }],
      allocationBaseline: allocation(9, 5, 3, 1),
      compositionIdentityReview: true,
      legacyExposure: { symbol: "EquipmentCompatibilityPolicy", location: "119:1", mechanism: "global-this-property" },
    }),
  },
  migrationGates: ["one-exact-source-and-method-shape", "one-export-identity-and-activation",
    "four-exact-earlier-batch-and-completed-prefix-imports", "three-owner-created-composition-identities",
    "one-reviewed-global-this-exposure", "one-exact-consumer-relationship-and-four-retired-bridges",
    "all-legacy-activation-positions-preserved", "zero-config-platform-browser-dev-dependencies",
    "zero-added-hot-loop-allocations"],
}).value;

const RELEASE = Object.freeze({
  title: "Equipment Compatibility Policy Domain",
  codename: "equipment-compatibility-policy-domain",
  summary: "Batch 048 migrated the equipment compatibility policy to the equipment Domain.",
  smokeContext: "Automated browser smoke under the owner's 2026-10-01 authorization: game-cycle re-executed without seals and compared with the pre-cutover output, game loaded in the built-in browser, and console errors and warnings counted.",
  notes: [
    "Migrate the equipment compatibility policy with its reviewed global exposure",
    "Import the slot catalog, slot visibility, terminal-line and rod capability collaborators",
    "Preserve one hundred forty-two project modules, one hundred thirty-two active activations and one hundred ninety-seven bridges",
  ],
  // Short format (owner decision 2026-10-01): 1-3 lines per release.
  changelog: [
    "- Migrated EquipmentCompatibilityPolicy to the equipment Domain; its global exposure moved to the activation shim.",
  ],
});

module.exports = { PREFLIGHT_PROFILE, RELEASE };
