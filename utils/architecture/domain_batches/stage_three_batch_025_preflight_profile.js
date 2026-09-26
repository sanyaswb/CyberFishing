"use strict";

const { StageThreeBatchExecutionProfile } = require("./stage_three_batch_execution_profile");
const { StageThreeBatchPreflightProfile } = require("./stage_three_batch_preflight_profile");

const allocation = (objectExpressions, arrayExpressions, newExpressions, objectFreezeCalls,
  objectAssignCalls = 0, roundingCalls = 0) => ({ objectExpressions, arrayExpressions,
  newExpressions, objectFreezeCalls, objectAssignCalls, roundingCalls });
const fishing = "src/core/fishing/";
const domain = "src/game/domain/fishing/";
const sector = fishing + "pole_fight_sector_constraint.js";
const pressure = fishing + "stamina/stamina_pressure_resolver.js";
const retrieve = "src/systems/fish_retrieve_system.js";
const imported = (consumer, name, file, activationId) => ({ consumer, from: domain + file,
  exportName: name, legacySymbol: name, viaShim: fishing + file, activationId });
const contract = fields => ({ classification: "authoritative-owner", instanceFields: [],
  publicStateShape: [], resultShape: [], stableResultIdentity: false, mutatesCallerInputs: false,
  hotLoopCallSites: [], ...fields });

// Batch 025 migrates three fishing modules whose partial state comes only from owner-created
// instances of completed-prefix classes; each composed class becomes a reviewed import.
const BATCH_025_EXECUTION_PROFILE = new StageThreeBatchExecutionProfile({
  schemaVersion: 1,
  batchId: "stage-3.replan-322.batch-025-fishing-9bcfae5e",
  batchNumber: "025",
  executionStageLabel: "Stage 3.26.1",
  auditStageLabel: "Stage 3.26.0",
  focusedStageId: "stage-3.26.2",
  prebuildStageId: "stage-3.26.3",
  sourceReleaseVersion: "0.24.62",
  targetReleaseVersion: "0.24.63",
  auditPath: "architecture/migration/stage_3_batch_025_audit.json",
  executionPlanPath: "architecture/migration/stage_3_batch_025_execution_plan.json",
  testMatrixPath: "architecture/migration/stage_3_batch_025_test_matrix.json",
  expectedTargetCount: 3,
  expectedExportCount: 3,
  expectedActivationCount: 3,
  expectedConsumerCount: 4,
  expectedDependencyEdgeCount: 0,
  expectedTargets: [
    { currentPath: sector, targetPath: domain + "pole_fight_sector_constraint.js",
      exports: ["PoleFightSectorConstraint"] },
    { currentPath: pressure, targetPath: domain + "stamina/stamina_pressure_resolver.js",
      exports: ["StaminaPressureResolver"] },
    { currentPath: retrieve, targetPath: domain + "fish_retrieve_system.js",
      exports: ["FishRetrieveSystem"] },
  ],
  continuationPlan: { path: "architecture/migration/stage_3_22/approved_prefix.json",
    sha256: "4873af4bbc6a11a07a57c17cd198350d8154c0e6eed3a17551b8d02f97eb436c" },
  expectedImports: [
    imported(sector, "PoleFightSectorGeometry", "pole_fight_sector_geometry.js", "activation-ffea5244c4bf"),
    imported(pressure, "StaminaLateralPositionResolver", "stamina/stamina_lateral_position_resolver.js",
      "activation-20cb461d88b8"),
    imported(retrieve, "DragForceCalculator", "drag_force_calculator.js", "activation-4e28fdf337a3"),
    imported(retrieve, "FishRetrieveResult", "fish_retrieve_result.js", "activation-9c5651e4f765"),
    imported(retrieve, "SimpleFightForceCalculator", "simple_fight_force_calculator.js", "activation-ccddea60d16c"),
  ],
  expectedActivationIds: ["activation-754e57609bef", "activation-89d032a4a1e8", "activation-e0fd80ed679d"],
  expectedActivationPositions: [105, 135, 216],
  expectedBridgeIds: ["bridge-1725d9aee214", "bridge-8139e8003a2a", "bridge-a825c474372d", "bridge-ec39039f0d1c"],
  informationalDocumentsExcluded: true,
  expectedRetiredActivationIds: ["activation-20cb461d88b8", "activation-9c5651e4f765"],
  expectedRetiredBridgeIds: ["bridge-011678614086", "bridge-1975df3eebf9", "bridge-a976ae6fdfc5",
    "bridge-c88c4a3e2737", "bridge-f6d56e05e037"],
  expectedTopology: { beforeProjectModuleCount: 83, afterProjectModuleCount: 86,
    beforeActivationCount: 93, afterActivationCount: 94,
    beforeBridgeCount: 142, afterBridgeCount: 141 },
  includeRuntimeActiveState: true,
  persistActiveBatchPhase: true,
  includeDetailedStatePerformanceGates: true,
  behaviorPhases: ["classic-baseline", "temporary-esm-parity", "post-cutover-esm"],
  compatibilityPhases: ["pre-build-fixture", "temporary-esm-parity", "post-build-runtime"],
  scmCheckpointRequired: true,
  sourceReleaseTag: "v0.24.62",
  bridgeReason: "Preserve the exact fishing sector, stamina pressure and retrieve consumers until their legacy symbols are removed.",
  rollbackRule: "restore-only-batch-025-delta-and-keep-batches-001-through-024",
  consumerSetSource: "stage-3.26.0-live-observation-and-stage-3.22-frozen-consumer-set",
  operationIds: ["verify-frozen-evidence", "open-batch-025",
    "create-three-named-esm-targets-with-five-prefix-imports", "render-three-candidate-activation-shims",
    "project-four-consumer-bridges-and-retire-five", "project-candidate-manifest",
    "validate-candidate-and-commit-atomic-cutover", "validate-identity-timing-state-and-behavior",
    "persist-and-reconcile-observations", "run-full-acceptance", "close-release-0.24.63"],
}).value;

const BATCH_025_PREFLIGHT_PROFILE = new StageThreeBatchPreflightProfile({
  schemaVersion: 1,
  stageLabel: "Stage 3.26.0",
  artifactKind: "cyber-fishing-stage-3-batch-preflight-audit",
  batchId: BATCH_025_EXECUTION_PROFILE.batchId,
  sourceReleaseVersion: BATCH_025_EXECUTION_PROFILE.sourceReleaseVersion,
  executionProfile: BATCH_025_EXECUTION_PROFILE,
  sideEffectEvidence: { path: "architecture/migration/stage_3_batch_025_side_effect_review.json",
    sha256: "6bba978028aeb8b0dcb43d33c0616d2fcaa91819aa433053992abd437f366280" },
  reviewedContracts: {
    [sector]: contract({
      instanceFields: ["#frame", "#geometry"],
      semanticRisk: "pole-fight-sector-clamp-with-owned-geometry-and-reused-frame",
      resultShape: ["active", "allowedMoveRatio", "angleDeg", "apexOffsetPx", "boundaryType", "clamped", "clampedAngleDeg", "enabled", "enforceRadius", "forwardX", "forwardY", "leftBoundaryDirectionX", "leftBoundaryDirectionY", "leftBoundaryRadiusIntersectionX", "leftBoundaryRadiusIntersectionY", "limitRadiusPx", "maxAngleFromCenterDeg", "originX", "originY", "outside", "positionX", "positionY", "proposedAngleDeg", "radialOriginX", "radialOriginY", "radiusPx", "recoveryMovement", "rightBoundaryDirectionX", "rightBoundaryDirectionY", "rightBoundaryRadiusIntersectionX", "rightBoundaryRadiusIntersectionY", "sectorApexX", "sectorApexY", "shoreOpeningWidthMeters", "side", "velocityAdjusted", "velocityX", "velocityY"],
      stableResultIdentity: true,
      performanceClassification: "existing-pole-fight-sector-constraint",
      callSiteEvidence: [{ path: "src/systems/fight_physics_system.js", marker: "new PoleFightSectorConstraint()" }],
      allocationBaseline: allocation(25, 0, 1, 0, 1),
      compositionIdentityReview: true,
    }),
    [pressure]: contract({
      instanceFields: ["#lateralPositionResolver"],
      semanticRisk: "stamina-pressure-resolution-with-owned-lateral-position-resolver",
      performanceClassification: "existing-stamina-pressure-resolution",
      callSiteEvidence: [{ path: "src/core/fishing/stamina/stamina_phase_machine.js",
        marker: "pressureResolver = new StaminaPressureResolver()" }],
      allocationBaseline: allocation(15, 0, 1, 5),
      compositionIdentityReview: true,
      legacyExposure: { symbol: "StaminaPressureResolver", location: "148:3", mechanism: "window-property" },
    }),
    [retrieve]: contract({
      instanceFields: ["#calculator", "#configSource", "#dragForceCalculator"],
      semanticRisk: "fish-retrieve-forces-with-owned-calculators-result-objects-and-rod-pull-write-back",
      mutatesCallerInputs: true,
      performanceClassification: "existing-fish-retrieve-system",
      callSiteEvidence: [{ path: "src/systems/fight_physics_system.js",
        marker: "new FishRetrieveSystem(this.#physicsConfig)" }],
      allocationBaseline: allocation(14, 0, 3, 0),
      compositionIdentityReview: true,
    }),
  },
  migrationGates: ["three-exact-source-and-method-shapes", "three-export-identities-and-activations",
    "five-exact-completed-prefix-imports", "five-owner-created-composition-identities",
    "one-reviewed-guarded-window-exposure", "four-exact-consumer-relationships-and-five-retired-bridges",
    "all-legacy-activation-positions-preserved", "zero-config-platform-browser-dev-dependencies",
    "zero-added-hot-loop-allocations"],
}).value;

module.exports = { BATCH_025_PREFLIGHT_PROFILE, BATCH_025_EXECUTION_PROFILE };
