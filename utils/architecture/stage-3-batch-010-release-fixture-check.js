"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { Batch010ReleaseProjection } = require("./project-stage-3-batch-010-release");
const { Batch010ReleaseTransition, TRANSITION } =
  require("./domain_batches/stage_three_batch_010_release_transition");
const { Batch010CandidateWorkspace } = require("./domain_batches/stage_three_batch_010_candidate_workspace");
const { Batch010HistoricalWorkspace } = require("./domain_batches/stage_three_batch_010_historical_workspace");
const { ControlledMetadataTransaction } = require("./domain_batches/controlled_metadata_transaction");
const { serialize } = require("./domain_batches/stage_three_batch_010_planning");

class Batch010ReleaseFixtures {
  run(root = path.resolve(__dirname, "../..")) {
    const projection = new Batch010ReleaseProjection().run(root);
    const validator = new Batch010ReleaseTransition(root);
    let negatives = 0;
    for (const mutate of [
      record => { record.fromRelease = "0.24.45"; },
      record => { record.toRelease = "0.24.48"; },
      record => { record.browserProof.sha256 = "0".repeat(64); },
      record => { record.records.pop(); },
      record => { record.records[0].afterSha256 = "0".repeat(64); },
    ]) {
      const changed = structuredClone(projection.transition);
      mutate(changed);
      assert.throws(() => {
        validator.validate(changed);
        for (const item of changed.records) {
          const projected = projection.writes.find(write => write.path === item.path);
          validator.reverse(projected.after, item);
        }
      });
      negatives++;
    }
    const writes = [
      ...projection.writes.map(item => ({ relativePath: item.path, bytes: item.after })),
      { relativePath: TRANSITION, bytes: serialize(projection.transition) },
    ];
    for (const [phase, count] of [["after-staging", 0], ["after-replacement", 1],
      ["after-replacement", 4], ["after-final-validation", writes.length]]) {
      const workspace = new Batch010CandidateWorkspace();
      try {
        const originals = new Map();
        for (const write of writes) {
          const source = path.join(root, write.relativePath);
          const before = fs.existsSync(source) ? fs.readFileSync(source) : null;
          originals.set(write.relativePath, before);
          if (before) workspace.write(write.relativePath, before);
          else fs.mkdirSync(path.dirname(path.join(workspace.root, write.relativePath)), { recursive: true });
        }
        let injected = false;
        assert.throws(() => new ControlledMetadataTransaction({
          projectRoot: workspace.root,
          failureInjector: event => {
            if (event.phase === phase && event.count === count) {
              injected = true;
              throw new Error("injected release publication failure");
            }
          },
        }).commit(writes, () => {}), /injected release publication failure/u);
        assert(injected);
        for (const [file, before] of originals) {
          const target = path.join(workspace.root, file);
          if (before === null) assert(!fs.existsSync(target));
          else assert.deepEqual(fs.readFileSync(target), before);
        }
        negatives++;
      } finally { workspace.cleanup(); }
    }
    console.log(`Stage 3.10.9 release fixtures PASS: ${negatives} invalid evidence and transaction boundaries rejected.`);
    return { negatives };
  }
}

if (require.main === module) {
  new Batch010HistoricalWorkspace().run(path.resolve(__dirname, "../.."),
    root => new Batch010ReleaseFixtures().run(root), { keepCutover: true })
    .catch(error => { console.error(error.stack); process.exitCode = 1; });
}

module.exports = { Batch010ReleaseFixtures };
