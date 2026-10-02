"use strict";

const { StageThreeBatchExecutionProfile } = require("../../../domain_batches/stage_three_batch_execution_profile");
const { StageThreeBatchPreflightProfile } = require("../../../domain_batches/stage_three_batch_preflight_profile");

const allocation = (objectExpressions, arrayExpressions, newExpressions, objectFreezeCalls,
  objectAssignCalls = 0, roundingCalls = 0) => ({ objectExpressions, arrayExpressions,
  newExpressions, objectFreezeCalls, objectAssignCalls, roundingCalls });
const forceSystem = "src/systems/fish_force_system.js";
const domain = "src/game/domain/";
const contract = fields => ({ classification: "authoritative-owner", instanceFields: [],
  publicStateShape: [], resultShape: [], stableResultIdentity: false, mutatesCallerInputs: false,
  hotLoopCallSites: [], ...fields });
const imported = (exportName, from, viaShim, activationId) =>
  ({ consumer: forceSystem, from, exportName, legacySymbol: exportName, viaShim, activationId });

// Batch 051 migrates the fish force system, the last Domain source of the Stage 3.50 review queue (queued only
// behind fish.js, migrated by batch 050). It owns its per-frame collaborators created from reviewed imports
// (direction resolver, drag, endurance debuff, hold opposition, player force, simple force and Engine Vector2
// scratch vectors: composition identities) and reads FishPhysicsProfile from batch 050. The frozen plan gives it
// no performance gate (state-identity risk); it runs every fight frame, so its target is representation-only and
// the game-cycle output is compared before and after the cutover. Six activations lose their last classic readers.
const EXECUTION_PROFILE = new StageThreeBatchExecutionProfile({
  schemaVersion: 1,
  batchId: "stage-3.replan-350.batch-051-fishing-95a74a4a",
  batchNumber: "051",
  executionStageLabel: "Stage 3.52.1",
  auditStageLabel: "Stage 3.52.0",
  focusedStageId: "stage-3.52.2",
  prebuildStageId: "stage-3.52.3",
  sourceReleaseVersion: "0.24.88",
  targetReleaseVersion: "0.24.89",
  auditPath: "architecture/migration/stage_3_batch_051_audit.json",
  executionPlanPath: "architecture/migration/stage_3_batch_051_execution_plan.json",
  testMatrixPath: "architecture/migration/stage_3_batch_051_test_matrix.json",
  expectedTargetCount: 1,
  expectedExportCount: 1,
  expectedActivationCount: 1,
  expectedConsumerCount: 1,
  expectedDependencyEdgeCount: 0,
  expectedTargets: [
    { currentPath: forceSystem, targetPath: `${domain}fishing/fish_force_system.js`, exports: ["FishForceSystem"] },
  ],
  continuationPlan: { path: "architecture/migration/stage_3_50_review_queue/freeze_extension.json",
    sha256: "484074c63c2ff654561a54e8111452158ec22ed33dccccb1e8c9023ae6f5ffa8" },
  expectedImports: [
    imported("Vector2", "src/engine/math/vector2.js", "src/core/math/vector2.js", "activation-28138de81e82"),
    imported("FishPhysicsProfile", `${domain}fish/fish.js`, "src/entities/fish.js", "activation-f31861589962"),
    imported("DragForceCalculator", `${domain}fishing/drag_force_calculator.js`, "src/core/fishing/drag_force_calculator.js",
      "activation-4e28fdf337a3"),
    imported("EnduranceMovementDebuffCalculator", `${domain}fishing/endurance/endurance_movement_debuff_calculator.js`,
      "src/core/fishing/endurance/endurance_movement_debuff_calculator.js", "activation-fa95b209e285"),
    imported("FishFightDirectionResolver", `${domain}fishing/fish_fight_direction_resolver.js`,
      "src/core/fishing/fish_fight_direction_resolver.js", "activation-aa0a15e8a3fa"),
    imported("HoldOppositionResolver", `${domain}fishing/hold_opposition_resolver.js`,
      "src/core/fishing/hold_opposition_resolver.js", "activation-9857928fc9d0"),
    imported("PlayerForceSystem", `${domain}fishing/player_force_system.js`, "src/systems/player_force_system.js",
      "activation-38802c3efbfc"),
    imported("SimpleFightForceCalculator", `${domain}fishing/simple_fight_force_calculator.js`,
      "src/core/fishing/simple_fight_force_calculator.js", "activation-ccddea60d16c"),
  ],
  expectedActivationIds: ["activation-3c43fc3b9397"],
  expectedActivationPositions: [211],
  expectedBridgeIds: ["bridge-b8c4f17ca300"],
  expectedRetiredActivationIds: ["activation-38802c3efbfc", "activation-4e28fdf337a3", "activation-9857928fc9d0",
    "activation-aa0a15e8a3fa", "activation-ccddea60d16c", "activation-fa95b209e285"],
  expectedRetiredBridgeIds: ["bridge-0d6b757f78b7", "bridge-359a15f20087", "bridge-a285ed92f069", "bridge-ae5067513523",
    "bridge-c5b20a842e06", "bridge-c6c1e5eb790e", "bridge-cd4e72ecdc5e", "bridge-e1840139830f"],
  informationalDocumentsExcluded: true,
  expectedTopology: { beforeProjectModuleCount: 149, afterProjectModuleCount: 150,
    beforeActivationCount: 136, afterActivationCount: 131,
    beforeBridgeCount: 199, afterBridgeCount: 192 },
  includeRuntimeActiveState: true,
  persistActiveBatchPhase: true,
  includeDetailedStatePerformanceGates: true,
  behaviorPhases: ["classic-baseline", "temporary-esm-parity", "post-cutover-esm"],
  compatibilityPhases: ["pre-build-fixture", "temporary-esm-parity", "post-build-runtime"],
  scmCheckpointRequired: true,
  sourceReleaseTag: "v0.24.88",
  bridgeReason: "Preserve the exact fish force system consumer until its legacy symbol is removed.",
  rollbackRule: "restore-only-batch-051-delta-and-keep-batches-001-through-050",
  consumerSetSource: "stage-3.50.0-live-observation-and-stage-3.50-frozen-consumer-set",
  operationIds: ["verify-frozen-evidence", "open-batch-051",
    "create-one-named-esm-target-with-one-export", "render-one-candidate-activation-shim",
    "project-one-consumer-bridge-and-retire-eight", "project-candidate-manifest",
    "validate-candidate-and-commit-atomic-cutover", "validate-identity-timing-state-and-behavior",
    "persist-and-reconcile-observations", "run-full-acceptance", "close-release-0.24.89"],
}).value;

const PREFLIGHT_PROFILE = new StageThreeBatchPreflightProfile({
  schemaVersion: 1,
  stageLabel: "Stage 3.52.0",
  artifactKind: "cyber-fishing-stage-3-batch-preflight-audit",
  batchId: EXECUTION_PROFILE.batchId,
  sourceReleaseVersion: EXECUTION_PROFILE.sourceReleaseVersion,
  executionProfile: EXECUTION_PROFILE,
  sideEffectEvidence: { path: "architecture/migration/stage_3_batch_051_side_effect_review.json",
    sha256: "c800667a5d1008ea9c21a82c68e764b6561c98f4a89d3b8488f6646902add4ef" },
  reviewedContracts: {
    [forceSystem]: contract({
      instanceFields: ["#config", "#debug", "#directionResolver", "#dragForceCalculator",
        "#enduranceMovementDebuffCalculator", "#fish", "#forceCalculator", "#holdOppositionResolver", "#physicsConfig",
        "#playerForceSystem", "#scratchB", "#targetVelocity", "#tautTargetVelocity"],
      semanticRisk: "per-frame-fish-force-direction-drag-opposition-and-player-force-over-owned-collaborators",
      performanceClassification: "existing-hot-loop-fish-force-system",
      hotLoopCallSites: ["src/systems/fight_physics_system.js#updateFishMotion"],
      callSiteEvidence: [{ path: "src/app/fishing.js", marker: "new FishForceSystem({" }],
      allocationBaseline: allocation(40, 0, 9, 2),
      compositionIdentityReview: true,
    }),
  },
  migrationGates: ["one-exact-source-and-method-shape", "one-export-identity-and-activation",
    "eight-exact-earlier-batch-completed-prefix-and-foundation-imports", "nine-owner-created-composition-identities",
    "one-exact-consumer-relationship-and-eight-retired-bridges", "six-retired-activations",
    "representation-only-per-frame-target-and-equal-game-cycle-output", "all-legacy-activation-positions-preserved",
    "zero-config-platform-browser-dev-dependencies", "zero-added-hot-loop-allocations"],
}).value;

const RELEASE = Object.freeze({
  title: "Fish Force System Domain",
  codename: "fish-force-system-domain",
  summary: "Batch 051 migrated the fish force system, the last Domain source of the Stage 3.50 review queue.",
  smokeContext: "Automated browser smoke under the owner's 2026-10-01 authorization: game-cycle re-executed without seals and compared with the pre-cutover output, game loaded in the built-in browser, and console errors and warnings counted.",
  notes: [
    "Migrate the fish force system with its owned per-frame collaborators",
    "Retire six activations whose last classic reader was the fish force system",
    "Preserve one hundred fifty project modules, one hundred thirty-one active activations and one hundred ninety-two bridges",
  ],
  // Short format (owner decision 2026-10-01): 1-3 lines per release.
  changelog: [
    "- Migrated FishForceSystem to the fishing Domain (per-frame, representation-only, game-cycle output unchanged); all 139 Domain modules are migrated.",
  ],
});

module.exports = { PREFLIGHT_PROFILE, RELEASE };
