"use strict";

const path = require("node:path");
const { Batch012Prebuild } = require("./domain_batches/stage_three_batch_012_prebuild");

try {
  const prebuild = new Batch012Prebuild(path.resolve(__dirname, "../.."));
  prebuild.open();
  prebuild.validateOpen();
  console.log("Stage 3.12.3 prebuild open: active batch 012, live 42/43/74 topology unchanged.");
} catch (error) { console.error(error.stack); process.exitCode = 1; }
