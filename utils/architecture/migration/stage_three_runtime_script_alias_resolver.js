"use strict";

class StageThreeRuntimeScriptAliasResolver {
  resolve(contract, { sourceProviderResolver = (activation) =>
    activation.sourceProvider } = {}) {
    const aliases = new Map();
    aliases.set(
      `${contract.output.directory}${contract.output.runtimeFile}`,
      null,
    );
    const representedProviders = new Set();
    for (const activation of contract.activationPositions || []) {
      const outputPath = `${contract.output.directory}${activation.shimFile}`;
      const logicalProvider = sourceProviderResolver(activation);
      const representsLegacyPosition = !representedProviders.has(
        logicalProvider,
      );
      aliases.set(
        outputPath,
        representsLegacyPosition ? logicalProvider : null,
      );
      representedProviders.add(logicalProvider);
    }
    return aliases;
  }
}

module.exports = { StageThreeRuntimeScriptAliasResolver };
