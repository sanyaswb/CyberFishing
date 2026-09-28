"use strict";

const { StageThreeBatchExecutionProfile } = require("../../../domain_batches/stage_three_batch_execution_profile");
const { StageThreeBatchPreflightProfile } = require("../../../domain_batches/stage_three_batch_preflight_profile");

const allocation = (objectExpressions, arrayExpressions, newExpressions, objectFreezeCalls,
  objectAssignCalls = 0, roundingCalls = 0) => ({ objectExpressions, arrayExpressions,
  newExpressions, objectFreezeCalls, objectAssignCalls, roundingCalls });
const registry = "src/core/assemblies/assembly_profile_registry.js";
const contract = fields => ({ classification: "authoritative-owner", instanceFields: [],
  publicStateShape: [], resultShape: [], stableResultIdentity: false, mutatesCallerInputs: false,
  hotLoopCallSites: [], ...fields });

// Batch 038 completes the Stage 3.36.0 approved prefix: the assembly profile registry, which
// receives its profile table from the composition roots since prerequisite 001.
const EXECUTION_PROFILE = new StageThreeBatchExecutionProfile({
  schemaVersion: 1,
  batchId: "stage-3.replan-336.batch-038-assemblies-d8271d28",
  batchNumber: "038",
  executionStageLabel: "Stage 3.39.1",
  auditStageLabel: "Stage 3.39.0",
  focusedStageId: "stage-3.39.2",
  prebuildStageId: "stage-3.39.3",
  sourceReleaseVersion: "0.24.75",
  targetReleaseVersion: "0.24.76",
  auditPath: "architecture/migration/stage_3_batch_038_audit.json",
  executionPlanPath: "architecture/migration/stage_3_batch_038_execution_plan.json",
  testMatrixPath: "architecture/migration/stage_3_batch_038_test_matrix.json",
  expectedTargetCount: 1,
  expectedExportCount: 1,
  expectedActivationCount: 1,
  expectedConsumerCount: 2,
  expectedDependencyEdgeCount: 0,
  expectedTargets: [
    { currentPath: registry, targetPath: "src/game/domain/assemblies/assembly_profile_registry.js",
      exports: ["AssemblyProfileRegistry"] },
  ],
  continuationPlan: { path: "architecture/migration/stage_3_36_graph_review/approved_prefix.json",
    sha256: "f5b2071225b846440768ad90468855bed202510285727263680327bfd6b287b7" },
  expectedImports: [],
  expectedActivationIds: ["activation-e85348eb50a6"],
  expectedActivationPositions: [151],
  expectedBridgeIds: ["bridge-75d36599542b", "bridge-ec0c2115d440"],
  informationalDocumentsExcluded: true,
  expectedTopology: { beforeProjectModuleCount: 112, afterProjectModuleCount: 113,
    beforeActivationCount: 101, afterActivationCount: 102,
    beforeBridgeCount: 141, afterBridgeCount: 143 },
  includeRuntimeActiveState: true,
  persistActiveBatchPhase: true,
  includeDetailedStatePerformanceGates: true,
  behaviorPhases: ["classic-baseline", "temporary-esm-parity", "post-cutover-esm"],
  compatibilityPhases: ["pre-build-fixture", "temporary-esm-parity", "post-build-runtime"],
  scmCheckpointRequired: true,
  sourceReleaseTag: "v0.24.75",
  bridgeReason: "Preserve the exact assembly profile registry consumers until their legacy symbol is removed.",
  rollbackRule: "restore-only-batch-038-delta-and-keep-batches-001-through-037",
  consumerSetSource: "stage-3.39.0-live-observation-and-stage-3.36-frozen-consumer-set",
  operationIds: ["verify-frozen-evidence", "open-batch-038",
    "create-one-named-esm-target", "render-one-candidate-activation-shim",
    "project-two-consumer-bridges", "project-candidate-manifest",
    "validate-candidate-and-commit-atomic-cutover", "validate-identity-timing-state-and-behavior",
    "persist-and-reconcile-observations", "run-full-acceptance", "close-release-0.24.76"],
}).value;

const PREFLIGHT_PROFILE = new StageThreeBatchPreflightProfile({
  schemaVersion: 1,
  stageLabel: "Stage 3.39.0",
  artifactKind: "cyber-fishing-stage-3-batch-preflight-audit",
  batchId: EXECUTION_PROFILE.batchId,
  sourceReleaseVersion: EXECUTION_PROFILE.sourceReleaseVersion,
  executionProfile: EXECUTION_PROFILE,
  sideEffectEvidence: { path: "architecture/migration/stage_3_batch_038_side_effect_review.json",
    sha256: "af985ed91fcb86804e408f0fc77457be314e36e6e3d24d7539896d023608d8f5" },
  reviewedContracts: {
    [registry]: contract({
      instanceFields: ["#itemDefinitionResolver", "#profileIdByFallbackType", "#profiles"],
      semanticRisk: "assembly-profile-registry-maps-over-the-injected-profile-table",
      performanceClassification: "existing-assembly-profile-registry",
      callSiteEvidence: [
        { path: "src/application/inventory/inventory_v2_composition_root.js", marker: "new AssemblyProfileRegistry(" },
        { path: "src/infrastructure/storage/inventory_v2_legacy_migration.js", marker: "new AssemblyProfileRegistry(" },
      ],
      allocationBaseline: allocation(7, 10, 8, 6),
      stateIdentityReview: { className: "AssemblyProfileRegistry", collections: [
        { owner: "AssemblyProfileRegistry#profileIdByFallbackType", field: "#profileIdByFallbackType", scope: "instance",
          collection: "Map", allowedOperations: ["get", "has", "set"] },
        { owner: "AssemblyProfileRegistry#profiles", field: "#profiles", scope: "instance", collection: "Map",
          allowedOperations: ["get", "has", "set"] },
      ] },
    }),
  },
  migrationGates: ["one-exact-source-and-method-shape", "one-export-identity-and-activation",
    "two-registry-collection-identities", "two-exact-consumer-relationships",
    "all-legacy-activation-positions-preserved", "zero-config-platform-browser-dev-dependencies",
    "zero-added-hot-loop-allocations"],
}).value;

const RELEASE = Object.freeze({
  title: "Assemblies Profile Registry Domain",
  codename: "assemblies-profile-registry-domain",
  summary: "Batch 038 migrated AssemblyProfileRegistry, completing the Stage 3.36.0 approved prefix.",
  smokeContext: "Automated substitute per the owner's 2026-09-27 authorization: game-cycle loop re-executed without seals and a built-in-browser load of the game (kits, assembly profile slots, save/reload) with screenshots and console counts.",
  notes: [
    "Migrate the assembly profile registry",
    "Keep the profile table injected by the composition roots",
    "Complete the Stage 3.36.0 approved prefix",
    "Preserve one hundred thirteen project modules, one hundred two activations and one hundred forty-three bridges",
  ],
  changelog: [
    "- Completed batch 038, the last batch of the Stage 3.36.0 approved prefix: AssemblyProfileRegistry as a named ESM export; its profile table stays injected by the composition roots.",
    "- Extended the cumulative graph from 112 to 113 project modules and from 101 to 102 activation contracts, with 143 exact bridge relationships (2 added).",
    "- The next task is the Vector2 extraction and the responsibility decompositions, followed by another repeated graph review.",
  ],
});

module.exports = { PREFLIGHT_PROFILE, RELEASE };
