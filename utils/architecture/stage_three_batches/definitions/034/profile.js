"use strict";

const { StageThreeBatchExecutionProfile } = require("../../../domain_batches/stage_three_batch_execution_profile");
const { StageThreeBatchPreflightProfile } = require("../../../domain_batches/stage_three_batch_preflight_profile");

const allocation = (objectExpressions, arrayExpressions, newExpressions, objectFreezeCalls,
  objectAssignCalls = 0, roundingCalls = 0) => ({ objectExpressions, arrayExpressions,
  newExpressions, objectFreezeCalls, objectAssignCalls, roundingCalls });
const fight = "src/systems/fight_physics_system.js";
const domain = "src/game/domain/fishing/";
const fatigue = "src/core/fishing/player_pressure/player_reel_fatigue_session.js";
const reelHold = "src/core/fishing/reel_hold_recovery_system.js";
const slowdown = "src/core/fishing/reel_recovery_fish_slowdown_policy.js";
const stress = "src/core/fishing/tackle_stress_accumulator.js";
const smoother = "src/systems/player_pull_motion_smoother.js";
const rodControl = "src/systems/rod_lateral_control_system.js";
const imported = (consumer, name, file, activationId) => ({ consumer, from: domain + file, exportName: name,
  legacySymbol: name, viaShim: `src/core/fishing/${file}`, activationId });
const contract = fields => ({ classification: "authoritative-owner", instanceFields: [],
  publicStateShape: [], resultShape: [], stableResultIdentity: false, mutatesCallerInputs: false,
  hotLoopCallSites: [], ...fields });

// Batch 034 is the hot-loop fishing cluster frozen by the Stage 3.34.0 review-queue extension. Its
// hot-loop prerequisites are resolved by the recorded evidence, and the post-cutover live
// validation must reproduce every recorded member fingerprint and game-cycle trace. Its three
// imported providers lose their last classic readers: their activations retire.
const EXECUTION_PROFILE = new StageThreeBatchExecutionProfile({
  schemaVersion: 1,
  batchId: "stage-3.replan-322.batch-034-fishing-b761d4f1",
  batchNumber: "034",
  executionStageLabel: "Stage 3.35.1",
  auditStageLabel: "Stage 3.35.0",
  focusedStageId: "stage-3.35.2",
  prebuildStageId: "stage-3.35.3",
  sourceReleaseVersion: "0.24.71",
  targetReleaseVersion: "0.24.72",
  auditPath: "architecture/migration/stage_3_batch_034_audit.json",
  executionPlanPath: "architecture/migration/stage_3_batch_034_execution_plan.json",
  testMatrixPath: "architecture/migration/stage_3_batch_034_test_matrix.json",
  expectedTargetCount: 6,
  expectedExportCount: 6,
  expectedActivationCount: 6,
  expectedConsumerCount: 6,
  expectedDependencyEdgeCount: 0,
  expectedTargets: [
    { currentPath: fatigue, targetPath: `${domain}player_pressure/player_reel_fatigue_session.js`,
      exports: ["PlayerReelFatigueSession"] },
    { currentPath: reelHold, targetPath: `${domain}reel_hold_recovery_system.js`, exports: ["ReelHoldRecoverySystem"] },
    { currentPath: slowdown, targetPath: `${domain}reel_recovery_fish_slowdown_policy.js`,
      exports: ["ReelRecoveryFishSlowdownPolicy"] },
    { currentPath: stress, targetPath: `${domain}tackle_stress_accumulator.js`, exports: ["TackleStressAccumulator"] },
    { currentPath: smoother, targetPath: `${domain}player_pull_motion_smoother.js`, exports: ["PlayerPullMotionSmoother"] },
    { currentPath: rodControl, targetPath: `${domain}rod_lateral_control_system.js`, exports: ["RodLateralControlSystem"] },
  ],
  continuationPlan: { path: "architecture/migration/stage_3_34_review_queue/freeze_extension.json",
    sha256: "5142dcb02f3b9936654440fbf804f66e4e47daff46acca18ce222d22a8ecba00" },
  expectedImports: [
    imported(reelHold, "ReelHoldLoadPolicy", "reel_hold_load_policy.js", "activation-4d4619b15e3c"),
    imported(rodControl, "RodControlAngleResolver", "rod_control_angle_resolver.js", "activation-3890808eb3cc"),
    imported(rodControl, "RodControlTensionModeResolver", "rod_control_tension_mode_resolver.js", "activation-f70148ad6a58"),
  ],
  expectedActivationIds: ["activation-6f9f31ec1100", "activation-7e9f7bbaf846", "activation-8d90074016f4",
    "activation-9f3fc146aed0", "activation-c23a9b7efff6", "activation-e092bb522808"],
  expectedActivationPositions: [98, 115, 116, 138, 212, 214],
  expectedBridgeIds: ["bridge-0095bdc3c5cc", "bridge-46e283c7d3b4", "bridge-54ef64d12545", "bridge-b2d34369a857",
    "bridge-bc742ffa077f", "bridge-bc7633877a9c"],
  informationalDocumentsExcluded: true,
  expectedRetiredActivationIds: ["activation-3890808eb3cc", "activation-4d4619b15e3c", "activation-f70148ad6a58"],
  expectedRetiredBridgeIds: ["bridge-19607c8ce243", "bridge-451e340bf590", "bridge-509dd42a0477"],
  expectedTopology: { beforeProjectModuleCount: 100, afterProjectModuleCount: 106,
    beforeActivationCount: 95, afterActivationCount: 98,
    beforeBridgeCount: 140, afterBridgeCount: 143 },
  includeRuntimeActiveState: true,
  persistActiveBatchPhase: true,
  includeDetailedStatePerformanceGates: true,
  behaviorPhases: ["classic-baseline", "temporary-esm-parity", "post-cutover-esm"],
  compatibilityPhases: ["pre-build-fixture", "temporary-esm-parity", "post-build-runtime"],
  scmCheckpointRequired: true,
  sourceReleaseTag: "v0.24.71",
  bridgeReason: "Preserve the exact hot-loop fishing consumers until their legacy symbols are removed.",
  rollbackRule: "restore-only-batch-034-delta-and-keep-batches-001-through-033",
  consumerSetSource: "stage-3.35.0-live-observation-and-stage-3.22-frozen-consumer-set",
  operationIds: ["verify-frozen-evidence", "open-batch-034",
    "create-six-named-esm-targets-with-three-prefix-imports", "render-six-candidate-activation-shims",
    "project-six-consumer-bridges-and-retire-three", "project-candidate-manifest",
    "validate-candidate-and-commit-atomic-cutover", "validate-identity-timing-state-behavior-and-hot-loop-traces",
    "persist-and-reconcile-observations", "run-full-acceptance", "close-release-0.24.72"],
}).value;

const PREFLIGHT_PROFILE = new StageThreeBatchPreflightProfile({
  schemaVersion: 1,
  stageLabel: "Stage 3.35.0",
  artifactKind: "cyber-fishing-stage-3-batch-preflight-audit",
  batchId: EXECUTION_PROFILE.batchId,
  sourceReleaseVersion: EXECUTION_PROFILE.sourceReleaseVersion,
  executionProfile: EXECUTION_PROFILE,
  sideEffectEvidence: { path: "architecture/migration/stage_3_batch_034_side_effect_review.json",
    sha256: "9b387400d627f8822b40276be4e74348a4da01f0001589084f8bd748846b3726" },
  reviewedContracts: {
    [fatigue]: contract({
      instanceFields: ["#active", "#endedThisFrame", "#startedThisFrame"],
      semanticRisk: "per-frame-reel-fatigue-session-latch-with-frozen-state-snapshots",
      performanceClassification: "existing-hot-loop-reel-fatigue-session",
      hotLoopCallSites: [`${fight}#updatePlayerReelFatigueSession`],
      callSiteEvidence: [{ path: fight, marker: "new PlayerReelFatigueSession()" }],
      allocationBaseline: allocation(2, 0, 0, 1),
      legacyExposure: { symbol: "PlayerReelFatigueSession", location: "44:3", mechanism: "window-property" },
    }),
    [reelHold]: contract({
      instanceFields: ["#loadPolicy", "#state", "#timerMs"],
      semanticRisk: "per-frame-hold-reel-recovery-timer-with-owned-load-policy",
      performanceClassification: "existing-hot-loop-reel-hold-recovery",
      hotLoopCallSites: [`${fight}#updateHoldReelRecovery`],
      callSiteEvidence: [{ path: fight, marker: "new ReelHoldRecoverySystem()" }],
      allocationBaseline: allocation(12, 0, 1, 0),
      compositionIdentityReview: true,
    }),
    [slowdown]: contract({
      semanticRisk: "per-frame-fish-slowdown-state-mutated-in-place",
      performanceClassification: "existing-hot-loop-fish-slowdown-policy",
      hotLoopCallSites: [`${fight}#step`, `${fight}#updateFishMotion`],
      callSiteEvidence: [{ path: fight, marker: "new ReelRecoveryFishSlowdownPolicy()" }],
      allocationBaseline: allocation(4, 0, 0, 0),
    }),
    [stress]: contract({
      instanceFields: ["#lastFailureChance", "#lastFailureSource", "#lastGuaranteedFailure", "#lastOverloadKg",
        "#lastRollPassed", "#lastRollValue", "#lastStressGainPerSecond", "#rollTimerMs", "#stressValue"],
      semanticRisk: "per-frame-tackle-stress-accumulation-and-failure-roll-timer",
      performanceClassification: "existing-hot-loop-tackle-stress-accumulator",
      hotLoopCallSites: ["src/systems/tackle_stress_system.js#updateTensionFrame"],
      callSiteEvidence: [{ path: "src/systems/tackle_stress_system.js", marker: "new TackleStressAccumulator()" }],
      allocationBaseline: allocation(14, 0, 0, 0),
    }),
    [smoother]: contract({
      instanceFields: ["#debug", "#velocityX", "#velocityY"],
      semanticRisk: "per-frame-player-pull-inertia-smoothing-with-in-place-debug-record",
      performanceClassification: "existing-hot-loop-player-pull-motion-smoother",
      hotLoopCallSites: [`${fight}#smoothPlayerPullAxis`, `${fight}#updateRodControl`, `${fight}#updateRodPull`],
      callSiteEvidence: [{ path: fight, marker: "new PlayerPullMotionSmoother()" }],
      allocationBaseline: allocation(8, 0, 0, 0),
    }),
    [rodControl]: contract({
      instanceFields: ["#angleResolver", "#centerStartDirectionX", "#controlBuildRatio", "#controlStartedCentered",
        "#result", "#tensionModeResolver", "#wasControlActive"],
      semanticRisk: "per-frame-rod-lateral-control-with-owned-angle-and-tension-mode-resolvers",
      performanceClassification: "existing-hot-loop-rod-lateral-control",
      hotLoopCallSites: [`${fight}#resolveRodControlIntent`, `${fight}#updateRodControl`],
      callSiteEvidence: [{ path: "src/app/fishing.js", marker: "new RodLateralControlSystem()" }],
      allocationBaseline: allocation(42, 0, 2, 3),
      compositionIdentityReview: true,
    }),
  },
  migrationGates: ["six-exact-sources-and-method-shapes", "six-export-identities-and-activations",
    "three-exact-completed-prefix-imports", "three-owner-created-composition-identities",
    "one-reviewed-guarded-window-exposure", "six-exact-consumer-relationships-and-three-retired-bridges", "three-retired-activations",
    "recorded-hot-loop-evidence-for-every-module", "post-cutover-member-fingerprints-and-game-cycle-traces-equal",
    "all-legacy-activation-positions-preserved", "zero-config-platform-browser-dev-dependencies",
    "zero-added-hot-loop-allocations"],
}).value;

const RELEASE = Object.freeze({
  title: "Fishing Hot-Loop Cluster Domain",
  codename: "fishing-hot-loop-cluster-domain",
  summary: "Batch 034 migrated the six hot-loop fishing modules with equal member fingerprints and game-cycle traces.",
  smokeContext: "Automated substitute per the owner's 2026-09-27 authorization: game-cycle loop (fight, reel hold, stress and rod control scenarios) re-executed without seals, the recorded hot-loop traces reproduced, and a built-in-browser load of the game with screenshots and console counts.",
  notes: [
    "Migrate the six hot-loop fishing modules frozen by the review-queue extension",
    "Import ReelHoldLoadPolicy, RodControlAngleResolver and RodControlTensionModeResolver from the completed prefix",
    "Move the guarded window exposure of PlayerReelFatigueSession to the exact activation shim",
    "Reproduce every recorded member fingerprint and game-cycle trace after the cutover",
    "Retire the ReelHoldLoadPolicy, RodControlAngleResolver and RodControlTensionModeResolver activations",
    "Preserve one hundred six project modules, ninety-eight activations and one hundred forty-three bridges",
  ],
  changelog: [
    "- Completed batch 034, the last batch of the Stage 3.34.0 freeze extension: PlayerReelFatigueSession, ReelHoldRecoverySystem, ReelRecoveryFishSlowdownPolicy, TackleStressAccumulator, PlayerPullMotionSmoother and RodLateralControlSystem as named ESM exports.",
    "- Hot-loop gates: the preflight resolves the recorded review-queue evidence of the unchanged sources, and the live validation reproduces every class member fingerprint, allocation site and game-cycle trace (call counts, deltaTime ranges, ordered arguments and results).",
    "- Retired the ReelHoldLoadPolicy, RodControlAngleResolver and RodControlTensionModeResolver activations as inert classic placeholders.",
    "- Extended the cumulative graph from 100 to 106 project modules and from 95 to 98 activation contracts, with 143 exact bridge relationships (6 added, 3 retired).",
    "- The next task is the prerequisite backlog (Vector2 extraction, descriptor boundaries, config injections, decompositions) and a new graph review.",
  ],
});

module.exports = { PREFLIGHT_PROFILE, RELEASE, RESOLVED_DEBT_IDS: ["debt-browser-capability-36211a794946"] };
