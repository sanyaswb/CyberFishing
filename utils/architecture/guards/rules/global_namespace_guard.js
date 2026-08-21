class GlobalNamespaceGuard {
  run(snapshot, classifier) {
    const approved = new Set(snapshot.globalBaseline.providers.map(this.#identity));
    for (const bridge of snapshot.bridgeRegistry.bridges) for (const provider of bridge.globalProviders) approved.add(this.#identity({ currentPath: bridge.bridge, ...provider }));
    const current = new Map();
    const esmByPath = new Map(snapshot.sources.map((item) => [item.currentPath, item.esm]));
    for (const module of snapshot.manifest.modules) {
      const esm = esmByPath.get(module.currentPath);
      const providers = esm?.hasEsmSyntax ? esm.globalAssignments : module.observed.providers.items;
      for (const provider of providers) current.set(this.#identity({ currentPath: module.currentPath, ...provider }), { currentPath: module.currentPath, ...provider });
    }
    const diagnostics = [];
    for (const [key, provider] of [...current].sort()) if (!approved.has(key)) diagnostics.push(classifier.classify({ rule: "global-namespace", source: provider.currentPath, target: `${provider.mechanism}:${provider.symbol}`, location: null, message: "Global provider is outside the exact approved baseline", identity: { rule: "global-namespace", currentPath: provider.currentPath, symbol: provider.symbol, mechanism: provider.mechanism } }, { debtEligible: false, exceptionRule: "legacy-global", exceptionSubject: `${provider.mechanism}:${provider.symbol}` }));
    return diagnostics;
  }
  #identity(item) { return `${item.currentPath}\u0000${item.symbol}\u0000${item.mechanism}`; }
}

module.exports = { GlobalNamespaceGuard };
