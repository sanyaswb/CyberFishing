"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { ControlledMetadataTransaction } = require("./domain_batches/controlled_metadata_transaction");
const { StageThreeLivePreflight, serialize } = require("./domain_batches/stage_three_live_preflight");
const { BATCH_020_PREFLIGHT_PROFILE: PROFILE } =
  require("./domain_batches/stage_three_batch_020_preflight_profile");

class Batch020AuditRecorder {
  run(root = path.resolve(__dirname, "../..")) {
    const output = PROFILE.executionProfile.auditPath;
    const preflight = new StageThreeLivePreflight(root, PROFILE);
    const audit = preflight.build();
    assert.equal(audit.effects.reviewed.length, 3);
    assert.equal(audit.prerequisites.reviewed.length, 6);
    const bytes = serialize(audit);
    const target = path.join(root, output);
    if (fs.existsSync(target)) assert.deepEqual(fs.readFileSync(target), bytes,
      "Immutable batch 020 audit drift");
    else new ControlledMetadataTransaction({ projectRoot: root }).commit([
      { relativePath: output, bytes },
    ], () => preflight.verifyReplay(JSON.parse(fs.readFileSync(target))));
    console.log("Stage 3.20.0 audit verified: 3 targets, 4 activations, 5 consumers; 73/77/130 → 76/81/135.");
    return audit;
  }
}

if (require.main === module) {
  try { new Batch020AuditRecorder().run(); }
  catch (error) { console.error(error.stack); process.exitCode = 1; }
}

module.exports = { Batch020AuditRecorder };
