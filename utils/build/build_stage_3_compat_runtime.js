"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { RetiredActivationPlaceholder } = require("./compat_runtime/activation_retirement");
const {
  LegacyScriptOrderReader,
} = require("../architecture/migration/legacy_script_order_reader");
const {
  CumulativeRuntimeBuildApplication,
} = require("./compat_runtime/cumulative_runtime_builder");
const {
  StageThreeRuntimeScriptAliasResolver,
} = require("../architecture/migration/stage_three_runtime_script_alias_resolver");
const {
  StageThreeApprovedPlanSource,
} = require("../architecture/domain_batches/stage_three_approved_plan_source");
const {
  StageFourClusterLedger,
} = require("../architecture/stage_four/cluster_ledger");

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
    const report = await new CumulativeRuntimeBuildApplication({
      projectRoot: this.projectRoot,
      contract,
      // The execution plan source appends an adopted continuation to the historical plan.
      approvedPlan: new StageThreeApprovedPlanSource({
        read: (relativePath) => fs.readFileSync(this.#path(relativePath)),
      }).load(persistedExecutionState).document,
      executionState,
      stageTwoApprovedPlan: this.#json(
        "architecture/migration/stage_2_approved_batches.json",
      ),
      stageTwoExecutionState: this.#json(
        "architecture/migration/stage_2_execution_state.json",
      ),
      viteLoader: this.viteLoader,
      outputManager: this.outputManager,
      additionalTargetModules: StageFourClusterLedger.cumulative(this.projectRoot).targetModules(),
      removedTargetModules: StageFourClusterLedger.cumulative(this.projectRoot).removedTargetModules(),
      scriptOrderProvider: () => new LegacyScriptOrderReader(
        LegacyScriptOrderReader.sourcePath(this.projectRoot),
        { scriptAliases: aliases },
      ).read(),
    }).run();
    // Retired Stage 2 exposures held generated classic positions. Regenerate their inert outputs
    // after the legacy builder cleans its directory; authored sources are never written here.
    for (const { sourceProvider, activations } of RetiredActivationPlaceholder.byProvider(
      (contract.retiredActivations || []).map(record => record.activation))) {
      if (!sourceProvider.startsWith("dist/legacy-bridges/")) continue;
      if (!/^dist\/legacy-bridges\/[a-z0-9_-]+\.iife\.js$/u.test(sourceProvider)) throw new Error("Unsafe retired Stage 2 output");
      const output = this.#path(sourceProvider);
      if (path.dirname(output) !== this.#path("dist/legacy-bridges")) throw new Error("Retired output escapes directory");
      fs.mkdirSync(path.dirname(output), { recursive: true });
      fs.writeFileSync(output, new RetiredActivationPlaceholder().renderProvider(activations));
    }
    return report;
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
