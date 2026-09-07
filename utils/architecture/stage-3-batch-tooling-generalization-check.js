"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { immutableRecord } = require("./guards/core/guard_models");
const {
  StageThreeBatchExecutionProfile,
} = require("./domain_batches/stage_three_batch_execution_profile");
const {
  BATCH_006_EXECUTION_PROFILE,
} = require("./domain_batches/stage_three_batch_006_execution_profile");
const {
  BATCH_007_EXECUTION_PROFILE,
} = require("./domain_batches/stage_three_batch_007_execution_profile");
const {
  BATCH_008_EXECUTION_PROFILE,
} = require("./domain_batches/stage_three_batch_008_execution_profile");
const {
  BATCH_006_BEHAVIOR_CASES,
  BATCH_006_COMPATIBILITY_CASES,
} = require("./domain_batches/stage_three_batch_006_focused_test_catalog");
const {
  BATCH_007_BEHAVIOR_CASES,
  BATCH_007_COMPATIBILITY_CASES,
} = require("./domain_batches/stage_three_batch_007_focused_test_catalog");
const {
  BATCH_008_BEHAVIOR_CASES,
  BATCH_008_COMPATIBILITY_CASES,
} = require("./domain_batches/stage_three_batch_008_focused_test_catalog");
const {
  StageThreeBatchExecutionPlanBuilder,
  StageThreeBatchExecutionPlanValidator,
} = require("./domain_batches/stage_three_batch_execution_plan");
const {
  StageThreeBatchFocusedTestMatrixBuilder,
  StageThreeBatchFocusedTestMatrixValidator,
} = require("./domain_batches/stage_three_batch_focused_test_matrix");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const GENERIC_FILES = Object.freeze([
  "utils/architecture/domain_batches/stage_three_batch_execution_profile.js",
  "utils/architecture/domain_batches/stage_three_batch_execution_plan.js",
  "utils/architecture/domain_batches/stage_three_batch_focused_test_matrix.js",
]);

class StageThreeBatchToolingGeneralizationCheck {
  run() {
    this.#verifyProfileContract();
    this.#verifyMandatoryInputs();
    this.#verifyGenericSourceBoundary();
    this.#verifyHistoricalBatch006();
    this.#verifyAcceptedBatch007();
    this.#verifyBatch008Inputs();
    console.log(
      "Stage 3.8.0 tooling hardening passed: generic builders require explicit immutable inputs, " +
      "batch data is isolated, and accepted batch-006/batch-007 artifacts remain byte-for-byte stable.",
    );
  }

  #verifyProfileContract() {
    for (const profile of [
      BATCH_006_EXECUTION_PROFILE,
      BATCH_007_EXECUTION_PROFILE,
      BATCH_008_EXECUTION_PROFILE,
    ]) {
      assert.equal(Object.isFrozen(profile), true);
      assert.equal(Object.isFrozen(profile.expectedTopology), true);
      assert.doesNotThrow(() => StageThreeBatchExecutionProfile.validateImmutable(profile));
    }
    assert.equal(BATCH_008_EXECUTION_PROFILE.expectedTargetCount, 3);
    assert.equal(BATCH_008_EXECUTION_PROFILE.expectedConsumerCount, 3);
    const invalid = JSON.parse(JSON.stringify(BATCH_008_EXECUTION_PROFILE));
    invalid.expectedTopology.afterBridgeCount = 61;
    assert.throws(
      () => StageThreeBatchExecutionProfile.validateImmutable(immutableRecord(invalid)),
      /bridge topology delta/u,
    );
  }

  #verifyMandatoryInputs() {
    assert.throws(() => new StageThreeBatchExecutionPlanBuilder(), /profile input is required/u);
    assert.throws(() => new StageThreeBatchExecutionPlanValidator(), /profile input is required/u);
    assert.throws(() => new StageThreeBatchExecutionPlanBuilder(
      JSON.parse(JSON.stringify(BATCH_008_EXECUTION_PROFILE)),
    ), /deeply immutable/u);
    assert.throws(() => new StageThreeBatchFocusedTestMatrixBuilder(),
      /requires profile, behaviorCases and compatibilityCases/u);
    assert.throws(() => new StageThreeBatchFocusedTestMatrixValidator({
      profile: BATCH_008_EXECUTION_PROFILE,
      behaviorCases: BATCH_008_BEHAVIOR_CASES,
    }), /compatibilityCases/u);
    assert.throws(() => new StageThreeBatchFocusedTestMatrixBuilder({
      profile: BATCH_008_EXECUTION_PROFILE,
      compatibilityCases: BATCH_008_COMPATIBILITY_CASES,
    }), /behaviorCases/u);
  }

  #verifyGenericSourceBoundary() {
    const forbidden = [
      "BATCH_006", "BATCH_007", "BATCH_008",
      "batch-006", "batch-007", "batch-008",
      "Stage 3.6", "Stage 3.7", "Stage 3.8",
      "seven-classic-consumers-retain-api",
      "nine-classic-consumers-retain-api",
      "three-classic-consumers-retain-api",
    ];
    for (const relativePath of GENERIC_FILES) {
      const source = this.#readBytes(relativePath).toString("utf8");
      for (const token of forbidden) {
        assert.equal(source.includes(token), false,
          `${relativePath} leaks batch-specific token: ${token}`);
      }
    }
  }

  #verifyHistoricalBatch006() {
    const historicalPlanBytes = this.#readBytes(BATCH_006_EXECUTION_PROFILE.executionPlanPath);
    const rebuiltPlan = this.#rebuildHistoricalPlan(
      BATCH_006_EXECUTION_PROFILE,
      JSON.parse(historicalPlanBytes.toString("utf8")),
    );
    const rebuiltPlanBytes = this.#serialize(rebuiltPlan);
    assert.deepEqual(rebuiltPlanBytes, historicalPlanBytes,
      "generic execution builder changed historical batch-006 bytes");
    this.#verifyHistoricalMatrix({
      profile: BATCH_006_EXECUTION_PROFILE,
      behaviorCases: BATCH_006_BEHAVIOR_CASES,
      compatibilityCases: BATCH_006_COMPATIBILITY_CASES,
      plan: rebuiltPlan,
      planBytes: rebuiltPlanBytes,
    });
  }

  #verifyAcceptedBatch007() {
    const planBytes = this.#readBytes(BATCH_007_EXECUTION_PROFILE.executionPlanPath);
    const plan = JSON.parse(planBytes.toString("utf8"));
    new StageThreeBatchExecutionPlanValidator(BATCH_007_EXECUTION_PROFILE).validate(plan);
    this.#verifyHistoricalMatrix({
      profile: BATCH_007_EXECUTION_PROFILE,
      behaviorCases: BATCH_007_BEHAVIOR_CASES,
      compatibilityCases: BATCH_007_COMPATIBILITY_CASES,
      plan,
      planBytes,
    });
  }

  #verifyBatch008Inputs() {
    const dependencies = {
      profile: BATCH_008_EXECUTION_PROFILE,
      behaviorCases: BATCH_008_BEHAVIOR_CASES,
      compatibilityCases: BATCH_008_COMPATIBILITY_CASES,
    };
    assert.doesNotThrow(() => new StageThreeBatchExecutionPlanBuilder(BATCH_008_EXECUTION_PROFILE));
    assert.doesNotThrow(() => new StageThreeBatchExecutionPlanValidator(BATCH_008_EXECUTION_PROFILE));
    assert.doesNotThrow(() => new StageThreeBatchFocusedTestMatrixBuilder(dependencies));
    assert.doesNotThrow(() => new StageThreeBatchFocusedTestMatrixValidator(dependencies));
  }

  #verifyHistoricalMatrix({ profile, behaviorCases, compatibilityCases, plan, planBytes }) {
    const historicalBytes = this.#readBytes(profile.testMatrixPath);
    const dependencies = { profile, behaviorCases, compatibilityCases };
    const rebuilt = new StageThreeBatchFocusedTestMatrixBuilder(dependencies).build({
      executionPlan: plan,
      executionPlanSha256: this.#sha256(planBytes),
    });
    new StageThreeBatchFocusedTestMatrixValidator(dependencies).validate(rebuilt);
    assert.deepEqual(this.#serialize(rebuilt), historicalBytes,
      `generic focused builder changed historical batch-${profile.batchNumber} bytes`);
  }

  #rebuildHistoricalPlan(profile, historicalPlan) {
    const audit = this.#json(profile.auditPath);
    const approvedPlan = this.#json("architecture/migration/stage_3_approved_batches.json");
    const currentRuntime = this.#json("architecture/migration/stage_3_compatibility_runtime.json");
    const currentRegistry = this.#json("architecture/guards/migration_bridge_registry.json");
    const executionState = { ...historicalPlan.lifecycle.preState };
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
    const plan = new StageThreeBatchExecutionPlanBuilder(profile).build({
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
    new StageThreeBatchExecutionPlanValidator(profile).validate(plan);
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
