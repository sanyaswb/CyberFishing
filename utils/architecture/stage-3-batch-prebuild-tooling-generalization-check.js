"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  BATCH_006_PREBUILD_PROFILE,
} = require("./domain_batches/stage_three_batch_prebuild_profile");
const {
  StageThreeBatchPrebuildContractBuilder,
  StageThreeBatchPrebuildContractValidator,
} = require("./domain_batches/stage_three_batch_prebuild_contract");

const PROJECT_ROOT = path.resolve(__dirname, "../..");

class StageThreeBatchPrebuildToolingGeneralizationCheck {
  run() {
    const historicalBytes = this.#read("architecture/migration/stage_3_batch_006_prebuild_contract.json");
    const historical = JSON.parse(historicalBytes.toString("utf8"));
    const audit = this.#json("architecture/migration/stage_3_batch_006_audit.json");
    const executionPlan = this.#json("architecture/migration/stage_3_batch_006_execution_plan.json");
    const testMatrix = this.#json("architecture/migration/stage_3_batch_006_test_matrix.json");
    const reconstructedState = {
      completedBatchIds: [...historical.lifecycle.completedBatchIds],
      activeBatchId: null,
      compatibilityRuntimeActivated: true,
    };
    const artifact = new StageThreeBatchPrebuildContractBuilder(BATCH_006_PREBUILD_PROFILE).build({
      audit,
      auditSha256: historical.evidence.audit.sha256,
      executionPlan,
      executionPlanSha256: historical.evidence.executionPlan.sha256,
      testMatrix,
      testMatrixSha256: historical.evidence.testMatrix.sha256,
      executionState: reconstructedState,
      executionStateSha256: historical.evidence.executionStateBefore.sha256,
      manifestSha256: historical.evidence.manifestBefore.sha256,
      runtimeContractSha256: historical.evidence.runtimeContractBefore.sha256,
      bridgeRegistrySha256: historical.evidence.bridgeRegistryBefore.sha256,
    });
    new StageThreeBatchPrebuildContractValidator(BATCH_006_PREBUILD_PROFILE).validate(artifact);
    assert.deepEqual(this.#serialize(artifact), historicalBytes,
      "Generic prebuild tooling changed historical batch-006 bytes");
    for (const relativePath of [
      "utils/architecture/domain_batches/stage_three_batch_prebuild_contract.js",
      "utils/architecture/domain_batches/stage_three_batch_prebuild_projector.js",
    ]) {
      const source = this.#read(relativePath).toString("utf8");
      for (const forbidden of ["batch-006", "batch-007", "3.6", "3.7"]) {
        assert.equal(source.includes(forbidden), false,
          `${relativePath} leaks batch-specific token ${forbidden}`);
      }
    }
    console.log(
      "Stage 3 prebuild tooling generalization passed: generic profile-driven builder/projector contain no batch-specific identities and reproduce the historical batch-006 artifact byte-for-byte.",
    );
  }

  #serialize(value) {
    return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
  }

  #json(relativePath) {
    return JSON.parse(this.#read(relativePath).toString("utf8"));
  }

  #read(relativePath) {
    return fs.readFileSync(path.join(PROJECT_ROOT, relativePath));
  }
}

new StageThreeBatchPrebuildToolingGeneralizationCheck().run();
