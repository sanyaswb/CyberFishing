"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { StageThreeBatchReleaseTransition } = require("./release_transition");
const { MANIFEST, beforeBatchObservations } = require("./observation_transition");
const { StageThreePrerequisiteLedger } = require("../../stage_three_prerequisites/core/prerequisite_ledger");

const STATE = "architecture/migration/stage_3_execution_state.json";
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex");

// Reconstructs the project in a temporary copy at one checkpoint of a continuation batch:
// before the release (keepCutover), before the cutover (keepPrebuild) or before the batch.
// A newer batch is always reversed first by its own workspace.
class StageThreeHistoricalWorkspace {
  constructor(definition, registry) {
    this.definition = definition;
    this.registry = registry;
  }

  async run(root, action, { keepPrebuild = false, keepCutover = false, copyTools = false } = {}) {
    const projectRoot = path.resolve(root);
    const context = this.definition.context;
    const next = context.next().number;
    if (this.registry.has(next)) {
      const nextPaths = context.next().paths;
      if (fs.existsSync(path.join(projectRoot, nextPaths.cutover)) ||
        fs.existsSync(path.join(projectRoot, nextPaths.prebuild))) {
        return new StageThreeHistoricalWorkspace(this.registry.load(next), this.registry).run(projectRoot,
          prior => this.run(prior, action, { keepPrebuild, keepCutover, copyTools }), { copyTools });
      }
    }
    const paths = context.paths;
    if (!fs.existsSync(path.join(projectRoot, paths.prebuild))) return action(projectRoot);
    const parent = fs.realpathSync(os.tmpdir());
    const prefix = context.tempPrefix("historical");
    const temporary = fs.mkdtempSync(path.join(parent, prefix));
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
      // Prerequisite transitions recorded after this batch are newer than its release.
      new StageThreePrerequisiteLedger(temporary).peel(context.number);
      const releasePath = path.join(temporary, paths.releaseTransition);
      if (fs.existsSync(releasePath)) {
        const transition = new StageThreeBatchReleaseTransition(temporary, this.definition);
        const artifact = transition.validate(JSON.parse(fs.readFileSync(releasePath)));
        for (const record of artifact.records) {
          const target = path.join(temporary, record.path);
          fs.writeFileSync(target, transition.reverse(fs.readFileSync(target), record));
        }
        fs.unlinkSync(releasePath);
      }
      if (keepCutover) return await action(temporary);
      const observationPath = path.join(temporary, paths.observation);
      if (fs.existsSync(observationPath)) {
        const manifest = path.join(temporary, MANIFEST);
        const prior = beforeBatchObservations(this.definition, fs.readFileSync(manifest), temporary);
        assert.notDeepEqual(prior, fs.readFileSync(manifest), "Observation transition did not reverse");
        fs.writeFileSync(manifest, prior);
        fs.unlinkSync(observationPath);
      }
      const cutoverPath = path.join(temporary, paths.cutover);
      if (fs.existsSync(cutoverPath)) {
        const cutover = JSON.parse(fs.readFileSync(cutoverPath));
        for (const record of cutover.writes) {
          const target = path.join(temporary, record.path);
          const current = fs.existsSync(target) ? fs.readFileSync(target) : null;
          assert.equal(current && sha(current), record.afterSha256, `batch ${context.number} cutover drift: ${record.path}`);
          if (record.beforeBase64 === null) fs.unlinkSync(target);
          else fs.writeFileSync(target, Buffer.from(record.beforeBase64, "base64"));
        }
        fs.unlinkSync(cutoverPath);
      }
      const debtResolutionPath = path.join(temporary, paths.knownDebt);
      if (fs.existsSync(debtResolutionPath)) {
        const resolution = JSON.parse(fs.readFileSync(debtResolutionPath));
        const debt = path.join(temporary, resolution.registry.path);
        assert.equal(sha(fs.readFileSync(debt)), resolution.registry.afterSha256);
        fs.writeFileSync(debt, Buffer.from(resolution.registry.beforeBase64, "base64"));
        assert.equal(sha(fs.readFileSync(debt)), resolution.registry.beforeSha256);
        fs.unlinkSync(debtResolutionPath);
      }
      const prebuild = JSON.parse(fs.readFileSync(path.join(temporary, paths.prebuild)));
      if (keepPrebuild) {
        assert.deepEqual(fs.readFileSync(path.join(temporary, STATE)),
          Buffer.from(prebuild.stateTransition.afterBase64, "base64"));
        return await action(temporary);
      }
      const transition = prebuild.stateTransition;
      const before = Buffer.from(transition.beforeBase64, "base64");
      const after = Buffer.from(transition.afterBase64, "base64");
      assert.equal(sha(before), transition.beforeSha256);
      assert.equal(sha(after), transition.afterSha256);
      assert.deepEqual(fs.readFileSync(path.join(temporary, STATE)), after,
        "historical workspace cannot reverse unknown execution state");
      fs.writeFileSync(path.join(temporary, STATE), before);
      fs.unlinkSync(path.join(temporary, paths.prebuild));
      return await action(temporary);
    } finally {
      const junction = path.join(temporary, "node_modules");
      if (fs.existsSync(junction)) fs.unlinkSync(junction);
      const resolved = fs.realpathSync(temporary);
      assert.equal(resolved, temporary);
      assert.equal(path.dirname(resolved), parent);
      assert(path.basename(resolved).startsWith(prefix));
      fs.rmSync(resolved, { recursive: true, force: true });
    }
  }
}

module.exports = { StageThreeHistoricalWorkspace };
