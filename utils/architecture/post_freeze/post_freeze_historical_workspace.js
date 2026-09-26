"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { PostFreezeReleaseTransition } = require("./post_freeze_release_transition");
const { DIRECTORY } = require("./post_freeze_paths");

const PREFIX = "cyber-stage322-historical-";
const BATCH_022_PREBUILD = "architecture/migration/stage_3_batch_022_prebuild_contract.json";

// Historical replay link after the v0.24.59 release: an isolated copy with the audit-only release
// reversed and the Stage 3.22 artifacts removed is exactly the batch-021 release checkpoint, so
// released batch checks replay there while cumulative guards keep running against the live
// workspace. Later batches are peeled first by their own historical workspaces.
class PostFreezeHistoricalWorkspace {
  async run(root, action, { copyTools = false } = {}) {
    const projectRoot = path.resolve(root);
    if (fs.existsSync(path.join(projectRoot, BATCH_022_PREBUILD))) {
      const { Batch022HistoricalWorkspace } = require("../domain_batches/stage_three_batch_022_historical_workspace");
      return new Batch022HistoricalWorkspace().run(projectRoot, prior => this.run(prior, action, { copyTools }),
        { copyTools });
    }
    if (!new PostFreezeReleaseTransition(projectRoot).exists()) return action(projectRoot);
    const parent = fs.realpathSync(os.tmpdir());
    const temporary = fs.mkdtempSync(path.join(parent, PREFIX));
    const copy = relative => {
      for (const entry of fs.readdirSync(path.join(projectRoot, relative), { withFileTypes: true })) {
        assert(!entry.isSymbolicLink(), `historical copy refuses symlink: ${relative}/${entry.name}`);
        const child = `${relative}/${entry.name}`;
        if (entry.isDirectory()) copy(child);
        else {
          const target = path.join(temporary, child);
          fs.mkdirSync(path.dirname(target), { recursive: true });
          fs.copyFileSync(path.join(projectRoot, child), target);
        }
      }
    };
    try {
      for (const directory of ["src", "architecture", "dist/stage-3-compat-runtime",
        ...(copyTools ? ["utils"] : [])]) copy(directory);
      for (const file of ["index.html", "package.json", "package-lock.json", "CHANGELOG.md", "refactor_Task.txt"]) {
        fs.copyFileSync(path.join(projectRoot, file), path.join(temporary, file));
      }
      if (copyTools) fs.symlinkSync(path.join(projectRoot, "node_modules"),
        path.join(temporary, "node_modules"), "junction");
      const transition = new PostFreezeReleaseTransition(temporary);
      for (const record of transition.artifact().records) {
        const target = path.join(temporary, record.path);
        fs.writeFileSync(target, transition.reverse(fs.readFileSync(target), record));
      }
      fs.rmSync(path.join(temporary, DIRECTORY), { recursive: true, force: true });
      return await action(temporary);
    } finally {
      const junction = path.join(temporary, "node_modules");
      if (fs.existsSync(junction)) fs.unlinkSync(junction);
      const resolved = fs.realpathSync(temporary);
      assert.equal(path.dirname(resolved), parent);
      assert(path.basename(resolved).startsWith(PREFIX));
      fs.rmSync(resolved, { recursive: true, force: true });
    }
  }
}

module.exports = { PostFreezeHistoricalWorkspace };
