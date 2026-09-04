"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { verifyBatch007ManifestEvidence } = require("./domain_batches/stage_three_batch_007_manifest_transition");
const {
  StageThreeBatch007LiveRuntimeHarness,
  StageThreeBatch007LiveRuntimeValidationContractValidator,
} = require("./domain_batches/stage_three_batch_007_live_runtime_validation");
const {
  StageThreeBatch007LifecycleTransition,
} = require("./domain_batches/stage_three_batch_007_lifecycle_transition");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const PATHS = Object.freeze({
  artifact: "architecture/migration/stage_3_batch_007_live_runtime_validation.json",
  audit: "architecture/migration/stage_3_batch_007_audit.json",
  plan: "architecture/migration/stage_3_batch_007_execution_plan.json",
  matrix: "architecture/migration/stage_3_batch_007_test_matrix.json",
  prebuild: "architecture/migration/stage_3_batch_007_prebuild_contract.json",
  sourceBuild: "architecture/migration/stage_3_batch_007_source_build_validation.json",
  cutover: "architecture/migration/stage_3_batch_007_runtime_cutover.json",
  state: "architecture/migration/stage_3_execution_state.json",
  runtime: "architecture/migration/stage_3_compatibility_runtime.json",
  registry: "architecture/guards/migration_bridge_registry.json",
});

class StageThreeBatch007LiveRuntimeIntegrationCheck {
  run() {
    const artifact = this.#json(PATHS.artifact);
    const lifecycle = new StageThreeBatch007LifecycleTransition();
    new StageThreeBatch007LiveRuntimeValidationContractValidator().validate(artifact);
    const before = this.#evidenceSnapshot(artifact);
    for (const evidence of Object.values(artifact.evidence)) {
      if (evidence.path === PATHS.state) {
        lifecycle.verifyRuntimeActiveEvidence(this.#bytes(evidence.path), evidence.sha256);
        continue;
      }
      if (evidence.path === "index.html") {
        lifecycle.verifyIndexEvidence(this.#bytes(evidence.path), evidence.sha256);
        continue;
      }
      if (evidence.path === "architecture/migration/module_migration_manifest.json") {
        verifyBatch007ManifestEvidence(this.#bytes(evidence.path), evidence.sha256);
        continue;
      }
      assert.equal(this.#sha256(this.#bytes(evidence.path)), evidence.sha256,
        `Stage 3.7.6 evidence changed: ${evidence.path}`);
    }
    const inputs = {
      audit: this.#json(PATHS.audit),
      plan: this.#json(PATHS.plan),
      matrix: this.#json(PATHS.matrix),
      prebuild: this.#json(PATHS.prebuild),
      sourceBuild: this.#json(PATHS.sourceBuild),
      cutover: this.#json(PATHS.cutover),
      state: lifecycle.projectRuntimeActive(this.#json(PATHS.state)),
      runtime: this.#json(PATHS.runtime),
      registry: this.#json(PATHS.registry),
    };
    const live = new StageThreeBatch007LiveRuntimeHarness(PROJECT_ROOT).run(inputs);
    for (const key of ["runtime", "activationTiming", "identity", "behavior", "state",
      "performance", "consumers", "issues"]) {
      assert.deepEqual(live[key], artifact[key], `live result differs: ${key}`);
    }
    assert.deepEqual(this.#evidenceSnapshot(artifact), before,
      "Stage 3.7.6 integration mutated protected evidence");
    console.log(
      "Stage 3.7.6 live-runtime integration passed: actual cumulative bundle preserves six exact " +
      "class/state identities, six activation timings, 54 behavior cases, nine consumers and zero " +
      "migration allocation/transport deltas; read-only.",
    );
  }

  #evidenceSnapshot(artifact) {
    return Object.fromEntries(Object.values(artifact.evidence).map((record) => [
      record.path,
      this.#sha256(this.#bytes(record.path)),
    ]));
  }

  #json(relativePath) {
    return JSON.parse(this.#bytes(relativePath).toString("utf8"));
  }

  #bytes(relativePath) {
    return fs.readFileSync(path.resolve(PROJECT_ROOT, relativePath));
  }

  #sha256(value) {
    return crypto.createHash("sha256").update(value).digest("hex");
  }
}

new StageThreeBatch007LiveRuntimeIntegrationCheck().run();
