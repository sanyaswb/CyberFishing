"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {
  BATCH_007_PREBUILD_PROFILE,
} = require("./domain_batches/stage_three_batch_prebuild_profile");
const {
  StageThreeBatch007CandidateBuild,
} = require("./domain_batches/stage_three_batch_007_candidate_build");
const {
  StageThreeBatch007SourceBuildContractValidator,
} = require("./domain_batches/stage_three_batch_007_source_build_contract");
const {
  RepresentationOnlyNamedEsmTarget,
} = require("./domain_batches/stage_three_representation_target");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const ARTIFACT_PATH = "architecture/migration/stage_3_batch_007_source_build_validation.json";

class StageThreeBatch007SourceBuildIntegrationCheck {
  async run() {
    const artifact = this.#json(ARTIFACT_PATH);
    new StageThreeBatch007SourceBuildContractValidator().validate(artifact);
    const before = this.#protectedSnapshot();
    for (const evidence of Object.values(artifact.evidence)) {
      assert.equal(this.#sha256(this.#bytes(evidence.path)), evidence.sha256,
        `Stage 3.7.4 evidence changed: ${evidence.path}`);
    }
    const prebuild = this.#json(BATCH_007_PREBUILD_PROFILE.artifactPath);
    assert.deepEqual(artifact.plannedTopology, prebuild.plannedTopology,
      "Stage 3.7.4 planned topology differs from frozen prebuild contract");
    const manifest = this.#json("architecture/migration/module_migration_manifest.json");
    const entries = new Map(manifest.modules.map((record) => [record.currentPath, record]));
    for (const source of artifact.sources) {
      const classic = this.#bytes(source.currentPath).toString("utf8");
      const projected = new RepresentationOnlyNamedEsmTarget().project({
        source: classic,
        currentPath: source.currentPath,
        targetPath: source.targetPath,
        exportName: source.exportName,
        sourceSha256: source.sourceSha256,
      });
      assert.equal(this.#bytes(source.targetPath).toString("utf8"), projected.targetSource);
      assert.equal(projected.targetSha256, source.targetSha256);
      const entry = entries.get(source.targetPath);
      assert(entry, `Manifest target missing: ${source.targetPath}`);
      assert.equal(entry.architecture.migrationStatus, "migrating");
      assert.equal(entry.architecture.targetBoundary, "game-domain");
      assert.equal(entry.architecture.targetPath, source.targetPath);
      assert.deepEqual(entry.architecture.roles, ["domain-behavior"]);
      assert.equal(entry.observed.providers.status, "verified");
      assert.equal(entry.observed.consumers.status, "verified");
      assert.equal(entry.observed.environment.browserApis.length, 0);
      assert.equal(entry.analysis.dependencies.status, "verified");
      assert.equal(entry.analysis.dependencies.items.length, 0);
    }
    assert.equal(manifest.modules.length, artifact.manifestReconciliation.moduleCount);
    const rebuilt = await new StageThreeBatch007CandidateBuild(PROJECT_ROOT).run({
      prebuild,
      approvedPlan: this.#json("architecture/migration/stage_3_approved_batches.json"),
      executionState: this.#json("architecture/migration/stage_3_execution_state.json"),
      runtimeContract: this.#json("architecture/migration/stage_3_compatibility_runtime.json"),
      stageTwoApprovedPlan: this.#json("architecture/migration/stage_2_approved_batches.json"),
      stageTwoExecutionState: this.#json("architecture/migration/stage_2_execution_state.json"),
    });
    assert.deepEqual(rebuilt, artifact.candidateBuild,
      "candidate cumulative build differs from reviewed Stage 3.7.4 evidence");
    assert.deepEqual(this.#protectedSnapshot(), before,
      "Stage 3.7.4 integration changed active runtime truth");
    assert.equal(fs.existsSync(this.#absolute("dist/.stage-3-batch-007-candidate")), false);
    console.log(
      "Stage 3.7.4 source/build integration passed: six exact named ESM targets and " +
      "mechanical Manifest facts produce an isolated 31-module / 32-activation candidate; " +
      "active 25/26/48 runtime, classic providers and index remain byte-identical.",
    );
  }

  #protectedSnapshot() {
    return {
      state: this.#sha256(this.#bytes("architecture/migration/stage_3_execution_state.json")),
      runtime: this.#sha256(this.#bytes("architecture/migration/stage_3_compatibility_runtime.json")),
      registry: this.#sha256(this.#bytes("architecture/guards/migration_bridge_registry.json")),
      index: this.#sha256(this.#bytes("index.html")),
      classics: BATCH_007_PREBUILD_PROFILE.executionProfile.expectedTargets.map((record) => ({
        path: record.currentPath,
        sha256: this.#sha256(this.#bytes(record.currentPath)),
      })),
      activeOutput: this.#activeOutput(),
    };
  }

  #activeOutput() {
    const root = this.#absolute("dist/stage-3-compat-runtime");
    if (!fs.existsSync(root)) return [];
    const walk = (directory) => fs.readdirSync(directory, { withFileTypes: true })
      .flatMap((entry) => {
        const item = path.join(directory, entry.name);
        return entry.isDirectory() ? walk(item) : [item];
      });
    return walk(root).map((absolutePath) => ({
      path: path.relative(PROJECT_ROOT, absolutePath).replaceAll("\\", "/"),
      sha256: this.#sha256(fs.readFileSync(absolutePath)),
    })).sort((left, right) => left.path.localeCompare(right.path));
  }

  #json(relativePath) {
    return JSON.parse(this.#bytes(relativePath).toString("utf8"));
  }

  #bytes(relativePath) {
    return fs.readFileSync(this.#absolute(relativePath));
  }

  #absolute(relativePath) {
    return path.join(PROJECT_ROOT, relativePath);
  }

  #sha256(bytes) {
    return crypto.createHash("sha256").update(bytes).digest("hex");
  }
}

new StageThreeBatch007SourceBuildIntegrationCheck().run().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
