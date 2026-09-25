"use strict";

const { StageThreeBatchExecutionProfile } = require("./stage_three_batch_execution_profile");
const { StageThreeBatchPreflightProfile } = require("./stage_three_batch_preflight_profile");

const allocation = (objectExpressions, arrayExpressions, newExpressions, objectFreezeCalls,
  objectAssignCalls = 0, roundingCalls = 0) => ({ objectExpressions, arrayExpressions,
  newExpressions, objectFreezeCalls, objectAssignCalls, roundingCalls });
const fishing = "src/core/fishing/";
const domain = "src/game/domain/fishing/";
const target = (suffix, exports) => ({ currentPath: fishing + suffix,
  targetPath: domain + suffix, exports });
const weakestTackle = "src/services/weakest_tackle_limit_resolver.js";
const fishForce = "src/systems/fish_force_system.js";
const fightPhysics = "src/systems/fight_physics_system.js";
const balanceFrame = "src/core/fishing/stamina/stamina_balance_frame.js";
const pressureResolver = "src/core/fishing/stamina/stamina_pressure_resolver.js";
const tackleStress = "src/systems/tackle_stress_system.js";
const windowExposure = (symbol, location) => ({ symbol, location, mechanism: "window-property" });

const BATCH_015_EXECUTION_PROFILE = new StageThreeBatchExecutionProfile({
  schemaVersion: 1,
  batchId: "stage-3.candidate-015-fishing-37dc3452",
  batchNumber: "015",
  executionStageLabel: "Stage 3.15.1",
  auditStageLabel: "Stage 3.15.0",
  focusedStageId: "stage-3.15.2",
  prebuildStageId: "stage-3.15.3",
  sourceReleaseVersion: "0.24.51",
  targetReleaseVersion: "0.24.52",
  auditPath: "architecture/migration/stage_3_batch_015_audit.json",
  executionPlanPath: "architecture/migration/stage_3_batch_015_execution_plan.json",
  testMatrixPath: "architecture/migration/stage_3_batch_015_test_matrix.json",
  expectedTargetCount: 6,
  expectedExportCount: 6,
  expectedActivationCount: 6,
  expectedConsumerCount: 6,
  expectedDependencyEdgeCount: 0,
  expectedTargets: [
    target("endurance/endurance_movement_debuff_calculator.js", ["EnduranceMovementDebuffCalculator"]),
    target("player_pressure/player_pressure_gain_resolver.js", ["PlayerPressureGainResolver"]),
    target("stamina/active_endurance_drain_calculator.js", ["ActiveEnduranceDrainCalculator"]),
    target("stamina/passive_endurance_drain_calculator.js", ["PassiveEnduranceDrainCalculator"]),
    target("stamina/stamina_lateral_position_resolver.js", ["StaminaLateralPositionResolver"]),
    { currentPath: weakestTackle, targetPath: domain + "weakest_tackle_limit_resolver.js",
      exports: ["WeakestTackleLimitResolver"] },
  ],
  expectedActivationIds: ["activation-20cb461d88b8", "activation-34fdfded9090",
    "activation-3b06bb1eb5b8", "activation-a9ba2b558615", "activation-e94561a6959c",
    "activation-fa95b209e285"],
  expectedActivationPositions: [96, 102, 103, 104, 111, 203],
  expectedBridgeIds: ["bridge-011678614086", "bridge-1ef925dd2ea8", "bridge-a285ed92f069",
    "bridge-b31831993e56", "bridge-b6066189c484", "bridge-f459f48ff32c"],
  expectedTopology: { beforeProjectModuleCount: 56, afterProjectModuleCount: 62,
    beforeActivationCount: 59, afterActivationCount: 65,
    beforeBridgeCount: 89, afterBridgeCount: 95 },
  includeRuntimeActiveState: true,
  persistActiveBatchPhase: true,
  includeDetailedStatePerformanceGates: true,
  behaviorPhases: ["classic-baseline", "temporary-esm-parity", "post-cutover-esm"],
  compatibilityPhases: ["pre-build-fixture", "temporary-esm-parity", "post-build-runtime"],
  scmCheckpointRequired: true,
  sourceReleaseTag: "v0.24.51",
  bridgeReason: "Preserve the exact Fishing domain consumers until their legacy symbols are removed.",
  rollbackRule: "restore-only-batch-015-delta-and-keep-batches-001-through-014",
  consumerSetSource: "stage-3.15.0-live-observation-and-frozen-consumer-set",
  operationIds: ["verify-frozen-evidence", "open-batch-015", "create-six-named-esm-targets",
    "render-six-candidate-activation-shims", "project-six-consumer-bridges",
    "project-candidate-manifest", "validate-candidate-and-commit-atomic-cutover",
    "validate-identity-timing-state-and-behavior", "persist-and-reconcile-observations",
    "run-full-acceptance", "close-release-0.24.52"],
}).value;

const BATCH_015_PREFLIGHT_PROFILE = new StageThreeBatchPreflightProfile({
  schemaVersion: 1,
  stageLabel: "Stage 3.15.0",
  artifactKind: "cyber-fishing-stage-3-batch-preflight-audit",
  batchId: BATCH_015_EXECUTION_PROFILE.batchId,
  sourceReleaseVersion: BATCH_015_EXECUTION_PROFILE.sourceReleaseVersion,
  executionProfile: BATCH_015_EXECUTION_PROFILE,
  sideEffectEvidence: { path: "architecture/migration/stage_3_batch_015_side_effect_review.json",
    sha256: "e7caf6527d853968fa91c5e2d43d2d649b6c6273d81998ebdc740cdb74eb377b" },
  reviewedContracts: {
    [fishing + "endurance/endurance_movement_debuff_calculator.js"]: {
      classification: "authoritative-owner", instanceFields: ["DEFAULT_RADIAL_RANGE"],
      publicStateShape: [], resultShape: [], stableResultIdentity: false, mutatesCallerInputs: false,
      semanticRisk: "endurance-movement-debuff-progress-radial-range-static-frozen-default",
      performanceClassification: "existing-fish-force-endurance-debuff",
      hotLoopCallSites: [fishForce],
      callSiteEvidence: [{ path: fishForce, marker: "new EnduranceMovementDebuffCalculator()" }],
      allocationBaseline: allocation(13, 7, 0, 9),
      frozenStaticFields: { className: "EnduranceMovementDebuffCalculator", bindings: {
        DEFAULT_RADIAL_RANGE: { location: "2:33", values: [0.35, 1] },
      } },
    },
    [fishing + "player_pressure/player_pressure_gain_resolver.js"]: {
      classification: "authoritative-owner", instanceFields: ["#config"], publicStateShape: [],
      resultShape: [], stableResultIdentity: false, mutatesCallerInputs: false,
      semanticRisk: "player-pressure-gain-curve-config-defaults-and-window-exposure",
      performanceClassification: "existing-fight-physics-pressure-gain",
      hotLoopCallSites: [fightPhysics],
      callSiteEvidence: [{ path: fightPhysics, marker: "new PlayerPressureGainResolver()" }],
      allocationBaseline: allocation(9, 0, 0, 1),
      legacyExposure: windowExposure("PlayerPressureGainResolver", "96:3"),
    },
    [fishing + "stamina/active_endurance_drain_calculator.js"]: {
      classification: "authoritative-owner", instanceFields: [], publicStateShape: [],
      resultShape: [], stableResultIdentity: false, mutatesCallerInputs: false,
      semanticRisk: "active-endurance-drain-ratio-rate-and-window-exposure",
      performanceClassification: "existing-stamina-balance-active-drain",
      hotLoopCallSites: [balanceFrame],
      callSiteEvidence: [{ path: balanceFrame,
        marker: "activeEnduranceDrainCalculator = new ActiveEnduranceDrainCalculator()" }],
      allocationBaseline: allocation(3, 0, 0, 1),
      legacyExposure: windowExposure("ActiveEnduranceDrainCalculator", "47:3"),
    },
    [fishing + "stamina/passive_endurance_drain_calculator.js"]: {
      classification: "authoritative-owner", instanceFields: [], publicStateShape: [],
      resultShape: [], stableResultIdentity: false, mutatesCallerInputs: false,
      semanticRisk: "passive-endurance-drain-taut-line-behavior-and-window-exposure",
      performanceClassification: "existing-stamina-balance-passive-drain",
      hotLoopCallSites: [balanceFrame],
      callSiteEvidence: [{ path: balanceFrame,
        marker: "passiveEnduranceDrainCalculator = new PassiveEnduranceDrainCalculator()" }],
      allocationBaseline: allocation(8, 0, 0, 1),
      legacyExposure: windowExposure("PassiveEnduranceDrainCalculator", "116:3"),
    },
    [fishing + "stamina/stamina_lateral_position_resolver.js"]: {
      classification: "authoritative-owner", instanceFields: [], publicStateShape: [],
      resultShape: [], stableResultIdentity: false, mutatesCallerInputs: false,
      semanticRisk: "stamina-lateral-position-offset-angle-ratio-and-window-exposure",
      performanceClassification: "existing-stamina-pressure-lateral-position",
      hotLoopCallSites: [pressureResolver],
      callSiteEvidence: [{ path: pressureResolver,
        marker: "lateralPositionResolver = new StaminaLateralPositionResolver()" }],
      allocationBaseline: allocation(3, 0, 0, 1),
      legacyExposure: windowExposure("StaminaLateralPositionResolver", "49:3"),
    },
    [weakestTackle]: {
      classification: "authoritative-owner", instanceFields: [], publicStateShape: [],
      resultShape: [], stableResultIdentity: false, mutatesCallerInputs: false,
      semanticRisk: "weakest-tackle-limit-component-order-and-window-exposure",
      performanceClassification: "existing-tackle-stress-weakest-limit",
      hotLoopCallSites: [tackleStress],
      callSiteEvidence: [{ path: tackleStress, marker: "new WeakestTackleLimitResolver()" }],
      allocationBaseline: allocation(4, 1, 0, 3),
      legacyExposure: windowExposure("WeakestTackleLimitResolver", "84:3"),
    },
  },
  migrationGates: ["six-exact-source-and-method-shapes", "six-export-identities-and-activations",
    "one-frozen-static-numeric-literal-evaluation-effect", "five-reviewed-window-class-exposures",
    "six-exact-consumer-relationships", "all-legacy-activation-positions-preserved",
    "zero-config-platform-browser-dev-dependencies", "zero-added-hot-loop-allocations"],
}).value;

module.exports = { BATCH_015_PREFLIGHT_PROFILE, BATCH_015_EXECUTION_PROFILE };
