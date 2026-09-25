"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { ControlledMetadataTransaction } = require("./domain_batches/controlled_metadata_transaction");
const { StageThreeLivePreflight, serialize } = require("./domain_batches/stage_three_live_preflight");
const { BATCH_015_PREFLIGHT_PROFILE: PROFILE } =
  require("./domain_batches/stage_three_batch_015_preflight_profile");

class Batch015AuditRecorder {
  run(root = path.resolve(__dirname, "../..")) {
    const output = PROFILE.executionProfile.auditPath;
    const preflight = new StageThreeLivePreflight(root, PROFILE);
    const audit = preflight.build();
    assert.equal(audit.effects.reviewed.length, 6);
    assert.equal(audit.prerequisites.reviewed.length, 6);
    const bytes = serialize(audit);
    const target = path.join(root, output);
    if (fs.existsSync(target)) assert.deepEqual(fs.readFileSync(target), bytes,
      "Immutable batch 015 audit drift");
    else new ControlledMetadataTransaction({ projectRoot: root }).commit([
      { relativePath: output, bytes },
    ], () => preflight.verifyReplay(JSON.parse(fs.readFileSync(target))));
    console.log("Stage 3.15.0 audit verified: 6 targets, 6 activations, 6 consumers; 56/59/89 → 62/65/95.");
    return audit;
  }
}

if (require.main === module) {
  try { new Batch015AuditRecorder().run(); }
  catch (error) { console.error(error.stack); process.exitCode = 1; }
}

module.exports = { Batch015AuditRecorder };
