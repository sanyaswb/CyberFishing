"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { Batch009ReleaseProjection } = require("./project-stage-3-batch-009-release");
const { Batch009ReleaseCheck } = require("./stage-3-batch-009-release-check");
const { ControlledMetadataTransaction } = require("./domain_batches/controlled_metadata_transaction");
const { canonicalBytes, fingerprint } = require("./domain_batches/stage_three_pending_target_manifest");
const { TRANSITION } = require("./domain_batches/stage_three_batch_009_release_transition");

class Batch009ReleasePublisher {
  run(root = path.resolve(__dirname, "../.."), { failureInjector = null } = {}) {
    const projected = new Batch009ReleaseProjection().run(root);
    const runtimeOutput = JSON.parse(fs.readFileSync(path.join(root,
      "architecture/migration/stage_3_compatibility_runtime.json")));
    const outputPaths = [runtimeOutput.output.directory + runtimeOutput.output.runtimeFile,
      ...runtimeOutput.activationPositions.map(item => runtimeOutput.output.directory + item.shimFile)];
    const protectedPaths = [
      "architecture/migration/module_migration_manifest.json",
      "architecture/guards/migration_bridge_registry.json",
      "architecture/migration/stage_3_compatibility_runtime.json",
      ...outputPaths,
      "src/game/domain/fish/fish_anomaly_variant_resolver.js",
      "src/game/domain/fish/fish_rarity_resolver.js",
    ];
    const protectedBefore = protectedPaths.map(file => ({ file,
      sha256: fingerprint(fs.readFileSync(path.join(root, file))) }));
    const writes = [...projected.writes.map(item => ({ relativePath: item.path, bytes: item.after })),
      { relativePath: TRANSITION, bytes: canonicalBytes(projected.transition) }];
    new ControlledMetadataTransaction({ projectRoot: root, failureInjector }).commit(writes, () => {
      new Batch009ReleaseCheck().run(root);
      for (const item of protectedBefore) assert.equal(
        fingerprint(fs.readFileSync(path.join(root, item.file))), item.sha256,
        `Release publication changed protected runtime/source: ${item.file}`);
      for (const item of writes) assert.deepEqual(fs.readFileSync(path.join(root, item.relativePath)), item.bytes);
    });
    console.log("Stage 3.9.9 release metadata published: v0.24.46, completed 001–009, active null; exact seven-file reversal and runtime byte-stability verified.");
  }
}

if (require.main === module) {
  try { new Batch009ReleasePublisher().run(); }
  catch (error) { console.error(error.stack); process.exitCode = 1; }
}
module.exports = { Batch009ReleasePublisher };
