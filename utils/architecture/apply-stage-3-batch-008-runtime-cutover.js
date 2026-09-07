"use strict";
const path = require("node:path");
const { StageThreeBatch008AtomicCutover } = require("./domain_batches/stage_three_batch_008_cutover");
new StageThreeBatch008AtomicCutover(path.resolve(__dirname, "../..")).run()
  .then((artifact) => console.log(`Stage 3.8.5: ${JSON.stringify(artifact.topology.counts)}; runtime-active; release unchanged.`))
  .catch((error) => { console.error(error); process.exitCode = 1; });
