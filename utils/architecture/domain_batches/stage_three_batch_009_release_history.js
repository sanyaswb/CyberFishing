"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { Batch009CandidateWorkspace } = require("./stage_three_batch_009_candidate_workspace");
const { StageThreeBatch009ReleaseTransition, TRANSITION, BATCH } =
  require("./stage_three_batch_009_release_transition");

// Only historical checks use this isolated pre-release view. Active architecture
// guards and source observations always inspect the real checkout.
class Batch009ReleaseHistoricalWorkspace {
  isCompleted(root) {
    if (!fs.existsSync(path.join(root, TRANSITION))) return false;
    const state = JSON.parse(fs.readFileSync(path.join(root, "architecture/migration/stage_3_execution_state.json")));
    return state.activeBatchId === null && state.completedBatchIds[8] === BATCH &&
      state.releaseVersion === "0.24.46";
  }

  async run(root, action, { copyTools = false } = {}) {
    root = path.resolve(root);
    if (fs.existsSync(path.join(root, "architecture/migration/stage_3_batch_010_prebuild_contract.json"))) {
      return new (require("./stage_three_batch_010_historical_workspace").Batch010HistoricalWorkspace)()
        .run(root, temporary => this.run(temporary, action, { copyTools }), { copyTools });
    }
    if (!this.isCompleted(root)) return action(root);
    const release = new StageThreeBatch009ReleaseTransition(root);
    const transition = release.validate(JSON.parse(release.read(TRANSITION)));
    const workspace = new Batch009CandidateWorkspace();
    try {
      const copy = relative => {
        for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
          assert(!entry.isSymbolicLink(), `Historical source contains symlink: ${relative}/${entry.name}`);
          const file = `${relative}/${entry.name}`;
          if (entry.isDirectory()) copy(file);
          else workspace.write(file, fs.readFileSync(path.join(root, file)));
        }
      };
      for (const directory of ["src", "architecture", "dist/stage-3-compat-runtime", ...(copyTools ? ["utils"] : [])]) copy(directory);
      for (const file of ["index.html", "package.json", "package-lock.json", "CHANGELOG.md", "refactor_Task.txt"]) {
        workspace.write(file, fs.readFileSync(path.join(root, file)));
      }
      for (const record of transition.records) workspace.write(record.path, release.reverse(release.read(record.path), record));
      fs.unlinkSync(path.join(workspace.root, TRANSITION));
      if (copyTools) fs.symlinkSync(path.join(root, "node_modules"), path.join(workspace.root, "node_modules"), "junction");
      return await action(workspace.root);
    } finally {
      const junction = path.join(workspace.root, "node_modules");
      if (fs.existsSync(junction)) fs.unlinkSync(junction);
      workspace.cleanup();
    }
  }
}

async function runPreReleaseScript(root, relative, action) {
  if (fs.existsSync(path.join(root, "architecture/migration/stage_3_batch_010_prebuild_contract.json"))) {
    return new (require("./stage_three_batch_010_historical_workspace").Batch010HistoricalWorkspace)()
      .run(root, temporary => runPreReleaseScript(temporary, relative, action), { copyTools: true });
  }
  const history = new Batch009ReleaseHistoricalWorkspace();
  if (!history.isCompleted(root)) return action();
  console.log(`Historical pre-release replay in isolated workspace: ${relative}`);
  return history.run(root, temporary => {
    const result = spawnSync(process.execPath, [path.join(temporary, relative), ...process.argv.slice(2)],
      { cwd: temporary, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
    if (result.stdout) process.stdout.write(result.stdout);
    assert.equal(result.status, 0, result.stderr || result.error?.message || "Historical check failed");
  }, { copyTools: true });
}

module.exports = { Batch009ReleaseHistoricalWorkspace, runPreReleaseScript };
