"use strict";

const path = require("node:path");
const { StageThreeBatch008ObservationApplication } = require("./domain_batches/stage_three_batch_008_observation_application");
const application = new StageThreeBatch008ObservationApplication(path.resolve(__dirname, "../.."));
const result = process.argv.includes("--check") ? application.check() : application.run();
console.log(`Stage 3.8.7 ${result.artifact.status}: ${result.artifact.metadataTransition.targets.length} verified ESM targets, ` +
  `${result.artifact.derivedIncomingConsumers.length} exact consumer relationships ` +
  `(${result.artifact.guardedConsumers.length} historically guarded), ${result.artifact.totals.edges} edges, ` +
  `${result.artifact.guards.failureCount} guard failures; ${result.artifact.verdict}. Release remains unchanged.`);
