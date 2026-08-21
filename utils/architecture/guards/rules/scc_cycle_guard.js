const { TarjanStronglyConnectedComponents } = require("../graph/tarjan_scc");

class SccCycleGuard {
  run(snapshot, classifier) {
    const finder = new TarjanStronglyConnectedComponents();
    return finder.find(snapshot.graph).filter((component) => component.length > 1).map((component) => {
      const members = new Set(component);
      const internalEdges = snapshot.graph.edges.filter((edge) => members.has(edge.source) && members.has(edge.target)).map((edge) => `${edge.source}->${edge.target}`).sort();
      const identity = { rule: "module-cycle", members: [...component].sort(), internalEdges };
      const source = component[0], target = `scc:${component.join("|")}`;
      return classifier.classify({ rule: "module-cycle", source, target, location: null, message: `Structural cycle: ${finder.canonicalCycle(component, snapshot.graph).join(" -> ")}`, identity });
    });
  }
}

module.exports = { SccCycleGuard };
