"use strict";

const path = require("node:path");
const { Batch020Prebuild } = require("./domain_batches/stage_three_batch_020_prebuild");

try {
  const prebuild = new Batch020Prebuild(path.resolve(__dirname, "../.."));
  prebuild.open();
  prebuild.validateOpen();
  console.log("Stage 3.20.3 prebuild open: active batch 020, live 73/77/130 topology unchanged.");
} catch (error) { console.error(error.stack); process.exitCode = 1; }
