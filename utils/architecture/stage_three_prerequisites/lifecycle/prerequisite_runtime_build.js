"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const TOOLING_ROOT = path.resolve(__dirname, "../../../..");
const CONTRACT = "architecture/migration/stage_3_compatibility_runtime.json";
const STATE = "architecture/migration/stage_3_execution_state.json";
const INPUTS = Object.freeze(["src", "index.html", "package.json"]);

// Builds the single cumulative compatibility runtime for a proposed tree: the tree's sources with the
// transition's proposed files laid over them (in a temporary workspace, see HistoricalBuildWorkspace)
// and the proposed runtime contract, exactly as the live build composes it. It returns the generated
// output bytes (runtime and activation shims) without writing the project. A prerequisite transition
// derives its runtime writes from it; the build runs in a child process because the transition
// builder is synchronous and the bundler is not.
function buildPrerequisiteRuntime({ root, overlay }) {
  const request = path.join(fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "cyber-prerequisite-runtime-")), "request.json");
  try {
    fs.writeFileSync(request, JSON.stringify({ root: path.resolve(root),
      overlay: [...overlay].map(([file, bytes]) => [file, Buffer.from(bytes).toString("base64")]) }));
    const result = spawnSync(process.execPath, [__filename, request],
      { cwd: TOOLING_ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, shell: false });
    assert.equal(result.status, 0, `prerequisite runtime build failed: ${result.stderr}`);
    const { outputs, files } = JSON.parse(result.stdout);
    return { outputs, files: new Map(Object.entries(files).map(([file, base64]) => [file, Buffer.from(base64, "base64")])) };
  } finally {
    fs.rmSync(path.dirname(request), { recursive: true, force: true });
  }
}

async function build(request) {
  const { HistoricalBuildWorkspace } = require("../../domain_batches/stage_three_historical_build_workspace");
  const { StageThreeCandidateOutputManager } = require("../../domain_batches/stage_three_candidate_output_manager");
  const { CumulativeRuntimeBuildApplication } = require("../../../build/compat_runtime/cumulative_runtime_builder");
  const { StageThreeApprovedPlanSource } = require("../../domain_batches/stage_three_approved_plan_source");
  const { StageThreeRuntimeScriptAliasResolver } = require("../../migration/stage_three_runtime_script_alias_resolver");
  const { LegacyScriptOrderReader } = require("../../migration/legacy_script_order_reader");
  const overlay = new Map(request.overlay.map(([file, base64]) => [file, Buffer.from(base64, "base64")]));
  const read = file => (overlay.has(file) ? overlay.get(file) : fs.readFileSync(path.join(request.root, file)));
  const json = file => JSON.parse(read(file).toString("utf8"));
  const contract = json(CONTRACT);
  const state = json(STATE);
  assert.equal(state.activeBatchId, null, "a prerequisite runtime build needs no active batch");
  return new HistoricalBuildWorkspace().run(request.root, async workspace => {
    const manager = new StageThreeCandidateOutputManager(workspace, "prerequisite");
    try {
      const report = await new CumulativeRuntimeBuildApplication({ projectRoot: workspace, contract,
        approvedPlan: new StageThreeApprovedPlanSource({ read }).load(state).document, executionState: state,
        stageTwoApprovedPlan: json("architecture/migration/stage_2_approved_batches.json"),
        stageTwoExecutionState: json("architecture/migration/stage_2_execution_state.json"),
        outputManager: manager,
        scriptOrderProvider: () => new LegacyScriptOrderReader(null, {
          scriptAliases: new StageThreeRuntimeScriptAliasResolver().resolve(contract),
        }).parse(read("index.html").toString("utf8")),
      }).run();
      const files = {};
      for (const output of report.outputs) files[output.path] = fs.readFileSync(manager.candidatePath(output.path)).toString("base64");
      return { outputs: report.outputs.map(output => ({ path: output.path, sha256: output.sha256 })), files };
    } finally {
      manager.cleanup();
    }
  }, { inputs: INPUTS, overlay, modulesRoot: TOOLING_ROOT });
}

if (require.main === module) {
  build(JSON.parse(fs.readFileSync(process.argv[2], "utf8")))
    .then(value => process.stdout.write(JSON.stringify(value)))
    .catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
}

module.exports = { buildPrerequisiteRuntime };
