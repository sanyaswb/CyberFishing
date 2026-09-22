"use strict";
const path = require("node:path");
const { Batch009ObservationApplication } = require("./domain_batches/stage_three_batch_009_observation_application");
new Batch009ObservationApplication(path.resolve(__dirname, "../..")).run()
  .then(result => console.log("Stage 3.9.7 persisted: " + result.artifact.totals.modules +
    " modules; four reconciled paths, two verified ESM targets; eligible for 3.9.8, not release closure."))
  .catch(error => { console.error(error.stack); process.exitCode = 1; });
