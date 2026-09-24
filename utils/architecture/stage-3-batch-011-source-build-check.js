"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { Batch011SourceBuild } = require("./domain_batches/stage_three_batch_011_source_build");
const { BATCH_011_PREFLIGHT_PROFILE: PROFILE } = require("./domain_batches/stage_three_batch_011_preflight_profile");

class Batch011SourceBuildCheck {
  async run(root = path.resolve(__dirname, "../..")) {
    const builder = new Batch011SourceBuild(root);
    const artifact = await builder.run();
    assert.equal(artifact.report.projectModules.length, 42);
    assert.equal(artifact.report.activationOutputs.length, 43);
    assert.equal(artifact.validation.behavior.length, 13);
    assert.equal(artifact.validation.exactClassicConsumerRelationships, 10);
    assert.equal(artifact.sources.length, PROFILE.executionProfile.expectedTargetCount);
    assert.equal(Object.values(artifact.evaluationProof.counts).filter(value => value !== 1).length, 0);
    console.log("Stage 3.11.4 PASS: 42-module/43-activation candidate, two-root byte equality, 13 parity cases, all evaluations once; live runtime unchanged.");
    return artifact;
  }
}

if (require.main === module) {
  new (require("./domain_batches/stage_three_batch_011_historical_workspace").Batch011HistoricalWorkspace)()
    .run(path.resolve(__dirname, "../.."), root => new Batch011SourceBuildCheck().run(root),
      { keepPrebuild: true })
    .catch(error => { console.error(error.stack); process.exitCode = 1; });
}

module.exports = { Batch011SourceBuildCheck };
