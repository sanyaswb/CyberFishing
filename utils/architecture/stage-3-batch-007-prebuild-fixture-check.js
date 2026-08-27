"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  BATCH_007_PREBUILD_PROFILE,
} = require("./domain_batches/stage_three_batch_prebuild_profile");
const {
  StageThreeBatchPrebuildContractValidator,
} = require("./domain_batches/stage_three_batch_prebuild_contract");

const PROJECT_ROOT = path.resolve(__dirname, "../..");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

class StageThreeBatch007PrebuildFixtureCheck {
  run() {
    const persisted = JSON.parse(fs.readFileSync(path.join(
      PROJECT_ROOT,
      BATCH_007_PREBUILD_PROFILE.artifactPath,
    ), "utf8"));
    const validator = new StageThreeBatchPrebuildContractValidator(BATCH_007_PREBUILD_PROFILE);
    const artifact = validator.validate(persisted);
    this.#reject(validator, artifact, (value) => value.lifecycle.completedBatchIds.pop());
    this.#reject(validator, artifact, (value) => value.lifecycle.activeBatchPhase = "runtime-active");
    this.#reject(validator, artifact, (value) => value.preliminaryMetadata.targets.pop());
    this.#reject(validator, artifact, (value) => value.preliminaryMetadata.plannedActivationPositions.pop());
    this.#reject(validator, artifact, (value) => value.preliminaryMetadata.plannedBridges.pop());
    this.#reject(validator, artifact, (value) => value.preliminaryMetadata.plannedBridges[0].id = "bridge-deadbeef0000");
    this.#reject(validator, artifact, (value) => value.planningStorage = "runtime-contract");
    this.#reject(validator, artifact, (value) => value.activeTopology.counts.modules = 26);
    this.#reject(validator, artifact, (value) => value.plannedDelta.projectModules[0] = value.activeTopology.projectModules[0]);
    this.#reject(validator, artifact, (value) => value.plannedTopology.activationIds[0] = "activation-deadbeef0000");
    this.#reject(validator, artifact, (value) => value.locks.runtimeCutoverAllowed = true);
    this.#reject(validator, artifact, (value) => value.locks.observationsFinal = true);
    assert.equal(Object.isFrozen(artifact), true);
    assert.equal(Object.isFrozen(artifact.plannedTopology), true);
    console.log(
      "Stage 3.7.3 prebuild fixtures passed: lifecycle, exact target/activation/consumer sets, canonical identities, active+delta topology union, contract-only planning and runtime locks are enforced.",
    );
  }

  #reject(validator, source, mutate) {
    const value = clone(source);
    mutate(value);
    assert.throws(() => validator.validate(value), /Stage 3\.7\.3 prebuild contract failed/u);
  }
}

new StageThreeBatch007PrebuildFixtureCheck().run();
