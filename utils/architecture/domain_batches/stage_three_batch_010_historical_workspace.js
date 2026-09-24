"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { PREBUILD } = require("./stage_three_batch_010_prebuild");

const STATE = "architecture/migration/stage_3_execution_state.json";
const CUTOVER = "architecture/migration/stage_3_batch_010_runtime_cutover.json";
const OBSERVATION = "architecture/migration/stage_3_batch_010_observation_reconciliation.json";
const MANIFEST = "architecture/migration/module_migration_manifest.json";
const RELEASE = "architecture/migration/stage_3_batch_010_release_transition.json";
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex");

class Batch010HistoricalWorkspace {
  async run(root, action, { keepPrebuild = false, keepCutover = false, copyTools = false } = {}) {
    const projectRoot = path.resolve(root);
    if (fs.existsSync(path.join(projectRoot,
      "architecture/migration/stage_3_batch_011_prebuild_contract.json"))) {
      return new (require("./stage_three_batch_011_historical_workspace").Batch011HistoricalWorkspace)()
        .run(projectRoot, temporary => this.run(temporary, action,
          { keepPrebuild, keepCutover, copyTools }), { copyTools });
    }
    if (!fs.existsSync(path.join(projectRoot, PREBUILD))) return action(projectRoot);
    const parent = fs.realpathSync(os.tmpdir());
    const temporary = fs.mkdtempSync(path.join(parent, "cyber-batch010-historical-"));
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
      const releasePath = path.join(temporary, RELEASE);
      if (fs.existsSync(releasePath)) {
        const transition = new (require("./stage_three_batch_010_release_transition").Batch010ReleaseTransition)(temporary);
        const artifact = transition.validate(JSON.parse(fs.readFileSync(releasePath)));
        for (const record of artifact.records) {
          const target = path.join(temporary, record.path);
          fs.writeFileSync(target, transition.reverse(fs.readFileSync(target), record));
        }
        fs.unlinkSync(releasePath);
      }
      if (keepCutover) return await action(temporary);
      const observationPath = path.join(temporary, OBSERVATION);
      if (fs.existsSync(observationPath)) {
        const manifest = path.join(temporary, MANIFEST);
        const prior = require("./stage_three_batch_010_observation_transition")
          .beforeBatch010Observations(fs.readFileSync(manifest), temporary);
        assert.notDeepEqual(prior, fs.readFileSync(manifest), "Observation transition did not reverse");
        fs.writeFileSync(manifest, prior);
        fs.unlinkSync(observationPath);
      }
      const cutoverPath = path.join(temporary, CUTOVER);
      if (fs.existsSync(cutoverPath)) {
        const cutover = JSON.parse(fs.readFileSync(cutoverPath));
        for (const record of cutover.writes) {
          const target = path.join(temporary, record.path);
          const current = fs.existsSync(target) ? fs.readFileSync(target) : null;
          assert.equal(current && sha(current), record.afterSha256, `batch 010 cutover drift: ${record.path}`);
          if (record.beforeBase64 === null) fs.unlinkSync(target);
          else fs.writeFileSync(target, Buffer.from(record.beforeBase64, "base64"));
        }
        fs.unlinkSync(cutoverPath);
      }
      if (keepPrebuild) {
        const prebuild = JSON.parse(fs.readFileSync(path.join(temporary, PREBUILD)));
        const expected = Buffer.from(prebuild.stateTransition.afterBase64, "base64");
        assert.deepEqual(fs.readFileSync(path.join(temporary, STATE)), expected);
        return await action(temporary);
      }
      const prebuild = JSON.parse(fs.readFileSync(path.join(temporary, PREBUILD)));
      const transition = prebuild.stateTransition;
      const before = Buffer.from(transition.beforeBase64, "base64");
      const after = Buffer.from(transition.afterBase64, "base64");
      assert.equal(sha(before), transition.beforeSha256);
      assert.equal(sha(after), transition.afterSha256);
      assert.deepEqual(fs.readFileSync(path.join(temporary, STATE)), after,
        "historical workspace cannot reverse unknown execution state");
      fs.writeFileSync(path.join(temporary, STATE), before);
      fs.unlinkSync(path.join(temporary, PREBUILD));
      return await action(temporary);
    } finally {
      const junction = path.join(temporary, "node_modules");
      if (fs.existsSync(junction)) fs.unlinkSync(junction);
      const resolved = fs.realpathSync(temporary);
      assert.equal(resolved, temporary);
      assert.equal(path.dirname(resolved), parent);
      assert(path.basename(resolved).startsWith("cyber-batch010-historical-"));
      fs.rmSync(resolved, { recursive: true, force: true });
    }
  }
}

module.exports = { Batch010HistoricalWorkspace };
