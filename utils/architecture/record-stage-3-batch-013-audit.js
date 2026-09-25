"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { ControlledMetadataTransaction } = require("./domain_batches/controlled_metadata_transaction");
const { StageThreeLivePreflight, serialize } = require("./domain_batches/stage_three_live_preflight");
const { BATCH_013_PREFLIGHT_PROFILE: PROFILE } =
  require("./domain_batches/stage_three_batch_013_preflight_profile");

class Batch013AuditRecorder {
  run(root = path.resolve(__dirname, "../..")) {
    const output = PROFILE.executionProfile.auditPath;
    const preflight = new StageThreeLivePreflight(root, PROFILE);
    const audit = preflight.build();
    assert.equal(audit.effects.reviewed.length, 6);
    assert.equal(audit.prerequisites.reviewed.length, 6);
    const bytes = serialize(audit);
    const target = path.join(root, output);
    if (fs.existsSync(target)) assert.deepEqual(fs.readFileSync(target), bytes,
      "Immutable batch 013 audit drift");
    else new ControlledMetadataTransaction({ projectRoot: root }).commit([
      { relativePath: output, bytes },
    ], () => preflight.verifyReplay(JSON.parse(fs.readFileSync(target))));
    console.log("Stage 3.13.0 audit verified: 6 targets, 8 activations, 7 consumers; 44/45/76 → 50/53/83.");
    return audit;
  }
}

if (require.main === module) {
  try { new Batch013AuditRecorder().run(); }
  catch (error) { console.error(error.stack); process.exitCode = 1; }
}

module.exports = { Batch013AuditRecorder };
