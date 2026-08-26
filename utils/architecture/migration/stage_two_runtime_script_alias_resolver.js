const fs = require("node:fs");
const path = require("node:path");
const {
  ActiveBridgePlanResolver,
} = require("../../build/legacy_bridge_build_config");
const {
  StageThreeRuntimeScriptAliasResolver,
} = require("./stage_three_runtime_script_alias_resolver");

class StageTwoRuntimeScriptAliasResolver {
  resolve({ state, approvedPlan, bridgeRegistry, runtimeFacts }) {
    const active = new ActiveBridgePlanResolver().resolve({
      state,
      approvedPlan,
      bridgeRegistry,
      runtimeFacts,
    });
    return new Map(
      active.plans.map((plan) => [plan.outputPath, plan.wrapperPath]),
    );
  }

  loadProject(projectRoot) {
    const readJson = (relativePath) => JSON.parse(
      fs.readFileSync(path.join(projectRoot, relativePath), "utf8"),
    );
    const indexHtml = fs.readFileSync(path.join(projectRoot, "index.html"), "utf8");
    const bridgeRegistry = readJson(
      "architecture/guards/migration_bridge_registry.json",
    );
    const stageTwoBatchIds = new Set(
      readJson("architecture/migration/stage_2_approved_batches.json")
        .batches.map((batch) => batch.id),
    );
    const stageTwoBridgeRegistry = {
      ...bridgeRegistry,
      bridges: bridgeRegistry.bridges.filter((bridge) =>
        stageTwoBatchIds.has(bridge.owner)),
    };
    const aliases = this.resolve({
      state: readJson("architecture/migration/stage_2_execution_state.json"),
      approvedPlan: readJson(
        "architecture/migration/stage_2_approved_batches.json",
      ),
      bridgeRegistry: stageTwoBridgeRegistry,
      runtimeFacts: {
        moduleScriptCount: (
          indexHtml.match(/<script\b[^>]*\btype\s*=\s*["']module["']/giu) || []
        ).length,
      },
    });
    const stageThreeStatePath = path.join(
      projectRoot,
      "architecture/migration/stage_3_execution_state.json",
    );
    if (!fs.existsSync(stageThreeStatePath)) return aliases;
    const stageThreeState = readJson(
      "architecture/migration/stage_3_execution_state.json",
    );
    if (stageThreeState.compatibilityRuntimeActivated !== true) return aliases;
    const contract = readJson(
      "architecture/migration/stage_3_compatibility_runtime.json",
    );
    const logicalProviderByActivationId = new Map();
    for (const activation of contract.activationPositions || []) {
      const bridgePaths = [...new Set(bridgeRegistry.bridges
        .filter((bridge) =>
          bridge.target === activation.targetModule &&
          bridge.globalProviders.some((provider) =>
            provider.symbol === activation.legacySymbol &&
            provider.mechanism === "global-this-property"))
        .map((bridge) => bridge.bridge))];
      if (bridgePaths.length !== 1) {
        throw new Error(
          `Stage 3 activation requires one exact registered bridge: ${activation.id}`,
        );
      }
      logicalProviderByActivationId.set(activation.id, bridgePaths[0]);
    }
    for (const [source, target] of
      new StageThreeRuntimeScriptAliasResolver().resolve(contract, {
        sourceProviderResolver: (activation) =>
          logicalProviderByActivationId.get(activation.id),
      })) {
      aliases.set(source, target);
    }
    return aliases;
  }
}

module.exports = { StageTwoRuntimeScriptAliasResolver };
