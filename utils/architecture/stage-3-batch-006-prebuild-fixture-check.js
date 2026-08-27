"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  StageThreeBatchPrebuildContractValidator,
} = require("./domain_batches/stage_three_batch_prebuild_contract");
const {
  BATCH_006_PREBUILD_PROFILE,
} = require("./domain_batches/stage_three_batch_prebuild_profile");

const PROJECT_ROOT = path.resolve(__dirname, "../..");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

class StageThreeBatch006PrebuildFixtureCheck {
  run() {
    const valid = JSON.parse(fs.readFileSync(path.join(
      PROJECT_ROOT,
      "architecture/migration/stage_3_batch_006_prebuild_contract.json",
    ), "utf8"));
    const validator = new StageThreeBatchPrebuildContractValidator(BATCH_006_PREBUILD_PROFILE);
    assert.doesNotThrow(() => validator.validate(valid));
    this.#reject(validator, valid, (record) => record.lifecycle.completedBatchIds.pop());
    this.#reject(validator, valid, (record) => record.lifecycle.activeBatchPhase = "runtime-active");
    this.#reject(validator, valid, (record) => record.preliminaryMetadata.targets.pop());
    this.#reject(validator, valid, (record) => record.preliminaryMetadata.plannedActivationPositions.pop());
    this.#reject(validator, valid, (record) => record.preliminaryMetadata.plannedBridges.pop());
    this.#reject(validator, valid, (record) => record.preliminaryMetadata.plannedBridges[0].id = "bridge-deadbeef0000");
    this.#reject(validator, valid, (record) => record.locks.runtimeCutoverAllowed = true);
    this.#reject(validator, valid, (record) => record.locks.observationsFinal = true);
    console.log(
      "Stage 3.6.4 prebuild fixtures passed: prefix drift, premature runtime phase, incomplete targets/activations/consumers, non-canonical IDs and early cutover are rejected.",
    );
  }

  #reject(validator, source, mutate) {
    const value = clone(source);
    mutate(value);
    assert.throws(() => validator.validate(value), /Stage 3\.6\.4 prebuild contract failed/u);
  }
}

new StageThreeBatch006PrebuildFixtureCheck().run();
