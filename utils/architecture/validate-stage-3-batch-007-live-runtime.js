"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {
  StageThreeBatch007LiveRuntimeHarness,
  StageThreeBatch007LiveRuntimeValidationContractValidator,
} = require("./domain_batches/stage_three_batch_007_live_runtime_validation");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const PATHS = Object.freeze({
  audit: "architecture/migration/stage_3_batch_007_audit.json",
  plan: "architecture/migration/stage_3_batch_007_execution_plan.json",
  matrix: "architecture/migration/stage_3_batch_007_test_matrix.json",
  prebuild: "architecture/migration/stage_3_batch_007_prebuild_contract.json",
  sourceBuild: "architecture/migration/stage_3_batch_007_source_build_validation.json",
  cutover: "architecture/migration/stage_3_batch_007_runtime_cutover.json",
  state: "architecture/migration/stage_3_execution_state.json",
  runtime: "architecture/migration/stage_3_compatibility_runtime.json",
  registry: "architecture/guards/migration_bridge_registry.json",
  index: "index.html",
  manifest: "architecture/migration/module_migration_manifest.json",
  output: "architecture/migration/stage_3_batch_007_live_runtime_validation.json",
});

class StageThreeBatch007LiveRuntimeValidationApplication {
  run() {
    const inputs = {
      audit: this.#json(PATHS.audit),
      plan: this.#json(PATHS.plan),
      matrix: this.#json(PATHS.matrix),
      prebuild: this.#json(PATHS.prebuild),
      sourceBuild: this.#json(PATHS.sourceBuild),
      cutover: this.#json(PATHS.cutover),
      state: this.#json(PATHS.state),
      runtime: this.#json(PATHS.runtime),
      registry: this.#json(PATHS.registry),
    };
    const protectedBefore = this.#protectedEvidence(inputs);
    const result = new StageThreeBatch007LiveRuntimeHarness(PROJECT_ROOT).run(inputs);
    const artifact = {
      schemaVersion: 1,
      kind: "cyber-fishing-stage-3-live-runtime-validation",
      status: "verified",
      batchId: inputs.state.activeBatchId,
      releaseVersion: inputs.state.releaseVersion,
      evidence: {
        audit: this.#evidence(PATHS.audit),
        executionPlan: this.#evidence(PATHS.plan),
        testMatrix: this.#evidence(PATHS.matrix),
        prebuildContract: this.#evidence(PATHS.prebuild),
        sourceBuildValidation: this.#evidence(PATHS.sourceBuild),
        runtimeCutover: this.#evidence(PATHS.cutover),
        executionState: this.#evidence(PATHS.state),
        runtimeContract: this.#evidence(PATHS.runtime),
        bridgeRegistry: this.#evidence(PATHS.registry),
        index: this.#evidence(PATHS.index),
        manifest: this.#evidence(PATHS.manifest),
        runtimeBundle: this.#evidence(
          `${inputs.runtime.output.directory}${inputs.runtime.output.runtimeFile}`,
        ),
      },
      lifecycle: {
        completedBatchIds: [...inputs.state.completedBatchIds],
        activeBatchId: inputs.state.activeBatchId,
        activeBatchPhase: inputs.state.activeBatchPhase,
        compatibilityRuntimeActivated: inputs.state.compatibilityRuntimeActivated,
        batchCompleted: false,
      },
      ...result,
      verdict: "eligible-for-observation-reconciliation",
      nextGate: "stage-3.7.7-observation-and-manifest-reconciliation",
    };
    new StageThreeBatch007LiveRuntimeValidationContractValidator().validate(artifact);
    this.#require(JSON.stringify(this.#protectedEvidence(inputs)) === JSON.stringify(protectedBefore),
      "live validation mutated protected runtime truth");
    fs.writeFileSync(this.#absolute(PATHS.output), `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
    return Object.freeze({
      status: artifact.status,
      behaviorCaseCount: artifact.behavior.caseCount,
      activationCount: artifact.activationTiming.length,
      consumerCount: artifact.consumers.relationshipCount,
    });
  }

  #protectedEvidence(inputs) {
    return {
      state: this.#evidence(PATHS.state),
      runtime: this.#evidence(PATHS.runtime),
      registry: this.#evidence(PATHS.registry),
      index: this.#evidence(PATHS.index),
      manifest: this.#evidence(PATHS.manifest),
      runtimeBundle: this.#evidence(
        `${inputs.runtime.output.directory}${inputs.runtime.output.runtimeFile}`,
      ),
      sources: inputs.sourceBuild.sources.flatMap((record) => [
        this.#evidence(record.currentPath),
        this.#evidence(record.targetPath),
      ]),
    };
  }

  #evidence(relativePath) {
    return { path: relativePath, sha256: this.#sha256(this.#bytes(relativePath)) };
  }

  #json(relativePath) {
    return JSON.parse(this.#bytes(relativePath).toString("utf8"));
  }

  #bytes(relativePath) {
    return fs.readFileSync(this.#absolute(relativePath));
  }

  #absolute(relativePath) {
    const absolute = path.resolve(PROJECT_ROOT, relativePath);
    const relative = path.relative(PROJECT_ROOT, absolute);
    this.#require(!relative.startsWith("..") && !path.isAbsolute(relative),
      `path escaped project root: ${relativePath}`);
    return absolute;
  }

  #sha256(value) {
    return crypto.createHash("sha256").update(value).digest("hex");
  }

  #require(condition, message) {
    if (!condition) throw new Error(`Stage 3.7.6 validation failed: ${message}`);
  }
}

if (require.main === module) {
  try {
    const result = new StageThreeBatch007LiveRuntimeValidationApplication().run();
    console.log(
      `Stage 3.7.6 live validation passed: ${result.behaviorCaseCount} behavior cases, ` +
      `${result.activationCount} activation timings and ${result.consumerCount} consumers.`,
    );
  } catch (error) {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = { StageThreeBatch007LiveRuntimeValidationApplication };
