"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { StageThreeBatchExecutionPlanProjector } = require("./stage_three_batch_execution_plan_projector");
const { StageThreeBatchExecutionPlanValidator } = require("./stage_three_batch_execution_plan");
const { StageThreeBatchFocusedTestMatrixBuilder, StageThreeBatchFocusedTestMatrixValidator } =
  require("./stage_three_batch_focused_test_matrix");
const { StageThreeLivePreflight, PATHS, serialize } = require("./stage_three_live_preflight");
const { BATCH_025_PREFLIGHT_PROFILE: PROFILE } = require("./stage_three_batch_025_preflight_profile");
const { BATCH_025_MATRIX_DEPENDENCIES } = require("./stage_three_batch_025_focused_test_catalog");

const PLAN_PATHS = Object.freeze({
  ...PATHS,
  audit: PROFILE.executionProfile.auditPath,
  output: PROFILE.executionProfile.executionPlanPath,
});
const ROLLBACK_PATHS = Object.freeze([
  "CHANGELOG.md", "architecture/build/package_contract.json", PATHS.bridgeRegistry,
  PATHS.manifest, PATHS.runtimeContract, PATHS.executionState, PATHS.index,
  "package-lock.json", "package.json", "src/config/project_version.js",
  ...PROFILE.executionProfile.expectedTargets.map(target => target.currentPath),
]);

// Classic sources of the activations this batch retires become inert placeholders, so their
// pre-cutover bytes belong to the rollback baseline. Resolved from the live or the retired ledger.
function retiredPlaceholderPaths(root) {
  const contract = JSON.parse(fs.readFileSync(path.join(root, PATHS.runtimeContract)));
  const known = [...contract.activationPositions, ...(contract.retiredActivations || []).map(item => item.activation)];
  return PROFILE.executionProfile.expectedRetiredActivationIds.map(id => {
    const activation = known.find(item => item.id === id);
    assert.ok(activation, `Retired activation is unknown: ${id}`);
    return activation.sourceProvider;
  });
}

class Batch025Planning {
  constructor(root) {
    this.root = path.resolve(root);
    this.preflight = new StageThreeLivePreflight(this.root, PROFILE);
    this.projector = new StageThreeBatchExecutionPlanProjector({
      projectRoot: this.root, profile: PROFILE.executionProfile,
      paths: PLAN_PATHS, rollbackFilePaths: [...ROLLBACK_PATHS, ...retiredPlaceholderPaths(this.root)],
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
    assert.deepEqual(plan.compatibility.activations.map(record => record.legacyScriptIndex)
      .sort((a, b) => a - b), PROFILE.executionProfile.expectedActivationPositions);
    return plan;
  }

  matrix() {
    const bytes = this.bytes(PLAN_PATHS.output);
    const plan = JSON.parse(bytes);
    assert.deepEqual(bytes, this.projector.serialize(this.plan()));
    const matrix = new StageThreeBatchFocusedTestMatrixBuilder(BATCH_025_MATRIX_DEPENDENCIES)
      .build({ executionPlan: plan,
        executionPlanSha256: crypto.createHash("sha256").update(bytes).digest("hex") });
    return new StageThreeBatchFocusedTestMatrixValidator(BATCH_025_MATRIX_DEPENDENCIES)
      .validate(matrix);
  }
}

const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex");

module.exports = { Batch025Planning, PLAN_PATHS, ROLLBACK_PATHS, sha, serialize };
