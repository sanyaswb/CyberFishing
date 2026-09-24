"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { Batch010Planning, PLAN_PATHS } = require("./domain_batches/stage_three_batch_010_planning");
const { PROFILE } = require("./domain_batches/stage_three_batch_010_preflight");
const { StageThreeBatchExecutionPlanValidator } = require("./domain_batches/stage_three_batch_execution_plan");
const { StageThreeBatchFocusedTestMatrixValidator } = require("./domain_batches/stage_three_batch_focused_test_matrix");
const { BATCH_010_MATRIX_DEPENDENCIES } = require("./domain_batches/stage_three_batch_010_focused_test_catalog");
const { RepresentationEquivalenceGuard } = require("./domain_batches/stage_three_batch_focused_harness");

class Batch010PlanningFixtures {
  run(root = path.resolve(__dirname, "../..")) {
    const app = new Batch010Planning(root);
    const plan = app.json(PLAN_PATHS.output);
    const matrix = app.json(PROFILE.executionProfile.testMatrixPath);
    const planValidator = new StageThreeBatchExecutionPlanValidator(PROFILE.executionProfile);
    const matrixValidator = new StageThreeBatchFocusedTestMatrixValidator(BATCH_010_MATRIX_DEPENDENCIES);
    planValidator.validate(plan);
    matrixValidator.validate(matrix);
    let negatives = 0;
    const rejects = (base, mutate, validate, label) => {
      const changed = structuredClone(base);
      mutate(changed);
      assert.throws(() => validate(changed), label);
      negatives++;
    };
    for (const [label, mutate] of [
      ["partial cutover", item => { item.scope.partialCutoverAllowed = true; }],
      ["missing target", item => { item.scope.modules.pop(); }],
      ["wrong activation position", item => { item.compatibility.activations[0].legacyScriptIndex++; }],
      ["missing consumer bridge", item => { item.compatibility.plannedBridgeRecords.pop(); }],
      ["noncanonical bridge", item => { item.compatibility.plannedBridgeRecords[0].id = "bridge-wrong"; }],
      ["duplicate runtime", item => { item.cumulativeRuntime.isolatedIifeAllowed = true; }],
      ["rollback gap", item => { item.rollback.baselineEvidence.files.pop(); }],
      ["early completion", item => { item.lifecycle.completedState.activeBatchId = PROFILE.batchId; }],
    ]) rejects(plan, mutate, item => planValidator.validate(item), label);
    for (const [label, mutate] of [
      ["missing behavior", item => { item.behaviorCases.pop(); }],
      ["missing compatibility", item => { item.compatibilityCases.pop(); }],
      ["duplicate evaluation", item => { item.identityContract.moduleEvaluationCount = 2; }],
      ["early cutover", item => { item.runtimeCutoverAllowed = true; }],
      ["extra allocation budget", item => { item.statePerformanceContract.additionalMigrationAllocationsAllowed = 1; }],
    ]) rejects(matrix, mutate, item => matrixValidator.validate(item), label);
    const module = plan.scope.modules[0];
    const source = app.bytes(module.currentPath).toString("utf8");
    const symbol = module.exports[0];
    const changed = source.replace("allowed: true", "allowed: false").replace(`class ${symbol}`, `export class ${symbol}`);
    assert.throws(() => new RepresentationEquivalenceGuard().validate({
      classicSource: source, candidateSource: changed, exportName: symbol,
      transportSymbol: "__CYBER_FISHING_COMPAT_RUNTIME__",
    }));
    negatives++;
    console.log(`Stage 3.10.1–3.10.2 fixtures PASS: ${negatives} negative cases.`);
    return negatives;
  }
}

if (require.main === module) {
  new (require("./domain_batches/stage_three_batch_010_historical_workspace").Batch010HistoricalWorkspace)()
    .run(path.resolve(__dirname, "../.."), root => new Batch010PlanningFixtures().run(root))
    .catch(error => { console.error(error.stack); process.exitCode = 1; });
}

module.exports = { Batch010PlanningFixtures };
