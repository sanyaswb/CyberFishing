"use strict";

const path = require("node:path");
const { Batch015Prebuild } = require("./domain_batches/stage_three_batch_015_prebuild");

try {
  const prebuild = new Batch015Prebuild(path.resolve(__dirname, "../.."));
  prebuild.open();
  prebuild.validateOpen();
  console.log("Stage 3.15.3 prebuild open: active batch 015, live 56/59/89 topology unchanged.");
} catch (error) { console.error(error.stack); process.exitCode = 1; }
