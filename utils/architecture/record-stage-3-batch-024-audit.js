"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { ControlledMetadataTransaction } = require("./domain_batches/controlled_metadata_transaction");
const { StageThreeLivePreflight, serialize } = require("./domain_batches/stage_three_live_preflight");
const { BATCH_024_PREFLIGHT_PROFILE: PROFILE } =
  require("./domain_batches/stage_three_batch_024_preflight_profile");

class Batch024AuditRecorder {
  run(root = path.resolve(__dirname, "../..")) {
    const output = PROFILE.executionProfile.auditPath;
    const preflight = new StageThreeLivePreflight(root, PROFILE);
    const audit = preflight.build();
    assert.equal(audit.effects.reviewed.length, 1);
    assert.equal(audit.prerequisites.frozen.length, 0);
    assert.equal(audit.prerequisites.reviewed.length, 1);
    assert.equal(audit.closure.resolvedImports.length, 1);
    const bytes = serialize(audit);
    const target = path.join(root, output);
    if (fs.existsSync(target)) assert.deepEqual(fs.readFileSync(target), bytes,
      "Immutable batch 024 audit drift");
    else new ControlledMetadataTransaction({ projectRoot: root }).commit([
      { relativePath: output, bytes },
    ], () => preflight.verifyReplay(JSON.parse(fs.readFileSync(target))));
    console.log("Stage 3.25.0 audit verified: 1 target, 1 activation, 1 consumer, 1 reviewed exposure, 1 reviewed import; 82/92/142 → 83/93/142.");
    return audit;
  }
}

if (require.main === module) {
  try { new Batch024AuditRecorder().run(); }
  catch (error) { console.error(error.stack); process.exitCode = 1; }
}

module.exports = { Batch024AuditRecorder };
