"use strict";

const { immutableRecord } = require("../guards/core/guard_models");
const {
  BATCH_006_EXECUTION_PROFILE,
  BATCH_007_EXECUTION_PROFILE,
} = require("./stage_three_batch_execution_profile");

const COMPLETED_005 = Object.freeze([
  "stage-3.candidate-001-inventory-85f44b2e",
  "stage-3.candidate-002-fishing-944d0790",
  "stage-3.candidate-003-fishing-9700ad4f",
  "stage-3.candidate-004-equipment-4f2570dc",
  "stage-3.candidate-005-fishing-45d0c7ce",
]);

const COMPLETED_006 = Object.freeze([
  ...COMPLETED_005,
  BATCH_006_EXECUTION_PROFILE.batchId,
]);

class StageThreeBatchPrebuildProfile {
  constructor(definition) {
    this.value = this.#validate(definition);
  }

  #validate(definition) {
    const errors = [];
    const require = (condition, message) => {
      if (!condition) errors.push(message);
    };
    const topology = definition?.topology;
    require(definition?.schemaVersion === 1, "profile schemaVersion must be 1");
    require([1, 2].includes(definition?.contractSchemaVersion),
      "contractSchemaVersion must be 1 or 2");
    require(typeof definition?.stageLabel === "string", "stageLabel is required");
    require(typeof definition?.batchId === "string", "batchId is required");
    require(Array.isArray(definition?.completedPrefix), "completedPrefix is required");
    require(definition?.completedPrefix?.at(-1) !== definition?.batchId,
      "active batch must not be part of completedPrefix");
    require(definition?.executionProfile?.batchId === definition?.batchId,
      "execution profile batch differs");
    require(typeof definition?.artifactPath === "string" && definition.artifactPath.endsWith(".json"),
      "artifactPath is invalid");
    require(definition?.planningStorage === "prebuild-contract-only" ||
      definition?.planningStorage === "historical-distributed-v1",
    "planningStorage is invalid");
    for (const field of ["modules", "activations", "bridges"]) {
      require(Number.isInteger(topology?.active?.[field]) && topology.active[field] >= 0,
        `active topology ${field} is invalid`);
      require(Number.isInteger(topology?.delta?.[field]) && topology.delta[field] >= 0,
        `delta topology ${field} is invalid`);
      require(topology?.planned?.[field] === topology?.active?.[field] + topology?.delta?.[field],
        `planned topology ${field} must equal active + delta`);
    }
    require(topology?.delta?.modules === definition?.executionProfile?.expectedTargetCount,
      "module delta differs from execution profile");
    require(topology?.delta?.activations === definition?.executionProfile?.expectedActivationCount,
      "activation delta differs from execution profile");
    require(topology?.delta?.bridges === definition?.executionProfile?.expectedConsumerCount,
      "bridge delta differs from execution profile");
    require(typeof definition?.unlockCondition === "string", "unlockCondition is required");
    require(typeof definition?.verdict === "string", "verdict is required");
    if (errors.length > 0) {
      throw new Error(`Stage 3 prebuild profile failed:\n- ${errors.join("\n- ")}`);
    }
    return immutableRecord(definition);
  }
}

const BATCH_006_PREBUILD_PROFILE = new StageThreeBatchPrebuildProfile({
  schemaVersion: 1,
  contractSchemaVersion: 1,
  stageLabel: "Stage 3.6.4",
  batchId: BATCH_006_EXECUTION_PROFILE.batchId,
  completedPrefix: COMPLETED_005,
  executionProfile: BATCH_006_EXECUTION_PROFILE,
  artifactPath: "architecture/migration/stage_3_batch_006_prebuild_contract.json",
  planningStorage: "historical-distributed-v1",
  topology: {
    active: { modules: 19, activations: 20, bridges: 41 },
    delta: { modules: 6, activations: 6, bridges: 7 },
    planned: { modules: 25, activations: 26, bridges: 48 },
  },
  unlockCondition: "stage-3.6.5-target-source-and-build-validation",
  verdict: "eligible-for-target-source-and-build-validation",
}).value;

const BATCH_007_PREBUILD_PROFILE = new StageThreeBatchPrebuildProfile({
  schemaVersion: 1,
  contractSchemaVersion: 2,
  stageLabel: "Stage 3.7.3",
  batchId: BATCH_007_EXECUTION_PROFILE.batchId,
  completedPrefix: COMPLETED_006,
  executionProfile: BATCH_007_EXECUTION_PROFILE,
  artifactPath: "architecture/migration/stage_3_batch_007_prebuild_contract.json",
  planningStorage: "prebuild-contract-only",
  topology: {
    active: { modules: 25, activations: 26, bridges: 48 },
    delta: { modules: 6, activations: 6, bridges: 9 },
    planned: { modules: 31, activations: 32, bridges: 57 },
  },
  unlockCondition: "stage-3.7.4-target-source-and-build-validation",
  verdict: "eligible-for-target-source-and-build-validation",
}).value;

module.exports = {
  BATCH_006_PREBUILD_PROFILE,
  BATCH_007_PREBUILD_PROFILE,
  StageThreeBatchPrebuildProfile,
};
