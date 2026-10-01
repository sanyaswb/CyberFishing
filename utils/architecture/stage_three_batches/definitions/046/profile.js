"use strict";

const { StageThreeBatchExecutionProfile } = require("../../../domain_batches/stage_three_batch_execution_profile");
const { StageThreeBatchPreflightProfile } = require("../../../domain_batches/stage_three_batch_preflight_profile");

const allocation = (objectExpressions, arrayExpressions, newExpressions, objectFreezeCalls,
  objectAssignCalls = 0, roundingCalls = 0) => ({ objectExpressions, arrayExpressions,
  newExpressions, objectFreezeCalls, objectAssignCalls, roundingCalls });
const retrieve = "src/core/fishing/retrieve_policy.js";
const states = "src/app/states.js";
const contract = fields => ({ classification: "authoritative-owner", instanceFields: [],
  publicStateShape: [], resultShape: [], stableResultIdentity: false, mutatesCallerInputs: false,
  hotLoopCallSites: [], ...fields });

// Batch 046 migrates the idle retrieve policies: the base policy, the passive lure and pole idle
// policies and the resolver that picks one by the usable reel. The resolver composes its two default
// policies inside the same module. The policies read the fight physics config through
// resolveFightPhysicsConfig of the batch 041 landing policy module (one earlier-batch import); that
// activation loses its only classic reader and retires as a shared-source line removal while the
// landing policy shim keeps LandingPolicyResolver. Risk level B (frozen plan: no performance gate):
// the retrieving state calls resolve and getRetrieveParams every frame while the player pulls, so the
// call site is recorded and the target must stay representation-only (allocation sites unchanged).
const EXECUTION_PROFILE = new StageThreeBatchExecutionProfile({
  schemaVersion: 1,
  batchId: "stage-3.replan-342.batch-046-fishing-9a1447c2",
  batchNumber: "046",
  executionStageLabel: "Stage 3.47.1",
  auditStageLabel: "Stage 3.47.0",
  focusedStageId: "stage-3.47.2",
  prebuildStageId: "stage-3.47.3",
  sourceReleaseVersion: "0.24.83",
  targetReleaseVersion: "0.24.84",
  auditPath: "architecture/migration/stage_3_batch_046_audit.json",
  executionPlanPath: "architecture/migration/stage_3_batch_046_execution_plan.json",
  testMatrixPath: "architecture/migration/stage_3_batch_046_test_matrix.json",
  expectedTargetCount: 1,
  expectedExportCount: 4,
  expectedActivationCount: 1,
  expectedConsumerCount: 1,
  expectedDependencyEdgeCount: 0,
  expectedTargets: [
    { currentPath: retrieve, targetPath: "src/game/domain/fishing/retrieve_policy.js",
      exports: ["IdleRetrievePolicyResolver", "PassiveLureRetrievePolicy", "PoleIdleRetrievePolicy", "RetrievePolicy"] },
  ],
  continuationPlan: { path: "architecture/migration/stage_3_42_graph_review/approved_prefix.json",
    sha256: "dcf3aa4db2927dec3a84658c0f25d1e845339d8d8f71f65c3eb6a05b9f482c8c" },
  expectedImports: [
    { consumer: retrieve, from: "src/game/domain/fishing/landing_policy.js", exportName: "resolveFightPhysicsConfig",
      legacySymbol: "resolveFightPhysicsConfig", viaShim: "src/core/fishing/landing_policy.js",
      activationId: "activation-cdf4b15936e1" },
  ],
  expectedActivationIds: ["activation-873455999edb"],
  expectedActivationPositions: [121],
  expectedBridgeIds: ["bridge-d874102f2cc0"],
  expectedRetiredActivationIds: ["activation-cdf4b15936e1"],
  expectedRetiredBridgeIds: ["bridge-72ec98688ff1"],
  informationalDocumentsExcluded: true,
  expectedTopology: { beforeProjectModuleCount: 134, afterProjectModuleCount: 135,
    beforeActivationCount: 126, afterActivationCount: 126,
    beforeBridgeCount: 201, afterBridgeCount: 201 },
  includeRuntimeActiveState: true,
  persistActiveBatchPhase: true,
  includeDetailedStatePerformanceGates: true,
  behaviorPhases: ["classic-baseline", "temporary-esm-parity", "post-cutover-esm"],
  compatibilityPhases: ["pre-build-fixture", "temporary-esm-parity", "post-build-runtime"],
  scmCheckpointRequired: true,
  sourceReleaseTag: "v0.24.83",
  bridgeReason: "Preserve the exact idle retrieve policy resolver consumer until its legacy symbol is removed.",
  rollbackRule: "restore-only-batch-046-delta-and-keep-batches-001-through-045",
  consumerSetSource: "stage-3.42.0-live-observation-and-stage-3.42-frozen-consumer-set",
  operationIds: ["verify-frozen-evidence", "open-batch-046",
    "create-one-named-esm-target-with-four-exports", "render-one-candidate-activation-shim",
    "project-one-consumer-bridge-and-retire-one", "project-candidate-manifest",
    "validate-candidate-and-commit-atomic-cutover", "validate-identity-timing-state-and-behavior",
    "persist-and-reconcile-observations", "run-full-acceptance", "close-release-0.24.84"],
}).value;

const PREFLIGHT_PROFILE = new StageThreeBatchPreflightProfile({
  schemaVersion: 1,
  stageLabel: "Stage 3.47.0",
  artifactKind: "cyber-fishing-stage-3-batch-preflight-audit",
  batchId: EXECUTION_PROFILE.batchId,
  sourceReleaseVersion: EXECUTION_PROFILE.sourceReleaseVersion,
  executionProfile: EXECUTION_PROFILE,
  sideEffectEvidence: { path: "architecture/migration/stage_3_batch_046_side_effect_review.json",
    sha256: "82d508ffdd0a23538a1dccf8df190c80c6008e60e7c2fc36240558f24af77e5c" },
  reviewedContracts: {
    [retrieve]: contract({
      localCompositions: ["PassiveLureRetrievePolicy", "PoleIdleRetrievePolicy"],
      semanticRisk: "per-frame-idle-retrieve-policy-selection-with-fresh-parameter-objects-and-config-fallbacks",
      performanceClassification: "existing-hot-loop-idle-retrieve-policy",
      hotLoopCallSites: [`${states}#getIdleRetrieveParams`],
      callSiteEvidence: [{ path: states, marker: "new IdleRetrievePolicyResolver();" }],
      allocationBaseline: allocation(11, 0, 2, 0),
    }),
  },
  migrationGates: ["one-exact-source-and-method-shape", "four-export-identities-and-one-activation",
    "one-exact-earlier-batch-import", "reviewed-local-default-compositions",
    "one-exact-consumer-relationship-and-one-retired-bridge",
    "one-shared-source-activation-retirement", "all-legacy-activation-positions-preserved",
    "zero-config-platform-browser-dev-dependencies", "zero-added-hot-loop-allocations"],
}).value;

const RELEASE = Object.freeze({
  title: "Idle Retrieve Policy Domain",
  codename: "idle-retrieve-policy-domain",
  summary: "Batch 046 migrated the idle retrieve policies and their resolver to the fishing Domain.",
  smokeContext: "Automated browser smoke under the owner's 2026-10-01 authorization: game-cycle re-executed without seals and compared with the pre-cutover output, game loaded in the built-in browser, and console errors and warnings counted.",
  notes: [
    "Migrate the base, passive lure and pole idle retrieve policies and the idle retrieve policy resolver",
    "Import resolveFightPhysicsConfig from the landing policy module and retire its activation from the shared landing policy shim",
    "Preserve one hundred thirty-five project modules, one hundred twenty-six active activations and two hundred one bridges",
  ],
  changelog: [
    "- Migrated RetrievePolicy, PassiveLureRetrievePolicy, PoleIdleRetrievePolicy and IdleRetrievePolicyResolver as named ESM exports; the per-frame retrieve parameters are unchanged.",
    "- Retired the resolveFightPhysicsConfig activation as a shared-source line removal: the landing policy shim keeps LandingPolicyResolver.",
    "- Extended the cumulative runtime from 134 to 135 project modules; 126 active activations and 201 exact bridge relationships.",
    "- The next task is batch 047 preflight.",
  ],
});

module.exports = { PREFLIGHT_PROFILE, RELEASE };
