"use strict";

const path = require("node:path");
const { Batch018Prebuild } = require("./domain_batches/stage_three_batch_018_prebuild");

try {
  const prebuild = new Batch018Prebuild(path.resolve(__dirname, "../.."));
  prebuild.open();
  prebuild.validateOpen();
  console.log("Stage 3.18.3 prebuild open: active batch 018, live 64/68/111 topology unchanged.");
} catch (error) { console.error(error.stack); process.exitCode = 1; }
