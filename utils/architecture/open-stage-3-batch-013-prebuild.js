"use strict";

const path = require("node:path");
const { Batch013Prebuild } = require("./domain_batches/stage_three_batch_013_prebuild");

try {
  const prebuild = new Batch013Prebuild(path.resolve(__dirname, "../.."));
  prebuild.open();
  prebuild.validateOpen();
  console.log("Stage 3.13.3 prebuild open: active batch 013, live 44/45/76 topology unchanged.");
} catch (error) { console.error(error.stack); process.exitCode = 1; }
