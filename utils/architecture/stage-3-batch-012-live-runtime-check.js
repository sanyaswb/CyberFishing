"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { Batch012LiveValidation } = require("./domain_batches/stage_three_batch_012_live_validation");

class Batch012LiveRuntimeCheck {
  async run(root = path.resolve(__dirname, "../..")) {
    const artifact = await new Batch012LiveValidation(root).run();
    assert.deepEqual(artifact.topology, { modules: 44, activations: 45, bridges: 76 });
    assert.equal(artifact.outputValidation.behavior.length, 6);
    assert.equal(artifact.stateAndAllocationShapes.length, 2);
    assert.equal(artifact.postActivationTransportReads, 0);
    console.log("Stage 3.12.6 LIVE PASS: 44/45/76, two exact ESM classes, approved timing and behavior parity.");
    return artifact;
  }
}

if (require.main === module) {
  new (require("./domain_batches/stage_three_batch_012_historical_workspace").Batch012HistoricalWorkspace)()
    .run(path.resolve(__dirname, "../.."), root => new Batch012LiveRuntimeCheck().run(root), { keepCutover: true })
    .catch(error => { console.error(error.stack); process.exitCode = 1; });
}

module.exports = { Batch012LiveRuntimeCheck };
