"use strict";

const { StageThreeBatchExecutionProfile } = require("../../../domain_batches/stage_three_batch_execution_profile");
const { StageThreeBatchPreflightProfile } = require("../../../domain_batches/stage_three_batch_preflight_profile");

const allocation = (objectExpressions, arrayExpressions, newExpressions, objectFreezeCalls,
  objectAssignCalls = 0, roundingCalls = 0) => ({ objectExpressions, arrayExpressions,
  newExpressions, objectFreezeCalls, objectAssignCalls, roundingCalls });
const fishing = "src/core/fishing/";
const domain = "src/game/domain/fishing/";
const angle = fishing + "pole_fight_sector_angle_constraint.js";
const phase = fishing + "stamina/stamina_phase_machine.js";
const stamina = (name, file, activationId) => ({ consumer: phase, from: domain + "stamina/" + file, exportName: name,
  legacySymbol: name, viaShim: fishing + "stamina/" + file, activationId });
const contract = fields => ({ classification: "authoritative-owner", instanceFields: [],
  publicStateShape: [], resultShape: [], stableResultIdentity: false, mutatesCallerInputs: false,
  hotLoopCallSites: [], ...fields });

// Batch 029 migrates the pole fight sector angle constraint and the stamina phase machine. Their
// owner-created collaborators are reviewed imports (two from batch 025); the phase machine's guarded
// window exposure moves to the activation shim. Four stamina activations lose their last classic
// readers and retire.
const EXECUTION_PROFILE = new StageThreeBatchExecutionProfile({
  schemaVersion: 1,
  batchId: "stage-3.replan-322.batch-029-fishing-f2a8faba",
  batchNumber: "029",
  executionStageLabel: "Stage 3.30.1",
  auditStageLabel: "Stage 3.30.0",
  focusedStageId: "stage-3.30.2",
  prebuildStageId: "stage-3.30.3",
  sourceReleaseVersion: "0.24.66",
  targetReleaseVersion: "0.24.67",
  auditPath: "architecture/migration/stage_3_batch_029_audit.json",
  executionPlanPath: "architecture/migration/stage_3_batch_029_execution_plan.json",
  testMatrixPath: "architecture/migration/stage_3_batch_029_test_matrix.json",
  expectedTargetCount: 2,
  expectedExportCount: 2,
  expectedActivationCount: 2,
  expectedConsumerCount: 2,
  expectedDependencyEdgeCount: 0,
  expectedTargets: [
    { currentPath: angle, targetPath: domain + "pole_fight_sector_angle_constraint.js",
      exports: ["PoleFightSectorAngleConstraint"] },
    { currentPath: phase, targetPath: domain + "stamina/stamina_phase_machine.js", exports: ["StaminaPhaseMachine"] },
  ],
  continuationPlan: { path: "architecture/migration/stage_3_22/approved_prefix.json",
    sha256: "4873af4bbc6a11a07a57c17cd198350d8154c0e6eed3a17551b8d02f97eb436c" },
  expectedImports: [
    { consumer: angle, from: domain + "pole_fight_sector_constraint.js", exportName: "PoleFightSectorConstraint",
      legacySymbol: "PoleFightSectorConstraint", viaShim: fishing + "pole_fight_sector_constraint.js",
      activationId: "activation-754e57609bef" },
    stamina("StaminaDrainCalculator", "stamina_drain_calculator.js", "activation-2eff98891b2d"),
    stamina("StaminaPressureResolver", "stamina_pressure_resolver.js", "activation-89d032a4a1e8"),
    stamina("StaminaRegenCalculator", "stamina_regen_calculator.js", "activation-dca4cdb154de"),
    stamina("StaminaTransitionResolver", "stamina_transition_resolver.js", "activation-9398dc78c283"),
  ],
  expectedActivationIds: ["activation-64ebf8ced768", "activation-95251e788d44"],
  expectedActivationPositions: [109, 136],
  expectedBridgeIds: ["bridge-711daa09e743", "bridge-ef59a7fecbec"],
  informationalDocumentsExcluded: true,
  expectedRetiredActivationIds: ["activation-2eff98891b2d", "activation-89d032a4a1e8", "activation-9398dc78c283",
    "activation-dca4cdb154de"],
  expectedRetiredBridgeIds: ["bridge-8139e8003a2a", "bridge-a880353d8927", "bridge-c53a729057bb",
    "bridge-d1647c1fa147", "bridge-ec39039f0d1c"],
  expectedTopology: { beforeProjectModuleCount: 93, afterProjectModuleCount: 95,
    beforeActivationCount: 98, afterActivationCount: 96,
    beforeBridgeCount: 141, afterBridgeCount: 138 },
  includeRuntimeActiveState: true,
  persistActiveBatchPhase: true,
  includeDetailedStatePerformanceGates: true,
  behaviorPhases: ["classic-baseline", "temporary-esm-parity", "post-cutover-esm"],
  compatibilityPhases: ["pre-build-fixture", "temporary-esm-parity", "post-build-runtime"],
  scmCheckpointRequired: true,
  sourceReleaseTag: "v0.24.66",
  bridgeReason: "Preserve the exact pole fight sector angle and stamina phase consumers until their legacy symbols are removed.",
  rollbackRule: "restore-only-batch-029-delta-and-keep-batches-001-through-028",
  consumerSetSource: "stage-3.30.0-live-observation-and-stage-3.22-frozen-consumer-set",
  operationIds: ["verify-frozen-evidence", "open-batch-029",
    "create-two-named-esm-targets-with-five-prefix-imports", "render-two-candidate-activation-shims",
    "project-two-consumer-bridges-and-retire-five", "project-candidate-manifest",
    "validate-candidate-and-commit-atomic-cutover", "validate-identity-timing-state-and-behavior",
    "persist-and-reconcile-observations", "run-full-acceptance", "close-release-0.24.67"],
}).value;

const PREFLIGHT_PROFILE = new StageThreeBatchPreflightProfile({
  schemaVersion: 1,
  stageLabel: "Stage 3.30.0",
  artifactKind: "cyber-fishing-stage-3-batch-preflight-audit",
  batchId: EXECUTION_PROFILE.batchId,
  sourceReleaseVersion: EXECUTION_PROFILE.sourceReleaseVersion,
  executionProfile: EXECUTION_PROFILE,
  sideEffectEvidence: { path: "architecture/migration/stage_3_batch_029_side_effect_review.json",
    sha256: "fcf281c59a79cc702eeeedc37697b3d422d41b44dfd61bf8a7823c36d69c1c4d" },
  reviewedContracts: {
    [angle]: contract({
      instanceFields: ["#constraint"],
      semanticRisk: "pole-fight-sector-angle-delegation-with-owned-sector-constraint",
      performanceClassification: "existing-pole-fight-sector-angle-constraint",
      callSiteEvidence: [{ path: "src/systems/fight_physics_system.js", marker: "new PoleFightSectorAngleConstraint()" }],
      allocationBaseline: allocation(6, 0, 1, 0),
      compositionIdentityReview: true,
    }),
    [phase]: contract({
      instanceFields: ["#drainCalculator", "#pressureResolver", "#regenCalculator", "#staminaNoInputElapsedMs",
        "#staminaRecoveryFromExhaustionActive", "#transitionResolver"],
      semanticRisk: "stamina-phase-frames-with-owned-calculators-recovery-and-no-input-timers",
      performanceClassification: "existing-stamina-phase-machine",
      callSiteEvidence: [{ path: "src/core/fishing/stamina/stamina_balance_frame.js",
        marker: "phaseMachine = new StaminaPhaseMachine()" }],
      allocationBaseline: allocation(19, 0, 4, 2),
      compositionIdentityReview: true,
      legacyExposure: { symbol: "StaminaPhaseMachine", location: "259:3", mechanism: "window-property" },
    }),
  },
  migrationGates: ["two-exact-source-and-method-shapes", "two-export-identities-and-activations",
    "five-exact-imports-including-two-earlier-batch-exports", "five-owner-created-composition-identities",
    "one-reviewed-guarded-window-exposure", "two-exact-consumer-relationships-and-five-retired-bridges",
    "four-retired-activations", "all-legacy-activation-positions-preserved",
    "zero-config-platform-browser-dev-dependencies", "zero-added-hot-loop-allocations"],
}).value;

const RELEASE = Object.freeze({
  title: "Fishing Sector Angle and Stamina Phase Domain",
  codename: "fishing-sector-angle-stamina-phase-domain",
  summary: "Batch 029 migrated PoleFightSectorAngleConstraint and StaminaPhaseMachine and retired four stamina activations.",
  smokeContext: "Automated substitute per the owner's 2026-09-27 authorization: game-cycle loop (fight, stamina and landing scenarios) re-executed without seals and a built-in-browser load of the game with screenshots and console counts.",
  notes: [
    "Migrate the pole fight sector angle constraint and the stamina phase machine",
    "Import their owner-created collaborators, two of them from batch 025",
    "Move the guarded window exposure of StaminaPhaseMachine to the exact activation shim",
    "Retire the stamina drain, pressure, transition and regeneration activations as inert classic placeholders",
    "Preserve ninety-five project modules, ninety-six activations and one hundred thirty-eight bridges",
  ],
  changelog: [
    "- Completed batch 029 of the Stage 3.22 approved prefix: PoleFightSectorAngleConstraint and StaminaPhaseMachine as named ESM exports.",
    "- Five reviewed imports (PoleFightSectorConstraint and StaminaPressureResolver from batch 025, StaminaDrainCalculator, StaminaRegenCalculator, StaminaTransitionResolver); the owner-created defaults are proven Domain compositions and the guarded window exposure moved to the activation shim.",
    "- Retired the StaminaDrainCalculator, StaminaPressureResolver, StaminaTransitionResolver and StaminaRegenCalculator activations as inert classic placeholders.",
    "- Extended the cumulative graph from 93 to 95 project modules and from 98 to 96 activation contracts, with 138 exact bridge relationships (2 added, 5 retired).",
    "- The next task is batch 030 preflight.",
  ],
});

module.exports = { PREFLIGHT_PROFILE, RELEASE, RESOLVED_DEBT_IDS: ["debt-browser-capability-ac1b5c6941e3"] };
