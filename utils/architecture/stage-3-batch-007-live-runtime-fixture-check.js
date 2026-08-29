"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  StageThreeBatch007LiveRuntimeValidationContractValidator,
} = require("./domain_batches/stage_three_batch_007_live_runtime_validation");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const ARTIFACT_PATH = path.join(
  PROJECT_ROOT,
  "architecture/migration/stage_3_batch_007_live_runtime_validation.json",
);

class StageThreeBatch007LiveRuntimeFixtureCheck {
  run() {
    const artifact = JSON.parse(fs.readFileSync(ARTIFACT_PATH, "utf8"));
    const validator = new StageThreeBatch007LiveRuntimeValidationContractValidator();
    validator.validate(artifact);
    this.#reject(validator, artifact, (value) => value.lifecycle.batchCompleted = true);
    this.#reject(validator, artifact, (value) => value.runtime.runtimeEvaluationCount = 2);
    this.#reject(validator, artifact, (value) => value.runtime.transportAssignmentCount = 2);
    this.#reject(validator, artifact, (value) => value.runtime.moduleScriptCount = 1);
    this.#reject(validator, artifact, (value) => value.activationTiming[0].globalAbsentBeforeActivation = false);
    this.#reject(validator, artifact, (value) => value.activationTiming[0].activationId = "activation-stale");
    this.#reject(validator, artifact, (value) => value.identity.exactExportIdentityCount = 5);
    this.#reject(validator, artifact, (value) => value.behavior.caseCount = 53);
    this.#reject(validator, artifact, (value) => value.state.rodPullState.exactPublicFieldCount = 31);
    this.#reject(validator, artifact, (value) => value.state.rodStrokeState.exactSnapshotFieldCount = 4);
    this.#reject(validator, artifact, (value) => value.performance.additionalMigrationAllocations = 1);
    this.#reject(validator, artifact, (value) => value.performance.transportLookups = 1);
    this.#reject(validator, artifact, (value) => value.consumers.relationshipCount = 8);
    this.#reject(validator, artifact, (value) => value.consumers.records[0].bridgeId = "bridge-stale");
    this.#reject(validator, artifact, (value) => value.evidence.runtimeBundle.sha256 = "0".repeat(64));
    console.log(
      "Stage 3.7.6 live-runtime fixtures passed: lifecycle, one evaluation, exact timing/identity, " +
      "state shape, allocation/transport budgets, consumer equality and stale evidence are enforced.",
    );
  }

  #reject(validator, artifact, mutate) {
    const invalid = structuredClone(artifact);
    mutate(invalid);
    assert.throws(() => validator.validate(invalid), /Stage 3\.7\.6 live runtime contract failed/u);
  }
}

new StageThreeBatch007LiveRuntimeFixtureCheck().run();
