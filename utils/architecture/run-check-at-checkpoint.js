"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const PROJECT_ROOT = path.resolve(__dirname, "../..");

// Runs one check against the exact reconstructed project state from before a released batch.
// The batch's historical workspace reverses that batch (and every newer one) byte-for-byte from
// recorded before-images, so checks describing earlier checkpoints keep their full strength after
// a later batch deletes or retires files they read. Usage:
//   node utils/architecture/run-check-at-checkpoint.js --before-batch 025 utils/architecture/<check>.js
class CheckpointCheckRunner {
  parse(argv) {
    const index = argv.indexOf("--before-batch");
    assert(index >= 0, "--before-batch <NNN> is required");
    const batch = argv[index + 1];
    const file = argv[index + 2];
    assert.match(batch || "", /^\d{3}$/u, "Batch number must have three digits");
    assert(typeof file === "string" && /^utils\/[a-z0-9_/.-]+\.js$/u.test(file) &&
      !file.split("/").includes(".."), `Invalid check path: ${file}`);
    return { batch, file };
  }

  async run(argv) {
    const { batch, file } = this.parse(argv);
    const modulePath = `./domain_batches/stage_three_batch_${batch}_historical_workspace`;
    const Workspace = require(modulePath)[`Batch${batch}HistoricalWorkspace`];
    assert.equal(typeof Workspace, "function", `Historical workspace is missing for batch ${batch}`);
    return new Workspace().run(PROJECT_ROOT, (root) => {
      const result = spawnSync(process.execPath, [path.join(root, file)], { cwd: root, stdio: "inherit" });
      if (result.error) throw result.error;
      return result.status ?? 1;
    }, { copyTools: true });
  }
}

new CheckpointCheckRunner().run(process.argv.slice(2))
  .then((status) => { process.exitCode = status; })
  .catch((error) => { console.error(error.stack); process.exitCode = 1; });
