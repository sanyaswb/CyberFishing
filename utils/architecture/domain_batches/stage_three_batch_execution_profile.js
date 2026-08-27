"use strict";

const { immutableRecord } = require("../guards/core/guard_models");

class StageThreeBatchExecutionProfile {
  constructor(definition) {
    this.value = this.#validate(definition);
  }

  #validate(definition) {
    const errors = [];
    const require = (condition, message) => {
      if (!condition) errors.push(message);
    };
    const positiveInteger = (value) => Number.isInteger(value) && value > 0;
    const normalizedPath = (value) =>
      typeof value === "string" &&
      value.length > 0 &&
      value.includes("/") &&
      !value.includes("\\") &&
      !value.includes("..") &&
      !value.includes("*");

    require(definition?.schemaVersion === 1, "schemaVersion must be 1");
    require(typeof definition?.batchId === "string" && definition.batchId.length > 0, "batchId is required");
    require(/^\d{3}$/u.test(definition?.batchNumber), "batchNumber must contain three digits");
    for (const field of [
      "executionStageLabel",
      "auditStageLabel",
      "focusedStageId",
      "prebuildStageId",
      "sourceReleaseVersion",
      "targetReleaseVersion",
      "bridgeReason",
      "rollbackRule",
      "consumerSetSource",
    ]) {
      require(typeof definition?.[field] === "string" && definition[field].length > 0, `${field} is required`);
    }
    for (const field of ["auditPath", "executionPlanPath", "testMatrixPath"]) {
      require(normalizedPath(definition?.[field]), `${field} must be a normalized project path`);
    }
    for (const field of [
      "expectedTargetCount",
      "expectedExportCount",
      "expectedActivationCount",
      "expectedConsumerCount",
    ]) {
      require(positiveInteger(definition?.[field]), `${field} must be a positive integer`);
    }
    require(Number.isInteger(definition?.expectedDependencyEdgeCount) && definition.expectedDependencyEdgeCount >= 0,
      "expectedDependencyEdgeCount must be a non-negative integer");
    require(Array.isArray(definition?.operationIds) && definition.operationIds.length === 11,
      "operationIds must contain the eleven ordered execution operations");
    require(new Set(definition?.operationIds || []).size === definition?.operationIds?.length,
      "operationIds must be unique");
    require(Array.isArray(definition?.expectedTargets) &&
      definition.expectedTargets.length === definition?.expectedTargetCount,
    "expectedTargets must cover every target");
    for (const target of definition?.expectedTargets || []) {
      require(normalizedPath(target?.currentPath), "expected target currentPath is invalid");
      require(normalizedPath(target?.targetPath), "expected target targetPath is invalid");
      require(Array.isArray(target?.exports) && target.exports.length > 0,
        "expected target exports are required");
    }
    require(Array.isArray(definition?.expectedActivationIds) &&
      definition.expectedActivationIds.length === definition?.expectedActivationCount,
    "expectedActivationIds must cover every activation");
    require(Array.isArray(definition?.expectedActivationPositions) &&
      definition.expectedActivationPositions.length === definition?.expectedActivationCount,
    "expectedActivationPositions must cover every activation");
    require(Array.isArray(definition?.expectedBridgeIds) &&
      definition.expectedBridgeIds.length === definition?.expectedConsumerCount,
    "expectedBridgeIds must cover every consumer relationship");
    require(new Set(definition?.expectedActivationIds || []).size === definition?.expectedActivationIds?.length,
      "expectedActivationIds must be unique");
    require(new Set(definition?.expectedBridgeIds || []).size === definition?.expectedBridgeIds?.length,
      "expectedBridgeIds must be unique");
    require(typeof definition?.includeRuntimeActiveState === "boolean",
      "includeRuntimeActiveState must be boolean");
    require(typeof definition?.includeDetailedStatePerformanceGates === "boolean",
      "includeDetailedStatePerformanceGates must be boolean");
    require(Array.isArray(definition?.behaviorPhases) && definition.behaviorPhases.length >= 2,
      "behaviorPhases must contain baseline and post-cutover phases");
    require(Array.isArray(definition?.compatibilityPhases) && definition.compatibilityPhases.length >= 2,
      "compatibilityPhases must contain pre-build and post-build phases");
    require(typeof definition?.scmCheckpointRequired === "boolean",
      "scmCheckpointRequired must be boolean");
    if (definition?.scmCheckpointRequired) {
      require(definition?.sourceReleaseTag === `v${definition?.sourceReleaseVersion}`,
        "sourceReleaseTag must match sourceReleaseVersion");
    } else {
      require(definition?.sourceReleaseTag === null,
        "sourceReleaseTag must be null when SCM evidence is not required");
    }
    const topology = definition?.expectedTopology;
    for (const field of [
      "beforeProjectModuleCount",
      "afterProjectModuleCount",
      "beforeActivationCount",
      "afterActivationCount",
      "beforeBridgeCount",
      "afterBridgeCount",
    ]) {
      require(Number.isInteger(topology?.[field]) && topology[field] >= 0,
        `expectedTopology.${field} must be a non-negative integer`);
    }
    require(
      topology?.afterProjectModuleCount - topology?.beforeProjectModuleCount === definition?.expectedTargetCount,
      "project-module topology delta must equal expectedTargetCount",
    );
    require(
      topology?.afterActivationCount - topology?.beforeActivationCount === definition?.expectedActivationCount,
      "activation topology delta must equal expectedActivationCount",
    );
    require(
      topology?.afterBridgeCount - topology?.beforeBridgeCount === definition?.expectedConsumerCount,
      "bridge topology delta must equal expectedConsumerCount",
    );
    if (errors.length > 0) {
      throw new Error(`Stage 3 batch execution profile failed:\n- ${errors.join("\n- ")}`);
    }
    return immutableRecord(definition);
  }
}

const BATCH_006_EXECUTION_PROFILE = new StageThreeBatchExecutionProfile({
  schemaVersion: 1,
  batchId: "stage-3.candidate-006-fishing-e48e70d8",
  batchNumber: "006",
  executionStageLabel: "Stage 3.6.2",
  auditStageLabel: "Stage 3.6.1",
  focusedStageId: "stage-3.6.3",
  prebuildStageId: "stage-3.6.4",
  sourceReleaseVersion: "0.24.42",
  targetReleaseVersion: "0.24.43",
  auditPath: "architecture/migration/stage_3_batch_006_audit.json",
  executionPlanPath: "architecture/migration/stage_3_batch_006_execution_plan.json",
  testMatrixPath: "architecture/migration/stage_3_batch_006_test_matrix.json",
  expectedTargetCount: 6,
  expectedExportCount: 6,
  expectedActivationCount: 6,
  expectedConsumerCount: 7,
  expectedDependencyEdgeCount: 0,
  expectedTargets: [
    { currentPath: "src/core/fishing/hold_opposition_resolver.js", targetPath: "src/game/domain/fishing/hold_opposition_resolver.js", exports: ["HoldOppositionResolver"] },
    { currentPath: "src/core/fishing/landing_lift_tension_calculator.js", targetPath: "src/game/domain/fishing/landing_lift_tension_calculator.js", exports: ["LandingLiftTensionCalculator"] },
    { currentPath: "src/core/fishing/line_constraint_state_resolver.js", targetPath: "src/game/domain/fishing/line_constraint_state_resolver.js", exports: ["LineConstraintStateResolver"] },
    { currentPath: "src/core/fishing/pole_fight_sector_geometry.js", targetPath: "src/game/domain/fishing/pole_fight_sector_geometry.js", exports: ["PoleFightSectorGeometry"] },
    { currentPath: "src/core/fishing/rod_control_tension_mode_resolver.js", targetPath: "src/game/domain/fishing/rod_control_tension_mode_resolver.js", exports: ["RodControlTensionModeResolver"] },
    { currentPath: "src/core/float_tackle_line_budget_policy.js", targetPath: "src/game/domain/fishing/float_tackle_line_budget_policy.js", exports: ["FloatTackleLineBudgetPolicy"] },
  ],
  expectedActivationIds: [
    "activation-7678742c83cf",
    "activation-775fb46bb6ce",
    "activation-8f8220d288e5",
    "activation-9857928fc9d0",
    "activation-f70148ad6a58",
    "activation-ffea5244c4bf",
  ],
  expectedActivationPositions: [88, 123, 126, 130, 134, 140],
  expectedBridgeIds: [
    "bridge-225041916b22",
    "bridge-451e340bf590",
    "bridge-6c073ecab1b3",
    "bridge-87740b3c6660",
    "bridge-c6c1e5eb790e",
    "bridge-c7d38bfb778f",
    "bridge-f6d56e05e037",
  ],
  expectedTopology: {
    beforeProjectModuleCount: 19,
    afterProjectModuleCount: 25,
    beforeActivationCount: 20,
    afterActivationCount: 26,
    beforeBridgeCount: 41,
    afterBridgeCount: 48,
  },
  includeRuntimeActiveState: false,
  includeDetailedStatePerformanceGates: false,
  behaviorPhases: ["classic-baseline", "post-cutover-esm"],
  compatibilityPhases: ["pre-build-fixture", "post-build-runtime"],
  scmCheckpointRequired: false,
  sourceReleaseTag: null,
  bridgeReason: "Preserve the exact synchronous Fishing Domain Primitives II consumer set until its approved migration stage removes the legacy symbols.",
  rollbackRule: "restore-only-batch-006-delta-and-keep-batches-001-through-005",
  consumerSetSource: "stage-3.6.2-planned-canonical-bridge-records",
  operationIds: [
    "verify-frozen-evidence",
    "open-batch-006",
    "create-six-named-esm-targets",
    "render-six-activation-shims",
    "register-seven-consumer-bridges",
    "project-preliminary-manifest-metadata",
    "build-single-cumulative-runtime",
    "validate-identity-timing-and-behavior",
    "persist-and-reconcile-observations",
    "run-full-acceptance",
    "close-release-0.24.43",
  ],
}).value;

const BATCH_007_EXECUTION_PROFILE = new StageThreeBatchExecutionProfile({
  schemaVersion: 1,
  batchId: "stage-3.candidate-007-fishing-bb8b3939",
  batchNumber: "007",
  executionStageLabel: "Stage 3.7.1",
  auditStageLabel: "Stage 3.7.0",
  focusedStageId: "stage-3.7.2",
  prebuildStageId: "stage-3.7.3",
  sourceReleaseVersion: "0.24.43",
  targetReleaseVersion: "0.24.44",
  auditPath: "architecture/migration/stage_3_batch_007_audit.json",
  executionPlanPath: "architecture/migration/stage_3_batch_007_execution_plan.json",
  testMatrixPath: "architecture/migration/stage_3_batch_007_test_matrix.json",
  expectedTargetCount: 6,
  expectedExportCount: 6,
  expectedActivationCount: 6,
  expectedConsumerCount: 9,
  expectedDependencyEdgeCount: 0,
  expectedTargets: [
    { currentPath: "src/core/fishing/line_constrained_fish_motion_resolver.js", targetPath: "src/game/domain/fishing/line_constrained_fish_motion_resolver.js", exports: ["LineConstrainedFishMotionResolver"] },
    { currentPath: "src/core/fishing/line_radial_movement_splitter.js", targetPath: "src/game/domain/fishing/line_radial_movement_splitter.js", exports: ["LineRadialMovementSplitter"] },
    { currentPath: "src/core/fishing/reel_retrieve_speed_calculator.js", targetPath: "src/game/domain/fishing/reel_retrieve_speed_calculator.js", exports: ["ReelRetrieveSpeedCalculator"] },
    { currentPath: "src/core/fishing/rod_pull_state.js", targetPath: "src/game/domain/fishing/rod_pull_state.js", exports: ["RodPullState"] },
    { currentPath: "src/core/fishing/rod_stroke_state.js", targetPath: "src/game/domain/fishing/rod_stroke_state.js", exports: ["RodStrokeState"] },
    { currentPath: "src/core/fishing/simple_fight_force_calculator.js", targetPath: "src/game/domain/fishing/simple_fight_force_calculator.js", exports: ["SimpleFightForceCalculator"] },
  ],
  expectedActivationIds: [
    "activation-00287f399f05",
    "activation-a63204f0676b",
    "activation-ccddea60d16c",
    "activation-da8d3f6d370f",
    "activation-dcb3cecb345c",
    "activation-f5eefdd6e6e2",
  ],
  expectedActivationPositions: [91, 92, 112, 131, 132, 139],
  expectedBridgeIds: [
    "bridge-1975df3eebf9",
    "bridge-292102f00c09",
    "bridge-9987d14a6b96",
    "bridge-c5b20a842e06",
    "bridge-d88e995bce27",
    "bridge-dcceaaf04a57",
    "bridge-dd65f33afb4a",
    "bridge-ddf61a64424b",
    "bridge-f20190e70bbd",
  ],
  expectedTopology: {
    beforeProjectModuleCount: 25,
    afterProjectModuleCount: 31,
    beforeActivationCount: 26,
    afterActivationCount: 32,
    beforeBridgeCount: 48,
    afterBridgeCount: 57,
  },
  includeRuntimeActiveState: true,
  includeDetailedStatePerformanceGates: true,
  behaviorPhases: ["classic-baseline", "temporary-esm-parity", "post-cutover-esm"],
  compatibilityPhases: ["pre-build-fixture", "temporary-esm-parity", "post-build-runtime"],
  scmCheckpointRequired: true,
  sourceReleaseTag: "v0.24.43",
  bridgeReason: "Preserve the exact synchronous Fishing State and Motion Primitives consumer set until its approved migration stage removes the legacy symbols.",
  rollbackRule: "restore-only-batch-007-delta-and-keep-batches-001-through-006",
  consumerSetSource: "stage-3.7.1-planned-canonical-bridge-records",
  operationIds: [
    "verify-frozen-evidence",
    "open-batch-007",
    "create-six-named-esm-targets",
    "render-six-activation-shims",
    "register-nine-consumer-bridges",
    "project-preliminary-manifest-metadata",
    "build-single-cumulative-runtime",
    "validate-identity-timing-and-behavior",
    "persist-and-reconcile-observations",
    "run-full-acceptance",
    "close-release-0.24.44",
  ],
}).value;

module.exports = {
  StageThreeBatchExecutionProfile,
  BATCH_006_EXECUTION_PROFILE,
  BATCH_007_EXECUTION_PROFILE,
};
