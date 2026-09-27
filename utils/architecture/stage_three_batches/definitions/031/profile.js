"use strict";

const { StageThreeBatchExecutionProfile } = require("../../../domain_batches/stage_three_batch_execution_profile");
const { StageThreeBatchPreflightProfile } = require("../../../domain_batches/stage_three_batch_preflight_profile");

const allocation = (objectExpressions, arrayExpressions, newExpressions, objectFreezeCalls,
  objectAssignCalls = 0, roundingCalls = 0) => ({ objectExpressions, arrayExpressions,
  newExpressions, objectFreezeCalls, objectAssignCalls, roundingCalls });
const stamina = "src/core/fishing/stamina/";
const domain = "src/game/domain/fishing/stamina/";
const frame = stamina + "stamina_balance_frame.js";
const imported = (name, file, activationId) => ({ consumer: frame, from: domain + file, exportName: name,
  legacySymbol: name, viaShim: stamina + file, activationId });
const contract = fields => ({ classification: "authoritative-owner", instanceFields: [],
  publicStateShape: [], resultShape: [], stableResultIdentity: false, mutatesCallerInputs: false,
  hotLoopCallSites: [], ...fields });

// Batch 031 migrates the stamina balance frame: its owner-created phase machine (batch 029) and
// endurance drain calculators are reviewed imports, its guarded window exposure moves to the
// activation shim, and all three imported activations lose their last classic readers.
const EXECUTION_PROFILE = new StageThreeBatchExecutionProfile({
  schemaVersion: 1,
  batchId: "stage-3.replan-322.batch-031-fishing-d2f28c0f",
  batchNumber: "031",
  executionStageLabel: "Stage 3.32.1",
  auditStageLabel: "Stage 3.32.0",
  focusedStageId: "stage-3.32.2",
  prebuildStageId: "stage-3.32.3",
  sourceReleaseVersion: "0.24.68",
  targetReleaseVersion: "0.24.69",
  auditPath: "architecture/migration/stage_3_batch_031_audit.json",
  executionPlanPath: "architecture/migration/stage_3_batch_031_execution_plan.json",
  testMatrixPath: "architecture/migration/stage_3_batch_031_test_matrix.json",
  expectedTargetCount: 1,
  expectedExportCount: 1,
  expectedActivationCount: 1,
  expectedConsumerCount: 1,
  expectedDependencyEdgeCount: 0,
  expectedTargets: [
    { currentPath: frame, targetPath: domain + "stamina_balance_frame.js", exports: ["StaminaBalanceFrame"] },
  ],
  continuationPlan: { path: "architecture/migration/stage_3_22/approved_prefix.json",
    sha256: "4873af4bbc6a11a07a57c17cd198350d8154c0e6eed3a17551b8d02f97eb436c" },
  expectedImports: [
    imported("ActiveEnduranceDrainCalculator", "active_endurance_drain_calculator.js", "activation-a9ba2b558615"),
    imported("PassiveEnduranceDrainCalculator", "passive_endurance_drain_calculator.js", "activation-e94561a6959c"),
    imported("StaminaPhaseMachine", "stamina_phase_machine.js", "activation-95251e788d44"),
  ],
  expectedActivationIds: ["activation-54c1801cfb5c"],
  expectedActivationPositions: [110],
  expectedBridgeIds: ["bridge-9f5854296dfd"],
  informationalDocumentsExcluded: true,
  expectedRetiredActivationIds: ["activation-95251e788d44", "activation-a9ba2b558615", "activation-e94561a6959c"],
  expectedRetiredBridgeIds: ["bridge-711daa09e743", "bridge-b31831993e56", "bridge-f459f48ff32c"],
  expectedTopology: { beforeProjectModuleCount: 97, afterProjectModuleCount: 98,
    beforeActivationCount: 97, afterActivationCount: 95,
    beforeBridgeCount: 140, afterBridgeCount: 138 },
  includeRuntimeActiveState: true,
  persistActiveBatchPhase: true,
  includeDetailedStatePerformanceGates: true,
  behaviorPhases: ["classic-baseline", "temporary-esm-parity", "post-cutover-esm"],
  compatibilityPhases: ["pre-build-fixture", "temporary-esm-parity", "post-build-runtime"],
  scmCheckpointRequired: true,
  sourceReleaseTag: "v0.24.68",
  bridgeReason: "Preserve the exact stamina balance frame consumer until its legacy symbol is removed.",
  rollbackRule: "restore-only-batch-031-delta-and-keep-batches-001-through-030",
  consumerSetSource: "stage-3.32.0-live-observation-and-stage-3.22-frozen-consumer-set",
  operationIds: ["verify-frozen-evidence", "open-batch-031",
    "create-one-named-esm-target-with-three-prefix-imports", "render-one-candidate-activation-shim",
    "project-one-consumer-bridge-and-retire-three", "project-candidate-manifest",
    "validate-candidate-and-commit-atomic-cutover", "validate-identity-timing-state-and-behavior",
    "persist-and-reconcile-observations", "run-full-acceptance", "close-release-0.24.69"],
}).value;

const PREFLIGHT_PROFILE = new StageThreeBatchPreflightProfile({
  schemaVersion: 1,
  stageLabel: "Stage 3.32.0",
  artifactKind: "cyber-fishing-stage-3-batch-preflight-audit",
  batchId: EXECUTION_PROFILE.batchId,
  sourceReleaseVersion: EXECUTION_PROFILE.sourceReleaseVersion,
  executionProfile: EXECUTION_PROFILE,
  sideEffectEvidence: { path: "architecture/migration/stage_3_batch_031_side_effect_review.json",
    sha256: "c2cb0afc6f3e08cb3b04240f1cd8f4c1fe265af0386609d9cd2ec2e9166cce8a" },
  reviewedContracts: {
    [frame]: contract({
      instanceFields: ["#activeEnduranceDrainCalculator", "#elapsedMs", "#passiveEnduranceDrainCalculator", "#phaseMachine"],
      semanticRisk: "stamina-balance-frames-with-owned-phase-machine-endurance-drains-and-elapsed-clock",
      performanceClassification: "existing-stamina-balance-frame",
      callSiteEvidence: [{ path: "src/systems/fight_physics_system.js", marker: "new StaminaBalanceFrame()" }],
      allocationBaseline: allocation(13, 0, 3, 1),
      compositionIdentityReview: true,
      legacyExposure: { symbol: "StaminaBalanceFrame", location: "305:3", mechanism: "window-property" },
    }),
  },
  migrationGates: ["one-exact-source-and-method-shape", "one-export-identity-and-activation",
    "three-exact-imports-including-one-earlier-batch-export", "three-owner-created-composition-identities",
    "one-reviewed-guarded-window-exposure", "one-exact-consumer-relationship-and-three-retired-bridges",
    "three-retired-activations", "all-legacy-activation-positions-preserved",
    "zero-config-platform-browser-dev-dependencies", "zero-added-hot-loop-allocations"],
}).value;

const RELEASE = Object.freeze({
  title: "Fishing Stamina Balance Frame Domain",
  codename: "fishing-stamina-balance-frame-domain",
  summary: "Batch 031 migrated StaminaBalanceFrame and retired the phase machine and endurance drain activations.",
  smokeContext: "Automated substitute per the owner's 2026-09-27 authorization: game-cycle loop (fight, stamina and landing scenarios) re-executed without seals and a built-in-browser load of the game with screenshots and console counts.",
  notes: [
    "Migrate the stamina balance frame",
    "Import the stamina phase machine from batch 029 and the endurance drain calculators",
    "Move the guarded window exposure of StaminaBalanceFrame to the exact activation shim",
    "Retire the stamina phase machine and endurance drain activations as inert classic placeholders",
    "Preserve ninety-eight project modules, ninety-five activations and one hundred thirty-eight bridges",
  ],
  changelog: [
    "- Completed batch 031 of the Stage 3.22 approved prefix: StaminaBalanceFrame as a named ESM export.",
    "- Three reviewed imports (StaminaPhaseMachine from batch 029, ActiveEnduranceDrainCalculator, PassiveEnduranceDrainCalculator); the owner-created defaults are proven Domain compositions and the guarded window exposure moved to the activation shim.",
    "- Retired the StaminaPhaseMachine, ActiveEnduranceDrainCalculator and PassiveEnduranceDrainCalculator activations as inert classic placeholders.",
    "- Extended the cumulative graph from 97 to 98 project modules and from 97 to 95 activation contracts, with 138 exact bridge relationships (1 added, 3 retired).",
    "- The next task is batch 032 preflight.",
  ],
});

module.exports = { PREFLIGHT_PROFILE, RELEASE, RESOLVED_DEBT_IDS: ["debt-browser-capability-b6d7a597fdc2"] };
