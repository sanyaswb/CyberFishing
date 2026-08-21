const { UnifiedDependencyEdge, immutableRecord } = require("../core/guard_models");

class UnifiedDependencyGraphBuilder {
  build({ manifest, esmResults, bridgeRegistry }) {
    const edges = new Map();
    const nodes = new Set(manifest.modules.map((item) => item.currentPath));
    const esmBySource = new Map(esmResults.map((item) => [item.source, item]));
    for (const module of manifest.modules) {
      const status = module.architecture.migrationStatus;
      if (!["esm", "verified"].includes(status)) {
        for (const dependency of module.analysis.dependencies.items) this.#add(edges, module.currentPath, dependency.target, "legacy-confirmed", { symbols: dependency.symbols });
      }
      const esm = esmBySource.get(module.currentPath);
      if (esm?.hasEsmSyntax) for (const observation of esm.observations) if (observation.resolutionStatus === "confirmed-project") this.#add(edges, module.currentPath, observation.resolvedTarget, observation.mechanism, observation);
    }
    for (const bridge of bridgeRegistry.bridges) {
      nodes.add(bridge.bridge);
      this.#add(edges, bridge.source, bridge.bridge, "approved-bridge", { bridgeId: bridge.id, leg: "source-bridge" });
      this.#add(edges, bridge.bridge, bridge.target, "approved-bridge", { bridgeId: bridge.id, leg: "bridge-target" });
    }
    const finalized = [...edges.values()].map((edge) => new UnifiedDependencyEdge(edge));
    return immutableRecord({ nodes: [...nodes].sort(), edges: finalized.sort((a, b) => `${a.source}\u0000${a.target}`.localeCompare(`${b.source}\u0000${b.target}`)) });
  }

  #add(edges, source, target, mechanism, provenance) {
    if (!source || !target || source === target) return;
    const key = `${source}\u0000${target}`;
    const record = edges.get(key) || { source, target, mechanisms: [], provenance: [] };
    if (!record.mechanisms.includes(mechanism)) record.mechanisms.push(mechanism);
    record.mechanisms.sort();
    record.provenance.push({ mechanism, ...provenance });
    edges.set(key, record);
  }
}

module.exports = { UnifiedDependencyGraphBuilder };
