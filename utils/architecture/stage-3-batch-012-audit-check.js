"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { StageThreeLivePreflight, serialize } = require("./domain_batches/stage_three_live_preflight");
const { BATCH_012_PREFLIGHT_PROFILE: PROFILE } =
  require("./domain_batches/stage_three_batch_012_preflight_profile");
const { RepositoryContentSnapshot } = require("./esm_infrastructure/repository_content_snapshot");

class Batch012AuditCheck {
  run(root = path.resolve(__dirname, "../..")) {
    const preflight = new StageThreeLivePreflight(root, PROFILE);
    const snapshot = new RepositoryContentSnapshot(root);
    const before = snapshot.capture();
    const outputBefore = preflight.projector.rollbackEvidence().runtimeOutput;
    try {
      const artifact = preflight.json(PROFILE.executionProfile.auditPath);
      preflight.verifyReplay(artifact);
      assert.deepEqual(preflight.bytes(PROFILE.executionProfile.auditPath), serialize(artifact));
      assert.equal(artifact.effects.reviewed.length, 2);
      assert.equal(artifact.effects.unsafe.length, 0);
      assert.equal(artifact.prerequisites.reviewed.length, 2);
      console.log("Stage 3.12.0 PASS: 2 exact sources/consumers/activations, reviewed effects, 44/45/76 planned; runtime unchanged.");
      return artifact;
    } finally {
      snapshot.assertEqual(before, snapshot.capture());
      assert.deepEqual(preflight.projector.rollbackEvidence().runtimeOutput, outputBefore);
    }
  }
}

if (require.main === module) {
  new (require("./domain_batches/stage_three_batch_012_historical_workspace").Batch012HistoricalWorkspace)()
    .run(path.resolve(__dirname, "../.."), root => new Batch012AuditCheck().run(root))
    .catch(error => { console.error(error.stack); process.exitCode = 1; });
}

module.exports = { Batch012AuditCheck };
