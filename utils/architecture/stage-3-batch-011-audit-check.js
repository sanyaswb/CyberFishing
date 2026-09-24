"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { StageThreeLivePreflight, serialize } = require("./domain_batches/stage_three_live_preflight");
const { BATCH_011_PREFLIGHT_PROFILE: PROFILE } = require("./domain_batches/stage_three_batch_011_preflight_profile");
const { RepositoryContentSnapshot } = require("./esm_infrastructure/repository_content_snapshot");

class Batch011AuditCheck {
  run(root = path.resolve(__dirname, "../..")) {
    const preflight = new StageThreeLivePreflight(root, PROFILE);
    const snapshot = new RepositoryContentSnapshot(root);
    const before = snapshot.capture();
    const outputBefore = preflight.projector.rollbackEvidence().runtimeOutput;
    try {
      const artifact = preflight.json(PROFILE.executionProfile.auditPath);
      preflight.verifyReplay(artifact);
      assert.deepEqual(preflight.bytes(PROFILE.executionProfile.auditPath), serialize(artifact),
        "audit serialization differs from deterministic output");
      console.log(`Stage 3.11.0 PASS: ${artifact.scope.targetCount} targets, ${artifact.compatibility.consumers.length} exact consumers, ${artifact.compatibility.activations.length} activations; topology ${artifact.runtimeBaseline.projectModuleCount}/${artifact.runtimeBaseline.activationCount}/${artifact.runtimeBaseline.bridgeCount} → ${artifact.plannedTopology.projectModuleCount}/${artifact.plannedTopology.activationCount}/${artifact.plannedTopology.bridgeRecordCount}; runtime unchanged.`);
      return artifact;
    } finally {
      snapshot.assertEqual(before, snapshot.capture());
      assert.deepEqual(preflight.projector.rollbackEvidence().runtimeOutput, outputBefore,
        "generated runtime bytes changed during preflight");
    }
  }
}

if (require.main === module) {
  new (require("./domain_batches/stage_three_batch_011_historical_workspace").Batch011HistoricalWorkspace)()
    .run(path.resolve(__dirname, "../.."), root => new Batch011AuditCheck().run(root))
    .catch(error => { console.error(error.stack); process.exitCode = 1; });
}

module.exports = { Batch011AuditCheck };
