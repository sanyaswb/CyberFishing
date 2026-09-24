"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { Batch012SourceBuild } = require("./domain_batches/stage_three_batch_012_source_build");
const { BATCH_012_PREFLIGHT_PROFILE: PROFILE } = require("./domain_batches/stage_three_batch_012_preflight_profile");

class Batch012SourceBuildCheck {
  async run(root = path.resolve(__dirname, "../..")) {
    const builder = new Batch012SourceBuild(root);
    const artifact = await builder.run();
    assert.equal(artifact.report.projectModules.length, 44);
    assert.equal(artifact.report.activationOutputs.length, 45);
    assert.equal(artifact.validation.behavior.length, 6);
    assert.equal(artifact.validation.exactClassicConsumerRelationships, 2);
    assert.equal(artifact.sources.length, PROFILE.executionProfile.expectedTargetCount);
    assert.equal(Object.values(artifact.evaluationProof.counts).filter(value => value !== 1).length, 0);
    console.log("Stage 3.12.4 PASS: 44-module/45-activation candidate, two-root byte equality, 6 parity cases, all evaluations once; live runtime unchanged.");
    return artifact;
  }
}

if (require.main === module) {
  new (require("./domain_batches/stage_three_batch_012_historical_workspace").Batch012HistoricalWorkspace)()
    .run(path.resolve(__dirname, "../.."), root => new Batch012SourceBuildCheck().run(root),
      { keepPrebuild: true })
    .catch(error => { console.error(error.stack); process.exitCode = 1; });
}

module.exports = { Batch012SourceBuildCheck };
