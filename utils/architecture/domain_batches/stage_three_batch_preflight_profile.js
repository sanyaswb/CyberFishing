"use strict";

const { immutableRecord } = require("../guards/core/guard_models");
const {
  StageThreeBatchExecutionProfile,
} = require("./stage_three_batch_execution_profile");

class StageThreeBatchPreflightProfile {
  constructor(definition) {
    this.value = this.#validate(definition);
  }

  #validate(definition) {
    const errors = [];
    const require = (condition, message) => {
      if (!condition) errors.push(message);
    };
    let executionProfile = null;
    try {
      executionProfile = StageThreeBatchExecutionProfile.validateImmutable(
        definition?.executionProfile,
      );
    } catch (error) {
      errors.push(error.message);
    }
    require(definition?.schemaVersion === 1, "schemaVersion must be 1");
    require(typeof definition?.stageLabel === "string" && definition.stageLabel.length > 0,
      "stageLabel is required");
    require(typeof definition?.artifactKind === "string" && definition.artifactKind.length > 0,
      "artifactKind is required");
    require(definition?.batchId === executionProfile?.batchId,
      "batchId must match execution profile");
    require(definition?.sourceReleaseVersion === executionProfile?.sourceReleaseVersion,
      "sourceReleaseVersion must match execution profile");
    const contracts = definition?.reviewedContracts;
    require(contracts && !Array.isArray(contracts) && typeof contracts === "object",
      "reviewedContracts are required");
    const expectedPaths = executionProfile?.expectedTargets.map((target) => target.currentPath).sort() || [];
    require(JSON.stringify(Object.keys(contracts || {}).sort()) === JSON.stringify(expectedPaths),
      "reviewedContracts must cover exact target paths");
    for (const [currentPath, contract] of Object.entries(contracts || {})) {
      for (const field of ["classification", "semanticRisk", "performanceClassification"]) {
        require(typeof contract?.[field] === "string" && contract[field].length > 0,
          `${currentPath} ${field} is required`);
      }
      for (const field of [
        "instanceFields", "publicStateShape", "resultShape", "hotLoopCallSites", "callSiteEvidence",
      ]) {
        require(Array.isArray(contract?.[field]), `${currentPath} ${field} must be an array`);
      }
      require(typeof contract?.stableResultIdentity === "boolean",
        `${currentPath} stableResultIdentity must be boolean`);
      require(typeof contract?.mutatesCallerInputs === "boolean",
        `${currentPath} mutatesCallerInputs must be boolean`);
      require(contract?.allocationBaseline && typeof contract.allocationBaseline === "object",
        `${currentPath} allocationBaseline is required`);
    }
    require(Array.isArray(definition?.migrationGates) && definition.migrationGates.length > 0,
      "migrationGates are required");
    if (errors.length > 0) {
      throw new Error(`Stage 3 batch preflight profile failed:\n- ${errors.join("\n- ")}`);
    }
    return immutableRecord(definition);
  }

  static validateImmutable(definition) {
    if (!definition || typeof definition !== "object" || !Object.isFrozen(definition)) {
      throw new Error("Stage 3 batch preflight profile is required and must be immutable");
    }
    return new StageThreeBatchPreflightProfile(definition).value;
  }
}

module.exports = { StageThreeBatchPreflightProfile };
