"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { StageThreeBatchRegistry } = require("./stage_three_batches/core/batch_definition");
const { StageThreeBatchArchitectureCheck } = require("./stage_three_batches/lifecycle/architecture_check");
const { StageThreeFocusedParityCheck } = require("./stage_three_batches/lifecycle/parity_check");
const { StageThreeBatchReleaseCheck } = require("./stage_three_batches/lifecycle/release");
const { StageThreeHistoricalWorkspace } = require("./stage_three_batches/lifecycle/historical_workspace");

const ROOT = path.resolve(__dirname, "../..");

// Shared check entrypoint of continuation batches, registered in the check catalog with args:
//   node utils/architecture/stage-3-batch-check-runner.js --batch 026 --mode architecture|parity|release
class StageThreeBatchCheckRunner {
  async run(argv) {
    const option = name => argv[argv.indexOf(name) + 1];
    assert(argv.includes("--batch") && argv.includes("--mode"), "--batch <NNN> and --mode are required");
    const definition = StageThreeBatchRegistry.load(option("--batch"));
    const registry = StageThreeBatchRegistry;
    const label = `${definition.context.label(0).replace(/\.0$/u, "")} batch ${definition.context.number}`;
    const mode = option("--mode");
    if (mode === "architecture") {
      const { live } = await new StageThreeBatchArchitectureCheck(definition, registry).run(ROOT);
      console.log(`${label} architecture PASS: audit/plan/matrix replay, parity, source and import fixtures, ` +
        `candidate build, rollback fixtures, live ${live.topology.modules}/${live.topology.activations}/` +
        `${live.topology.bridges} and observations.`);
    } else if (mode === "parity") {
      const matrix = await new StageThreeHistoricalWorkspace(definition, registry)
        .run(ROOT, root => new StageThreeFocusedParityCheck(definition).run(root));
      console.log(`${label} parity PASS: ${matrix.behaviorCases.length} behavior cases.`);
    } else if (mode === "release") {
      const result = new StageThreeBatchReleaseCheck(definition).run(ROOT);
      console.log(`${label} release PASS: ${result.releaseFiles} reversible files.`);
    } else {
      throw new Error(`Unknown mode: ${mode}`);
    }
  }
}

new StageThreeBatchCheckRunner().run(process.argv.slice(2))
  .catch(error => { console.error(error.stack); process.exitCode = 1; });
