"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { Batch009ReleaseProjection } = require("./project-stage-3-batch-009-release");
const { StageThreeBatch009ReleaseTransition } =
  require("./domain_batches/stage_three_batch_009_release_transition");

class Batch009ReleaseFixtureCheck {
  run(root = path.resolve(__dirname, "../..")) {
    const { transition, writes } = new Batch009ReleaseProjection().run(root);
    const validator = new StageThreeBatch009ReleaseTransition(root);
    assert.equal(writes.length, 7);
    assert.deepEqual(transition.records.map(item => item.path), writes.map(item => item.path));
    let negatives = 0;
    for (const record of transition.records) {
      const after = writes.find(item => item.path === record.path).after;
      assert.deepEqual(validator.reverse(after, record), fs.readFileSync(path.join(root, record.path)));
      assert.throws(() => validator.reverse(Buffer.concat([after, Buffer.from(" ")]), record));
      negatives++;
    }
    const mutation = structuredClone(transition);
    mutation.records[0].edits[0].count = 2;
    assert.throws(() => validator.reverse(writes[0].after, mutation.records[0])); negatives++;
    const missing = structuredClone(transition);
    missing.records.pop();
    assert.throws(() => validator.validate(missing)); negatives++;
    const staleAcceptance = structuredClone(transition);
    staleAcceptance.acceptance.sha256 = "0".repeat(64);
    assert.throws(() => validator.validate(staleAcceptance)); negatives++;
    const staleBrowser = structuredClone(transition);
    staleBrowser.browserProof.sha256 = "0".repeat(64);
    assert.throws(() => validator.validate(staleBrowser)); negatives++;
    const state = writes.find(item => item.path === "architecture/migration/stage_3_execution_state.json");
    const badState = JSON.parse(state.after);
    badState.activeBatchPhase = "runtime-active";
    assert.throws(() => validator.validateDelta(state.path,
      fs.readFileSync(path.join(root, state.path)), Buffer.from(JSON.stringify(badState)))); negatives++;
    const packageFile = writes.find(item => item.path === "package.json");
    const badPackage = JSON.parse(packageFile.after);
    badPackage.scripts["release:shortcut"] = "true";
    assert.throws(() => validator.validateDelta(packageFile.path,
      fs.readFileSync(path.join(root, packageFile.path)), Buffer.from(JSON.stringify(badPackage)))); negatives++;
    console.log(`Stage 3.9.9 release projection PASS: seven exact forward/reverse metadata deltas; ${negatives} invalid changes rejected; no files written.`);
  }
}

if (require.main === module) {
  const root = path.resolve(__dirname, "../..");
  new (require("./domain_batches/stage_three_batch_009_release_history").Batch009ReleaseHistoricalWorkspace)()
    .run(root, temporary => new Batch009ReleaseFixtureCheck().run(temporary))
    .catch(error => { console.error(error.stack); process.exitCode = 1; });
}
module.exports = { Batch009ReleaseFixtureCheck };
