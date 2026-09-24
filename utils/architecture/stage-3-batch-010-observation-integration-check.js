"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { Batch010ObservationApplication } = require("./domain_batches/stage_three_batch_010_observation_application");

class Batch010ObservationIntegrationCheck {
  async run(root = path.resolve(__dirname, "../..")) {
    const result = await new Batch010ObservationApplication(root).check();
    assert.equal(result.artifact.guards.failureCount, 0);
    assert.equal(result.artifact.metadataTransition.targets.length, 1);
    assert.deepEqual(result.artifact.topology, { modules: 37, activations: 38, bridges: 64 });
    console.log("Stage 3.10.7 PASS: live source observations, Manifest, graph and guards reconciled.");
    return result;
  }
}

if (require.main === module) {
  new (require("./domain_batches/stage_three_batch_010_historical_workspace").Batch010HistoricalWorkspace)()
    .run(path.resolve(__dirname, "../.."), root => new Batch010ObservationIntegrationCheck().run(root),
      { keepCutover: true })
    .catch(error => { console.error(error.stack); process.exitCode = 1; });
}

module.exports = { Batch010ObservationIntegrationCheck };
