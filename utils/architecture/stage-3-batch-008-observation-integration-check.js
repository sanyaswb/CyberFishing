"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { StageThreeBatch008ObservationApplication } = require("./domain_batches/stage_three_batch_008_observation_application");
function run() {
const application = new StageThreeBatch008ObservationApplication(path.resolve(__dirname, "../.."));
const before = application.protectedSnapshot();
const first = application.check();
const second = application.check();
assert.deepEqual(first.artifact, second.artifact, "Full live observation replay is not deterministic");
assert.deepEqual(application.protectedSnapshot(), before, "Observation integration mutated source/runtime/evidence");
console.log(`Stage 3.8.7 PASS: ${first.artifact.totals.modules} actual sources; six exact persisted fact groups, ` +
  "three verified targets, unchanged consumer/dependency sets and compatibility topology; " +
  `${first.artifact.guards.failureCount} guard failures; exact historical reversal; no release approval.`);
}
require("./domain_batches/stage_three_batch_009_historical_workspace").runHistoricalScript(path.resolve(__dirname,"../.."),
  "utils/architecture/stage-3-batch-008-observation-integration-check.js",run).catch(e=>{console.error(e.stack);process.exitCode=1;});
