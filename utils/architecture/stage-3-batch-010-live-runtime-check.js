"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { Batch010LiveValidation } = require("./domain_batches/stage_three_batch_010_live_validation");

class Batch010LiveRuntimeCheck {
  async run(root = path.resolve(__dirname, "../..")) {
    const result = await new Batch010LiveValidation(root).run();
    assert.deepEqual(result.topology, { modules: 37, activations: 38, bridges: 64 });
    assert.equal(result.activation.activationTiming.length, 38);
    assert.equal(result.evaluation[0].moduleEvaluationCount, 1);
    assert.equal(result.postActivationTransportReads, 0);
    console.log("Stage 3.10.6 PASS: published runtime identity/timing, 37/38/64, state and allocation parity.");
    return result;
  }
}

if (require.main === module) {
  new (require("./domain_batches/stage_three_batch_010_historical_workspace").Batch010HistoricalWorkspace)()
    .run(path.resolve(__dirname, "../.."), root => new Batch010LiveRuntimeCheck().run(root),
      { keepCutover: true })
    .catch(error => { console.error(error.stack); process.exitCode = 1; });
}

module.exports = { Batch010LiveRuntimeCheck };
