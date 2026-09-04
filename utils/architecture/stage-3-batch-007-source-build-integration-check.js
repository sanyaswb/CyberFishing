"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { verifyBatch007ManifestEvidence } = require("./domain_batches/stage_three_batch_007_manifest_transition");
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
const {
  StageThreeBatch007LifecycleTransition,
} = require("./domain_batches/stage_three_batch_007_lifecycle_transition");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const ARTIFACT_PATH = "architecture/migration/stage_3_batch_007_source_build_validation.json";

class StageThreeBatch007SourceBuildIntegrationCheck {
  async run() {
    const artifact = this.#json(ARTIFACT_PATH);
    new StageThreeBatch007SourceBuildContractValidator().validate(artifact);
    const state = this.#json("architecture/migration/stage_3_execution_state.json");
    const lifecycle = new StageThreeBatch007LifecycleTransition();
    lifecycle.assertCurrentContainsBatch(state);
    const runtimeActive = lifecycle.isRuntimeAvailable(state);
    const before = this.#protectedSnapshot();
    for (const [key, evidence] of Object.entries(artifact.evidence)) {
      if (runtimeActive && ["executionState", "manifestAfterTargetReconciliation",
        "activeRuntimeContract", "activeBridgeRegistry", "index"].includes(key)) continue;
      assert.equal(this.#sha256(this.#bytes(evidence.path)), evidence.sha256,
        `Stage 3.7.4 evidence changed: ${evidence.path}`);
    }
    const prebuild = this.#json(BATCH_007_PREBUILD_PROFILE.artifactPath);
    assert.deepEqual(artifact.plannedTopology, prebuild.plannedTopology,
      "Stage 3.7.4 planned topology differs from frozen prebuild contract");
    const manifest = this.#json("architecture/migration/module_migration_manifest.json");
    const expectedStatus = runtimeActive ? verifyBatch007ManifestEvidence(
      this.#bytes("architecture/migration/module_migration_manifest.json"),
      this.#json("architecture/migration/stage_3_batch_007_runtime_cutover.json")
        .evidence.manifestAfterMechanicalObservation.sha256) : "migrating";
    const entries = new Map(manifest.modules.map((record) => [record.currentPath, record]));
    for (const source of artifact.sources) {
      assert.equal(this.#sha256(this.#bytes(source.targetPath)), source.targetSha256);
      const entry = entries.get(source.targetPath);
      assert(entry, `Manifest target missing: ${source.targetPath}`);
      assert.equal(entry.architecture.migrationStatus, expectedStatus);
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
    const rebuilt = runtimeActive ? artifact.candidateBuild : await new StageThreeBatch007CandidateBuild(PROJECT_ROOT).run({
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
      "Stage 3.7.4 historical integration changed current runtime truth");
    assert.equal(fs.existsSync(this.#absolute("dist/.stage-3-batch-007-candidate")), false);
    console.log(
      "Stage 3.7.4 source/build evidence passed: six exact named ESM targets produced the " +
      "reviewed 31-module / 32-activation candidate" +
      (runtimeActive ? "; evidence remains valid after atomic cutover." :
        "; active 25/26/48 runtime remains unchanged."),
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
