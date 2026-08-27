"use strict";

const { immutableRecord } = require("../guards/core/guard_models");
const {
  BATCH_007_APPROVED_VIRTUAL_MODULES,
} = require("./stage_three_batch_007_candidate_build");
const {
  BATCH_007_EXECUTION_PROFILE,
} = require("./stage_three_batch_execution_profile");
const {
  BATCH_007_PREBUILD_PROFILE,
} = require("./stage_three_batch_prebuild_profile");

class StageThreeBatch007SourceBuildContractValidator {
  validate(contract) {
    const profile = BATCH_007_EXECUTION_PROFILE;
    const errors = [];
    const require = (condition, message) => {
      if (!condition) errors.push(message);
    };
    require(contract?.schemaVersion === 1, "schemaVersion must be 1");
    require(contract?.kind === "cyber-fishing-stage-3-source-build-validation",
      "kind differs");
    require(contract?.status === "candidate-build-verified", "status differs");
    require(contract?.batchId === profile.batchId, "batchId differs");
    require(contract?.sourceReleaseVersion === profile.sourceReleaseVersion,
      "source release differs");
    require(contract?.targetReleaseVersion === profile.targetReleaseVersion,
      "target release differs");
    const sources = contract?.sources || [];
    require(sources.length === profile.expectedTargetCount, "source target count differs");
    require(this.#same(sources.map((record) => record.currentPath).sort(),
      profile.expectedTargets.map((record) => record.currentPath).sort()),
    "classic source set differs");
    require(this.#same(sources.map((record) => record.targetPath).sort(),
      profile.expectedTargets.map((record) => record.targetPath).sort()),
    "ESM target set differs");
    for (const expected of profile.expectedTargets) {
      const source = sources.find((record) => record.currentPath === expected.currentPath);
      require(source?.targetPath === expected.targetPath,
        `target mapping differs: ${expected.currentPath}`);
      require(source?.exportName === expected.exports[0],
        `target export differs: ${expected.currentPath}`);
    }
    for (const source of sources) {
      require(/^[a-f0-9]{64}$/u.test(source.sourceSha256 || ""),
        `classic fingerprint is invalid: ${source.currentPath}`);
      require(/^[a-f0-9]{64}$/u.test(source.targetSha256 || ""),
        `target fingerprint is invalid: ${source.targetPath}`);
      require(source.representation ===
        "classic-class-declaration-to-named-esm-export-only",
      `representation differs: ${source.targetPath}`);
      require(source.importCount === 0, `imports are forbidden: ${source.targetPath}`);
      require(source.behaviorDelta === "none", `behavior delta is forbidden: ${source.targetPath}`);
      require(source.stateOwnershipDelta === "none",
        `state ownership delta is forbidden: ${source.targetPath}`);
      require(source.allocationDelta === "none",
        `allocation delta is forbidden: ${source.targetPath}`);
    }
    const build = contract?.candidateBuild;
    require(build?.status === "candidate-build-verified", "candidate build status differs");
    require(build?.moduleCount === profile.expectedTopology.afterProjectModuleCount,
      "candidate module count differs");
    require(build?.activationCount === profile.expectedTopology.afterActivationCount,
      "candidate activation count differs");
    require(this.#same(build?.projectModules, contract?.plannedTopology?.projectModules),
      "candidate project module set differs from planned topology");
    require(build?.activationOutputs?.length === profile.expectedTopology.afterActivationCount,
      "candidate activation output set differs");
    require(this.#same(
      build?.activationOutputs?.map((record) => record.activationId).sort(),
      contract?.plannedTopology?.activationIds,
    ), "candidate activation identities differ from planned topology");
    require(this.#same(build?.selectedBatchIds,
      BATCH_007_PREBUILD_PROFILE.completedPrefix.concat(profile.batchId)),
    "candidate selected batch prefix differs");
    require(build?.candidateOutputPersisted === false,
      "candidate output must not remain persisted");
    require(this.#same(build?.virtualBuildModules,
      [...new Set(build?.virtualBuildModules || [])].sort()),
    "candidate virtual module set must be sorted and unique");
    require(this.#same(
      contract?.candidateInfrastructure?.virtualBuildModulesAdded,
      BATCH_007_APPROVED_VIRTUAL_MODULES,
    ), "candidate virtual helper delta differs");
    require(contract?.candidateInfrastructure?.classification === "build-helper",
      "candidate helper classification differs");
    require(contract?.candidateInfrastructure?.ownsGameState === false,
      "candidate helper must not own game state");
    require(this.#same(contract?.candidateInfrastructure?.globalAssignments, []),
      "candidate helper globals are forbidden");
    require(this.#same(contract?.candidateInfrastructure?.browserCapabilities, []),
      "candidate helper browser capabilities are forbidden");
    require(BATCH_007_APPROVED_VIRTUAL_MODULES.every((moduleId) =>
      build?.virtualBuildModules?.includes(moduleId)),
    "candidate build report omits an approved helper delta");
    require(this.#same(contract?.plannedTopology?.counts,
      BATCH_007_PREBUILD_PROFILE.topology.planned),
    "planned topology counts differ");
    require(contract?.plannedTopology?.projectModules?.length ===
      BATCH_007_PREBUILD_PROFILE.topology.planned.modules,
    "planned project module set differs");
    require(contract?.plannedTopology?.activationIds?.length ===
      BATCH_007_PREBUILD_PROFILE.topology.planned.activations,
    "planned activation identity set differs");
    require(contract?.plannedTopology?.bridgeIds?.length ===
      BATCH_007_PREBUILD_PROFILE.topology.planned.bridges,
    "planned bridge identity set differs");
    require(contract?.activeRuntimeLocks?.indexChanged === false,
      "index must remain unchanged");
    require(contract?.activeRuntimeLocks?.classicProvidersReplaced === false,
      "classic providers must remain active");
    require(contract?.activeRuntimeLocks?.runtimeContractChanged === false,
      "active runtime contract must remain unchanged");
    require(contract?.activeRuntimeLocks?.bridgeRegistryChanged === false,
      "active bridge registry must remain unchanged");
    require(contract?.activeRuntimeLocks?.validatedOutputChanged === false,
      "validated active output must remain unchanged");
    require(contract?.runtimeCutoverAllowed === false,
      "source/build validation must not allow runtime cutover itself");
    require(contract?.verdict === "eligible-for-atomic-runtime-cutover",
      "verdict differs");
    const expectedEvidencePaths = {
      prebuildContract: BATCH_007_PREBUILD_PROFILE.artifactPath,
      executionPlan: profile.executionPlanPath,
      testMatrix: profile.testMatrixPath,
      executionState: "architecture/migration/stage_3_execution_state.json",
      manifestAfterTargetReconciliation:
        "architecture/migration/module_migration_manifest.json",
      activeRuntimeContract:
        "architecture/migration/stage_3_compatibility_runtime.json",
      activeBridgeRegistry:
        "architecture/guards/migration_bridge_registry.json",
      index: "index.html",
    };
    require(this.#same(Object.keys(contract?.evidence || {}).sort(),
      Object.keys(expectedEvidencePaths).sort()),
    "evidence key set differs");
    for (const [key, expectedPath] of Object.entries(expectedEvidencePaths)) {
      const evidence = contract?.evidence?.[key];
      require(evidence?.path === expectedPath, `evidence path differs: ${key}`);
      require(/^[a-f0-9]{64}$/u.test(evidence?.sha256 || ""),
        `evidence fingerprint is invalid: ${expectedPath}`);
    }
    if (errors.length > 0) {
      throw new Error(`Stage 3.7.4 source/build contract failed:\n- ${errors.join("\n- ")}`);
    }
    return immutableRecord(contract);
  }

  #same(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
  }
}

module.exports = { StageThreeBatch007SourceBuildContractValidator };
