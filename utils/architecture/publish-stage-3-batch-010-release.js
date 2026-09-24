"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { Batch010ReleaseProjection } = require("./project-stage-3-batch-010-release");
const { Batch010ReleaseCheck } = require("./stage-3-batch-010-release-check");
const { ControlledMetadataTransaction } = require("./domain_batches/controlled_metadata_transaction");
const { TRANSITION } = require("./domain_batches/stage_three_batch_010_release_transition");
const { sha, serialize } = require("./domain_batches/stage_three_batch_010_planning");

class Batch010ReleasePublisher {
  run(root = path.resolve(__dirname, "../.."), { failureInjector = null } = {}) {
    const projected = new Batch010ReleaseProjection().run(root);
    const runtime = JSON.parse(fs.readFileSync(path.join(root,
      "architecture/migration/stage_3_compatibility_runtime.json")));
    const outputPaths = [runtime.output.directory + runtime.output.runtimeFile,
      ...runtime.activationPositions.map(item => runtime.output.directory + item.shimFile)];
    const protectedPaths = [
      "architecture/migration/module_migration_manifest.json",
      "architecture/guards/migration_bridge_registry.json",
      "architecture/migration/stage_3_compatibility_runtime.json",
      ...outputPaths,
      "src/game/domain/inventory/unlimited_assembly_capacity_policy.js",
    ];
    const protectedBefore = protectedPaths.map(file => ({ file,
      sha256: sha(fs.readFileSync(path.join(root, file))) }));
    const writes = [
      ...projected.writes.map(item => ({ relativePath: item.path, bytes: item.after })),
      { relativePath: TRANSITION, bytes: serialize(projected.transition) },
    ];
    new ControlledMetadataTransaction({ projectRoot: root, failureInjector }).commit(writes, () => {
      new Batch010ReleaseCheck().run(root);
      for (const item of protectedBefore) {
        assert.equal(sha(fs.readFileSync(path.join(root, item.file))), item.sha256,
          `Release publication changed protected runtime/source: ${item.file}`);
      }
      for (const item of writes) {
        assert.deepEqual(fs.readFileSync(path.join(root, item.relativePath)), item.bytes);
      }
    });
    console.log("Stage 3.10.9 release metadata published: v0.24.47, completed 001–010, active null; exact seven-file reversal and runtime byte-stability verified.");
  }
}

if (require.main === module) {
  try { new Batch010ReleasePublisher().run(); }
  catch (error) { console.error(error.stack); process.exitCode = 1; }
}

module.exports = { Batch010ReleasePublisher };
