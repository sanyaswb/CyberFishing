"use strict";
const path = require("node:path");
const { Batch009SourceBuild } = require("./domain_batches/stage_three_batch_009_source_build");
const { RepositoryContentSnapshot } = require("./esm_infrastructure/repository_content_snapshot");
class Batch009SourceBuildCheck {
  async run(root = path.resolve(__dirname, "../..")) {
    const snapshot = new RepositoryContentSnapshot(root), before = snapshot.capture();
    try {
      const result = await new Batch009SourceBuild(root).run();
      console.log(`Stage 3.9.3–3.9.4 PASS: exact live prebuild state; ${result.report.moduleCount} candidate modules / ${result.report.activationCount} activations; two-root deterministic build; ${result.validation.behavior.length} parity cases; ${result.validation.fixedCatchOutputs.length} DI cases; all modules evaluated once. Live 34/35/60 unchanged.`);
      return result;
    } finally { snapshot.assertEqual(before, snapshot.capture()); }
  }
}
if (require.main === module) new (require("./domain_batches/stage_three_batch_009_historical_workspace").Batch009HistoricalWorkspace)()
  .run(path.resolve(__dirname,"../.."), root => new Batch009SourceBuildCheck().run(root)).catch(error => { console.error(error.stack); process.exitCode = 1; });
module.exports = { Batch009SourceBuildCheck };
