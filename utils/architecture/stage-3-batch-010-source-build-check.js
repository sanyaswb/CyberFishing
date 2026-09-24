"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { Batch010SourceBuild } = require("./domain_batches/stage_three_batch_010_source_build");
const { Batch010HistoricalWorkspace } = require("./domain_batches/stage_three_batch_010_historical_workspace");

class Batch010SourceBuildCheck {
  async run(root = path.resolve(__dirname, "../..")) {
    const artifact = await new Batch010SourceBuild(root).run();
    assert.equal(artifact.report.moduleCount, 37);
    assert.equal(artifact.report.activationCount, 38);
    assert.equal(artifact.validation.behavior.length, 4);
    assert.equal(artifact.validation.exactClassicConsumerRelationships, 2);
    assert.equal(Object.keys(artifact.evaluationProof.counts).length, 37);
    assert(Object.values(artifact.evaluationProof.counts).every(count => count === 1));
    console.log("Stage 3.10.4 PASS: deterministic isolated candidate, 37 module evaluations once, 38 activations, exact consumers and behavior.");
    return artifact;
  }
}

if (require.main === module) {
  new Batch010HistoricalWorkspace().run(path.resolve(__dirname, "../.."),
    root => new Batch010SourceBuildCheck().run(root), { keepPrebuild: true })
    .catch(error => { console.error(error.stack); process.exitCode = 1; });
}

module.exports = { Batch010SourceBuildCheck };
