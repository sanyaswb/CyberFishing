"use strict";

const path = require("node:path");
const { Batch014Prebuild } = require("./domain_batches/stage_three_batch_014_prebuild");

try {
  const prebuild = new Batch014Prebuild(path.resolve(__dirname, "../.."));
  prebuild.open();
  prebuild.validateOpen();
  console.log("Stage 3.14.3 prebuild open: active batch 014, live 50/53/83 topology unchanged.");
} catch (error) { console.error(error.stack); process.exitCode = 1; }
