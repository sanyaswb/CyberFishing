"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  StageThreeBatchDependencyStateAuditValidator,
} = require("./domain_batches/stage_three_batch_dependency_state_audit");
const { buildArtifact } = require("./generate-stage-3-batch-006-audit");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

class StageThreeBatch006AuditFixtureCheck {
  run() {
    const validator = new StageThreeBatchDependencyStateAuditValidator();
    const state = JSON.parse(fs.readFileSync(path.resolve(
      __dirname,
      "../../architecture/migration/stage_3_execution_state.json",
    ), "utf8"));
    const historical = state.activeBatchId === "stage-3.candidate-006-fishing-e48e70d8" ||
      state.completedBatchIds.includes("stage-3.candidate-006-fishing-e48e70d8");
    const source = historical
      ? JSON.parse(fs.readFileSync(path.resolve(
        __dirname,
        "../../architecture/migration/stage_3_batch_006_audit.json",
      ), "utf8"))
      : buildArtifact();
    const valid = validator.validate(source);

    this.#reject(validator, valid, (artifact) => {
      artifact.scope.modules.pop();
      artifact.scope.targetCount -= 1;
    }, "incomplete scope");
    this.#reject(validator, valid, (artifact) => {
      artifact.closure.unexpectedDependencies.push({
        source: artifact.scope.modules[0].currentPath,
        target: "src/platform/browser_adapter.js",
        symbols: ["BrowserAdapter"],
        resolution: "confirmed",
      });
    }, "unexpected dependency");
    this.#reject(validator, valid, (artifact) => {
      artifact.boundaries.directConfigDependencies.push({
        source: artifact.scope.modules[0].currentPath,
        target: "src/config/config.js",
      });
    }, "direct config dependency");
    this.#reject(validator, valid, (artifact) => {
      artifact.boundaries.browserCapabilities.push({
        module: artifact.scope.modules[0].currentPath,
        capability: "dom",
      });
    }, "browser capability");
    this.#reject(validator, valid, (artifact) => {
      artifact.boundaries.transportReads.push(artifact.scope.modules[0].currentPath);
    }, "transport read");
    this.#reject(validator, valid, (artifact) => {
      artifact.state.unresolved.push({ module: artifact.scope.modules[0].currentPath });
    }, "unresolved state");
    this.#reject(validator, valid, (artifact) => {
      artifact.effects.unsafe.push(artifact.scope.modules[0].currentPath);
    }, "unsafe effect");
    this.#reject(validator, valid, (artifact) => {
      artifact.compatibility.activations.pop();
    }, "activation mismatch");
    this.#reject(validator, valid, (artifact) => {
      artifact.compatibility.consumers.pop();
    }, "consumer mismatch");
    this.#reject(validator, valid, (artifact) => {
      artifact.prerequisites.newlyDiscovered.push({
        kind: "config-di",
        issue: "fixture",
      });
    }, "new prerequisite");
    this.#reject(validator, valid, (artifact) => {
      artifact.scope.modules[0].sourceSha256 = "stale";
    }, "stale source fingerprint");
    this.#reject(validator, valid, (artifact) => {
      artifact.evaluation.stronglyConnectedComponents[0].cyclic = true;
      artifact.evaluation.cycles.push(["a.js", "b.js"]);
    }, "cycle");

    assert.equal(Object.isFrozen(valid), true);
    assert.equal(Object.isFrozen(valid.scope.modules[0]), true);
    console.log(
      "Stage 3.6.1 audit fixtures passed: scope, closure, boundary, state, effect, compatibility, prerequisite and fingerprint failures are rejected.",
    );
  }

  #reject(validator, source, mutate, label) {
    const artifact = clone(source);
    mutate(artifact);
    assert.throws(
      () => validator.validate(artifact),
      /Stage 3\.6\.1 audit contract failed/u,
      label,
    );
  }
}

new StageThreeBatch006AuditFixtureCheck().run();
