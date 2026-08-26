"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  LegacyScriptOrderReader,
} = require("../architecture/migration/legacy_script_order_reader");
const {
  CumulativeRuntimeBuildApplication,
} = require("./compat_runtime/cumulative_runtime_builder");
const {
  StageThreeRuntimeScriptAliasResolver,
} = require("../architecture/migration/stage_three_runtime_script_alias_resolver");

class StageThreeCompatibilityBuildApplication {
  constructor({
    projectRoot = path.resolve(__dirname, "../.."),
    viteLoader = () => import("vite"),
    outputManager = null,
  } = {}) {
    this.projectRoot = path.resolve(projectRoot);
    this.viteLoader = viteLoader;
    this.outputManager = outputManager;
  }

  async run() {
    const statePath = this.#path(
      "architecture/migration/stage_3_execution_state.json",
    );
    if (!fs.existsSync(statePath)) {
      return Object.freeze({
        status: "no-stage-3-state",
        moduleCount: 0,
        activationCount: 0,
        outputs: Object.freeze([]),
      });
    }
    const persistedExecutionState = this.#json(
      "architecture/migration/stage_3_execution_state.json",
    );
    const executionState = persistedExecutionState.activeBatchPhase === "prebuild"
      ? {
        ...persistedExecutionState,
        activeBatchId: null,
      }
      : persistedExecutionState;
    const contract = this.#json(
      "architecture/migration/stage_3_compatibility_runtime.json",
    );
    const aliases = new StageThreeRuntimeScriptAliasResolver().resolve(contract);
    return new CumulativeRuntimeBuildApplication({
      projectRoot: this.projectRoot,
      contract,
      approvedPlan: this.#json(
        "architecture/migration/stage_3_approved_batches.json",
      ),
      executionState,
      stageTwoApprovedPlan: this.#json(
        "architecture/migration/stage_2_approved_batches.json",
      ),
      stageTwoExecutionState: this.#json(
        "architecture/migration/stage_2_execution_state.json",
      ),
      viteLoader: this.viteLoader,
      outputManager: this.outputManager,
      scriptOrderProvider: () => new LegacyScriptOrderReader(
        this.#path("index.html"),
        { scriptAliases: aliases },
      ).read(),
    }).run();
  }

  #json(relativePath) {
    return JSON.parse(fs.readFileSync(this.#path(relativePath), "utf8"));
  }

  #path(relativePath) {
    return path.join(this.projectRoot, relativePath);
  }
}

async function runCli() {
  const report = await new StageThreeCompatibilityBuildApplication().run();
  console.log(
    `Stage 3 compatibility build: ${report.status}; ` +
      `${report.moduleCount} module(s), ${report.activationCount} activation(s).`,
  );
  for (const output of report.outputs || []) {
    console.log(`- ${output.path} ${output.sha256}`);
  }
}

if (require.main === module) {
  runCli().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}

module.exports = { StageThreeCompatibilityBuildApplication };
