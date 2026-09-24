"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { StageThreeBatchExecutionPlanProjector } = require("./stage_three_batch_execution_plan_projector");
const { StageThreeBatchExecutionPlanValidator } = require("./stage_three_batch_execution_plan");
const { StageThreeBatchFocusedTestMatrixBuilder, StageThreeBatchFocusedTestMatrixValidator } = require("./stage_three_batch_focused_test_matrix");
const { StageThreeLivePreflight, PATHS } = require("./stage_three_live_preflight");
const { BATCH_011_PREFLIGHT_PROFILE: PROFILE } = require("./stage_three_batch_011_preflight_profile");
const { BATCH_011_MATRIX_DEPENDENCIES } = require("./stage_three_batch_011_focused_test_catalog");

const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const serialize = value => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
const PLAN_PATHS = Object.freeze({
  ...PATHS,
  audit: PROFILE.executionProfile.auditPath,
  output: PROFILE.executionProfile.executionPlanPath,
});
const ROLLBACK_PATHS = Object.freeze([
  "CHANGELOG.md", "architecture/build/package_contract.json", PATHS.bridgeRegistry,
  PATHS.manifest, PATHS.runtimeContract, PATHS.executionState, PATHS.index,
  "package-lock.json", "package.json", "refactor_Task.txt", "src/config/project_version.js",
  ...PROFILE.executionProfile.expectedTargets.map(target => target.currentPath),
]);

class Batch011Planning {
  constructor(root) {
    this.root = path.resolve(root);
    this.preflight = new StageThreeLivePreflight(this.root, PROFILE);
    this.projector = new StageThreeBatchExecutionPlanProjector({
      projectRoot: this.root, profile: PROFILE.executionProfile,
      paths: PLAN_PATHS, rollbackFilePaths: ROLLBACK_PATHS,
    });
  }

  bytes(file) { return fs.readFileSync(path.join(this.root, file)); }
  read(file) { return this.bytes(file).toString("utf8"); }
  json(file) { return JSON.parse(this.bytes(file)); }

  plan() {
    this.preflight.verifyReplay(this.json(PLAN_PATHS.audit));
    const plan = this.projector.buildPlan();
    new StageThreeBatchExecutionPlanValidator(PROFILE.executionProfile).validate(plan);
    assert.equal(plan.scriptTopology.before.cumulativeRuntimeScriptCount, 1);
    assert.equal(plan.scriptTopology.after.cumulativeRuntimeScriptCount, 1);
    assert.equal(plan.scriptTopology.after.isolatedIifeScriptCount, 0);
    assert.deepEqual(plan.compatibility.plannedBridgeRecords.map(record => record.id),
      PROFILE.executionProfile.expectedBridgeIds);
    assert.deepEqual(plan.compatibility.activations.map(record => record.legacyScriptIndex).sort((a, b) => a - b),
      PROFILE.executionProfile.expectedActivationPositions);
    return plan;
  }

  matrix() {
    const plan = this.json(PLAN_PATHS.output);
    assert.deepEqual(this.bytes(PLAN_PATHS.output), serialize(this.plan()), "execution plan replay differs");
    const matrix = new StageThreeBatchFocusedTestMatrixBuilder(BATCH_011_MATRIX_DEPENDENCIES).build({
      executionPlan: plan,
      executionPlanSha256: sha(this.bytes(PLAN_PATHS.output)),
    });
    return new StageThreeBatchFocusedTestMatrixValidator(BATCH_011_MATRIX_DEPENDENCIES).validate(matrix);
  }
}

module.exports = { Batch011Planning, PLAN_PATHS, ROLLBACK_PATHS, sha, serialize };
