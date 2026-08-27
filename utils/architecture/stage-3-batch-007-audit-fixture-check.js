"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  StageThreeBatch007DependencyStateAuditValidator,
} = require("./domain_batches/stage_three_batch_007_dependency_state_audit");

const PROJECT_ROOT = path.resolve(__dirname, "../..");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

class StageThreeBatch007AuditFixtureCheck {
  run() {
    const validator = new StageThreeBatch007DependencyStateAuditValidator();
    const valid = validator.validate(JSON.parse(fs.readFileSync(path.join(
      PROJECT_ROOT,
      "architecture/migration/stage_3_batch_007_audit.json",
    ), "utf8")));

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
    }, "unexpected closure dependency");
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
      artifact.state.reviewed[0].ownerIdentity = "duplicated";
      artifact.scope.modules[0].state.duplicateStateCopies = "allowed";
    }, "duplicate state identity");
    this.#reject(validator, valid, (artifact) => {
      const state = artifact.scope.modules.find((module) =>
        module.currentPath.endsWith("rod_stroke_state.js"));
      state.state.snapshotShape.pop();
    }, "snapshot shape loss");
    this.#reject(validator, valid, (artifact) => {
      const movement = artifact.scope.modules.find((module) =>
        module.currentPath.endsWith("line_constrained_fish_motion_resolver.js"));
      movement.state.stableResultIdentity = false;
    }, "movement buffer identity");
    this.#reject(validator, valid, (artifact) => {
      artifact.performance.additionalMigrationAllocationsAllowed = 1;
    }, "new hot-loop allocation");
    this.#reject(validator, valid, (artifact) => {
      artifact.performance.transportLookupsAllowed = 1;
    }, "hot-loop transport lookup");
    this.#reject(validator, valid, (artifact) => {
      artifact.performance.hotLoopSensitive[0].callSites = [];
      artifact.scope.modules[0].performance.callSites = [];
    }, "missing hot-loop evidence");
    this.#reject(validator, valid, (artifact) => {
      artifact.scope.modules[0].behavior.formulaDefaultsClampsRoundingFingerprint = "stale";
    }, "formula fingerprint drift");
    this.#reject(validator, valid, (artifact) => {
      artifact.scope.modules[0].sourceShape.allocationTotals.roundingCalls = 1;
      artifact.scope.modules[0].sourceSha256 = "stale";
    }, "rounding drift");
    this.#reject(validator, valid, (artifact) => {
      artifact.compatibility.consumers.pop();
    }, "consumer mismatch");
    this.#reject(validator, valid, (artifact) => {
      artifact.compatibility.activations.pop();
    }, "activation mismatch");
    this.#reject(validator, valid, (artifact) => {
      artifact.prerequisites.newlyDiscovered.push({ kind: "audit-blocker" });
    }, "new prerequisite");

    assert.equal(Object.isFrozen(valid), true);
    assert.equal(Object.isFrozen(valid.scope.modules[0]), true);
    console.log(
      "Stage 3.7.0 audit fixtures passed: scope, closure, state identity, snapshot shape, reusable buffers, formula fingerprints, hot-loop allocation/transport budgets and exact compatibility sets are enforced.",
    );
  }

  #reject(validator, source, mutate, label) {
    const artifact = clone(source);
    mutate(artifact);
    assert.throws(
      () => validator.validate(artifact),
      /Stage 3\.7\.0 audit contract failed/u,
      label,
    );
  }
}

new StageThreeBatch007AuditFixtureCheck().run();
