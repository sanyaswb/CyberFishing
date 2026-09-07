"use strict";

const path = require("node:path");
const { StageThreeBatch008SourceBuild } = require("./domain_batches/stage_three_batch_008_source_build");

if (require.main === module) new StageThreeBatch008SourceBuild(path.resolve(__dirname, "../..")).run()
  .then((artifact) => console.log(`Stage 3.8.4 verified: ${artifact.sources.length} exact ESM targets; ` +
    `${artifact.candidateBuild.moduleCount} candidate modules / ${artifact.candidateBuild.activationCount} activations; ` +
    "36 classic-to-bundle behavior cases; live runtime preserved."))
  .catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
