"use strict";

const { StageThreeBatchExecutionProfile } = require("./stage_three_batch_execution_profile");
const { StageThreeBatchPreflightProfile } = require("./stage_three_batch_preflight_profile");

const allocation = (objectExpressions, arrayExpressions, newExpressions, objectFreezeCalls,
  objectAssignCalls = 0, roundingCalls = 0) => ({ objectExpressions, arrayExpressions,
  newExpressions, objectFreezeCalls, objectAssignCalls, roundingCalls });
const domain = "src/game/domain/assemblies/";
const refill = "src/application/inventory/refill_compatible_signature_policy.js";
const state = "src/core/assemblies/assembly_state.js";
const exact = "src/core/assemblies/exact_assembly_refill_signature_policy.js";
const contract = fields => ({ classification: "authoritative-owner", instanceFields: [],
  publicStateShape: [], resultShape: [], stableResultIdentity: false, mutatesCallerInputs: false,
  hotLoopCallSites: [], ...fields });

const BATCH_020_EXECUTION_PROFILE = new StageThreeBatchExecutionProfile({
  schemaVersion: 1,
  batchId: "stage-3.candidate-020-assemblies-43d77861",
  batchNumber: "020",
  executionStageLabel: "Stage 3.20.1",
  auditStageLabel: "Stage 3.20.0",
  focusedStageId: "stage-3.20.2",
  prebuildStageId: "stage-3.20.3",
  sourceReleaseVersion: "0.24.56",
  targetReleaseVersion: "0.24.57",
  auditPath: "architecture/migration/stage_3_batch_020_audit.json",
  executionPlanPath: "architecture/migration/stage_3_batch_020_execution_plan.json",
  testMatrixPath: "architecture/migration/stage_3_batch_020_test_matrix.json",
  expectedTargetCount: 3,
  expectedExportCount: 4,
  expectedActivationCount: 4,
  expectedConsumerCount: 5,
  expectedDependencyEdgeCount: 0,
  expectedTargets: [
    { currentPath: refill, targetPath: domain + "refill_compatible_signature_policy.js",
      exports: ["RefillCompatibleSignaturePolicy"] },
    { currentPath: state, targetPath: domain + "assembly_state.js",
      exports: ["AssemblyPreparationStatus", "AssemblyState"] },
    { currentPath: exact, targetPath: domain + "exact_assembly_refill_signature_policy.js",
      exports: ["ExactAssemblyRefillSignaturePolicy"] },
  ],
  expectedActivationIds: ["activation-28ccfbfa82e2", "activation-73dd5c8cd351",
    "activation-97cede2d09c5", "activation-b3d160e2af4c"],
  expectedActivationPositions: [149, 149, 155, 188],
  expectedBridgeIds: ["bridge-18e896f28aa4", "bridge-65a33fea8e4f", "bridge-a7acd7dabc86",
    "bridge-afb1d1b1fb1e", "bridge-e01af933a4a4"],
  expectedTopology: { beforeProjectModuleCount: 73, afterProjectModuleCount: 76,
    beforeActivationCount: 77, afterActivationCount: 81,
    beforeBridgeCount: 130, afterBridgeCount: 135 },
  includeRuntimeActiveState: true,
  persistActiveBatchPhase: true,
  includeDetailedStatePerformanceGates: true,
  behaviorPhases: ["classic-baseline", "temporary-esm-parity", "post-cutover-esm"],
  compatibilityPhases: ["pre-build-fixture", "temporary-esm-parity", "post-build-runtime"],
  scmCheckpointRequired: true,
  sourceReleaseTag: "v0.24.56",
  bridgeReason: "Preserve the exact Assemblies domain consumers until their legacy symbols are removed.",
  rollbackRule: "restore-only-batch-020-delta-and-keep-batches-001-through-019",
  consumerSetSource: "stage-3.20.0-live-observation-and-frozen-consumer-set",
  operationIds: ["verify-frozen-evidence", "open-batch-020", "create-three-named-esm-targets",
    "render-four-candidate-activation-shims", "project-five-consumer-bridges",
    "project-candidate-manifest", "validate-candidate-and-commit-atomic-cutover",
    "validate-identity-timing-state-and-behavior", "persist-and-reconcile-observations",
    "run-full-acceptance", "close-release-0.24.57"],
}).value;

const BATCH_020_PREFLIGHT_PROFILE = new StageThreeBatchPreflightProfile({
  schemaVersion: 1,
  stageLabel: "Stage 3.20.0",
  artifactKind: "cyber-fishing-stage-3-batch-preflight-audit",
  batchId: BATCH_020_EXECUTION_PROFILE.batchId,
  sourceReleaseVersion: BATCH_020_EXECUTION_PROFILE.sourceReleaseVersion,
  executionProfile: BATCH_020_EXECUTION_PROFILE,
  sideEffectEvidence: { path: "architecture/migration/stage_3_batch_020_side_effect_review.json",
    sha256: "f592997a611cea93ac9ecf1ddb213b227a3885f5915dede120554c7b7f4bc681" },
  reviewedContracts: {
    [refill]: contract({
      instanceFields: ["#ignoredKeys"],
      semanticRisk: "refill-compatible-signature-ignored-keys-canonical-clone-freeze-and-global-exposure",
      performanceClassification: "existing-refill-compatible-signature",
      callSiteEvidence: [{ path: "src/application/inventory/inventory_v2_composition_root.js",
        marker: "new RefillCompatibleSignaturePolicy()" }],
      allocationBaseline: allocation(3, 2, 2, 1),
      legacyExposure: { symbol: "RefillCompatibleSignaturePolicy", location: "55:1",
        mechanism: "global-this-property" },
      stateIdentityReview: { className: "RefillCompatibleSignaturePolicy", collections: [
        { owner: "RefillCompatibleSignaturePolicy.ignoredKeys", field: "#ignoredKeys", scope: "static",
          collection: "Set", allowedOperations: ["has"] },
      ] },
      privateStaticSets: { className: "RefillCompatibleSignaturePolicy", bindings: {
        "#ignoredKeys": { location: "2:25",
          values: ["instanceId", "quantity", "location", "buildId", "freshnessState"] },
      } },
    }),
    [state]: contract({
      instanceFields: ["#profileId", "#refillSignatures", "#rootInstanceId", "#status"],
      publicStateShape: ["isDraft", "isPrepared", "profileId", "rootInstanceId", "status"],
      semanticRisk: "assembly-preparation-status-table-mutable-refill-signature-map-and-snapshots",
      performanceClassification: "existing-assembly-state-lifecycle",
      callSiteEvidence: [{ path: "src/core/assemblies/assembly_state_repository.js",
        marker: "new AssemblyState(snapshot)" }],
      allocationBaseline: allocation(5, 4, 5, 0),
      stateIdentityReview: { className: "AssemblyState", collections: [
        { owner: "AssemblyState#refillSignatures", field: "#refillSignatures", scope: "instance",
          collection: "Map", allowedOperations: ["delete", "entries", "get", "keys", "set"] },
      ] },
      frozenConstants: { className: "AssemblyState", bindings: {
        AssemblyPreparationStatus: { location: "1:35", values: { DRAFT: "DRAFT", PREPARED: "PREPARED" } },
      } },
    }),
    [exact]: contract({
      instanceFields: ["#ignoredKeys"],
      semanticRisk: "exact-assembly-refill-signature-ignored-keys-deep-freeze-and-stable-serialization",
      performanceClassification: "existing-exact-assembly-refill-signature",
      callSiteEvidence: [{ path: "src/core/assemblies/item_assembly_service.js",
        marker: "new ExactAssemblyRefillSignaturePolicy()" }],
      allocationBaseline: allocation(3, 2, 2, 1),
      stateIdentityReview: { className: "ExactAssemblyRefillSignaturePolicy", collections: [
        { owner: "ExactAssemblyRefillSignaturePolicy.ignoredKeys", field: "#ignoredKeys", scope: "static",
          collection: "Set", allowedOperations: ["has"] },
      ] },
      privateStaticSets: { className: "ExactAssemblyRefillSignaturePolicy", bindings: {
        "#ignoredKeys": { location: "2:25",
          values: ["instanceId", "quantity", "location", "buildId", "progression", "ratingPercent",
            "progressionLevel", "ratingTier", "normalizedRating", "ratingColor", "ratingGradient",
            "powerPercent", "powerLevel", "normalizedPower", "powerColor", "powerGradient",
            "qualityMax", "capacityPercent", "conditionPercent", "freshness", "freshnessPercent"] },
      } },
    }),
  },
  migrationGates: ["three-exact-source-and-method-shapes", "four-export-identities-and-activations",
    "two-reviewed-private-static-literal-sets", "one-frozen-string-literal-constant",
    "one-reviewed-global-this-class-exposure", "five-exact-consumer-relationships",
    "all-legacy-activation-positions-preserved", "zero-config-platform-browser-dev-dependencies",
    "zero-added-hot-loop-allocations"],
}).value;

module.exports = { BATCH_020_PREFLIGHT_PROFILE, BATCH_020_EXECUTION_PROFILE };
