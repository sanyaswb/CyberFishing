"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { Batch008CutoverHistory } = require("./domain_batches/stage_three_batch_008_cutover_history");
const { CumulativeRuntimeBuildApplication } = require("../build/compat_runtime/cumulative_runtime_builder");
const { StageThreeCandidateOutputManager } = require("./domain_batches/stage_three_candidate_output_manager");
const { StageThreeRuntimeScriptAliasResolver } = require("./migration/stage_three_runtime_script_alias_resolver");
const { LegacyScriptOrderReader } = require("./migration/legacy_script_order_reader");
const { fingerprint } = require("./domain_batches/stage_three_pending_target_manifest");

async function run(root) {
  const history = new Batch008CutoverHistory(root);
  const read = (name) => JSON.parse(history.before(`architecture/migration/${name}.json`));
  const contract = read("stage_3_compatibility_runtime");
  const state = read("stage_3_execution_state"); state.activeBatchId = null; delete state.activeBatchPhase;
  const manager = new StageThreeCandidateOutputManager(root, "008-historical");
  try {
    const report = await new CumulativeRuntimeBuildApplication({ projectRoot: root, contract,
      approvedPlan: read("stage_3_approved_batches"), executionState: state,
      stageTwoApprovedPlan: read("stage_2_approved_batches"), stageTwoExecutionState: read("stage_2_execution_state"),
      outputManager: manager, scriptOrderProvider: () => new LegacyScriptOrderReader(null, {
        scriptAliases: new StageThreeRuntimeScriptAliasResolver().resolve(contract),
      }).parse(history.before("index.html").toString("utf8")),
    }).run();
    const baseline = read("stage_3_batch_008_execution_plan").rollback.baselineEvidence.runtimeOutput.files;
    const files = {};
    for (const output of report.outputs) {
      const bytes = fs.readFileSync(manager.candidatePath(output.path));
      assert.equal(fingerprint(bytes), baseline.find((item) => item.path === output.path)?.sha256);
      files[output.path] = bytes.toString("base64");
    }
    assert.equal(Object.keys(files).length, baseline.length);
    return { report, files };
  } finally { manager.cleanup(); }
}
if (require.main === module) run(path.resolve(process.argv[2]))
  .then((value) => process.stdout.write(JSON.stringify(value)))
  .catch((error) => { console.error(error); process.exitCode = 1; });
module.exports = { run };
