"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { ArchitectureGuardSnapshotBuilder } = require("./guards/corpus/architecture_guard_snapshot_builder");
const { DomainAuditContract } = require("./domain_audit/domain_audit_contract");
const { DomainAuditValidator } = require("./domain_audit/domain_audit_validator");
const { ConservativeDomainInventoryBuilder } = require("./domain_audit/conservative_domain_inventory_builder");
const { InducedDomainGraphBuilder } = require("./domain_audit/induced_domain_graph_builder");
const { DomainDependencyTopologyAnalyzer } = require("./domain_audit/domain_dependency_topology_analyzer");
const { DomainDependencyAuditPipeline } = require("./domain_audit/domain_dependency_audit_pipeline");
const { DomainDependencyAuditPersistence } = require("./domain_audit/domain_dependency_audit_persistence");
const { RepositoryContentSnapshot } = require("./esm_infrastructure/repository_content_snapshot");
const { StageThreeHistoricalAuditGuard } = require("./domain_audit/stage_three_historical_audit_guard");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const paths = {
  manifest: path.join(PROJECT_ROOT, "architecture/migration/module_migration_manifest.json"),
  audit: path.join(PROJECT_ROOT, "architecture/migration/stage_3_domain_audit.json"),
  policy: path.join(PROJECT_ROOT, "architecture/module_architecture.json"),
  bridges: path.join(PROJECT_ROOT, "architecture/guards/migration_bridge_registry.json"),
  globals: path.join(PROJECT_ROOT, "architecture/guards/global_provider_baseline.json"),
  debt: path.join(PROJECT_ROOT, "architecture/guards/known_debt_registry.json"),
  package: path.join(PROJECT_ROOT, "package.json"),
};
const EXPECTED_BASELINE = Object.freeze({
  entries: 135,
  internalEdges: 87,
  externalEdges: 21,
  reverseLinks: 246,
  components: 135,
  cycles: 0,
  minimumDepth: 0,
  maximumDepth: 3,
  allowedExternalEdges: 1,
  forbiddenExternalEdges: 20,
  capabilities: 2,
  availabilityConstraints: 114,
  topLevelEffects: 84,
  partialEntries: 0,
});

class StageThreeDependencyAuditIntegrationCheck {
  run() {
    const historicalGuard = new StageThreeHistoricalAuditGuard(PROJECT_ROOT);
    if (historicalGuard.isActive()) {
      const historical = historicalGuard.validate();
      console.log(`Stage 3 dependency audit remains frozen and exact after runtime activation: ${historical.entries} entries.`);
      return;
    }
    const contentSnapshot = new RepositoryContentSnapshot(PROJECT_ROOT);
    const repositoryBefore = contentSnapshot.capture();
    const manifestBytes = fs.readFileSync(paths.manifest, "utf8");
    const auditBytes = fs.readFileSync(paths.audit, "utf8");
    const manifest = JSON.parse(manifestBytes);
    const actual = JSON.parse(auditBytes);
    const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
    const policy = read(paths.policy);
    const contract = new DomainAuditContract();
    const inventoryBuilder = new ConservativeDomainInventoryBuilder(contract);
    const inventory = inventoryBuilder.build({
      manifest,
      releaseVersion: read(paths.package).version,
    });
    const snapshot = new ArchitectureGuardSnapshotBuilder({
      projectRoot: PROJECT_ROOT,
      policy,
      manifest,
      bridgeRegistry: read(paths.bridges),
      globalBaseline: read(paths.globals),
      debtRegistry: read(paths.debt),
    }).build();
    const graph = new InducedDomainGraphBuilder().build({
      manifest,
      unifiedGraph: snapshot.graph,
    });
    const topology = new DomainDependencyTopologyAnalyzer().analyze(graph);
    const pipeline = new DomainDependencyAuditPipeline({
      projectRoot: PROJECT_ROOT,
      policy,
    });
    const analyses = pipeline.observe({ manifest, graph, topology });
    assert.deepEqual(
      pipeline.observe({ manifest, graph, topology }),
      analyses,
      "Dependency audit observation must be deterministic",
    );
    const expected = new DomainDependencyAuditPersistence().apply({
      inventoryDocument: inventory,
      existingDocument: actual,
      analyses,
    });
    new DomainAuditValidator(contract).validate(actual, {
      expectedInventory: inventory,
    });
    assert.deepEqual(actual, expected, "Persisted dependency facts must equal live observations");
    assert.equal(
      auditBytes.replaceAll("\r\n", "\n"),
      `${JSON.stringify(expected, null, 2)}\n`,
      "Stage 3 dependency audit must be canonical and byte-stable",
    );

    const summary = this.#summary(actual);
    assert.deepEqual(summary, EXPECTED_BASELINE);
    assert(actual.entries.every((entry) =>
      entry.dependencyAudit.status === "verified" ||
      entry.dependencyAudit.status === "partial"
    ));
    assert(actual.entries.every((entry) => [
      entry.stateOwnership,
      entry.configurationInput,
      entry.performanceRisk,
    ].every((analysis) => analysis.status !== "pending" && analysis.facts !== null)));
    assert.equal(fs.readFileSync(paths.manifest, "utf8"), manifestBytes);
    assert.equal(fs.readFileSync(paths.audit, "utf8"), auditBytes);
    assert.deepEqual(contentSnapshot.capture(), repositoryBefore);

    console.log(
      "Stage 3 dependency audit integration passed read-only: " +
        `${summary.entries} entries, ${summary.internalEdges}/${summary.externalEdges} ` +
        `internal/external edges, ${summary.components} SCC/${summary.cycles} cycles, ` +
        `depth ${summary.minimumDepth}–${summary.maximumDepth}, ` +
        `${summary.allowedExternalEdges} allowed/${summary.forbiddenExternalEdges} forbidden external edges, ` +
        `${summary.capabilities} capability records, ${summary.availabilityConstraints} availability constraints, ` +
        `${summary.topLevelEffects} top-level effects and ${summary.partialEntries} partial entries; canonical and deterministic.`,
    );
  }

  #summary(document) {
    const facts = document.entries.map((entry) => entry.dependencyAudit.facts);
    const external = facts.flatMap((item) => item.externalDependencies);
    const depths = facts.map((item) => item.dependencyDepth);
    return {
      entries: document.entries.length,
      internalEdges: facts.reduce((total, item) => total + item.internalDependencies.length, 0),
      externalEdges: external.length,
      reverseLinks: facts.reduce((total, item) => total + item.reverseConsumers.length, 0),
      components: new Set(facts.map((item) => item.scc.id)).size,
      cycles: new Set(facts.filter((item) => item.scc.cyclic).map((item) => item.scc.id)).size,
      minimumDepth: Math.min(...depths),
      maximumDepth: Math.max(...depths),
      allowedExternalEdges: external.filter((edge) => edge.policy === "allowed").length,
      forbiddenExternalEdges: external.filter((edge) => edge.policy === "forbidden").length,
      capabilities: facts.reduce((total, item) => total + item.capabilities.length, 0),
      availabilityConstraints: facts.reduce((total, item) => total + item.availabilityConstraints.length, 0),
      topLevelEffects: facts.reduce((total, item) => total + item.topLevelEffects.length, 0),
      partialEntries: document.entries.filter((entry) => entry.dependencyAudit.status === "partial").length,
    };
  }
}

new StageThreeDependencyAuditIntegrationCheck().run();
