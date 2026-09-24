"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { Batch011SourceBuild } = require("./domain_batches/stage_three_batch_011_source_build");

class Batch011SourceBuildFixtures {
  async run(root = path.resolve(__dirname, "../..")) {
    const builder = new Batch011SourceBuild(root);
    const before = builder.snapshot();
    await assert.rejects(builder.candidate({ failure: "loader" }), /injected candidate loader failure/);
    assert.deepEqual(builder.snapshot(), before, "loader failure mutated live files");
    await assert.rejects(builder.candidate({ failure: "output" }), /injected candidate output rejection/);
    assert.deepEqual(builder.snapshot(), before, "output failure mutated live files");
    const candidate = await builder.candidate();
    assert.equal(candidate.validation.exactClassicConsumerRelationships, 10);
    assert.deepEqual(builder.snapshot(), before, "candidate build mutated live files");
    console.log("Stage 3.11.4 fixtures PASS: loader/output rejection preserves live bytes; candidate remains isolated.");
    return 2;
  }
}

if (require.main === module) {
  new (require("./domain_batches/stage_three_batch_011_historical_workspace").Batch011HistoricalWorkspace)()
    .run(path.resolve(__dirname, "../.."), root => new Batch011SourceBuildFixtures().run(root),
      { keepPrebuild: true })
    .catch(error => { console.error(error.stack); process.exitCode = 1; });
}

module.exports = { Batch011SourceBuildFixtures };
