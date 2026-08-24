"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  ArchitectureGuardSnapshotBuilder,
} = require("./guards/corpus/architecture_guard_snapshot_builder");
const {
  InducedDomainGraphBuilder,
} = require("./domain_audit/induced_domain_graph_builder");
const {
  RepositoryContentSnapshot,
} = require("./esm_infrastructure/repository_content_snapshot");
const { DomainScopeSelector } = require("./domain_audit/domain_scope_selector");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const paths = {
  manifest: path.join(PROJECT_ROOT, "architecture/migration/module_migration_manifest.json"),
  audit: path.join(PROJECT_ROOT, "architecture/migration/stage_3_domain_audit.json"),
  policy: path.join(PROJECT_ROOT, "architecture/module_architecture.json"),
  bridges: path.join(PROJECT_ROOT, "architecture/guards/migration_bridge_registry.json"),
  globals: path.join(PROJECT_ROOT, "architecture/guards/global_provider_baseline.json"),
  debt: path.join(PROJECT_ROOT, "architecture/guards/known_debt_registry.json"),
};

class StageThreeInducedDomainGraphCorpusCheck {
  constructor({ contentSnapshot, graphBuilder }) {
    this.contentSnapshot = contentSnapshot;
    this.graphBuilder = graphBuilder;
  }

  run() {
    const before = this.contentSnapshot.capture();
    const manifestBytes = fs.readFileSync(paths.manifest, "utf8");
    const auditBytes = fs.readFileSync(paths.audit, "utf8");
    const manifest = JSON.parse(manifestBytes);
    const audit = JSON.parse(auditBytes);
    const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
    const snapshot = new ArchitectureGuardSnapshotBuilder({
      projectRoot: PROJECT_ROOT,
      policy: read(paths.policy),
      manifest,
      bridgeRegistry: read(paths.bridges),
      globalBaseline: read(paths.globals),
      debtRegistry: read(paths.debt),
    }).build();
    const graph = this.graphBuilder.build({
      manifest,
      unifiedGraph: snapshot.graph,
    });
    const repeated = this.graphBuilder.build({
      manifest,
      unifiedGraph: snapshot.graph,
    });
    assert.deepEqual(repeated.snapshot(), graph.snapshot());

    const scopeSelector = new DomainScopeSelector();
    const scope = new Set(manifest.modules
      .filter((entry) => scopeSelector.includes(entry))
      .map((entry) => entry.currentPath));
    assert.deepEqual(graph.nodes(), [...scope].sort());
    assert.equal(
      graph.internalDependencies().length,
      snapshot.graph.edges.filter((edge) =>
        scope.has(edge.source) && scope.has(edge.target) && edge.source !== edge.target
      ).length,
    );
    assert.equal(
      graph.externalDependencies().length,
      snapshot.graph.edges.filter((edge) =>
        scope.has(edge.source) && !scope.has(edge.target) && edge.source !== edge.target
      ).length,
    );
    assert.equal(
      graph.incomingDependencies().length,
      snapshot.graph.edges.filter((edge) =>
        scope.has(edge.target) && edge.source !== edge.target
      ).length,
    );
    this.#assertConfirmedLegacyProvenance(manifest, graph, scope);
    this.#assertNoSpeculativeEdges(manifest, graph);
    assert(audit.entries.every((entry) => entry.dependencyAudit.facts !== null));
    assert.equal(fs.readFileSync(paths.manifest, "utf8"), manifestBytes);
    assert.equal(fs.readFileSync(paths.audit, "utf8"), auditBytes);
    assert.deepEqual(this.contentSnapshot.capture(), before);

    const boundaryCounts = new Map();
    for (const edge of graph.externalDependencies()) {
      const boundary = edge.targetBoundary || "unclassified";
      boundaryCounts.set(boundary, (boundaryCounts.get(boundary) || 0) + 1);
    }
    const boundarySummary = [...boundaryCounts]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([boundary, count]) => `${boundary}=${count}`)
      .join(", ");
    console.log(
      "Stage 3 induced domain corpus passed read-only: " +
        `${graph.nodes().length} exact game-domain nodes, ` +
        `${graph.internalDependencies().length} internal edges, ` +
        `${graph.externalDependencies().length} external edges (${boundarySummary}), ` +
        `${graph.incomingDependencies().length} derived incoming links, ` +
        `${graph.fingerprint}; persisted audit bytes unchanged.`,
    );
  }

  #assertConfirmedLegacyProvenance(manifest, graph, scope) {
    const projected = new Map([
      ...graph.internalDependencies(),
      ...graph.externalDependencies(),
    ].map((edge) => [`${edge.source}\u0000${edge.target}`, edge]));
    for (const entry of manifest.modules.filter((item) => scope.has(item.currentPath))) {
      for (const observation of entry.analysis.dependencies.confirmed) {
        if (observation.resolution !== "confirmed") continue;
        const edge = projected.get(`${entry.currentPath}\u0000${observation.target}`);
        assert(edge, `${entry.currentPath} → ${observation.target} must be projected`);
        assert(edge.symbols.includes(observation.symbol));
        assert(edge.executionPhases.includes(observation.executionPhase));
      }
    }
  }

  #assertNoSpeculativeEdges(manifest, graph) {
    const keys = new Set([
      ...graph.internalDependencies(),
      ...graph.externalDependencies(),
    ].map((edge) => `${edge.source}\u0000${edge.target}`));
    for (const entry of manifest.modules) {
      const confirmedTargets = new Set(entry.analysis.dependencies.confirmed
        .filter((item) => item.resolution === "confirmed")
        .map((item) => item.target));
      for (const observation of [
        ...entry.analysis.dependencies.unresolved,
        ...entry.analysis.dependencies.ambiguous,
      ]) {
        if (observation.target && !confirmedTargets.has(observation.target)) {
          assert(!keys.has(`${entry.currentPath}\u0000${observation.target}`));
        }
      }
    }
  }
}

new StageThreeInducedDomainGraphCorpusCheck({
  contentSnapshot: new RepositoryContentSnapshot(PROJECT_ROOT),
  graphBuilder: new InducedDomainGraphBuilder(),
}).run();
