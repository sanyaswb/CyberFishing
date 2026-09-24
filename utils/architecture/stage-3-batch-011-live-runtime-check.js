"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { Batch011LiveValidation } = require("./domain_batches/stage_three_batch_011_live_validation");

class Batch011LiveRuntimeCheck {
  async run(root = path.resolve(__dirname, "../..")) {
    const artifact = await new Batch011LiveValidation(root).run();
    assert.deepEqual(artifact.topology, { modules: 42, activations: 43, bridges: 74 });
    assert.equal(artifact.outputValidation.behavior.length, 13);
    assert.equal(artifact.stateAndAllocationShapes.length, 5);
    assert.equal(artifact.postActivationTransportReads, 0);
    console.log("Stage 3.11.6 LIVE PASS: 42/43/74, five exact ESM classes, approved timing and behavior parity.");
    return artifact;
  }
}

if (require.main === module) {
  new (require("./domain_batches/stage_three_batch_011_historical_workspace").Batch011HistoricalWorkspace)()
    .run(path.resolve(__dirname, "../.."), root => new Batch011LiveRuntimeCheck().run(root), { keepCutover: true })
    .catch(error => { console.error(error.stack); process.exitCode = 1; });
}

module.exports = { Batch011LiveRuntimeCheck };
