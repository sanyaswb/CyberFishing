"use strict";

const path = require("node:path");
const { Batch017Prebuild } = require("./domain_batches/stage_three_batch_017_prebuild");

try {
  const prebuild = new Batch017Prebuild(path.resolve(__dirname, "../.."));
  prebuild.open();
  prebuild.validateOpen();
  console.log("Stage 3.17.3 prebuild open: active batch 017, live 63/66/96 topology unchanged.");
} catch (error) { console.error(error.stack); process.exitCode = 1; }
