class BridgeRegistryGuard {
  run(snapshot, classifier) {
    const modules = new Set(snapshot.manifest.modules.map((item) => item.currentPath));
    const diagnostics = [];
    for (const bridge of snapshot.bridgeRegistry.bridges) {
      if (!modules.has(bridge.source) || !modules.has(bridge.bridge) || !modules.has(bridge.target) || bridge.source === bridge.target) {
        diagnostics.push(classifier.classify({ rule: "stale-bridge", source: bridge.source, target: bridge.target, location: null, message: `Bridge ${bridge.id} has missing/equal source, bridge, or target modules`, identity: { rule: "stale-bridge", id: bridge.id, bridge: bridge.bridge, source: bridge.source, target: bridge.target } }, { debtEligible: false }));
      }
    }
    return diagnostics;
  }
}

module.exports = { BridgeRegistryGuard };
