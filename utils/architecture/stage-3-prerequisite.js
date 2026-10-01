"use strict";

// Stage 3 prerequisite transitions (behavior-preserving structural changes between batches).
//   node utils/architecture/stage-3-prerequisite.js --task NNN --step plan      (dry run, prints the delta)
//   node utils/architecture/stage-3-prerequisite.js --task NNN --step apply     (records and publishes it)
//   node utils/architecture/stage-3-prerequisite.js --task NNN --step check     (replay at its checkpoint)
//   node utils/architecture/stage-3-prerequisite.js --task NNN --step rollback --confirm
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { ControlledMetadataTransaction } = require("./domain_batches/controlled_metadata_transaction");
const { StageThreePrerequisiteLedger } = require("./stage_three_prerequisites/core/prerequisite_ledger");
const { StageThreePrerequisiteTransitionBuilder } = require("./stage_three_prerequisites/lifecycle/transition_builder");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex");

class StageThreePrerequisiteCommand {
  constructor(root, number) {
    assert.match(String(number), /^\d{3}$/u, "--task needs a three-digit number");
    this.root = path.resolve(root);
    this.task = require(`./stage_three_prerequisites/tasks/${number}/task`);
    assert.equal(this.task.sequence, Number(number), "task number differs from its sequence");
    this.file = StageThreePrerequisiteLedger.fileName(this.task);
  }

  plan() {
    const { record } = new StageThreePrerequisiteTransitionBuilder(this.root, this.task).build();
    const { writes, ...summary } = record;
    return { ...summary, writes: writes.map(write => write.path) };
  }

  apply() {
    assert(!fs.existsSync(path.join(this.root, this.file)), `prerequisite ${this.task.sequence} is already recorded`);
    const { bytes, after } = new StageThreePrerequisiteTransitionBuilder(this.root, this.task).build();
    const writes = [...[...after].map(([relativePath, content]) => ({ relativePath, bytes: content })),
      { relativePath: this.file, bytes }];
    for (const write of writes) fs.mkdirSync(path.dirname(path.join(this.root, write.relativePath)), { recursive: true });
    new ControlledMetadataTransaction({ projectRoot: this.root }).commit(writes, () => {
      for (const write of writes) {
        const target = path.join(this.root, write.relativePath);
        if (write.bytes === null) assert(!fs.existsSync(target), `deleted file still exists: ${write.relativePath}`);
        else assert.deepEqual(fs.readFileSync(target), write.bytes);
      }
    });
    return `applied ${this.file}`;
  }

  // Rebuilds the transition from the exact tree it was applied to: newer batches are reversed by
  // their historical workspaces, then this and every later transition are peeled from a copy.
  async check() {
    const recorded = fs.readFileSync(path.join(this.root, this.file));
    const record = StageThreePrerequisiteLedger.validate(JSON.parse(recorded));
    const checkpointFiles = new StageThreePrerequisiteLedger(this.root).records()
      .filter(item => item.sequence >= record.sequence)
      .flatMap(item => item.writes.map(write => write.path))
      .filter(file => !file.startsWith("src/") && !file.startsWith("architecture/") &&
        !file.startsWith("dist/stage-3-compat-runtime/") && !["index.html", "package.json"].includes(file));
    const next = String(Number(this.task.afterBatch) + 1).padStart(3, "0");
    const { StageThreeBatchRegistry } = require("./stage_three_batches/core/batch_definition");
    const verify = checkpoint => this.#inCopy(checkpoint, copy => {
      // Later transitions are newer than this one: peel them before verifying its published state.
      new StageThreePrerequisiteLedger(copy).peelFrom(record.sequence + 1);
      for (const write of record.writes) {
        const target = path.join(copy, write.path);
        assert.equal(fs.existsSync(target) ? sha(fs.readFileSync(target)) : null, write.afterSha256,
          `prerequisite ${record.sequence} is not the published state: ${write.path}`);
      }
      new StageThreePrerequisiteLedger(copy).peelFrom(record.sequence);
      const rebuilt = new StageThreePrerequisiteTransitionBuilder(copy, this.task).build();
      assert.deepEqual(rebuilt.bytes, recorded, "prerequisite transition does not replay byte-identically");
      return rebuilt.record;
    }, checkpointFiles);
    const nextPrebuild = StageThreeBatchRegistry.has(next) &&
      fs.existsSync(path.join(this.root, StageThreeBatchRegistry.load(next).context.paths.prebuild));
    if (!nextPrebuild) return verify(this.root);
    const { StageThreeHistoricalWorkspace } = require("./stage_three_batches/lifecycle/historical_workspace");
    return new StageThreeHistoricalWorkspace(StageThreeBatchRegistry.load(next), StageThreeBatchRegistry).run(this.root, verify);
  }

  rollback(confirmed) {
    assert(confirmed, "rollback needs --confirm");
    const ledger = new StageThreePrerequisiteLedger(this.root);
    assert.equal(ledger.records().at(-1)?.sequence, this.task.sequence, "only the newest prerequisite transition rolls back");
    const record = JSON.parse(fs.readFileSync(path.join(this.root, this.file)));
    const writes = record.writes.map(write => {
      const target = path.join(this.root, write.path);
      assert.equal(fs.existsSync(target) ? sha(fs.readFileSync(target)) : null, write.afterSha256, `drift: ${write.path}`);
      return { relativePath: write.path, bytes: write.beforeBase64 === null ? null : Buffer.from(write.beforeBase64, "base64") };
    });
    new ControlledMetadataTransaction({ projectRoot: this.root }).commit([...writes, { relativePath: this.file, bytes: null }],
      () => undefined);
    // Directories that only held files this transition created disappear with them.
    for (const write of record.writes.filter(item => item.beforeBase64 === null)) {
      for (let directory = path.dirname(path.join(this.root, write.path));
        directory !== this.root && fs.existsSync(directory) && fs.readdirSync(directory).length === 0;
        directory = path.dirname(directory)) fs.rmdirSync(directory);
    }
    return `rolled back ${this.file}`;
  }

  #inCopy(root, action, supplementalFiles = []) {
    const parent = fs.realpathSync(os.tmpdir());
    const temporary = fs.mkdtempSync(path.join(parent, "cyber-prerequisite-check-"));
    const copy = relative => {
      for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
        const child = `${relative}/${entry.name}`;
        if (entry.isDirectory()) copy(child);
        else if (entry.isFile()) {
          fs.mkdirSync(path.dirname(path.join(temporary, child)), { recursive: true });
          fs.copyFileSync(path.join(root, child), path.join(temporary, child));
        }
      }
    };
    try {
      for (const directory of ["src", "architecture", "dist/stage-3-compat-runtime"]) copy(directory);
      for (const file of ["index.html", "package.json"]) fs.copyFileSync(path.join(root, file), path.join(temporary, file));
      for (const file of supplementalFiles) {
        const checkpointSource = path.join(root, file);
        const source = fs.existsSync(checkpointSource) ? checkpointSource : path.join(this.root, file);
        const target = path.join(temporary, file);
        if (!fs.existsSync(source) || fs.existsSync(target)) continue;
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(source, target);
      }
      return action(temporary);
    } finally {
      assert.equal(path.dirname(fs.realpathSync(temporary)), parent);
      fs.rmSync(temporary, { recursive: true, force: true });
    }
  }
}

async function main(argv) {
  const value = flag => argv[argv.indexOf(flag) + 1];
  const command = new StageThreePrerequisiteCommand(PROJECT_ROOT, value("--task"));
  const step = value("--step");
  const label = `Stage 3 prerequisite ${command.task.sequence} (${command.task.slug})`;
  if (step === "plan") console.log(JSON.stringify(command.plan(), null, 2));
  else if (step === "apply") console.log(`${label}: ${command.apply()}`);
  else if (step === "check") {
    const record = await command.check();
    console.log(`${label} PASS: replayed byte-identically at its checkpoint; ${record.writes.length} files, ` +
      `edge delta ${record.dependencyObservation.confirmedEdgeDelta}, resolved debts ${record.resolvedDebtIds.length}, ` +
      `guard failures ${record.guards.failureCount}, parity cases ${record.parity.cases}.`);
  } else if (step === "rollback") console.log(`${label}: ${command.rollback(argv.includes("--confirm"))}`);
  else throw new Error("--step must be plan, apply, check or rollback");
}

if (require.main === module) {
  main(process.argv.slice(2)).catch(error => { console.error(error.stack); process.exitCode = 1; });
}

module.exports = { StageThreePrerequisiteCommand };
