"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {
  StageThreeExecutionStateValidator,
} = require("./domain_batches/domain_approved_prefix");
const {
  BATCH_008_PREBUILD_PROFILE,
} = require("./domain_batches/stage_three_batch_prebuild_profile");
const {
  StageThreeBatchPrebuildContractValidator,
} = require("./domain_batches/stage_three_batch_prebuild_contract");
const {
  readRuntimeFacts,
} = require("./generate-stage-3-approved-prefix");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const { StageThreeBatch008HistoricalInputs } = require("./domain_batches/stage_three_batch_008_historical_inputs");

class StageThreeBatch008PrebuildIntegrationCheck {
  run() {
    const historical = new StageThreeBatch008HistoricalInputs(PROJECT_ROOT);
    const artifact = this.#json(BATCH_008_PREBUILD_PROFILE.artifactPath);
    const state = this.#json("architecture/migration/stage_3_execution_state.json");
    const manifest = this.#json("architecture/migration/module_migration_manifest.json");
    const runtime = this.#json("architecture/migration/stage_3_compatibility_runtime.json");
    const registry = this.#json("architecture/guards/migration_bridge_registry.json");
    const approvedPlanBytes = this.#bytes("architecture/migration/stage_3_approved_batches.json");
    const approvedPlan = JSON.parse(approvedPlanBytes.toString("utf8"));
    const plan = this.#json(BATCH_008_PREBUILD_PROFILE.executionProfile.executionPlanPath);
    const matrix = this.#json(BATCH_008_PREBUILD_PROFILE.executionProfile.testMatrixPath);
    new StageThreeBatchPrebuildContractValidator(BATCH_008_PREBUILD_PROFILE).validate(artifact);
    new StageThreeExecutionStateValidator().validate({
      approvedPlan,
      approvedPlanSha256: this.#sha256(approvedPlanBytes),
      state,
      runtimeFacts: { ...readRuntimeFacts(), runtimeScriptCount: (this.#bytes("index.html").toString("utf8")
        .match(/<script\b[^>]*stage-3-compat-runtime[^>]*><\/script>/giu) || []).length },
    });

    assert.equal(plan.verdict, "eligible-for-focused-test-matrix");
    assert.equal(matrix.verdict, "eligible-for-prebuild-open");
    assert.equal(state.releaseVersion, "0.24.44");
    assert.deepEqual(state.completedBatchIds, BATCH_008_PREBUILD_PROFILE.completedPrefix);
    assert.equal(state.activeBatchId, BATCH_008_PREBUILD_PROFILE.batchId);
    assert.equal(state.activeBatchPhase, "prebuild");
    assert.equal(state.compatibilityRuntimeActivated, true);
    assert.deepEqual(artifact.activeTopology.counts, { modules: 31, activations: 32, bridges: 57 });
    assert.deepEqual(artifact.plannedDelta.counts, { modules: 3, activations: 3, bridges: 3 });
    assert.deepEqual(artifact.plannedTopology.counts, { modules: 34, activations: 35, bridges: 60 });

    const beforeState = { ...state, activeBatchId: null };
    delete beforeState.activeBatchPhase;
    assert.equal(
      this.#sha256(this.#serialize(beforeState)),
      artifact.evidence.executionStateBefore.sha256,
      "prebuild state is not the exact two-field projection of the frozen state",
    );
    for (const [key, relativePath] of [
      ["manifestBefore", "architecture/migration/module_migration_manifest.json"],
      ["runtimeContractBefore", "architecture/migration/stage_3_compatibility_runtime.json"],
      ["bridgeRegistryBefore", "architecture/guards/migration_bridge_registry.json"],
    ]) {
      assert.equal(this.#sha256(historical.bytes(relativePath)), artifact.evidence[key].sha256,
        `${relativePath} changed while opening prebuild`);
    }
    assert.equal(manifest.preliminaryMigration, undefined);
    assert.equal(runtime.plannedActivationPositions, undefined);
    assert.equal(registry.plannedBridges, undefined);
    assert.equal(runtime.activationPositions.length, 32);
    assert.equal(registry.bridges.length, 57);

    const targetPaths = artifact.preliminaryMetadata.targets.map((record) => record.targetPath).sort();
    const preparedTargets = historical.verifyTargets();
    assert.equal(manifest.modules.filter((record) => targetPaths.includes(record.currentPath)).length,
      preparedTargets, "Real source preparation and exact pending target records must be atomic");
    const baselineFiles = new Map(plan.rollback.baselineEvidence.files.map((record) => [record.path, record.sha256]));
    for (const relativePath of [
      "index.html",
      ...BATCH_008_PREBUILD_PROFILE.executionProfile.expectedTargets.map((record) => record.currentPath),
    ]) {
      assert.equal(this.#sha256(this.#bytes(relativePath)), baselineFiles.get(relativePath),
        `${relativePath} differs from the exact v0.24.44 rollback baseline`);
    }
    assert.deepEqual(this.#runtimeOutputEvidence(), plan.rollback.baselineEvidence.runtimeOutput.files,
      "validated v0.24.44 runtime output changed during prebuild open");

    const scripts = [...this.#bytes("index.html").toString("utf8")
      .matchAll(/<script\b([^>]*)\bsrc=["']([^"']+)["'][^>]*>/giu)];
    assert.equal(scripts.length, 426);
    assert.equal(scripts.filter((match) => /\btype=["']module["']/iu.test(match[1])).length, 0);
    assert.equal(artifact.locks.sourceFilesCreated, false);
    assert.equal(artifact.locks.sourceProvidersReplaced, false);
    assert.equal(artifact.locks.indexChanged, false);
    assert.equal(artifact.locks.runtimeRebuilt, false);
    assert.equal(artifact.locks.observationsFinal, false);
    assert.equal(artifact.locks.runtimeCutoverAllowed, false);
    assert.equal(artifact.verdict, "eligible-for-target-source-and-build-validation");
    console.log(
      `Stage 3.8.3 historical prebuild replay passed: frozen topology 31/32/57; ${preparedTargets} representation-only targets, exact pending Manifest delta; current runtime bytes preserved.`,
    );
  }

  #runtimeOutputEvidence() {
    const root = this.#absolute("dist/stage-3-compat-runtime");
    const walk = (directory) => fs.readdirSync(directory, { withFileTypes: true })
      .flatMap((entry) => {
        const item = path.join(directory, entry.name);
        return entry.isDirectory() ? walk(item) : [item];
      });
    const expected = new Set(this.#json(BATCH_008_PREBUILD_PROFILE.executionProfile.executionPlanPath)
      .rollback.baselineEvidence.runtimeOutput.files.map((item) => item.path));
    return walk(root).map((absolutePath) => ({
      path: path.relative(PROJECT_ROOT, absolutePath).replaceAll("\\", "/"),
      sha256: this.#sha256(this.#bytes(path.relative(PROJECT_ROOT, absolutePath).replaceAll("\\", "/"))),
    })).filter((item) => expected.has(item.path)).sort((left, right) => left.path.localeCompare(right.path));
  }

  #serialize(value) {
    return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
  }

  #json(relativePath) {
    return JSON.parse(this.#bytes(relativePath).toString("utf8"));
  }

  #bytes(relativePath) {
    return require("./domain_batches/stage_three_batch_008_cutover_history").historicalCutoverBytes(relativePath, fs.readFileSync(this.#absolute(relativePath)));
  }

  #absolute(relativePath) {
    return path.join(PROJECT_ROOT, relativePath);
  }

  #sha256(bytes) {
    return crypto.createHash("sha256").update(bytes).digest("hex");
  }
}

new StageThreeBatch008PrebuildIntegrationCheck().run();
