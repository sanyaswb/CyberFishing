"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { StageThreeBatchExecutionPlanProjector } = require("../../domain_batches/stage_three_batch_execution_plan_projector");
const { StageThreeBatchExecutionPlanValidator } = require("../../domain_batches/stage_three_batch_execution_plan");
const { StageThreeBatchFocusedTestMatrixBuilder, StageThreeBatchFocusedTestMatrixValidator } =
  require("../../domain_batches/stage_three_batch_focused_test_matrix");
const { StageThreeLivePreflight, PATHS, serialize } = require("../../domain_batches/stage_three_live_preflight");
const { immutableRecord } = require("../../guards/core/guard_models");

const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex");

// Release metadata the rollback baseline covers (informational documents are excluded).
const RELEASE_ROLLBACK_PATHS = Object.freeze(["CHANGELOG.md", "architecture/build/package_contract.json",
  "package-lock.json", "package.json", "src/config/project_version.js"]);

// Preflight audit, execution plan and focused matrix of one batch (Stage 3.N.0–3.N.2).
class StageThreeBatchPlanning {
  constructor(root, definition) {
    this.root = path.resolve(root);
    this.definition = definition;
    this.paths = Object.freeze({ ...PATHS, audit: definition.execution.auditPath,
      output: definition.execution.executionPlanPath });
    this.preflight = new StageThreeLivePreflight(this.root, definition.profile);
    this.projector = new StageThreeBatchExecutionPlanProjector({
      projectRoot: this.root, profile: definition.execution, paths: this.paths,
      rollbackFilePaths: [...this.rollbackPaths(), ...this.retiredPlaceholderPaths()],
    });
  }

  bytes(file) { return fs.readFileSync(path.join(this.root, file)); }
  read(file) { return this.bytes(file).toString("utf8"); }
  json(file) { return JSON.parse(this.bytes(file)); }

  rollbackPaths() {
    return [...RELEASE_ROLLBACK_PATHS, PATHS.bridgeRegistry, PATHS.manifest, PATHS.runtimeContract,
      PATHS.executionState, PATHS.index, ...this.definition.execution.expectedTargets.map(target => target.currentPath)];
  }

  // Classic sources of the activations this batch retires become inert placeholders, so their
  // pre-cutover bytes belong to the rollback baseline. Resolved from the live or the retired ledger.
  retiredPlaceholderPaths() {
    const contract = this.json(PATHS.runtimeContract);
    const known = [...contract.activationPositions, ...(contract.retiredActivations || []).map(item => item.activation)];
    return [...new Set((this.definition.execution.expectedRetiredActivationIds || []).map(id => {
      const activation = known.find(item => item.id === id);
      assert.ok(activation, `Retired activation is unknown: ${id}`);
      return activation.sourceProvider;
    }))];
  }

  matrixDependencies() {
    return Object.freeze({
      profile: this.definition.execution,
      behaviorCases: immutableRecord(this.definition.matrix.behaviorCases),
      compatibilityCases: Object.freeze([...this.definition.matrix.compatibilityCases]),
    });
  }

  audit() { return this.preflight.build(); }

  plan() {
    this.preflight.verifyReplay(this.json(this.paths.audit));
    const plan = this.projector.buildPlan();
    const execution = this.definition.execution;
    new StageThreeBatchExecutionPlanValidator(execution).validate(plan);
    assert.equal(plan.scriptTopology.before.cumulativeRuntimeScriptCount, 1);
    assert.equal(plan.scriptTopology.after.cumulativeRuntimeScriptCount, 1);
    assert.equal(plan.scriptTopology.after.isolatedIifeScriptCount, 0);
    assert.deepEqual(plan.compatibility.plannedBridgeRecords.map(record => record.id), execution.expectedBridgeIds);
    assert.deepEqual(plan.compatibility.activations.map(record => record.legacyScriptIndex)
      .sort((a, b) => a - b), execution.expectedActivationPositions);
    return plan;
  }

  matrix() {
    const bytes = this.bytes(this.paths.output);
    const plan = JSON.parse(bytes);
    assert.deepEqual(bytes, this.projector.serialize(this.plan()));
    const dependencies = this.matrixDependencies();
    const matrix = new StageThreeBatchFocusedTestMatrixBuilder(dependencies)
      .build({ executionPlan: plan, executionPlanSha256: sha(bytes) });
    return new StageThreeBatchFocusedTestMatrixValidator(dependencies).validate(matrix);
  }
}

module.exports = { StageThreeBatchPlanning, RELEASE_ROLLBACK_PATHS, sha, serialize };
