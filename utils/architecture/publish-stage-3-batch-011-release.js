"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { Batch011ReleaseProjection } = require("./project-stage-3-batch-011-release");
const { Batch011ReleaseCheck } = require("./stage-3-batch-011-release-check");
const { ControlledMetadataTransaction } = require("./domain_batches/controlled_metadata_transaction");
const { TRANSITION } = require("./domain_batches/stage_three_batch_011_release_transition");
const { sha, serialize } = require("./domain_batches/stage_three_batch_011_planning");

class Batch011ReleasePublisher {
  run(root = path.resolve(__dirname, "../.."), { failureInjector = null } = {}) {
    const projected = new Batch011ReleaseProjection().run(root);
    const runtime = JSON.parse(fs.readFileSync(path.join(root,
      "architecture/migration/stage_3_compatibility_runtime.json")));
    const outputPaths = [runtime.output.directory + runtime.output.runtimeFile,
      ...runtime.activationPositions.map(item => runtime.output.directory + item.shimFile)];
    const protectedPaths = [
      "architecture/migration/module_migration_manifest.json",
      "architecture/guards/migration_bridge_registry.json",
      "architecture/migration/stage_3_compatibility_runtime.json",
      ...outputPaths,
      "src/game/domain/items/progression/item_metric_strategy.js",
      "src/game/domain/items/progression/item_progression_descriptor.js",
      "src/game/domain/items/rarity/item_rarity_descriptor.js",
      "src/game/domain/items/rarity/item_rarity_strategy.js",
      "src/game/domain/items/rarity/item_rarity_strategy_registry.js",
    ];
    const protectedBefore = protectedPaths.map(file => ({ file,
      sha256: sha(fs.readFileSync(path.join(root, file))) }));
    const writes = [
      ...projected.writes.map(item => ({ relativePath: item.path, bytes: item.after })),
      { relativePath: TRANSITION, bytes: serialize(projected.transition) },
    ];
    new ControlledMetadataTransaction({ projectRoot: root, failureInjector }).commit(writes, () => {
      new Batch011ReleaseCheck().run(root);
      for (const item of protectedBefore) {
        assert.equal(sha(fs.readFileSync(path.join(root, item.file))), item.sha256,
          `Release changed runtime/source: ${item.file}`);
      }
      for (const item of writes) {
        assert.deepEqual(fs.readFileSync(path.join(root, item.relativePath)), item.bytes);
      }
    });
    console.log("Stage 3.11.9 release published: v0.24.48, completed 001–011, active null; exact metadata reversal and runtime stability verified.");
  }
}

if (require.main === module) {
  try { new Batch011ReleasePublisher().run(); }
  catch (error) { console.error(error.stack); process.exitCode = 1; }
}

module.exports = { Batch011ReleasePublisher };
