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
  DomainDependencyTopologyAnalyzer,
} = require("./domain_audit/domain_dependency_topology_analyzer");
const {
  RepositoryContentSnapshot,
} = require("./esm_infrastructure/repository_content_snapshot");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const paths = {
  manifest: path.join(PROJECT_ROOT, "architecture/migration/module_migration_manifest.json"),
  audit: path.join(PROJECT_ROOT, "architecture/migration/stage_3_domain_audit.json"),
  policy: path.join(PROJECT_ROOT, "architecture/module_architecture.json"),
  bridges: path.join(PROJECT_ROOT, "architecture/guards/migration_bridge_registry.json"),
  globals: path.join(PROJECT_ROOT, "architecture/guards/global_provider_baseline.json"),
  debt: path.join(PROJECT_ROOT, "architecture/guards/known_debt_registry.json"),
};
const EXPECTED_BASELINE = Object.freeze({
  nodes: 135,
  components: 135,
  cycles: 0,
  minimumDepth: 0,
  maximumDepth: 3,
});

class StageThreeDomainTopologyCorpusCheck {
  constructor({ contentSnapshot, graphBuilder, analyzer }) {
    this.contentSnapshot = contentSnapshot;
    this.graphBuilder = graphBuilder;
    this.analyzer = analyzer;
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
    const graph = this.graphBuilder.build({ manifest, unifiedGraph: snapshot.graph });
    const topology = this.analyzer.analyze(graph);
    const repeated = this.analyzer.analyze(graph);
    assert.deepEqual(repeated.snapshot(), topology.snapshot());

    assert.deepEqual(
      {
        nodes: graph.nodes().length,
        components: topology.components().length,
        cycles: topology.cycles().length,
        minimumDepth: topology.minimumDepth,
        maximumDepth: topology.maximumDepth,
      },
      EXPECTED_BASELINE,
      "v0.24.36 Stage 3 domain topology acceptance baseline changed",
    );
    assert.equal(topology.depths().length, graph.nodes().length);
    assert.deepEqual(
      topology.depths().map((item) => item.currentPath),
      graph.nodes(),
      "Every exact domain node must have one deterministic depth",
    );
    assert(topology.components().every((component) => !component.cyclic));
    assert(audit.entries.every((entry) => entry.dependencyAudit.facts !== null));
    assert.equal(fs.readFileSync(paths.manifest, "utf8"), manifestBytes);
    assert.equal(fs.readFileSync(paths.audit, "utf8"), auditBytes);
    assert.deepEqual(this.contentSnapshot.capture(), before);

    const distribution = new Map();
    for (const record of topology.depths()) {
      distribution.set(record.depth, (distribution.get(record.depth) || 0) + 1);
    }
    const summary = [...distribution]
      .sort(([left], [right]) => left - right)
      .map(([depth, count]) => `${depth}=${count}`)
      .join(", ");
    console.log(
      "Stage 3 domain topology corpus passed read-only: " +
        `${topology.components().length} canonical SCC, ` +
        `${topology.cycles().length} structural cycles, depth ` +
        `${topology.minimumDepth}–${topology.maximumDepth} (${summary}), ` +
        `${topology.fingerprint}; persisted audit bytes unchanged.`,
    );
  }
}

new StageThreeDomainTopologyCorpusCheck({
  contentSnapshot: new RepositoryContentSnapshot(PROJECT_ROOT),
  graphBuilder: new InducedDomainGraphBuilder(),
  analyzer: new DomainDependencyTopologyAnalyzer(),
}).run();
