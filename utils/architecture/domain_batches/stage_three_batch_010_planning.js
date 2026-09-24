"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { StageThreeBatchExecutionPlanProjector } = require("./stage_three_batch_execution_plan_projector");
const { StageThreeBatchExecutionPlanValidator } = require("./stage_three_batch_execution_plan");
const { StageThreeBatchFocusedTestMatrixBuilder, StageThreeBatchFocusedTestMatrixValidator } = require("./stage_three_batch_focused_test_matrix");
const { Batch010Preflight, PROFILE, PATHS } = require("./stage_three_batch_010_preflight");
const { BATCH_010_MATRIX_DEPENDENCIES } = require("./stage_three_batch_010_focused_test_catalog");

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

class Batch010Planning {
  constructor(root) {
    this.root = path.resolve(root);
    this.preflight = new Batch010Preflight(this.root);
    this.projector = new StageThreeBatchExecutionPlanProjector({
      projectRoot: this.root,
      profile: PROFILE.executionProfile,
      paths: PLAN_PATHS,
      rollbackFilePaths: ROLLBACK_PATHS,
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
    assert.equal(plan.compatibility.activations[0].legacyScriptIndex, 148);
    assert.deepEqual(plan.compatibility.plannedBridgeRecords.map(record => record.id),
      PROFILE.executionProfile.expectedBridgeIds);
    return plan;
  }

  matrix() {
    const plan = this.json(PLAN_PATHS.output);
    assert.deepEqual(this.bytes(PLAN_PATHS.output), serialize(this.plan()), "execution plan replay differs");
    const dependencies = BATCH_010_MATRIX_DEPENDENCIES;
    const matrix = new StageThreeBatchFocusedTestMatrixBuilder(dependencies).build({
      executionPlan: plan,
      executionPlanSha256: sha(this.bytes(PLAN_PATHS.output)),
    });
    return new StageThreeBatchFocusedTestMatrixValidator(dependencies).validate(matrix);
  }
}

module.exports = { Batch010Planning, PLAN_PATHS, ROLLBACK_PATHS, sha, serialize };
