"use strict";

const path = require("node:path");
const { Batch025Prebuild } = require("./domain_batches/stage_three_batch_025_prebuild");

try {
  const prebuild = new Batch025Prebuild(path.resolve(__dirname, "../.."));
  prebuild.open();
  prebuild.validateOpen();
  console.log("Stage 3.26.3 prebuild open: active batch 025, live 83/93/142 topology unchanged (planned 86/94/141).");
} catch (error) { console.error(error.stack); process.exitCode = 1; }
