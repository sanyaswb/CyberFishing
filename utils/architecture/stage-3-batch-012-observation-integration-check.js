"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { Batch012ObservationApplication } = require("./domain_batches/stage_three_batch_012_observation_application");

class Batch012ObservationIntegrationCheck {
  async run(root = path.resolve(__dirname, "../..")) {
    const result = await new Batch012ObservationApplication(root).check();
    assert.equal(result.artifact.guards.failureCount, 0);
    assert.equal(result.artifact.metadataTransition.targets.length, 2);
    assert.deepEqual(result.artifact.topology, { modules: 44, activations: 45, bridges: 76 });
    console.log("Stage 3.12.7 PASS: live observations, Manifest, graph and guards reconciled.");
    return result;
  }
}

if (require.main === module) {
  new (require("./domain_batches/stage_three_batch_012_historical_workspace").Batch012HistoricalWorkspace)()
    .run(path.resolve(__dirname, "../.."), root => new Batch012ObservationIntegrationCheck().run(root), { keepCutover: true })
    .catch(error => { console.error(error.stack); process.exitCode = 1; });
}

module.exports = { Batch012ObservationIntegrationCheck };
