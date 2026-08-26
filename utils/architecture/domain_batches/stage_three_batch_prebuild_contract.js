"use strict";

const { immutableRecord } = require("../guards/core/guard_models");
const {
  CanonicalActivationIdentity,
} = require("../../build/compat_runtime/cumulative_runtime_contract");
const {
  CanonicalBridgeIdentity,
} = require("../../build/legacy_bridge_build_config");
const { BATCH_ID } = require("./stage_three_batch_dependency_state_audit");

const COMPLETED_PREFIX = Object.freeze([
  "stage-3.candidate-001-inventory-85f44b2e",
  "stage-3.candidate-002-fishing-944d0790",
  "stage-3.candidate-003-fishing-9700ad4f",
  "stage-3.candidate-004-equipment-4f2570dc",
  "stage-3.candidate-005-fishing-45d0c7ce",
]);

class StageThreeBatchPrebuildContractBuilder {
  build({ audit, auditSha256, executionPlan, executionPlanSha256, testMatrix,
    testMatrixSha256, executionState, executionStateSha256, manifestSha256,
    runtimeContractSha256, bridgeRegistrySha256 }) {
    this.#require(audit?.verdict === "eligible-for-execution-plan", "audit does not allow planning");
    this.#require(executionPlan?.status === "execution-plan-verified", "execution plan is not verified");
    this.#require(executionPlan?.batchId === BATCH_ID, "execution plan batch differs");
    this.#require(testMatrix?.status === "verified", "focused test matrix is not verified");
    this.#require(testMatrix?.verdict === "eligible-for-prebuild-open", "focused test matrix does not allow prebuild open");
    this.#require(this.#same(executionState.completedBatchIds, COMPLETED_PREFIX), "completed prefix differs");
    this.#require(executionState.activeBatchId === null, "another batch is already active");
    this.#require(executionState.compatibilityRuntimeActivated === true, "compatibility runtime must already be active");

    const activations = executionPlan.compatibility.activations
      .map((record) => this.#activationContract(record))
      .sort((left, right) => left.id.localeCompare(right.id));
    const bridges = executionPlan.compatibility.plannedBridgeRecords
      .map((record) => structuredClone(record))
      .sort((left, right) => left.id.localeCompare(right.id));
    const auditModules = new Map(audit.scope.modules.map((record) => [
      record.currentPath,
      record,
    ]));
    const targets = executionPlan.scope.modules.map((record) => ({
      currentPath: record.currentPath,
      targetPath: record.targetPath,
      targetBoundary: "game-domain",
      roles: [...(auditModules.get(record.currentPath)?.roles || [])],
      migrationStatus: "planned",
      observationStatus: "pending",
      sourceSha256: record.sourceSha256,
    })).sort((left, right) => left.targetPath.localeCompare(right.targetPath));

    return immutableRecord({
      schemaVersion: 1,
      kind: "cyber-fishing-stage-3-prebuild-contract",
      status: "prebuild-open",
      batchId: BATCH_ID,
      sourceReleaseVersion: executionPlan.sourceReleaseVersion,
      targetReleaseVersion: executionPlan.targetReleaseVersion,
      evidence: {
        audit: this.#evidence("architecture/migration/stage_3_batch_006_audit.json", auditSha256),
        executionPlan: this.#evidence("architecture/migration/stage_3_batch_006_execution_plan.json", executionPlanSha256),
        testMatrix: this.#evidence("architecture/migration/stage_3_batch_006_test_matrix.json", testMatrixSha256),
        executionStateBefore: this.#evidence("architecture/migration/stage_3_execution_state.json", executionStateSha256),
        manifestBefore: this.#evidence("architecture/migration/module_migration_manifest.json", manifestSha256),
        runtimeContractBefore: this.#evidence("architecture/migration/stage_3_compatibility_runtime.json", runtimeContractSha256),
        bridgeRegistryBefore: this.#evidence("architecture/guards/migration_bridge_registry.json", bridgeRegistrySha256),
      },
      lifecycle: {
        completedBatchIds: [...COMPLETED_PREFIX],
        activeBatchId: BATCH_ID,
        activeBatchPhase: "prebuild",
        compatibilityRuntimeActivated: true,
      },
      preliminaryMetadata: {
        targets,
        plannedActivationPositions: activations,
        plannedBridges: bridges,
      },
      activeRuntimeTopology: {
        selectedThroughBatch: COMPLETED_PREFIX.at(-1),
        projectModuleCount: executionPlan.cumulativeRuntime.beforeProjectModuleCount,
        activationCount: executionPlan.cumulativeRuntime.beforeActivationCount,
        physicalClassicScriptCount: executionPlan.scriptTopology.before.physicalClassicScriptCount,
        logicalLegacyPositionCount: executionPlan.scriptTopology.before.logicalLegacyPositionCount,
        moduleScriptCount: executionPlan.scriptTopology.before.moduleScriptCount,
      },
      plannedRuntimeTopology: {
        selectedThroughBatch: BATCH_ID,
        projectModuleCount: executionPlan.cumulativeRuntime.afterProjectModuleCount,
        activationCount: executionPlan.cumulativeRuntime.afterActivationCount,
        targetSelection: executionPlan.lifecycle.runtimeTargetSelection,
      },
      locks: {
        sourceFilesCreated: false,
        sourceProvidersReplaced: false,
        indexChanged: false,
        runtimeRebuilt: false,
        observationsFinal: false,
        runtimeCutoverAllowed: false,
        unlockCondition: "stage-3.6.5-target-source-and-build-validation",
      },
      verdict: "eligible-for-target-source-and-build-validation",
    });
  }

  #activationContract(record) {
    const contract = {
      id: record.id,
      owner: record.owner,
      sourceProvider: record.sourceProvider,
      targetModule: record.targetModule,
      exportName: record.exportName,
      legacySymbol: record.legacySymbol,
      legacyScriptIndex: record.legacyScriptIndex,
      shimFile: record.shimFile,
      reason: record.reason,
      removalStage: record.removalStage,
    };
    this.#require(contract.id === CanonicalActivationIdentity.id(contract), `activation is not canonical: ${contract.id}`);
    return contract;
  }

  #evidence(path, sha256) {
    this.#require(/^[a-f0-9]{64}$/.test(sha256 || ""), `invalid fingerprint: ${path}`);
    return { path, sha256 };
  }

  #same(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  #require(condition, message) {
    if (!condition) throw new Error(`Stage 3.6.4 prebuild contract failed: ${message}`);
  }
}

class StageThreeBatchPrebuildContractValidator {
  validate(contract) {
    const errors = [];
    const require = (condition, message) => {
      if (!condition) errors.push(message);
    };
    require(contract?.schemaVersion === 1, "schemaVersion must be 1");
    require(contract?.kind === "cyber-fishing-stage-3-prebuild-contract", "kind is invalid");
    require(contract?.status === "prebuild-open", "status must be prebuild-open");
    require(contract?.batchId === BATCH_ID, "batchId differs");
    require(this.#same(contract?.lifecycle?.completedBatchIds, COMPLETED_PREFIX), "completed prefix differs");
    require(contract?.lifecycle?.activeBatchId === BATCH_ID, "active batch differs");
    require(contract?.lifecycle?.activeBatchPhase === "prebuild", "active phase differs");
    require(contract?.lifecycle?.compatibilityRuntimeActivated === true, "runtime activation differs");
    const targets = contract?.preliminaryMetadata?.targets || [];
    const activations = contract?.preliminaryMetadata?.plannedActivationPositions || [];
    const bridges = contract?.preliminaryMetadata?.plannedBridges || [];
    require(targets.length === 6, "target metadata must contain six records");
    require(activations.length === 6, "planned activations must contain six records");
    require(bridges.length === 7, "planned bridges must contain seven records");
    require(new Set(targets.map((record) => record.targetPath)).size === 6, "target paths must be unique");
    require(targets.every((record) => record.targetBoundary === "game-domain" &&
      record.migrationStatus === "planned" && record.observationStatus === "pending"), "target metadata status differs");
    require(activations.every((record) => record.id === CanonicalActivationIdentity.id(record)), "planned activation identity differs");
    require(bridges.every((record) => record.id === CanonicalBridgeIdentity.id(record)), "planned bridge identity differs");
    require(new Set(bridges.map((record) => `${record.bridge}\0${record.source}`)).size === 7, "planned bridge consumer set is not exact");
    require(contract?.activeRuntimeTopology?.projectModuleCount === 19, "active module topology differs");
    require(contract?.activeRuntimeTopology?.activationCount === 20, "active activation topology differs");
    require(contract?.plannedRuntimeTopology?.projectModuleCount === 25, "planned module topology differs");
    require(contract?.plannedRuntimeTopology?.activationCount === 26, "planned activation topology differs");
    require(contract?.locks?.runtimeCutoverAllowed === false, "prebuild must not allow runtime cutover");
    require(contract?.locks?.observationsFinal === false, "observations must remain preliminary");
    require(contract?.verdict === "eligible-for-target-source-and-build-validation", "verdict differs");
    for (const evidence of Object.values(contract?.evidence || {})) {
      require(/^[a-f0-9]{64}$/.test(evidence?.sha256 || ""), `invalid evidence fingerprint: ${evidence?.path}`);
    }
    if (errors.length > 0) {
      throw new Error(`Stage 3.6.4 prebuild contract failed:\n- ${errors.join("\n- ")}`);
    }
    return immutableRecord(contract);
  }

  #same(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
  }
}

module.exports = {
  BATCH_ID,
  COMPLETED_PREFIX,
  StageThreeBatchPrebuildContractBuilder,
  StageThreeBatchPrebuildContractValidator,
};
