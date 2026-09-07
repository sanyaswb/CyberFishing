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
    require(typeof definition?.persistActiveBatchPhase === "boolean",
      "persistActiveBatchPhase must be boolean");
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

  static validateImmutable(definition) {
    if (!definition || typeof definition !== "object") {
      throw new Error("Stage 3 batch execution profile input is required");
    }
    if (!StageThreeBatchExecutionProfile.#isDeeplyFrozen(definition)) {
      throw new Error("Stage 3 batch execution profile must be deeply immutable");
    }
    return new StageThreeBatchExecutionProfile(definition).value;
  }

  static #isDeeplyFrozen(value, seen = new Set()) {
    if (!value || typeof value !== "object" || seen.has(value)) return true;
    if (!Object.isFrozen(value)) return false;
    seen.add(value);
    return Object.values(value).every((item) =>
      StageThreeBatchExecutionProfile.#isDeeplyFrozen(item, seen));
  }
}

module.exports = {
  StageThreeBatchExecutionProfile,
};
