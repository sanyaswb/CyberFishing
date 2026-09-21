"use strict";
const path = require("node:path");
const { Batch009Prebuild } = require("./domain_batches/stage_three_batch_009_prebuild");
const { Batch009SourceBuild } = require("./domain_batches/stage_three_batch_009_source_build");
async function main() {
  const root = path.resolve(__dirname, "../..");
  new Batch009Prebuild(root).open();
  const result = await new Batch009SourceBuild(root).run({ persist: true });
  console.log(`Stage 3.9.3–3.9.4: ${result.status}; candidate ${result.report.moduleCount}/${result.report.activationCount}; live unchanged.`);
}
if (require.main === module) main().catch(error => { console.error(error.stack); process.exitCode = 1; });
