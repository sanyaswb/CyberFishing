"use strict";

const { immutableRecord } = require("../guards/core/guard_models");
const {
  BATCH_007_EXECUTION_PROFILE,
} = require("./stage_three_batch_execution_profile");
const {
  BATCH_007_PREBUILD_PROFILE,
} = require("./stage_three_batch_prebuild_profile");

class StageThreeBatch007CutoverContractValidator {
  validate(contract) {
    const errors = [];
    const require = (condition, message) => {
      if (!condition) errors.push(message);
    };
    const expected = BATCH_007_PREBUILD_PROFILE.topology.planned;
    require(contract?.schemaVersion === 1, "schemaVersion must be 1");
    require(contract?.kind === "cyber-fishing-stage-3-runtime-cutover",
      "kind differs");
    require(contract?.status === "runtime-active-verified", "status differs");
    require(contract?.batchId === BATCH_007_EXECUTION_PROFILE.batchId,
      "batchId differs");
    require(contract?.releaseVersion === BATCH_007_EXECUTION_PROFILE.sourceReleaseVersion,
      "cutover must not close the target release");
    require(contract?.lifecycle?.activeBatchPhase === "runtime-active",
      "active phase differs");
    require(this.#same(contract?.lifecycle?.completedBatchIds,
      BATCH_007_PREBUILD_PROFILE.completedPrefix), "completed prefix differs");
    require(contract?.lifecycle?.activeBatchId === BATCH_007_EXECUTION_PROFILE.batchId,
      "active batch differs");
    require(contract?.lifecycle?.batchCompleted === false,
      "cutover must not complete batch 007");
    require(this.#same(contract?.topology?.counts, expected), "topology counts differ");
    require(contract?.topology?.projectModules?.length === expected.modules,
      "project module set differs");
    require(contract?.topology?.activationIds?.length === expected.activations,
      "activation identity set differs");
    require(contract?.topology?.bridgeIds?.length === expected.bridges,
      "bridge identity set differs");
    require(contract?.build?.status === "built", "build status differs");
    require(contract?.build?.moduleCount === expected.modules, "build module count differs");
    require(contract?.build?.activationCount === expected.activations,
      "build activation count differs");
    require(contract?.build?.candidateRuntimeSha256 === contract?.build?.runtimeSha256,
      "active runtime differs from the reviewed candidate");
    require(this.#hash(contract?.build?.runtimeSha256), "runtime fingerprint is invalid");
    require(contract?.build?.previousOutputPreservedUntilValidation === true,
      "output replacement safety is not proven");
    require(contract?.sourceTransition?.targetCount === 6, "target count differs");
    require(contract?.sourceTransition?.shimCount === 6, "shim count differs");
    require(contract?.sourceTransition?.representationOnly === true,
      "representation-only invariant differs");
    require(contract?.sourceTransition?.partialCutoverAllowed === false,
      "partial cutover must be forbidden");
    require(contract?.dependencyObservation?.confirmedInterFileEdgesBefore === 771,
      "confirmed edge baseline differs");
    require(contract?.dependencyObservation?.confirmedInterFileEdgesAfter === 772,
      "confirmed edge result differs");
    require(contract?.dependencyObservation?.confirmedEdgeDelta === 1,
      "confirmed edge semantic delta differs");
    require(contract?.dependencyObservation?.newlyConfirmedEdges?.length === 1,
      "new confirmed edge evidence differs");
    const confirmedEdge = contract?.dependencyObservation?.newlyConfirmedEdges?.[0];
    require(confirmedEdge?.source ===
      "src/ui/inventory/inventory_v2_balance_parameter_resolver.js",
    "new confirmed edge source differs");
    require(confirmedEdge?.target ===
      "src/core/fishing/reel_retrieve_speed_calculator.js",
    "new confirmed edge target differs");
    require(this.#same(confirmedEdge?.symbols, ["ReelRetrieveSpeedCalculator"]),
      "new confirmed edge symbol set differs");
    require(contract?.scriptTopology?.physicalClassicScriptCount === 426,
      "physical script anchor differs");
    require(contract?.scriptTopology?.logicalLegacyPositionCount === 424,
      "logical script anchor differs");
    require(contract?.scriptTopology?.moduleScriptCount === 0,
      "module scripts are forbidden");
    require(contract?.rollback?.scope === "batch-007-only", "rollback scope differs");
    require(contract?.rollback?.preserveCompletedBatchesThrough ===
      "stage-3.candidate-006-fishing-e48e70d8", "rollback prefix differs");
    require(contract?.rollback?.partialRollbackAllowed === false,
      "partial rollback must be forbidden");
    require(contract?.nextGate === "stage-3.7.6-post-build-identity-and-timing-validation",
      "next gate differs");
    for (const evidence of Object.values(contract?.evidence || {})) {
      require(typeof evidence?.path === "string" && evidence.path.length > 0,
        "evidence path is invalid");
      require(this.#hash(evidence?.sha256), `evidence fingerprint is invalid: ${evidence?.path}`);
    }
    if (errors.length > 0) {
      throw new Error(`Stage 3.7.5 cutover contract failed:\n- ${errors.join("\n- ")}`);
    }
    return immutableRecord(contract);
  }

  #hash(value) {
    return /^[a-f0-9]{64}$/u.test(value || "");
  }

  #same(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
  }
}

module.exports = { StageThreeBatch007CutoverContractValidator };
