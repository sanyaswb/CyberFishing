"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {
  CumulativeRuntimeBuildApplication,
} = require("../../build/compat_runtime/cumulative_runtime_builder");
const {
  CumulativeRuntimeContractValidator,
} = require("../../build/compat_runtime/cumulative_runtime_contract");
const {
  StageTwoMigratedTargetCatalog,
} = require("../../build/compat_runtime/cumulative_graph_planner");
const {
  LegacyScriptOrderReader,
} = require("../migration/legacy_script_order_reader");
const {
  StageThreeRuntimeScriptAliasResolver,
} = require("../migration/stage_three_runtime_script_alias_resolver");
const { StageThreeCandidateOutputManager } = require(
  "./stage_three_candidate_output_manager"
);

const BATCH_007_APPROVED_VIRTUAL_MODULES = Object.freeze([
  "\u0000@oxc-project+runtime@0.146.0/helpers/esm/defineProperty.js",
  "\u0000@oxc-project+runtime@0.146.0/helpers/esm/toPrimitive.js",
  "\u0000@oxc-project+runtime@0.146.0/helpers/esm/toPropertyKey.js",
  "\u0000@oxc-project+runtime@0.146.0/helpers/esm/typeof.js",
]);

class StageThreeBatch007CandidateBuild {
  constructor(projectRoot) {
    this.projectRoot = path.resolve(projectRoot);
    this.outputManager = new StageThreeCandidateOutputManager(
      this.projectRoot,
      "007",
    );
  }

  async run({ prebuild, approvedPlan, executionState, runtimeContract,
    stageTwoApprovedPlan, stageTwoExecutionState }) {
    const activeOutputBefore = this.#snapshotActiveOutput();
    const futureContract = structuredClone(runtimeContract);
    futureContract.activationPositions = [
      ...runtimeContract.activationPositions,
      ...prebuild.preliminaryMetadata.plannedActivationPositions,
    ].sort((left, right) => left.id.localeCompare(right.id));
    futureContract.approvedVirtualModules = [...new Set([
      ...futureContract.approvedVirtualModules,
      ...BATCH_007_APPROVED_VIRTUAL_MODULES,
    ])].sort();
    new CumulativeRuntimeContractValidator().validate(futureContract);
    const futureState = {
      ...executionState,
      activeBatchPhase: "runtime-active",
    };
    const aliases = new StageThreeRuntimeScriptAliasResolver().resolve(futureContract);
    try {
      const report = await new CumulativeRuntimeBuildApplication({
        projectRoot: this.projectRoot,
        contract: futureContract,
        approvedPlan,
        executionState: futureState,
        previousStageModules: new StageTwoMigratedTargetCatalog().collect({
          approvedPlan: stageTwoApprovedPlan,
          executionState: stageTwoExecutionState,
        }),
        outputManager: this.outputManager,
        scriptOrderProvider: () => new LegacyScriptOrderReader(
          this.#absolute("index.html"),
          { scriptAliases: aliases },
        ).read(),
      }).run();
      this.#validateReport(report, prebuild);
      const result = this.#normalizeReport(report);
      assert.deepEqual(this.#snapshotActiveOutput(), activeOutputBefore,
        "candidate build changed validated active runtime output");
      return result;
    } finally {
      this.outputManager.cleanup();
      assert.deepEqual(this.#snapshotActiveOutput(), activeOutputBefore,
        "candidate cleanup changed validated active runtime output");
    }
  }

  #validateReport(report, prebuild) {
    assert.equal(report.status, "built");
    assert.equal(report.moduleCount, prebuild.plannedTopology.counts.modules);
    assert.equal(report.activationCount, prebuild.plannedTopology.counts.activations);
    assert.deepEqual(
      report.selectedBatchIds,
      prebuild.lifecycle.completedBatchIds.concat(prebuild.batchId),
    );
    const runtime = report.outputs.find((record) => record.kind === "cumulative-runtime");
    assert(runtime, "candidate cumulative runtime output is missing");
    assert.deepEqual(runtime.projectModules, prebuild.plannedTopology.projectModules);
    assert.equal(new Set(runtime.projectModules).size, runtime.projectModules.length);
    assert.deepEqual(
      runtime.virtualBuildModules,
      [...new Set(runtime.virtualBuildModules)].sort(),
      "candidate virtual build module set must be sorted and unique",
    );
    for (const helper of BATCH_007_APPROVED_VIRTUAL_MODULES) {
      assert(runtime.virtualBuildModules.includes(helper),
        `candidate build helper is missing: ${helper}`);
    }
    const activations = report.outputs.filter((record) => record.kind === "activation-shim");
    assert.deepEqual(
      activations.map((record) => record.activationId).sort(),
      prebuild.plannedTopology.activationIds,
    );
    for (const output of report.outputs) {
      const candidatePath = this.outputManager.candidatePath(output.path);
      assert.equal(fs.existsSync(candidatePath), true,
        `candidate output is missing: ${output.path}`);
      assert.equal(this.#sha256(fs.readFileSync(candidatePath)), output.sha256,
        `candidate output fingerprint differs: ${output.path}`);
    }
  }

  #normalizeReport(report) {
    const runtime = report.outputs.find((record) => record.kind === "cumulative-runtime");
    return Object.freeze({
      status: "candidate-build-verified",
      moduleCount: report.moduleCount,
      activationCount: report.activationCount,
      selectedBatchIds: [...report.selectedBatchIds],
      projectModules: [...runtime.projectModules],
      virtualBuildModules: [...runtime.virtualBuildModules],
      runtimeSha256: runtime.sha256,
      activationOutputs: report.outputs
        .filter((record) => record.kind === "activation-shim")
        .map((record) => ({
          activationId: record.activationId,
          path: record.path,
          sha256: record.sha256,
          targetModule: record.targetModule,
          exportName: record.exportName,
          legacyScriptIndex: record.legacyScriptIndex,
        }))
        .sort((left, right) => left.activationId.localeCompare(right.activationId)),
      candidateOutputPersisted: false,
    });
  }

  #snapshotActiveOutput() {
    const root = this.#absolute("dist/stage-3-compat-runtime");
    if (!fs.existsSync(root)) return [];
    const walk = (directory) => fs.readdirSync(directory, { withFileTypes: true })
      .flatMap((entry) => {
        const item = path.join(directory, entry.name);
        return entry.isDirectory() ? walk(item) : [item];
      });
    return walk(root).map((absolutePath) => ({
      path: path.relative(this.projectRoot, absolutePath).replaceAll("\\", "/"),
      sha256: this.#sha256(fs.readFileSync(absolutePath)),
    })).sort((left, right) => left.path.localeCompare(right.path));
  }

  #absolute(relativePath) {
    const absolute = path.resolve(this.projectRoot, relativePath);
    const relative = path.relative(this.projectRoot, absolute).replaceAll("\\", "/");
    if (relative !== relativePath) {
      throw new Error(`Stage 3.7.4 path escaped project root: ${relativePath}`);
    }
    return absolute;
  }

  #sha256(bytes) {
    return crypto.createHash("sha256").update(bytes).digest("hex");
  }
}

module.exports = {
  BATCH_007_APPROVED_VIRTUAL_MODULES,
  StageThreeBatch007CandidateBuild,
};
