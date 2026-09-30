"use strict";

const { StageThreeBatchExecutionProfile } = require("../../../domain_batches/stage_three_batch_execution_profile");
const { StageThreeBatchPreflightProfile } = require("../../../domain_batches/stage_three_batch_preflight_profile");

const allocation = (objectExpressions, arrayExpressions, newExpressions, objectFreezeCalls,
  objectAssignCalls = 0, roundingCalls = 0) => ({ objectExpressions, arrayExpressions,
  newExpressions, objectFreezeCalls, objectAssignCalls, roundingCalls });
const landing = "src/core/fishing/landing_policy.js";
const contract = fields => ({ classification: "authoritative-owner", instanceFields: [],
  publicStateShape: [], resultShape: [], stableResultIdentity: false, mutatesCallerInputs: false,
  hotLoopCallSites: [], ...fields });

// Batch 041 opens the Stage 3.42.0 replacement suffix after prerequisite 030. The landing policy
// source is effect-free apart from its pure top-level function resolveFightPhysicsConfig (reviewed
// topLevelFunctions shape: exported beside the classes; retrieve_policy.js reads it through its
// activation until batch 046). LandingPolicyResolver defaults to the reel and pole policies of the
// same source (reviewed localCompositions), which resolves the frozen constructor-injection-boundary
// prerequisite without a cross-module composition.
const EXECUTION_PROFILE = new StageThreeBatchExecutionProfile({
  schemaVersion: 1,
  batchId: "stage-3.replan-342.batch-041-fishing-71e662d7",
  batchNumber: "041",
  executionStageLabel: "Stage 3.42.1",
  auditStageLabel: "Stage 3.42.0",
  focusedStageId: "stage-3.42.2",
  prebuildStageId: "stage-3.42.3",
  sourceReleaseVersion: "0.24.78",
  targetReleaseVersion: "0.24.79",
  auditPath: "architecture/migration/stage_3_batch_041_audit.json",
  executionPlanPath: "architecture/migration/stage_3_batch_041_execution_plan.json",
  testMatrixPath: "architecture/migration/stage_3_batch_041_test_matrix.json",
  expectedTargetCount: 1,
  expectedExportCount: 5,
  expectedActivationCount: 2,
  expectedConsumerCount: 5,
  expectedDependencyEdgeCount: 0,
  expectedTargets: [
    { currentPath: landing, targetPath: "src/game/domain/fishing/landing_policy.js",
      exports: ["LandingPolicy", "LandingPolicyResolver", "PoleLandingPolicy", "ReelLandingPolicy",
        "resolveFightPhysicsConfig"] },
  ],
  continuationPlan: { path: "architecture/migration/stage_3_42_graph_review/approved_prefix.json",
    sha256: "dcf3aa4db2927dec3a84658c0f25d1e845339d8d8f71f65c3eb6a05b9f482c8c" },
  expectedImports: [],
  expectedActivationIds: ["activation-2fc19b0cf09b", "activation-cdf4b15936e1"],
  expectedActivationPositions: [120, 120],
  expectedBridgeIds: ["bridge-0f4da996fde3", "bridge-72ec98688ff1", "bridge-dd0df8ff0363",
    "bridge-de699c628b92", "bridge-ff82838dfd66"],
  expectedRetiredActivationIds: [],
  expectedRetiredBridgeIds: [],
  informationalDocumentsExcluded: true,
  expectedTopology: { beforeProjectModuleCount: 123, afterProjectModuleCount: 124,
    beforeActivationCount: 116, afterActivationCount: 118,
    beforeBridgeCount: 176, afterBridgeCount: 181 },
  includeRuntimeActiveState: true,
  persistActiveBatchPhase: true,
  includeDetailedStatePerformanceGates: true,
  behaviorPhases: ["classic-baseline", "temporary-esm-parity", "post-cutover-esm"],
  compatibilityPhases: ["pre-build-fixture", "temporary-esm-parity", "post-build-runtime"],
  scmCheckpointRequired: true,
  sourceReleaseTag: "v0.24.78",
  bridgeReason: "Preserve the exact landing resolver consumers and the retrieve-policy helper reader until their legacy symbols are removed.",
  rollbackRule: "restore-only-batch-041-delta-and-keep-batches-001-through-040",
  consumerSetSource: "stage-3.42.0-live-observation-and-stage-3.42-frozen-consumer-set",
  operationIds: ["verify-frozen-evidence", "adopt-stage-3.42-replacement-prefix-and-open-batch-041",
    "create-one-named-esm-target-with-five-exports", "render-two-candidate-activation-shims",
    "project-five-consumer-bridges", "project-candidate-manifest",
    "validate-candidate-and-commit-atomic-cutover", "validate-identity-timing-state-and-behavior",
    "persist-and-reconcile-observations", "run-full-acceptance", "close-release-0.24.79"],
}).value;

const PREFLIGHT_PROFILE = new StageThreeBatchPreflightProfile({
  schemaVersion: 1,
  stageLabel: "Stage 3.42.0",
  artifactKind: "cyber-fishing-stage-3-batch-preflight-audit",
  batchId: EXECUTION_PROFILE.batchId,
  sourceReleaseVersion: EXECUTION_PROFILE.sourceReleaseVersion,
  executionProfile: EXECUTION_PROFILE,
  sideEffectEvidence: { path: "architecture/migration/stage_3_batch_041_side_effect_review.json",
    sha256: "20444384c2eb623b3c027f5c7bb43091665e396b2796250ac9017f3b487df51d" },
  reviewedContracts: {
    [landing]: contract({
      topLevelFunctions: ["resolveFightPhysicsConfig"],
      localCompositions: ["PoleLandingPolicy", "ReelLandingPolicy"],
      semanticRisk: "reel-and-pole-landing-distance-over-live-catch-zone-config-and-rod-length",
      performanceClassification: "existing-landing-policy",
      callSiteEvidence: [{ path: "src/app/bootstrap.js", marker: "new LandingPolicyResolver()" },
        { path: "src/systems/fight_physics_system.js", marker: "new LandingPolicyResolver()" }],
      allocationBaseline: allocation(11, 0, 3, 0),
    }),
  },
  migrationGates: ["one-exact-source-and-method-shapes", "five-export-identities-and-two-activations",
    "reviewed-pure-top-level-function-exported-and-activated", "reviewed-local-default-compositions",
    "five-exact-consumer-relationships", "all-legacy-activation-positions-preserved",
    "zero-config-platform-browser-dev-dependencies", "zero-added-hot-loop-allocations"],
}).value;

const RELEASE = Object.freeze({
  title: "Landing Policy Domain",
  codename: "landing-policy-domain",
  summary: "Batch 041 adopted the Stage 3.42.0 replacement prefix and migrated the landing policy family to the fishing Domain.",
  smokeContext: "Automated browser smoke under the owner's 2026-09-30 authorization: game-cycle re-executed without seals, game loaded in the browser, and console errors and warnings counted.",
  notes: [
    "Adopt the Stage 3.42.0 replacement prefix",
    "Migrate the reel and pole landing policies and their resolver",
    "Export and activate the pure resolveFightPhysicsConfig helper that the retrieve policies read",
    "Preserve one hundred twenty-four project modules, one hundred eighteen active activations and one hundred eighty-one bridges",
  ],
  changelog: [
    "- Adopted the Stage 3.42.0 replacement suffix after the duplicate-helper removal and migrated the landing policy source with five named ESM exports.",
    "- Added five exact classic consumer bridges for LandingPolicyResolver and the resolveFightPhysicsConfig helper.",
    "- Extended the cumulative runtime from 123 to 124 project modules and the active activation set from 116 to 118 contracts, with 181 exact bridge relationships.",
    "- The next task is batch 042 preflight.",
  ],
});

module.exports = { PREFLIGHT_PROFILE, RELEASE };
