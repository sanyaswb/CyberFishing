"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  BATCH_008_PREFLIGHT_PROFILE,
} = require("./domain_batches/stage_three_batch_008_preflight_profile");
const {
  StageThreeBatchPreflightAuditValidator,
} = require("./domain_batches/stage_three_batch_preflight_audit");

const PROJECT_ROOT = path.resolve(__dirname, "../..");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

class StageThreeBatch008AuditFixtureCheck {
  run() {
    const validator = new StageThreeBatchPreflightAuditValidator(
      BATCH_008_PREFLIGHT_PROFILE,
    );
    const valid = validator.validate(JSON.parse(fs.readFileSync(path.join(
      PROJECT_ROOT,
      "architecture/migration/stage_3_batch_008_audit.json",
    ), "utf8")));
    this.#reject(validator, valid, (artifact) => artifact.scope.modules.pop(), "missing target");
    this.#reject(validator, valid, (artifact) => {
      artifact.closure.unexpectedDependencies.push({ source: "a", target: "b", symbols: [] });
    }, "unexpected dependency");
    this.#reject(validator, valid, (artifact) => {
      artifact.boundaries.directConfigDependencies.push({ source: "a", target: "game-config" });
    }, "config edge");
    this.#reject(validator, valid, (artifact) => {
      artifact.boundaries.browserCapabilities.push({ module: "a", capability: "dom" });
    }, "browser capability");
    this.#reject(validator, valid, (artifact) => {
      artifact.boundaries.transportReads.push("src/game/domain/fishing/line_spool_state.js");
    }, "transport read");
    this.#reject(validator, valid, (artifact) => {
      artifact.effects.unsafe.push("src/core/line/line_spool_state.js");
    }, "unsafe effect");
    this.#reject(validator, valid, (artifact) => {
      artifact.runtimeBaseline.projectModules.pop();
    }, "live runtime topology drift");
    this.#reject(validator, valid, (artifact) => {
      artifact.scope.modules[0].state.ownerIdentity = "duplicated";
    }, "state owner drift");
    this.#reject(validator, valid, (artifact) => {
      artifact.scope.modules[0].sourceShape.allocationTotals.objectExpressions += 1;
    }, "allocation drift");
    this.#reject(validator, valid, (artifact) => artifact.compatibility.consumers.pop(),
      "missing consumer");
    this.#reject(validator, valid, (artifact) => artifact.compatibility.activations.pop(),
      "missing activation");
    this.#reject(validator, valid, (artifact) => {
      artifact.prerequisites.newlyDiscovered.push({ kind: "preflight-blocker", issue: "new" });
    }, "new prerequisite");
    assert.equal(Object.isFrozen(valid), true);
    assert.equal(Object.isFrozen(valid.scope.modules[0]), true);
    console.log(
      "Stage 3.8.0 preflight fixtures passed: scope, closure, boundaries, state identity, " +
      "allocation baseline, consumers, activations and prerequisites fail closed.",
    );
  }

  #reject(validator, source, mutate, label) {
    const artifact = clone(source);
    mutate(artifact);
    assert.throws(() => validator.validate(artifact),
      /Stage 3\.8\.0 preflight contract failed/u, label);
  }
}

new StageThreeBatch008AuditFixtureCheck().run();
