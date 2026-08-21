const fs = require("node:fs");
const path = require("node:path");

class PhysicalTargetPathGuard {
  constructor(projectRoot) { this.projectRoot = projectRoot; }
  run(snapshot, classifier) {
    const diagnostics = [];
    for (const module of snapshot.manifest.modules) {
      if (!["esm", "verified"].includes(module.architecture.migrationStatus)) continue;
      const targetPath = module.architecture.targetPath;
      const resolvedBoundary = this.#resolveBoundary(snapshot.policy.targetBoundaries, targetPath);
      if (module.currentPath !== targetPath || !fs.existsSync(path.resolve(this.projectRoot, targetPath)) || resolvedBoundary !== module.architecture.targetBoundary) {
        diagnostics.push(classifier.classify({ rule: "physical-target-path", source: module.currentPath, target: targetPath, location: null, message: "ESM/verified module must exist at its approved targetPath and boundary", identity: { rule: "physical-target-path", source: module.currentPath, target: targetPath } }, { debtEligible: false }));
      }
    }
    return diagnostics;
  }
  #resolveBoundary(boundaries, targetPath) {
    let best = null;
    for (const boundary of boundaries) for (const prefix of boundary.pathPrefixes) if (targetPath.startsWith(prefix) && (!best || prefix.length > best.prefix.length)) best = { id: boundary.id, prefix };
    return best?.id || null;
  }
}

module.exports = { PhysicalTargetPathGuard };
