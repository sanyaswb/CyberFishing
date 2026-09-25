"use strict";

const { StageThreeBatchExecutionProfile } = require("./stage_three_batch_execution_profile");
const { StageThreeBatchPreflightProfile } = require("./stage_three_batch_preflight_profile");

const allocation = (objectExpressions, arrayExpressions, newExpressions, objectFreezeCalls,
  objectAssignCalls = 0, roundingCalls = 0) => ({ objectExpressions, arrayExpressions,
  newExpressions, objectFreezeCalls, objectAssignCalls, roundingCalls });
const source = "src/core/fishing/player_pressure/player_pressure_fatigue_source_resolver.js";
const target = "src/game/domain/fishing/player_pressure/player_pressure_fatigue_source_resolver.js";
const fightPhysics = "src/systems/fight_physics_system.js";

const BATCH_016_EXECUTION_PROFILE = new StageThreeBatchExecutionProfile({
  schemaVersion: 1,
  batchId: "stage-3.candidate-016-fishing-f8c953aa",
  batchNumber: "016",
  executionStageLabel: "Stage 3.16.1",
  auditStageLabel: "Stage 3.16.0",
  focusedStageId: "stage-3.16.2",
  prebuildStageId: "stage-3.16.3",
  sourceReleaseVersion: "0.24.52",
  targetReleaseVersion: "0.24.53",
  auditPath: "architecture/migration/stage_3_batch_016_audit.json",
  executionPlanPath: "architecture/migration/stage_3_batch_016_execution_plan.json",
  testMatrixPath: "architecture/migration/stage_3_batch_016_test_matrix.json",
  expectedTargetCount: 1,
  expectedExportCount: 1,
  expectedActivationCount: 1,
  expectedConsumerCount: 1,
  expectedDependencyEdgeCount: 0,
  expectedTargets: [
    { currentPath: source, targetPath: target, exports: ["PlayerPressureFatigueSourceResolver"] },
  ],
  expectedActivationIds: ["activation-a0ef26ab86ac"],
  expectedActivationPositions: [99],
  expectedBridgeIds: ["bridge-04bc2fe4918e"],
  expectedTopology: { beforeProjectModuleCount: 62, afterProjectModuleCount: 63,
    beforeActivationCount: 65, afterActivationCount: 66,
    beforeBridgeCount: 95, afterBridgeCount: 96 },
  includeRuntimeActiveState: true,
  persistActiveBatchPhase: true,
  includeDetailedStatePerformanceGates: true,
  behaviorPhases: ["classic-baseline", "temporary-esm-parity", "post-cutover-esm"],
  compatibilityPhases: ["pre-build-fixture", "temporary-esm-parity", "post-build-runtime"],
  scmCheckpointRequired: true,
  sourceReleaseTag: "v0.24.52",
  bridgeReason: "Preserve the exact Fishing domain consumers until their legacy symbols are removed.",
  rollbackRule: "restore-only-batch-016-delta-and-keep-batches-001-through-015",
  consumerSetSource: "stage-3.16.0-live-observation-and-frozen-consumer-set",
  operationIds: ["verify-frozen-evidence", "open-batch-016", "create-one-named-esm-target",
    "render-one-candidate-activation-shim", "project-one-consumer-bridge",
    "project-candidate-manifest", "validate-candidate-and-commit-atomic-cutover",
    "validate-identity-timing-state-and-behavior", "persist-and-reconcile-observations",
    "run-full-acceptance", "close-release-0.24.53"],
}).value;

const BATCH_016_PREFLIGHT_PROFILE = new StageThreeBatchPreflightProfile({
  schemaVersion: 1,
  stageLabel: "Stage 3.16.0",
  artifactKind: "cyber-fishing-stage-3-batch-preflight-audit",
  batchId: BATCH_016_EXECUTION_PROFILE.batchId,
  sourceReleaseVersion: BATCH_016_EXECUTION_PROFILE.sourceReleaseVersion,
  executionProfile: BATCH_016_EXECUTION_PROFILE,
  sideEffectEvidence: { path: "architecture/migration/stage_3_batch_016_side_effect_review.json",
    sha256: "9b36c814aab11a487e133907db738f68f287c82ccfd4e086eb57132760b0967a" },
  reviewedContracts: {
    [source]: {
      classification: "authoritative-owner", instanceFields: ["#config"], publicStateShape: [],
      resultShape: [], stableResultIdentity: false, mutatesCallerInputs: false,
      semanticRisk: "pressure-fatigue-source-mode-reasons-config-precedence-and-window-exposure",
      performanceClassification: "existing-fight-physics-fatigue-source",
      hotLoopCallSites: [fightPhysics],
      callSiteEvidence: [{ path: fightPhysics, marker: "new PlayerPressureFatigueSourceResolver()" }],
      allocationBaseline: allocation(10, 0, 0, 1),
      legacyExposure: { symbol: "PlayerPressureFatigueSourceResolver", location: "110:3",
        mechanism: "window-property" },
    },
  },
  migrationGates: ["one-exact-source-and-method-shape", "one-export-identity-and-activation",
    "one-reviewed-window-class-exposure", "one-exact-consumer-relationship",
    "all-legacy-activation-positions-preserved", "zero-config-platform-browser-dev-dependencies",
    "zero-added-hot-loop-allocations"],
}).value;

module.exports = { BATCH_016_PREFLIGHT_PROFILE, BATCH_016_EXECUTION_PROFILE };
