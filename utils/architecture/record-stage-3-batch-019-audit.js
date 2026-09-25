"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { ControlledMetadataTransaction } = require("./domain_batches/controlled_metadata_transaction");
const { StageThreeLivePreflight, serialize } = require("./domain_batches/stage_three_live_preflight");
const { BATCH_019_PREFLIGHT_PROFILE: PROFILE } =
  require("./domain_batches/stage_three_batch_019_preflight_profile");

class Batch019AuditRecorder {
  run(root = path.resolve(__dirname, "../..")) {
    const output = PROFILE.executionProfile.auditPath;
    const preflight = new StageThreeLivePreflight(root, PROFILE);
    const audit = preflight.build();
    assert.equal(audit.effects.reviewed.length, 3);
    assert.equal(audit.prerequisites.reviewed.length, 3);
    const bytes = serialize(audit);
    const target = path.join(root, output);
    if (fs.existsSync(target)) assert.deepEqual(fs.readFileSync(target), bytes,
      "Immutable batch 019 audit drift");
    else new ControlledMetadataTransaction({ projectRoot: root }).commit([
      { relativePath: output, bytes },
    ], () => preflight.verifyReplay(JSON.parse(fs.readFileSync(target))));
    console.log("Stage 3.19.0 audit verified: 3 targets, 3 activations, 7 consumers; 70/74/123 → 73/77/130.");
    return audit;
  }
}

if (require.main === module) {
  try { new Batch019AuditRecorder().run(); }
  catch (error) { console.error(error.stack); process.exitCode = 1; }
}

module.exports = { Batch019AuditRecorder };
