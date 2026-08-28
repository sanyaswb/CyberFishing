"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {
  StageThreeBatchExecutionProfile,
  BATCH_006_EXECUTION_PROFILE,
  BATCH_007_EXECUTION_PROFILE,
} = require("./domain_batches/stage_three_batch_execution_profile");
const {
  StageThreeBatchExecutionPlanBuilder,
  StageThreeBatchExecutionPlanValidator,
} = require("./domain_batches/stage_three_batch_execution_plan");
const {
  StageThreeBatchFocusedTestMatrixBuilder,
  StageThreeBatchFocusedTestMatrixValidator,
} = require("./domain_batches/stage_three_batch_focused_test_matrix");

const PROJECT_ROOT = path.resolve(__dirname, "../..");

class StageThreeBatchToolingGeneralizationCheck {
  run() {
    this.#verifyProfileContract();
    const historicalPlanBytes = this.#readBytes(BATCH_006_EXECUTION_PROFILE.executionPlanPath);
    const historicalPlan = JSON.parse(historicalPlanBytes.toString("utf8"));
    const rebuiltPlan = this.#rebuildHistoricalPlan(historicalPlan);
    const rebuiltPlanBytes = this.#serialize(rebuiltPlan);
    assert.deepEqual(rebuiltPlanBytes, historicalPlanBytes,
      "generic execution builder changed the historical batch-006 artifact");

    const historicalMatrixBytes = this.#readBytes(BATCH_006_EXECUTION_PROFILE.testMatrixPath);
    const historicalMatrix = JSON.parse(historicalMatrixBytes.toString("utf8"));
    const rebuiltMatrix = new StageThreeBatchFocusedTestMatrixBuilder().build({
      executionPlan: rebuiltPlan,
      executionPlanSha256: this.#sha256(rebuiltPlanBytes),
    });
    new StageThreeBatchFocusedTestMatrixValidator().validate(rebuiltMatrix);
    assert.deepEqual(this.#serialize(rebuiltMatrix), historicalMatrixBytes,
      "generic focused-matrix builder changed the historical batch-006 artifact");
    assert.deepEqual(rebuiltMatrix, historicalMatrix);

    console.log(
      "Stage 3 batch tooling generalization passed: immutable data-only profiles drive generic rules, and batch-006 execution-plan/test-matrix artifacts remain byte-for-byte stable.",
    );
  }

  #verifyProfileContract() {
    assert.equal(Object.isFrozen(BATCH_006_EXECUTION_PROFILE), true);
    assert.equal(Object.isFrozen(BATCH_007_EXECUTION_PROFILE.expectedTopology), true);
    assert.equal(BATCH_007_EXECUTION_PROFILE.expectedConsumerCount, 9);
    assert.equal(BATCH_007_EXECUTION_PROFILE.includeRuntimeActiveState, true);
    const invalid = JSON.parse(JSON.stringify(BATCH_007_EXECUTION_PROFILE));
    invalid.expectedTopology.afterBridgeCount = 56;
    assert.throws(
      () => new StageThreeBatchExecutionProfile(invalid),
      /bridge topology delta/u,
    );
  }

  #rebuildHistoricalPlan(historicalPlan) {
    const audit = this.#json(BATCH_006_EXECUTION_PROFILE.auditPath);
    const approvedPlan = this.#json("architecture/migration/stage_3_approved_batches.json");
    const currentRuntime = this.#json("architecture/migration/stage_3_compatibility_runtime.json");
    const currentRegistry = this.#json("architecture/guards/migration_bridge_registry.json");
    const executionState = {
      ...historicalPlan.lifecycle.preState,
    };
    const historicalOwners = new Set(executionState.completedBatchIds);
    const runtimeContract = {
      ...currentRuntime,
      activationPositions: currentRuntime.activationPositions.filter((record) =>
        historicalOwners.has(record.owner)),
    };
    const bridgeRegistry = {
      ...currentRegistry,
      bridges: currentRegistry.bridges.filter((record) =>
        /^stage-2\./u.test(record.owner) || historicalOwners.has(record.owner)),
    };
    const builder = new StageThreeBatchExecutionPlanBuilder(BATCH_006_EXECUTION_PROFILE);
    const plan = builder.build({
      audit,
      auditSha256: historicalPlan.sourceEvidence.audit.sha256,
      approvedPlan,
      approvedPlanSha256: historicalPlan.sourceEvidence.approvedPlan.sha256,
      executionState,
      executionStateSha256: historicalPlan.sourceEvidence.executionState.sha256,
      runtimeContract,
      runtimeContractSha256: historicalPlan.sourceEvidence.runtimeContract.sha256,
      manifestSha256: historicalPlan.sourceEvidence.manifest.sha256,
      bridgeRegistry,
      bridgeRegistrySha256: historicalPlan.sourceEvidence.bridgeRegistry.sha256,
      runtimeFacts: {
        projectModuleCount: historicalPlan.cumulativeRuntime.beforeProjectModuleCount,
        activationCount: historicalPlan.cumulativeRuntime.beforeActivationCount,
        scriptTopology: historicalPlan.scriptTopology.before,
      },
      rollbackEvidence: historicalPlan.rollback.baselineEvidence,
    });
    new StageThreeBatchExecutionPlanValidator(BATCH_006_EXECUTION_PROFILE).validate(plan);
    return plan;
  }

  #json(relativePath) {
    return JSON.parse(this.#readBytes(relativePath).toString("utf8"));
  }

  #readBytes(relativePath) {
    return fs.readFileSync(path.join(PROJECT_ROOT, relativePath));
  }

  #serialize(value) {
    return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
  }

  #sha256(value) {
    return crypto.createHash("sha256").update(value).digest("hex");
  }
}

new StageThreeBatchToolingGeneralizationCheck().run();
