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
const { DomainSemanticAuditPipeline } = require("./domain_audit/domain_semantic_audit_pipeline");
const { DomainSemanticAuditPersistence } = require("./domain_audit/domain_semantic_audit_persistence");
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
  stateVerified: 82,
  statePartial: 53,
  authoritativeOwners: 124,
  stateParticipants: 1,
  stateless: 10,
  stateIssues: 118,
  configurationVerified: 135,
  configurationModules: 8,
  configurationInputs: 9,
  forbiddenConfigReads: 9,
  performanceVerified: 135,
  directHotLoopModules: 12,
  allocationRiskModules: 10,
  deltaTimeReviewModules: 8,
  mixedUpdateRenderModules: 0,
});

class StageThreeSemanticAuditIntegrationCheck {
  run() {
    const historicalGuard = new StageThreeHistoricalAuditGuard(PROJECT_ROOT);
    if (historicalGuard.isActive()) {
      const historical = historicalGuard.validate();
      console.log(`Stage 3 semantic audit remains frozen and exact after runtime activation: ${historical.entries} entries.`);
      return;
    }
    const repositorySnapshot = new RepositoryContentSnapshot(PROJECT_ROOT);
    const before = repositorySnapshot.capture();
    const manifestBytes = fs.readFileSync(paths.manifest, "utf8");
    const auditBytes = fs.readFileSync(paths.audit, "utf8");
    const manifest = JSON.parse(manifestBytes);
    const actual = JSON.parse(auditBytes);
    const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
    const policy = read(paths.policy);
    const contract = new DomainAuditContract();
    const inventory = new ConservativeDomainInventoryBuilder(contract).build({
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
    const graph = new InducedDomainGraphBuilder().build({ manifest, unifiedGraph: snapshot.graph });
    const topology = new DomainDependencyTopologyAnalyzer().analyze(graph);
    const dependencyAnalyses = new DomainDependencyAuditPipeline({
      projectRoot: PROJECT_ROOT,
      policy,
    }).observe({ manifest, graph, topology });
    const dependencyDocument = new DomainDependencyAuditPersistence().apply({
      inventoryDocument: inventory,
      existingDocument: actual,
      analyses: dependencyAnalyses,
    });
    const pipeline = new DomainSemanticAuditPipeline({ projectRoot: PROJECT_ROOT });
    const semanticAnalyses = pipeline.observe({ manifest, dependencyAnalyses });
    assert.deepEqual(
      pipeline.observe({ manifest, dependencyAnalyses }),
      semanticAnalyses,
      "Semantic observations must be deterministic",
    );
    const expected = new DomainSemanticAuditPersistence().apply({
      dependencyAuditDocument: dependencyDocument,
      analyses: semanticAnalyses,
    });
    new DomainAuditValidator(contract).validate(actual, { expectedInventory: inventory });
    assert.deepEqual(actual, expected, "Persisted semantic facts must equal live observations");
    assert.equal(
      auditBytes.replaceAll("\r\n", "\n"),
      `${JSON.stringify(expected, null, 2)}\n`,
      "Semantic audit artifact must remain canonical and byte-stable",
    );
    const summary = this.#summary(actual);
    assert.deepEqual(summary, EXPECTED_BASELINE);
    assert(actual.entries.every((entry) => [
      entry.dependencyAudit,
      entry.stateOwnership,
      entry.configurationInput,
      entry.performanceRisk,
    ].every((analysis) => analysis.status !== "pending" && analysis.facts !== null)));
    assert.equal(fs.readFileSync(paths.manifest, "utf8"), manifestBytes);
    assert.equal(fs.readFileSync(paths.audit, "utf8"), auditBytes);
    assert.deepEqual(repositorySnapshot.capture(), before);
    console.log(
      "Stage 3 semantic audit integration passed read-only: " +
        `${summary.authoritativeOwners} state owners, ${summary.stateParticipants} participants, ` +
        `${summary.stateless} stateless, ${summary.statePartial} conservative partial state reviews, ` +
        `${summary.configurationInputs} config inputs/${summary.forbiddenConfigReads} forbidden direct reads, ` +
        `${summary.directHotLoopModules} direct hot-loop modules, ${summary.allocationRiskModules} allocation risks, ` +
        `${summary.deltaTimeReviewModules} deltaTime reviews and ${summary.mixedUpdateRenderModules} mixed update/render modules; ` +
        "canonical, deterministic and runtime-neutral.",
    );
  }

  #summary(document) {
    const count = (field, predicate) => document.entries.filter((entry) =>
      predicate(entry[field])
    ).length;
    return {
      entries: document.entries.length,
      stateVerified: count("stateOwnership", (analysis) => analysis.status === "verified"),
      statePartial: count("stateOwnership", (analysis) => analysis.status === "partial"),
      authoritativeOwners: count("stateOwnership", (analysis) => analysis.facts.classification === "authoritative-owner"),
      stateParticipants: count("stateOwnership", (analysis) => analysis.facts.classification === "state-participant"),
      stateless: count("stateOwnership", (analysis) => analysis.facts.classification === "stateless"),
      stateIssues: document.entries.reduce((total, entry) => total + entry.stateOwnership.facts.issues.length, 0),
      configurationVerified: count("configurationInput", (analysis) => analysis.status === "verified"),
      configurationModules: count("configurationInput", (analysis) => analysis.facts.inputs.length > 0),
      configurationInputs: document.entries.reduce((total, entry) => total + entry.configurationInput.facts.inputs.length, 0),
      forbiddenConfigReads: document.entries.reduce((total, entry) => total + entry.configurationInput.facts.forbiddenDirectReads.length, 0),
      performanceVerified: count("performanceRisk", (analysis) => analysis.status === "verified"),
      directHotLoopModules: count("performanceRisk", (analysis) => analysis.facts.hotLoopParticipation === "direct"),
      allocationRiskModules: count("performanceRisk", (analysis) => analysis.facts.perFrameAllocations === "observed"),
      deltaTimeReviewModules: count("performanceRisk", (analysis) => analysis.facts.deltaTimeSemantics === "requires-review"),
      mixedUpdateRenderModules: count("performanceRisk", (analysis) => analysis.facts.updateRenderSeparation === "mixed"),
    };
  }
}

new StageThreeSemanticAuditIntegrationCheck().run();
