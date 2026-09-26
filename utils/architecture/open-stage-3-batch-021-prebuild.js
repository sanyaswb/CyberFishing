"use strict";

const path = require("node:path");
const { Batch021Prebuild } = require("./domain_batches/stage_three_batch_021_prebuild");

try {
  const prebuild = new Batch021Prebuild(path.resolve(__dirname, "../.."));
  prebuild.open();
  prebuild.validateOpen();
  console.log("Stage 3.21.3 prebuild open: active batch 021, live 76/81/135 topology unchanged.");
} catch (error) { console.error(error.stack); process.exitCode = 1; }
