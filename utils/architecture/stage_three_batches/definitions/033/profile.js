"use strict";

const { StageThreeBatchExecutionProfile } = require("../../../domain_batches/stage_three_batch_execution_profile");
const { StageThreeBatchPreflightProfile } = require("../../../domain_batches/stage_three_batch_preflight_profile");

const allocation = (objectExpressions, arrayExpressions, newExpressions, objectFreezeCalls,
  objectAssignCalls = 0, roundingCalls = 0) => ({ objectExpressions, arrayExpressions,
  newExpressions, objectFreezeCalls, objectAssignCalls, roundingCalls });
const repository = "src/core/assemblies/assembly_state_repository.js";
const imported = name => ({ consumer: repository, from: "src/game/domain/assemblies/assembly_state.js",
  exportName: name, legacySymbol: name, viaShim: "src/core/assemblies/assembly_state.js",
  activationId: name === "AssemblyState" ? "activation-97cede2d09c5" : "activation-b3d160e2af4c" });
const contract = fields => ({ classification: "authoritative-owner", instanceFields: [],
  publicStateShape: [], resultShape: [], stableResultIdentity: false, mutatesCallerInputs: false,
  hotLoopCallSites: [], ...fields });

// Batch 033 is the first batch of the Stage 3.34.0 review-queue freeze extension: the assembly
// state repository, whose authoritative #states Map is proven by the atomic local replacement
// rule (restoreSnapshot) and whose AssemblyState instances are owner-created reviewed imports. It
// was the last classic reader of AssemblyState and AssemblyPreparationStatus: both activations retire.
const EXECUTION_PROFILE = new StageThreeBatchExecutionProfile({
  schemaVersion: 1,
  batchId: "stage-3.replan-322.batch-033-assemblies-3cd39292",
  batchNumber: "033",
  executionStageLabel: "Stage 3.34.1",
  auditStageLabel: "Stage 3.34.0",
  focusedStageId: "stage-3.34.2",
  prebuildStageId: "stage-3.34.3",
  sourceReleaseVersion: "0.24.70",
  targetReleaseVersion: "0.24.71",
  auditPath: "architecture/migration/stage_3_batch_033_audit.json",
  executionPlanPath: "architecture/migration/stage_3_batch_033_execution_plan.json",
  testMatrixPath: "architecture/migration/stage_3_batch_033_test_matrix.json",
  expectedTargetCount: 1,
  expectedExportCount: 1,
  expectedActivationCount: 1,
  expectedConsumerCount: 2,
  expectedDependencyEdgeCount: 0,
  expectedTargets: [
    { currentPath: repository, targetPath: "src/game/domain/assemblies/assembly_state_repository.js",
      exports: ["AssemblyStateRepository"] },
  ],
  continuationPlan: { path: "architecture/migration/stage_3_34_review_queue/freeze_extension.json",
    sha256: "5142dcb02f3b9936654440fbf804f66e4e47daff46acca18ce222d22a8ecba00" },
  expectedImports: [imported("AssemblyPreparationStatus"), imported("AssemblyState")],
  expectedActivationIds: ["activation-d5bf762477bb"],
  expectedActivationPositions: [150],
  expectedBridgeIds: ["bridge-32071390ea55", "bridge-a7b5464bce7f"],
  informationalDocumentsExcluded: true,
  expectedRetiredActivationIds: ["activation-97cede2d09c5", "activation-b3d160e2af4c"],
  expectedRetiredBridgeIds: ["bridge-afb1d1b1fb1e"],
  expectedTopology: { beforeProjectModuleCount: 99, afterProjectModuleCount: 100,
    beforeActivationCount: 96, afterActivationCount: 95,
    beforeBridgeCount: 139, afterBridgeCount: 140 },
  includeRuntimeActiveState: true,
  persistActiveBatchPhase: true,
  includeDetailedStatePerformanceGates: true,
  behaviorPhases: ["classic-baseline", "temporary-esm-parity", "post-cutover-esm"],
  compatibilityPhases: ["pre-build-fixture", "temporary-esm-parity", "post-build-runtime"],
  scmCheckpointRequired: true,
  sourceReleaseTag: "v0.24.70",
  bridgeReason: "Preserve the exact assembly state repository consumers until their legacy symbol is removed.",
  rollbackRule: "restore-only-batch-033-delta-and-keep-batches-001-through-032",
  consumerSetSource: "stage-3.34.0-live-observation-and-stage-3.22-frozen-consumer-set",
  operationIds: ["verify-frozen-evidence", "adopt-review-queue-freeze-extension-and-open-batch-033",
    "create-one-named-esm-target-with-two-prefix-imports", "render-one-candidate-activation-shim",
    "project-two-consumer-bridges-and-retire-one", "project-candidate-manifest",
    "validate-candidate-and-commit-atomic-cutover", "validate-identity-timing-state-and-behavior",
    "persist-and-reconcile-observations", "run-full-acceptance", "close-release-0.24.71"],
}).value;

const PREFLIGHT_PROFILE = new StageThreeBatchPreflightProfile({
  schemaVersion: 1,
  stageLabel: "Stage 3.34.0",
  artifactKind: "cyber-fishing-stage-3-batch-preflight-audit",
  batchId: EXECUTION_PROFILE.batchId,
  sourceReleaseVersion: EXECUTION_PROFILE.sourceReleaseVersion,
  executionProfile: EXECUTION_PROFILE,
  sideEffectEvidence: { path: "architecture/migration/stage_3_batch_033_side_effect_review.json",
    sha256: "f1aed41d5054f72bee97dd62cd33d5c0fd28e82816e3de61a83e78c62b548d4d" },
  reviewedContracts: {
    [repository]: contract({
      instanceFields: ["#states"],
      semanticRisk: "authoritative-assembly-state-map-with-atomic-snapshot-restore-and-owner-created-states",
      performanceClassification: "existing-assembly-state-repository",
      callSiteEvidence: [
        { path: "src/application/inventory/inventory_v2_composition_root.js", marker: "new AssemblyStateRepository({" },
        { path: "src/infrastructure/storage/inventory_v2_legacy_migration.js", marker: "new AssemblyStateRepository()" },
      ],
      allocationBaseline: allocation(4, 3, 9, 0),
      stateIdentityReview: { className: "AssemblyStateRepository", collections: [
        { owner: "AssemblyStateRepository#states", field: "#states", scope: "instance", collection: "Map",
          allowedOperations: ["delete", "get", "has", "set", "values"], replacement: "atomic-local" },
      ] },
      compositionIdentityReview: true,
    }),
  },
  migrationGates: ["one-exact-source-and-method-shape", "one-export-identity-and-activation",
    "two-exact-completed-prefix-imports", "four-owner-created-composition-identities",
    "one-collection-identity-with-atomic-local-replacement", "two-exact-consumer-relationships-and-one-retired-bridge",
    "two-retired-activations", "all-legacy-activation-positions-preserved", "zero-config-platform-browser-dev-dependencies",
    "zero-added-hot-loop-allocations"],
}).value;

const RELEASE = Object.freeze({
  title: "Assemblies Assembly State Repository Domain",
  codename: "assemblies-assembly-state-repository-domain",
  summary: "Batch 033 adopted the Stage 3.34.0 review-queue freeze extension and migrated AssemblyStateRepository.",
  smokeContext: "Automated substitute per the owner's 2026-09-27 authorization: game-cycle loop re-executed without seals and a built-in-browser load of the game (inventory kits, assembly preparation and save/reload) with screenshots and console counts.",
  notes: [
    "Adopt the Stage 3.34.0 review-queue freeze extension (batches 033 and 034)",
    "Migrate the assembly state repository",
    "Prove the authoritative #states Map with the atomic local replacement rule",
    "Import AssemblyState and AssemblyPreparationStatus from the completed prefix",
    "Retire the AssemblyState and AssemblyPreparationStatus activations as inert classic placeholders",
    "Preserve one hundred project modules, ninety-five activations and one hundred forty bridges",
  ],
  changelog: [
    "- Stage 3.34.0 review-queue freeze: collection-identity evidence (AssemblyStateRepository#states, atomic local replacement and a persistence round trip) and hot-loop evidence (six fishing modules: static member review and traced game-cycle fight scenarios) froze batches 033 and 034 as an extension of the Stage 3.22 approved prefix.",
    "- Completed batch 033: AssemblyStateRepository as a named ESM export with two reviewed completed-prefix imports (AssemblyState, AssemblyPreparationStatus) and four owner-created composition identities.",
    "- Retired the AssemblyState and AssemblyPreparationStatus activations as inert classic placeholders (no classic reader remains).",
    "- Extended the cumulative graph from 99 to 100 project modules and from 96 to 95 activation contracts, with 140 exact bridge relationships (2 added, 1 retired).",
    "- The next task is batch 034 preflight (hot-loop fishing modules against the recorded game-cycle traces).",
  ],
});

module.exports = { PREFLIGHT_PROFILE, RELEASE };
