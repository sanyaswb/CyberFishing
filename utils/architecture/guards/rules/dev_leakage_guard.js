class DevLeakageGuard {
  run(snapshot, classifier) {
    const modules = new Map(snapshot.manifest.modules.map((item) => [item.currentPath, item]));
    const roles = new Set(snapshot.policy.architectureGuards.developmentOnlyRoles);
    const devBoundaries = new Set(["dev", "bootstrap-development", "entrypoint-dev"]);
    const productionRootBoundary = snapshot.policy.environments.production.rootBoundary;
    const roots = snapshot.manifest.modules.filter((item) => item.architecture.targetBoundary === productionRootBoundary).map((item) => item.currentPath);
    const paths = this.#reachablePaths(snapshot.graph, roots);
    const diagnostics = [];
    for (const edge of snapshot.graph.edges) {
      const source = modules.get(edge.source), target = modules.get(edge.target);
      if (!source || !target || devBoundaries.has(source.architecture.targetBoundary)) continue;
      const targetIsDevelopment = devBoundaries.has(target.architecture.targetBoundary) || target.architecture.roles.some((role) => roles.has(role));
      if (!targetIsDevelopment) continue;
      const path = paths.get(edge.source);
      const suffix = path ? `; production path: ${[...path, edge.target].join(" -> ")}` : "";
      diagnostics.push(classifier.classify({ rule: "dev-leakage", source: edge.source, target: edge.target, location: edge.provenance?.find((item) => item.location)?.location || null, message: `Production module reaches development-only module${suffix}`, identity: { rule: "dev-leakage", source: edge.source, target: edge.target } }, { exceptionRule: "dev-leakage", exceptionSubject: edge.target }));
    }
    return diagnostics;
  }
  #reachablePaths(graph, roots) {
    const adjacency = new Map();
    for (const edge of graph.edges) { if (!adjacency.has(edge.source)) adjacency.set(edge.source, []); adjacency.get(edge.source).push(edge.target); }
    const paths = new Map(), queue = roots.sort().map((root) => [root]);
    for (const root of roots) paths.set(root, [root]);
    while (queue.length) { const path = queue.shift(), tail = path[path.length - 1]; for (const target of (adjacency.get(tail) || []).sort()) if (!paths.has(target)) { const next = [...path, target]; paths.set(target, next); queue.push(next); } }
    return paths;
  }
}

module.exports = { DevLeakageGuard };
