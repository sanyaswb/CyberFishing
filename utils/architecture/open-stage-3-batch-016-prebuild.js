"use strict";

const path = require("node:path");
const { Batch016Prebuild } = require("./domain_batches/stage_three_batch_016_prebuild");

try {
  const prebuild = new Batch016Prebuild(path.resolve(__dirname, "../.."));
  prebuild.open();
  prebuild.validateOpen();
  console.log("Stage 3.16.3 prebuild open: active batch 016, live 62/65/95 topology unchanged.");
} catch (error) { console.error(error.stack); process.exitCode = 1; }
