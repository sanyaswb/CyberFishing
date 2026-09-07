const fs = require("node:fs");
const path = require("node:path");
const { EsmDependencyObserver } = require("../observation/esm_dependency_observer");
const { UnifiedDependencyGraphBuilder } = require("../graph/unified_dependency_graph");
const { immutableRecord } = require("../core/guard_models");

class ArchitectureGuardSnapshotBuilder {
  constructor({ projectRoot, policy, manifest, bridgeRegistry, globalBaseline, debtRegistry }) {
    this.projectRoot = projectRoot; this.policy = policy; this.manifest = manifest;
    this.bridgeRegistry = bridgeRegistry; this.globalBaseline = globalBaseline; this.debtRegistry = debtRegistry;
  }

  build() {
    // Pending persistence must never disable enforcement of current source facts.
    // This projection is in-memory only; it does not approve or persist migration.
    const { LiveObservationSnapshot } = require("../../observation/persistence/live_observation_snapshot");
    const manifest = this.manifest.modules.some((item) => item.observed.providers.status === "pending")
      ? new LiveObservationSnapshot().build({ projectRoot: this.projectRoot, policy: this.policy, manifest: this.manifest })
      : this.manifest;
    const observer = new EsmDependencyObserver({ projectRoot: this.projectRoot });
    const sources = this.manifest.modules.map((module) => {
      const absolute = path.resolve(this.projectRoot, module.currentPath);
      const text = fs.readFileSync(absolute, "utf8");
      return { currentPath: module.currentPath, text, esm: observer.observeFile(module.currentPath, text) };
    });
    const graph = new UnifiedDependencyGraphBuilder().build({ manifest, esmResults: sources.map((item) => item.esm), bridgeRegistry: this.bridgeRegistry });
    return immutableRecord({ policy: this.policy, manifest, sources, graph, bridgeRegistry: this.bridgeRegistry, globalBaseline: this.globalBaseline, debtRegistry: this.debtRegistry });
  }
}

module.exports = { ArchitectureGuardSnapshotBuilder };
