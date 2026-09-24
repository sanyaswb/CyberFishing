"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { ControlledMetadataTransaction } = require("./domain_batches/controlled_metadata_transaction");
const { StageThreeLivePreflight, serialize } = require("./domain_batches/stage_three_live_preflight");
const { BATCH_012_PREFLIGHT_PROFILE: PROFILE } =
  require("./domain_batches/stage_three_batch_012_preflight_profile");

class Batch012AuditRecorder {
  run(root = path.resolve(__dirname, "../..")) {
    const output = PROFILE.executionProfile.auditPath;
    assert(!fs.existsSync(path.join(root, output)), "Batch 012 audit is immutable");
    const preflight = new StageThreeLivePreflight(root, PROFILE);
    const before = preflight.projector.rollbackEvidence().runtimeOutput;
    const audit = preflight.build();
    assert.deepEqual(audit.plannedTopology,
      { projectModuleCount: 44, activationCount: 45, bridgeRecordCount: 76 });
    assert.deepEqual(audit.effects.reviewed,
      PROFILE.executionProfile.expectedTargets.map(target => target.currentPath));
    assert.equal(audit.prerequisites.reviewed.length, 2);
    assert.deepEqual(preflight.projector.rollbackEvidence().runtimeOutput, before);
    const bytes = serialize(audit);
    new ControlledMetadataTransaction({ projectRoot: root }).commit([
      { relativePath: output, bytes },
    ], () => assert.deepEqual(fs.readFileSync(path.join(root, output)), bytes));
    console.log("Stage 3.12.0 audit recorded: 2 targets, 2 exact consumers, reviewed class exposures, 42/43/74 → 44/45/76; runtime untouched.");
    return audit;
  }
}

if (require.main === module) {
  try { new Batch012AuditRecorder().run(); }
  catch (error) { console.error(error.stack); process.exitCode = 1; }
}

module.exports = { Batch012AuditRecorder };
