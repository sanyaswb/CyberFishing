"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { Batch012Planning, PLAN_PATHS, serialize } = require("./domain_batches/stage_three_batch_012_planning");
const { RepositoryContentSnapshot } = require("./esm_infrastructure/repository_content_snapshot");

class Batch012PlanningCheck {
  run(root = path.resolve(__dirname, "../..")) {
    const planning = new Batch012Planning(root);
    const snapshot = new RepositoryContentSnapshot(root);
    const before = snapshot.capture();
    const runtimeBefore = planning.projector.rollbackEvidence().runtimeOutput;
    try {
      const plan = planning.json(PLAN_PATHS.output);
      assert.deepEqual(planning.bytes(PLAN_PATHS.output), serialize(planning.plan()));
      const matrix = planning.json(planning.preflight.profile.executionProfile.testMatrixPath);
      assert.deepEqual(planning.bytes(planning.preflight.profile.executionProfile.testMatrixPath), serialize(planning.matrix()));
      assert.equal(matrix.scope.moduleCount, 2);
      console.log(`Stage 3.12.1–.2 PASS: ${plan.scope.targetCount} targets, ${plan.scope.consumerRelationshipCount} bridges, ${matrix.behaviorCases.length} behavior cases; batch-only rollback and runtime unchanged.`);
      return { plan, matrix };
    } finally {
      snapshot.assertEqual(before, snapshot.capture());
      assert.deepEqual(planning.projector.rollbackEvidence().runtimeOutput, runtimeBefore);
    }
  }
}

if (require.main === module) {
  new (require("./domain_batches/stage_three_batch_012_historical_workspace").Batch012HistoricalWorkspace)()
    .run(path.resolve(__dirname, "../.."), root => new Batch012PlanningCheck().run(root))
    .catch(error => { console.error(error.stack); process.exitCode = 1; });
}

module.exports = { Batch012PlanningCheck };
