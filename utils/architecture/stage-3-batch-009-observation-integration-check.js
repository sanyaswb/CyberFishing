"use strict";
const assert = require("node:assert/strict");
const path = require("node:path");
const { Batch009ObservationApplication } = require("./domain_batches/stage_three_batch_009_observation_application");

async function run() {
  const app = new Batch009ObservationApplication(path.resolve(__dirname, "../.."));
  const before = app.protectedSnapshot();
  const first = await app.check(), second = await app.check();
  assert.deepEqual(first.artifact, second.artifact, "Live observation replay is not deterministic");
  assert.deepEqual(app.protectedSnapshot(), before, "Reconciliation check mutated protected files");
  console.log("Stage 3.9.7 PASS: " + first.artifact.totals.modules +
    " actual sources, four exact fact groups, two verified targets, exact forward/reverse consumers; " +
    first.artifact.guards.failureCount + " guard failures; runtime/lifecycle unchanged; no release approval.");
}
if (require.main === module) run().catch(error => { console.error(error.stack); process.exitCode = 1; });
module.exports = { run };
