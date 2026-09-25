"use strict";

const path = require("node:path");
const { Batch019Prebuild } = require("./domain_batches/stage_three_batch_019_prebuild");

try {
  const prebuild = new Batch019Prebuild(path.resolve(__dirname, "../.."));
  prebuild.open();
  prebuild.validateOpen();
  console.log("Stage 3.19.3 prebuild open: active batch 019, live 70/74/123 topology unchanged.");
} catch (error) { console.error(error.stack); process.exitCode = 1; }
