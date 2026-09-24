"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { Batch011ObservationApplication } = require("./domain_batches/stage_three_batch_011_observation_application");

class Batch011ObservationIntegrationCheck {
  async run(root = path.resolve(__dirname, "../..")) {
    const result = await new Batch011ObservationApplication(root).check();
    assert.equal(result.artifact.guards.failureCount, 0);
    assert.equal(result.artifact.metadataTransition.targets.length, 5);
    assert.deepEqual(result.artifact.topology, { modules: 42, activations: 43, bridges: 74 });
    console.log("Stage 3.11.7 PASS: live observations, Manifest, graph and guards reconciled.");
    return result;
  }
}

if (require.main === module) {
  new (require("./domain_batches/stage_three_batch_011_historical_workspace").Batch011HistoricalWorkspace)()
    .run(path.resolve(__dirname, "../.."), root => new Batch011ObservationIntegrationCheck().run(root), { keepCutover: true })
    .catch(error => { console.error(error.stack); process.exitCode = 1; });
}

module.exports = { Batch011ObservationIntegrationCheck };
