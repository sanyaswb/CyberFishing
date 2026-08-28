"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  ExactRuntimeOutputSnapshot,
} = require("./apply-stage-3-batch-007-runtime-cutover");
const {
  StageThreeBatch007CutoverContractValidator,
} = require("./domain_batches/stage_three_batch_007_cutover_contract");

class StageThreeBatch007CutoverFixtureCheck {
  run() {
    const artifact = JSON.parse(fs.readFileSync(path.resolve(
      __dirname,
      "../../architecture/migration/stage_3_batch_007_runtime_cutover.json",
    ), "utf8"));
    const validator = new StageThreeBatch007CutoverContractValidator();
    validator.validate(artifact);
    this.#reject(validator, artifact, (value) => value.lifecycle.batchCompleted = true);
    this.#reject(validator, artifact, (value) => value.topology.counts.modules = 30);
    this.#reject(validator, artifact, (value) => value.build.runtimeSha256 = "0".repeat(64));
    this.#reject(validator, artifact, (value) => value.sourceTransition.partialCutoverAllowed = true);
    this.#reject(validator, artifact, (value) => value.rollback.scope = "all-stage-3");
    this.#verifySnapshotSafety();
    console.log(
      "Stage 3.7.5 cutover fixtures passed: lifecycle, exact topology, candidate hash, " +
      "partial-cutover prohibition, rollback scope and exact output restoration verified.",
    );
  }

  #verifySnapshotSafety() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "cyber-fishing-stage-3-7-5-"));
    try {
      const output = path.join(root, "dist/stage-3-compat-runtime");
      fs.mkdirSync(path.join(output, "activations"), { recursive: true });
      fs.writeFileSync(path.join(output, "compat_runtime.iife.js"), "before\n");
      fs.writeFileSync(path.join(output, "activations/example.js"), "shim\n");
      const snapshot = new ExactRuntimeOutputSnapshot(root);
      const records = snapshot.capture();
      fs.writeFileSync(path.join(output, "compat_runtime.iife.js"), "changed\n");
      snapshot.restore(records);
      assert.equal(fs.readFileSync(path.join(output, "compat_runtime.iife.js"), "utf8"), "before\n");
      assert.throws(() => new ExactRuntimeOutputSnapshot(root, "dist/not-approved"), /exact runtime directory/u);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }

  #reject(validator, artifact, mutate) {
    const invalid = structuredClone(artifact);
    mutate(invalid);
    assert.throws(() => validator.validate(invalid), /Stage 3\.7\.5 cutover contract failed/u);
  }
}

new StageThreeBatch007CutoverFixtureCheck().run();
