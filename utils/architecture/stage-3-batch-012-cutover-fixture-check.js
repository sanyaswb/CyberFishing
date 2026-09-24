"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { Batch012CutoverProjection, Batch012AtomicCutover } =
  require("./domain_batches/stage_three_batch_012_cutover");
const { Batch012HistoricalWorkspace } =
  require("./domain_batches/stage_three_batch_012_historical_workspace");

class Batch012CutoverFixtures {
  async run(root = path.resolve(__dirname, "../..")) {
    return new Batch012HistoricalWorkspace().run(root, async temporary => {
      const prepared = await new Batch012CutoverProjection().prepare(temporary);
      const snapshot = () => new Map(prepared.writes.map(write => {
        const absolute = path.join(temporary, write.relativePath);
        return [write.relativePath, fs.existsSync(absolute) ? fs.readFileSync(absolute) : null];
      }));
      const before = snapshot();
      const assertRestored = () => {
        const after = snapshot();
        for (const [file, bytes] of before) assert.deepEqual(after.get(file), bytes,
          `Cutover rollback changed ${file}`);
      };
      const failures = [
        ["after-staging", 0], ["after-replacement", 1],
        ["after-replacement", 7], ["after-replacement", prepared.writes.length],
        ["after-final-validation", prepared.writes.length],
      ];
      for (const [phase, count] of failures) {
        assert.throws(() => new Batch012AtomicCutover(temporary).commit(prepared, {
          failureInjector: point => {
            if (point.phase === phase && point.count === count) throw new Error("injected batch 012 failure");
          },
        }), /injected batch 012 failure/);
        assertRestored();
      }
      console.log(`Stage 3.12.5 fixtures PASS: ${failures.length} atomic publication boundaries restore exact 011 prefix bytes.`);
      return failures.length;
    }, { keepPrebuild: true });
  }
}

if (require.main === module) {
  new Batch012CutoverFixtures().run()
    .catch(error => { console.error(error.stack); process.exitCode = 1; });
}

module.exports = { Batch012CutoverFixtures };
