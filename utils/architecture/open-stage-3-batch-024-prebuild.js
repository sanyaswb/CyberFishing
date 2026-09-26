"use strict";

const path = require("node:path");
const { Batch024Prebuild } = require("./domain_batches/stage_three_batch_024_prebuild");

try {
  const prebuild = new Batch024Prebuild(path.resolve(__dirname, "../.."));
  prebuild.open();
  prebuild.validateOpen();
  console.log("Stage 3.25.3 prebuild open: active batch 024, live 82/92/142 topology unchanged.");
} catch (error) { console.error(error.stack); process.exitCode = 1; }
