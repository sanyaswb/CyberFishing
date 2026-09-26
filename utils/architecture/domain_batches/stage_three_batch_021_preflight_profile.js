"use strict";

const { StageThreeBatchExecutionProfile } = require("./stage_three_batch_execution_profile");
const { StageThreeBatchPreflightProfile } = require("./stage_three_batch_preflight_profile");

const allocation = (objectExpressions, arrayExpressions, newExpressions, objectFreezeCalls,
  objectAssignCalls = 0, roundingCalls = 0) => ({ objectExpressions, arrayExpressions,
  newExpressions, objectFreezeCalls, objectAssignCalls, roundingCalls });
const autoRefill = "src/core/equipment/auto_refill_policy.js";
const exactItem = "src/core/equipment/exact_item_signature_policy.js";
const domain = "src/game/domain/equipment/";
const contract = fields => ({ classification: "authoritative-owner", instanceFields: [],
  publicStateShape: [], resultShape: [], stableResultIdentity: false, mutatesCallerInputs: false,
  hotLoopCallSites: [], ...fields });

const BATCH_021_EXECUTION_PROFILE = new StageThreeBatchExecutionProfile({
  schemaVersion: 1,
  batchId: "stage-3.candidate-021-equipment-4044fcef",
  batchNumber: "021",
  executionStageLabel: "Stage 3.21.1",
  auditStageLabel: "Stage 3.21.0",
  focusedStageId: "stage-3.21.2",
  prebuildStageId: "stage-3.21.3",
  sourceReleaseVersion: "0.24.57",
  targetReleaseVersion: "0.24.58",
  auditPath: "architecture/migration/stage_3_batch_021_audit.json",
  executionPlanPath: "architecture/migration/stage_3_batch_021_execution_plan.json",
  testMatrixPath: "architecture/migration/stage_3_batch_021_test_matrix.json",
  expectedTargetCount: 2,
  expectedExportCount: 6,
  expectedActivationCount: 6,
  expectedConsumerCount: 4,
  expectedDependencyEdgeCount: 0,
  expectedTargets: [
    { currentPath: autoRefill, targetPath: domain + "auto_refill_policy.js",
      exports: ["AutoRefillMemory", "AutoRefillPolicy", "AutoRefillScope", "AutoRefillSettings",
        "AutoRefillTrigger"] },
    { currentPath: exactItem, targetPath: domain + "exact_item_signature_policy.js",
      exports: ["ExactItemSignaturePolicy"] },
  ],
  expectedActivationIds: ["activation-23610c146ce8", "activation-3496b09d5f7c",
    "activation-35621c703348", "activation-99430ac00c3f", "activation-9d32b36c0350",
    "activation-a658f15200ed"],
  expectedActivationPositions: [164, 165, 165, 165, 165, 165],
  expectedBridgeIds: ["bridge-085faac976d6", "bridge-242afef6802f", "bridge-603f6e08a836",
    "bridge-6fcf1bea53e9"],
  expectedTopology: { beforeProjectModuleCount: 76, afterProjectModuleCount: 78,
    beforeActivationCount: 81, afterActivationCount: 87,
    beforeBridgeCount: 135, afterBridgeCount: 139 },
  includeRuntimeActiveState: true,
  persistActiveBatchPhase: true,
  includeDetailedStatePerformanceGates: true,
  behaviorPhases: ["classic-baseline", "temporary-esm-parity", "post-cutover-esm"],
  compatibilityPhases: ["pre-build-fixture", "temporary-esm-parity", "post-build-runtime"],
  scmCheckpointRequired: true,
  sourceReleaseTag: "v0.24.57",
  bridgeReason: "Preserve the exact Equipment domain consumers until their legacy symbols are removed.",
  rollbackRule: "restore-only-batch-021-delta-and-keep-batches-001-through-020",
  consumerSetSource: "stage-3.21.0-live-observation-and-frozen-consumer-set",
  operationIds: ["verify-frozen-evidence", "open-batch-021", "create-two-named-esm-targets",
    "render-six-candidate-activation-shims", "project-four-consumer-bridges",
    "project-candidate-manifest", "validate-candidate-and-commit-atomic-cutover",
    "validate-identity-timing-state-and-behavior", "persist-and-reconcile-observations",
    "run-full-acceptance", "close-release-0.24.58"],
}).value;

const BATCH_021_PREFLIGHT_PROFILE = new StageThreeBatchPreflightProfile({
  schemaVersion: 1,
  stageLabel: "Stage 3.21.0",
  artifactKind: "cyber-fishing-stage-3-batch-preflight-audit",
  batchId: BATCH_021_EXECUTION_PROFILE.batchId,
  sourceReleaseVersion: BATCH_021_EXECUTION_PROFILE.sourceReleaseVersion,
  executionProfile: BATCH_021_EXECUTION_PROFILE,
  sideEffectEvidence: { path: "architecture/migration/stage_3_batch_021_side_effect_review.json",
    sha256: "33fa5682680b4a179e3dbc4c04c80cbf8c1b8ad67776056b68fb6b6487ae6f13" },
  reviewedContracts: {
    [autoRefill]: contract({
      instanceFields: ["#autoBait", "#autoChum", "#settings", "#signatures"],
      publicStateShape: ["autoBait", "autoChum"],
      semanticRisk: "auto-refill-trigger-scope-tables-settings-memory-and-scope-resolution",
      performanceClassification: "existing-auto-refill-policy-resolution",
      callSiteEvidence: [{ path: "src/application/inventory/inventory_v2_composition_root.js",
        marker: "new AutoRefillSettings(snapshot.settings)" }],
      allocationBaseline: allocation(7, 6, 2, 6),
      stateIdentityReview: { className: "AutoRefillMemory", collections: [
        { owner: "AutoRefillMemory#signatures", field: "#signatures", scope: "instance",
          collection: "Map", allowedOperations: ["delete", "get", "iterate", "set"] },
      ] },
      frozenConstants: {
        classNames: ["AutoRefillSettings", "AutoRefillMemory", "AutoRefillPolicy"],
        bindings: {
          AutoRefillTrigger: { location: "1:27", values: { ROD_RETRIEVED: "rod-retrieved",
            HAND_CHUM_USED: "hand-chum-used", BOAT_RETURNED: "boat-returned" } },
          AutoRefillScope: { location: "7:25", values: { TACKLE_BAIT: "tackle-bait",
            TACKLE_CHUM: "tackle-chum", HAND_CHUM: "hand-chum", BOAT_CHUM: "boat-chum" } },
        },
      },
    }),
    [exactItem]: contract({
      instanceFields: ["#ignoredKeys"],
      semanticRisk: "exact-item-signature-ignored-keys-canonicalization-and-deep-freeze",
      performanceClassification: "existing-exact-item-signature",
      callSiteEvidence: [{ path: "src/application/inventory/auto_refill_coordinator.js",
        marker: "new ExactItemSignaturePolicy()" }],
      allocationBaseline: allocation(3, 1, 2, 1),
      stateIdentityReview: { className: "ExactItemSignaturePolicy", collections: [
        { owner: "ExactItemSignaturePolicy.ignoredKeys", field: "#ignoredKeys", scope: "static",
          collection: "Set", allowedOperations: ["has"] },
      ] },
      privateStaticSets: { className: "ExactItemSignaturePolicy", bindings: {
        "#ignoredKeys": { location: "2:25",
          values: ["instanceId", "quantity", "location", "buildId", "progression", "ratingPercent",
            "progressionLevel", "ratingTier", "normalizedRating", "ratingColor", "ratingGradient",
            "powerPercent", "powerLevel", "normalizedPower", "powerColor", "powerGradient",
            "qualityMax", "capacityPercent", "conditionPercent", "freshness", "freshnessPercent"] },
      } },
    }),
  },
  migrationGates: ["two-exact-source-and-method-shapes", "six-export-identities-and-activations",
    "two-frozen-string-literal-constants", "one-reviewed-private-static-literal-set",
    "two-reviewed-collection-state-identities", "four-exact-consumer-relationships",
    "all-legacy-activation-positions-preserved", "zero-config-platform-browser-dev-dependencies",
    "zero-added-hot-loop-allocations"],
}).value;

module.exports = { BATCH_021_PREFLIGHT_PROFILE, BATCH_021_EXECUTION_PROFILE };
