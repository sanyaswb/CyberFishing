"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

// Project inputs a historical cumulative-runtime build reads from its project root.
const INPUTS = Object.freeze(["src", "index.html", "package.json", "package-lock.json"]);
const PREFIX = "cyber-historical-build-";

// A temporary copy of a project's build inputs, laid out exactly like the project (so bundle paths
// relative to the root stay identical), with node_modules linked to the project's. A historical
// replay builds there instead of writing candidate output into the project (or the history base),
// which keeps the checks that replay it free of project writes. The copy is removed afterwards.
// Options (a prerequisite that rebuilds the runtime from a proposed tree): `inputs` names the copied
// inputs, `overlay` maps project-relative paths to the proposed bytes written over the copy, and
// `modulesRoot` is the project whose node_modules the build links (a replay copy has none of its own).
class HistoricalBuildWorkspace {
  async run(projectRoot, action, { inputs = INPUTS, overlay = new Map(), modulesRoot = projectRoot } = {}) {
    const source = path.resolve(projectRoot);
    const parent = fs.realpathSync(os.tmpdir());
    const workspace = fs.mkdtempSync(path.join(parent, PREFIX));
    try {
      for (const relative of inputs) this.#copy(source, workspace, relative);
      for (const [relative, bytes] of overlay) {
        const target = path.join(workspace, relative);
        assert.equal(path.relative(workspace, target).split(path.sep)[0] === "..", false, `overlay escapes the workspace: ${relative}`);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, bytes);
      }
      // The history base links node_modules itself; link the resolved directory.
      fs.symlinkSync(fs.realpathSync(path.join(path.resolve(modulesRoot), "node_modules")),
        path.join(workspace, "node_modules"), "junction");
      return await action(workspace);
    } finally {
      const junction = path.join(workspace, "node_modules");
      if (fs.existsSync(junction)) fs.unlinkSync(junction);
      const resolved = fs.realpathSync(workspace);
      assert.equal(path.dirname(resolved), parent, "historical build workspace escaped the temporary directory");
      assert(path.basename(resolved).startsWith(PREFIX), "unexpected historical build workspace");
      fs.rmSync(resolved, { recursive: true, force: true });
    }
  }

  #copy(source, workspace, relative) {
    const from = path.join(source, relative);
    const entry = fs.lstatSync(from);
    assert(!entry.isSymbolicLink(), `historical build copy refuses symlink: ${relative}`);
    if (entry.isDirectory()) {
      for (const child of fs.readdirSync(from)) this.#copy(source, workspace, `${relative}/${child}`);
      return;
    }
    const target = path.join(workspace, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(from, target);
  }
}

module.exports = { HistoricalBuildWorkspace };
