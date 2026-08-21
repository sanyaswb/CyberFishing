class BoundaryGuard {
  run(snapshot, classifier) {
    const modules = new Map(snapshot.manifest.modules.map((item) => [item.currentPath, item]));
    const boundaries = new Map(snapshot.policy.targetBoundaries.map((item) => [item.id, item]));
    const diagnostics = [];
    for (const edge of snapshot.graph.edges) {
      const source = modules.get(edge.source), target = modules.get(edge.target);
      if (!source || !target) {
        diagnostics.push(classifier.classify(this.#violation("missing-module-metadata", edge.source, edge.target, "Unified edge lacks authoritative manifest metadata", edge), { debtEligible: false }));
        continue;
      }
      const sourceBoundary = boundaries.get(source.architecture.targetBoundary);
      if (!sourceBoundary?.allowedDependencies.includes(target.architecture.targetBoundary)) {
        diagnostics.push(classifier.classify(this.#violation("boundary-dependency", edge.source, edge.target, `${source.architecture.targetBoundary} cannot depend on ${target.architecture.targetBoundary}`, edge), { exceptionRule: "forbidden-dependency", exceptionSubject: target.architecture.targetBoundary }));
        continue;
      }
      const qualified = snapshot.policy.qualifiedDependencies.find((rule) => rule.sourceBoundary === source.architecture.targetBoundary && rule.targetBoundary === target.architecture.targetBoundary);
      if (qualified && !target.architecture.roles.some((role) => qualified.allowedTargetModuleRoles.includes(role))) {
        diagnostics.push(classifier.classify(this.#violation("qualified-role", edge.source, edge.target, `${qualified.id} requires target role ${qualified.allowedTargetModuleRoles.join("/")}`, edge), { exceptionRule: "forbidden-dependency", exceptionSubject: qualified.id }));
      }
    }
    return diagnostics;
  }
  #violation(rule, source, target, message, edge) { return { rule, source, target, location: edge?.provenance?.find((item) => item.location)?.location || null, message, identity: { rule, source, target } }; }
}

module.exports = { BoundaryGuard };
