"use strict";

const { immutableRecord } = require("../guards/core/guard_models");
const {
  CanonicalActivationIdentity,
} = require("../../build/compat_runtime/cumulative_runtime_contract");
const {
  CanonicalBridgeIdentity,
} = require("../../build/legacy_bridge_build_config");

class StageThreeBatchPrebuildContractBuilder {
  #profile;

  constructor(profile) {
    if (!profile) throw new Error("Stage 3 prebuild builder requires an immutable batch profile");
    this.#profile = profile;
  }

  build({ audit, auditSha256, executionPlan, executionPlanSha256, testMatrix,
    testMatrixSha256, executionState, executionStateSha256, manifestSha256,
    runtimeContract, runtimeContractSha256, bridgeRegistry, bridgeRegistrySha256 }) {
    const profile = this.#profile;
    this.#require(audit?.verdict === "eligible-for-execution-plan", "audit does not allow planning");
    this.#require(executionPlan?.status === "execution-plan-verified", "execution plan is not verified");
    this.#require(executionPlan?.batchId === profile.batchId, "execution plan batch differs");
    this.#require(testMatrix?.status === "verified", "focused test matrix is not verified");
    this.#require(testMatrix?.verdict === "eligible-for-prebuild-open", "focused test matrix does not allow prebuild open");
    this.#require(this.#same(executionState.completedBatchIds, profile.completedPrefix), "completed prefix differs");
    this.#require(executionState.activeBatchId === null, "another batch is already active");
    this.#require(executionState.activeBatchPhase === undefined, "inactive state retains an execution phase");
    this.#require(executionState.compatibilityRuntimeActivated === true, "compatibility runtime must already be active");

    const activations = executionPlan.compatibility.activations
      .map((record) => this.#activationContract(record))
      .sort((left, right) => left.id.localeCompare(right.id));
    const bridges = executionPlan.compatibility.plannedBridgeRecords
      .map((record) => structuredClone(record))
      .sort((left, right) => left.id.localeCompare(right.id));
    const auditModules = new Map(audit.scope.modules.map((record) => [record.currentPath, record]));
    const targets = executionPlan.scope.modules.map((record) => ({
      currentPath: record.currentPath,
      targetPath: record.targetPath,
      targetBoundary: "game-domain",
      roles: [...(auditModules.get(record.currentPath)?.roles || [])],
      migrationStatus: "planned",
      observationStatus: "pending",
      sourceSha256: record.sourceSha256,
    })).sort((left, right) => left.targetPath.localeCompare(right.targetPath));
    this.#require(targets.length === profile.topology.delta.modules, "target delta differs from profile");
    this.#require(activations.length === profile.topology.delta.activations, "activation delta differs from profile");
    this.#require(bridges.length === profile.topology.delta.bridges, "bridge delta differs from profile");

    const common = {
      schemaVersion: profile.contractSchemaVersion,
      kind: "cyber-fishing-stage-3-prebuild-contract",
      status: "prebuild-open",
      batchId: profile.batchId,
      sourceReleaseVersion: executionPlan.sourceReleaseVersion,
      targetReleaseVersion: executionPlan.targetReleaseVersion,
      evidence: {
        audit: this.#evidence(profile.executionProfile.auditPath, auditSha256),
        executionPlan: this.#evidence(profile.executionProfile.executionPlanPath, executionPlanSha256),
        testMatrix: this.#evidence(profile.executionProfile.testMatrixPath, testMatrixSha256),
        executionStateBefore: this.#evidence("architecture/migration/stage_3_execution_state.json", executionStateSha256),
        manifestBefore: this.#evidence("architecture/migration/module_migration_manifest.json", manifestSha256),
        runtimeContractBefore: this.#evidence("architecture/migration/stage_3_compatibility_runtime.json", runtimeContractSha256),
        bridgeRegistryBefore: this.#evidence("architecture/guards/migration_bridge_registry.json", bridgeRegistrySha256),
      },
      lifecycle: {
        completedBatchIds: [...profile.completedPrefix],
        activeBatchId: profile.batchId,
        activeBatchPhase: "prebuild",
        compatibilityRuntimeActivated: true,
      },
      preliminaryMetadata: {
        targets,
        plannedActivationPositions: activations,
        plannedBridges: bridges,
      },
    };
    if (profile.contractSchemaVersion === 1) {
      return immutableRecord({
        ...common,
        activeRuntimeTopology: {
          selectedThroughBatch: profile.completedPrefix.at(-1),
          projectModuleCount: executionPlan.cumulativeRuntime.beforeProjectModuleCount,
          activationCount: executionPlan.cumulativeRuntime.beforeActivationCount,
          physicalClassicScriptCount: executionPlan.scriptTopology.before.physicalClassicScriptCount,
          logicalLegacyPositionCount: executionPlan.scriptTopology.before.logicalLegacyPositionCount,
          moduleScriptCount: executionPlan.scriptTopology.before.moduleScriptCount,
        },
        plannedRuntimeTopology: {
          selectedThroughBatch: profile.batchId,
          projectModuleCount: executionPlan.cumulativeRuntime.afterProjectModuleCount,
          activationCount: executionPlan.cumulativeRuntime.afterActivationCount,
          targetSelection: executionPlan.lifecycle.runtimeTargetSelection,
        },
        locks: this.#locks(profile),
        verdict: profile.verdict,
      });
    }

    this.#require(runtimeContract && bridgeRegistry,
      "schema v2 requires active runtime and bridge registry documents");
    const targetPaths = targets.map((record) => record.targetPath).sort();
    const targetSet = new Set(targetPaths);
    const plannedProjectModules = [...executionPlan.cumulativeRuntime.projectModulesAfter].sort();
    const activeProjectModules = plannedProjectModules.filter((modulePath) => !targetSet.has(modulePath));
    const activeActivationIds = runtimeContract.activationPositions.map((record) => record.id).sort();
    const activeBridgeIds = bridgeRegistry.bridges.map((record) => record.id).sort();
    const deltaActivationIds = activations.map((record) => record.id).sort();
    const deltaBridgeIds = bridges.map((record) => record.id).sort();
    const plannedActivationIds = this.#union(activeActivationIds, deltaActivationIds);
    const plannedBridgeIds = this.#union(activeBridgeIds, deltaBridgeIds);
    this.#require(activeProjectModules.length === profile.topology.active.modules,
      "active module set differs from profile");
    this.#require(activeActivationIds.length === profile.topology.active.activations,
      "active activation set differs from profile");
    this.#require(activeBridgeIds.length === profile.topology.active.bridges,
      "active bridge set differs from profile");

    return immutableRecord({
      ...common,
      planningStorage: profile.planningStorage,
      activeTopology: {
        projectModules: activeProjectModules,
        activationIds: activeActivationIds,
        bridgeIds: activeBridgeIds,
        counts: { ...profile.topology.active },
        scriptTopology: structuredClone(executionPlan.scriptTopology.before),
      },
      plannedDelta: {
        projectModules: targetPaths,
        activationIds: deltaActivationIds,
        bridgeIds: deltaBridgeIds,
        counts: { ...profile.topology.delta },
      },
      plannedTopology: {
        projectModules: plannedProjectModules,
        activationIds: plannedActivationIds,
        bridgeIds: plannedBridgeIds,
        counts: { ...profile.topology.planned },
        targetSelection: executionPlan.lifecycle.runtimeTargetSelection,
      },
      locks: this.#locks(profile),
      verdict: profile.verdict,
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
    this.#require(contract.id === CanonicalActivationIdentity.id(contract),
      `activation is not canonical: ${contract.id}`);
    return contract;
  }

  #locks(profile) {
    return {
      sourceFilesCreated: false,
      sourceProvidersReplaced: false,
      indexChanged: false,
      runtimeRebuilt: false,
      observationsFinal: false,
      runtimeCutoverAllowed: false,
      unlockCondition: profile.unlockCondition,
    };
  }

  #union(left, right) {
    const combined = [...left, ...right];
    this.#require(new Set(combined).size === combined.length, "active and planned sets overlap");
    return combined.sort();
  }

  #evidence(path, sha256) {
    this.#require(/^[a-f0-9]{64}$/u.test(sha256 || ""), `invalid fingerprint: ${path}`);
    return { path, sha256 };
  }

  #same(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  #require(condition, message) {
    if (!condition) throw new Error(`${this.#profile.stageLabel} prebuild contract failed: ${message}`);
  }
}

class StageThreeBatchPrebuildContractValidator {
  #profile;

  constructor(profile) {
    if (!profile) throw new Error("Stage 3 prebuild validator requires an immutable batch profile");
    this.#profile = profile;
  }

  validate(contract) {
    const profile = this.#profile;
    const errors = [];
    const require = (condition, message) => {
      if (!condition) errors.push(message);
    };
    require(contract?.schemaVersion === profile.contractSchemaVersion, "schemaVersion differs");
    require(contract?.kind === "cyber-fishing-stage-3-prebuild-contract", "kind is invalid");
    require(contract?.status === "prebuild-open", "status must be prebuild-open");
    require(contract?.batchId === profile.batchId, "batchId differs");
    require(this.#same(contract?.lifecycle?.completedBatchIds, profile.completedPrefix), "completed prefix differs");
    require(contract?.lifecycle?.activeBatchId === profile.batchId, "active batch differs");
    require(contract?.lifecycle?.activeBatchPhase === "prebuild", "active phase differs");
    require(contract?.lifecycle?.compatibilityRuntimeActivated === true, "runtime activation differs");
    const targets = contract?.preliminaryMetadata?.targets || [];
    const activations = contract?.preliminaryMetadata?.plannedActivationPositions || [];
    const bridges = contract?.preliminaryMetadata?.plannedBridges || [];
    require(targets.length === profile.topology.delta.modules, "target metadata count differs");
    require(activations.length === profile.topology.delta.activations, "planned activation count differs");
    require(bridges.length === profile.topology.delta.bridges, "planned bridge count differs");
    require(new Set(targets.map((record) => record.targetPath)).size === targets.length,
      "target paths must be unique");
    require(targets.every((record) => record.targetBoundary === "game-domain" &&
      record.migrationStatus === "planned" && record.observationStatus === "pending"),
    "target metadata status differs");
    require(activations.every((record) => record.id === CanonicalActivationIdentity.id(record)),
      "planned activation identity differs");
    require(bridges.every((record) => record.id === CanonicalBridgeIdentity.id(record)),
      "planned bridge identity differs");
    require(new Set(bridges.map((record) => `${record.bridge}\0${record.source}`)).size === bridges.length,
      "planned bridge consumer set is not exact");
    require(contract?.locks?.runtimeCutoverAllowed === false, "prebuild must not allow runtime cutover");
    require(contract?.locks?.observationsFinal === false, "observations must remain preliminary");
    require(contract?.locks?.sourceFilesCreated === false, "prebuild must not create source files");
    require(this.#same(contract?.locks, {
      sourceFilesCreated: false,
      sourceProvidersReplaced: false,
      indexChanged: false,
      runtimeRebuilt: false,
      observationsFinal: false,
      runtimeCutoverAllowed: false,
      unlockCondition: profile.unlockCondition,
    }), "prebuild locks differ");
    require(contract?.verdict === profile.verdict, "verdict differs");
    const expectedEvidencePaths = {
      audit: profile.executionProfile.auditPath,
      executionPlan: profile.executionProfile.executionPlanPath,
      testMatrix: profile.executionProfile.testMatrixPath,
      executionStateBefore: "architecture/migration/stage_3_execution_state.json",
      manifestBefore: "architecture/migration/module_migration_manifest.json",
      runtimeContractBefore: "architecture/migration/stage_3_compatibility_runtime.json",
      bridgeRegistryBefore: "architecture/guards/migration_bridge_registry.json",
    };
    require(this.#same(
      Object.keys(contract?.evidence || {}).sort(),
      Object.keys(expectedEvidencePaths).sort(),
    ), "evidence key set differs");
    for (const [key, expectedPath] of Object.entries(expectedEvidencePaths)) {
      const evidence = contract?.evidence?.[key];
      require(evidence?.path === expectedPath, `evidence path differs: ${key}`);
      require(/^[a-f0-9]{64}$/u.test(evidence?.sha256 || ""),
        `invalid evidence fingerprint: ${expectedPath}`);
    }
    if (profile.contractSchemaVersion === 1) {
      require(contract?.activeRuntimeTopology?.projectModuleCount === profile.topology.active.modules,
        "active module topology differs");
      require(contract?.activeRuntimeTopology?.activationCount === profile.topology.active.activations,
        "active activation topology differs");
      require(contract?.plannedRuntimeTopology?.projectModuleCount === profile.topology.planned.modules,
        "planned module topology differs");
      require(contract?.plannedRuntimeTopology?.activationCount === profile.topology.planned.activations,
        "planned activation topology differs");
    } else {
      this.#validateTopology(contract, require);
    }
    if (errors.length > 0) {
      throw new Error(`${profile.stageLabel} prebuild contract failed:\n- ${errors.join("\n- ")}`);
    }
    return immutableRecord(contract);
  }

  #validateTopology(contract, require) {
    const profile = this.#profile;
    const active = contract?.activeTopology;
    const delta = contract?.plannedDelta;
    const planned = contract?.plannedTopology;
    require(contract?.planningStorage === "prebuild-contract-only", "planning storage differs");
    for (const [name, topology, expected] of [
      ["active", active, profile.topology.active],
      ["delta", delta, profile.topology.delta],
      ["planned", planned, profile.topology.planned],
    ]) {
      require(this.#same(topology?.counts, expected), `${name} topology counts differ`);
      require(topology?.projectModules?.length === expected.modules, `${name} module set differs`);
      require(topology?.activationIds?.length === expected.activations, `${name} activation set differs`);
      require(topology?.bridgeIds?.length === expected.bridges, `${name} bridge set differs`);
      require(this.#sortedUnique(topology?.projectModules), `${name} modules must be sorted and unique`);
      require(this.#sortedUnique(topology?.activationIds), `${name} activations must be sorted and unique`);
      require(this.#sortedUnique(topology?.bridgeIds), `${name} bridges must be sorted and unique`);
    }
    require(this.#same(planned?.projectModules, this.#union(active?.projectModules, delta?.projectModules)),
      "planned module set is not the exact active + delta union");
    require(this.#same(planned?.activationIds, this.#union(active?.activationIds, delta?.activationIds)),
      "planned activation set is not the exact active + delta union");
    require(this.#same(planned?.bridgeIds, this.#union(active?.bridgeIds, delta?.bridgeIds)),
      "planned bridge set is not the exact active + delta union");
    require(this.#same(delta?.projectModules,
      contract?.preliminaryMetadata?.targets?.map((record) => record.targetPath).sort()),
    "planned module delta differs from exact target metadata");
    require(this.#same(delta?.activationIds,
      contract?.preliminaryMetadata?.plannedActivationPositions?.map((record) => record.id).sort()),
    "planned activation delta differs from exact activation metadata");
    require(this.#same(delta?.bridgeIds,
      contract?.preliminaryMetadata?.plannedBridges?.map((record) => record.id).sort()),
    "planned bridge delta differs from exact bridge metadata");
  }

  #union(left = [], right = []) {
    return [...new Set([...left, ...right])].sort();
  }

  #sortedUnique(values) {
    return Array.isArray(values) && this.#same(values, [...new Set(values)].sort());
  }

  #same(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
  }
}

module.exports = {
  StageThreeBatchPrebuildContractBuilder,
  StageThreeBatchPrebuildContractValidator,
};
