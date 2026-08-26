"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { globSync } = require("glob");
const {
  CumulativeRuntimeContractValidator,
  EXACT_TRANSPORT_GLOBAL,
} = require("../build/compat_runtime/cumulative_runtime_contract");
const {
  StageThreeCompatibilityBuildApplication,
} = require("../build/build_stage_3_compat_runtime");
const {
  LegacyBridgeBuildApplication,
} = require("../build/build_legacy_bridges");
const {
  LegacyScriptOrderReader,
} = require("./migration/legacy_script_order_reader");
const {
  StageTwoRuntimeScriptAliasResolver,
} = require("./migration/stage_two_runtime_script_alias_resolver");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const CONTRACT_PATH = path.join(
  PROJECT_ROOT,
  "architecture/migration/stage_3_compatibility_runtime.json",
);

class StageThreeCompatibilityRuntimeIntegrationCheck {
  async run() {
    const contractBytes = fs.readFileSync(CONTRACT_PATH);
    const contract = new CumulativeRuntimeContractValidator().validate(
      JSON.parse(contractBytes.toString("utf8")),
    );
    const state = this.#readJson(
      "architecture/migration/stage_3_execution_state.json",
    );
    const approvedPlan = this.#readJson(
      "architecture/migration/stage_3_approved_batches.json",
    );
    const prebuildOpen = state.activeBatchPhase === "prebuild";
    const selectedBatchId = prebuildOpen
      ? state.completedBatchIds.at(-1)
      : (state.activeBatchId || state.completedBatchIds.at(-1));
    const selectedBatch = approvedPlan.batches.find(
      (batch) => batch.id === selectedBatchId,
    );
    assert(selectedBatch, `Selected Stage 3 batch is missing: ${selectedBatchId}`);
    const expectedProjectModules = [
      ...selectedBatch.cumulativeRuntimeTopology.stage2Targets,
      ...selectedBatch.cumulativeRuntimeTopology.stage3Targets,
      ...contract.approvedInfrastructureModules,
    ].sort();
    const expectedActivationIds = [
      ...selectedBatch.compatibility.cumulativeActivationIds,
    ].sort();
    assert.equal(contract.status, "migration-active");
    assert.equal(state.compatibilityRuntimeActivated, true);
    assert.deepEqual(
      contract.activationPositions.map((activation) => activation.id).sort(),
      expectedActivationIds,
    );
    assert.equal(contract.sideEffectReviews.length, 5);
    assert.equal(contract.previousRuntimeTransitions.length, 9);
    assert.equal(contract.approvedInfrastructureModules.length, 0);
    assert.equal(contract.transport.symbol, EXACT_TRANSPORT_GLOBAL);
    assert.equal(contract.transport.ownsGameState, false);

    const indexPath = path.join(PROJECT_ROOT, "index.html");
    const html = fs.readFileSync(indexPath, "utf8");
    const scripts = [...html.matchAll(
      /<script\b([^>]*)\bsrc\s*=\s*["']([^"']+)["'][^>]*><\/script>/giu,
    )];
    const moduleScripts = scripts.filter((match) =>
      /\btype\s*=\s*["']module["']/iu.test(match[1] || ""),
    );
    assert.equal(moduleScripts.length, 0, "Stage 3 migration must not activate a module script");
    const runtimePath = `${contract.output.directory}${contract.output.runtimeFile}`;
    assert.equal(
      scripts.filter((match) => match[2].split("?")[0] === runtimePath).length,
      1,
      "cumulative runtime must be loaded exactly once",
    );
    const aliases = new StageTwoRuntimeScriptAliasResolver().loadProject(
      PROJECT_ROOT,
    );
    const logicalScripts = new LegacyScriptOrderReader(indexPath, {
      scriptAliases: aliases,
    }).read();
    assert.equal(logicalScripts.length, 424);
    assert.equal(logicalScripts.filter((script) => script.type === "module").length, 0);
    const activationProviderCount = new Set(
      contract.activationPositions.map((activation) => activation.sourceProvider),
    ).size;
    assert.equal(
      scripts.length,
      logicalScripts.length + 1 +
        (contract.activationPositions.length - activationProviderCount),
      "Stage 3 physical scripts must derive from logical positions, one runtime and grouped activations",
    );

    const previousRuntime = path.join(PROJECT_ROOT, "dist/legacy-bridges");
    const legacyReport = await new LegacyBridgeBuildApplication({
      projectRoot: PROJECT_ROOT,
    }).run();
    assert.equal(legacyReport.status, "transitioned-to-cumulative-runtime");
    assert.equal(fs.existsSync(previousRuntime), false, "isolated Stage 2 IIFEs must be removed");
    let runtime = null;
    if (prebuildOpen) {
      const outputRoot = path.join(PROJECT_ROOT, contract.output.directory);
      assert.equal(fs.existsSync(outputRoot), true, "validated prior runtime output must remain available");
      assert.equal(
        fs.existsSync(path.join(outputRoot, contract.output.runtimeFile)),
        true,
        "validated prior cumulative runtime must remain available",
      );
      assert.equal(
        globSync("activations/*.js", { cwd: outputRoot, nodir: true }).length,
        expectedActivationIds.length,
        "prebuild must preserve the completed-prefix activation output",
      );
      runtime = {
        path: `${contract.output.directory}${contract.output.runtimeFile}`,
      };
    } else {
      const report = await new StageThreeCompatibilityBuildApplication({
        projectRoot: PROJECT_ROOT,
      }).run();
      assert.equal(report.status, "built");
      assert.equal(report.moduleCount, expectedProjectModules.length);
      assert.equal(report.activationCount, expectedActivationIds.length);
      assert.equal(report.outputs.length, expectedActivationIds.length + 1);
      runtime = report.outputs.find((output) => output.kind === "cumulative-runtime");
      assert(runtime);
      assert.deepEqual(runtime.projectModules, expectedProjectModules);
      assert.equal(new Set(runtime.projectModules).size, expectedProjectModules.length);
      assert.deepEqual(
        runtime.virtualBuildModules,
        [...new Set(runtime.virtualBuildModules)].sort(),
      );
      assert(runtime.virtualBuildModules.every((moduleId) =>
        contract.approvedVirtualModules.includes(moduleId)),
      );
    }
    assert.equal(
      fs.readFileSync(path.join(PROJECT_ROOT, runtime.path), "utf8")
        .includes(EXACT_TRANSPORT_GLOBAL),
      true,
    );

    const manifest = this.#readJson(
      "architecture/migration/module_migration_manifest.json",
    );
    const entryByPath = new Map(
      manifest.modules.map((entry) => [entry.currentPath, entry]),
    );
    const runtimeSources = globSync("src/**/*.js", {
      cwd: PROJECT_ROOT,
      nodir: true,
    }).map((relativePath) => relativePath.replaceAll("\\", "/")).sort();
    const transportConsumers = runtimeSources.filter((relativePath) =>
      fs.readFileSync(path.join(PROJECT_ROOT, relativePath), "utf8")
        .includes(EXACT_TRANSPORT_GLOBAL),
    );
    const expectedTransportConsumers = [...new Set(contract.activationPositions
      .filter((activation) => activation.sourceProvider.startsWith("src/"))
      .map((activation) => activation.sourceProvider))]
      .sort();
    assert.deepEqual(transportConsumers, expectedTransportConsumers);
    for (const consumer of transportConsumers) {
      assert.deepEqual(entryByPath.get(consumer)?.architecture?.roles, [
        "compatibility-bridge",
      ]);
    }
    assert.deepEqual(
      fs.readFileSync(CONTRACT_PATH),
      contractBytes,
      "integration validation must not rewrite the runtime contract",
    );
    console.log(
      `Stage 3.0.4 integration passed: one ${expectedProjectModules.length}-module cumulative graph, ` +
        `${expectedActivationIds.length} exact activations, 424 logical classic positions, ` +
        `no isolated IIFEs and no domain transport dependency${prebuildOpen ? "; batch 006 remains planned-only" : ""}.`,
    );
  }

  #readJson(relativePath) {
    return JSON.parse(
      fs.readFileSync(path.join(PROJECT_ROOT, relativePath), "utf8"),
    );
  }
}

new StageThreeCompatibilityRuntimeIntegrationCheck().run().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
