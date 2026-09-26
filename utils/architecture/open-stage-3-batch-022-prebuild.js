"use strict";

const path = require("node:path");
const { Batch022Prebuild } = require("./domain_batches/stage_three_batch_022_prebuild");

try {
  const prebuild = new Batch022Prebuild(path.resolve(__dirname, "../.."));
  prebuild.open();
  prebuild.validateOpen();
  console.log("Stage 3.23.3 prebuild open: active batch 022, Stage 3.22 prefix adopted, live 78/87/139 topology unchanged.");
} catch (error) { console.error(error.stack); process.exitCode = 1; }
