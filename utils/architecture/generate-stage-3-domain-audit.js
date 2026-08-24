const fs = require("node:fs");
const path = require("node:path");
const { DomainAuditArtifactWriter } = require("./domain_audit/domain_audit_artifact_writer");
const { DomainAuditContract } = require("./domain_audit/domain_audit_contract");
const { DomainAuditRepository } = require("./domain_audit/domain_audit_repository");
const {
  DomainAuditSchemaMigrator,
} = require("./domain_audit/domain_audit_schema_migrator");
const { DomainAuditValidator } = require("./domain_audit/domain_audit_validator");
const {
  ConservativeDomainInventoryBuilder,
} = require("./domain_audit/conservative_domain_inventory_builder");
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
  DomainDependencyAuditPipeline,
} = require("./domain_audit/domain_dependency_audit_pipeline");
const {
  DomainDependencyAuditPersistence,
} = require("./domain_audit/domain_dependency_audit_persistence");
const {
  DomainSemanticAuditPipeline,
} = require("./domain_audit/domain_semantic_audit_pipeline");
const {
  DomainSemanticAuditPersistence,
} = require("./domain_audit/domain_semantic_audit_persistence");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const MANIFEST_PATH = path.join(
  PROJECT_ROOT,
  "architecture",
  "migration",
  "module_migration_manifest.json",
);
const AUDIT_PATH = path.join(
  PROJECT_ROOT,
  "architecture",
  "migration",
  "stage_3_domain_audit.json",
);
const PACKAGE_PATH = path.join(PROJECT_ROOT, "package.json");
const POLICY_PATH = path.join(PROJECT_ROOT, "architecture", "module_architecture.json");
const BRIDGE_PATH = path.join(PROJECT_ROOT, "architecture", "guards", "migration_bridge_registry.json");
const GLOBALS_PATH = path.join(PROJECT_ROOT, "architecture", "guards", "global_provider_baseline.json");
const DEBT_PATH = path.join(PROJECT_ROOT, "architecture", "guards", "known_debt_registry.json");

class GenerateStageThreeDomainAuditCommand {
  constructor({
    contract,
    builder,
    validator,
    migrator,
    repository,
    writer,
    graphBuilder,
    topologyAnalyzer,
    persistence,
    semanticPersistence,
  }) {
    this.contract = contract;
    this.builder = builder;
    this.validator = validator;
    this.migrator = migrator;
    this.repository = repository;
    this.writer = writer;
    this.graphBuilder = graphBuilder;
    this.topologyAnalyzer = topologyAnalyzer;
    this.persistence = persistence;
    this.semanticPersistence = semanticPersistence;
  }

  run() {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
    const releaseVersion = JSON.parse(
      fs.readFileSync(PACKAGE_PATH, "utf8"),
    ).version;
    const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
    const policy = read(POLICY_PATH);
    const existingDocument = this.repository.exists()
      ? this.migrator.migrate(this.repository.read().snapshot())
      : null;
    const inventoryDocument = this.builder.build({ manifest, releaseVersion });
    const snapshot = new ArchitectureGuardSnapshotBuilder({
      projectRoot: PROJECT_ROOT,
      policy,
      manifest,
      bridgeRegistry: read(BRIDGE_PATH),
      globalBaseline: read(GLOBALS_PATH),
      debtRegistry: read(DEBT_PATH),
    }).build();
    const graph = this.graphBuilder.build({
      manifest,
      unifiedGraph: snapshot.graph,
    });
    const topology = this.topologyAnalyzer.analyze(graph);
    const analyses = new DomainDependencyAuditPipeline({
      projectRoot: PROJECT_ROOT,
      policy,
    }).observe({ manifest, graph, topology });
    const dependencyDocument = this.persistence.apply({
      inventoryDocument,
      existingDocument,
      analyses,
    });
    const semanticAnalyses = new DomainSemanticAuditPipeline({
      projectRoot: PROJECT_ROOT,
    }).observe({ manifest, dependencyAnalyses: analyses });
    const document = this.semanticPersistence.apply({
      dependencyAuditDocument: dependencyDocument,
      analyses: semanticAnalyses,
    });
    this.validator.validate(document, {
      expectedInventory: inventoryDocument,
    });
    this.writer.write(document);
    console.log(
      `Stage 3 domain audit generated: ${document.entries.length} exact ` +
        `${this.contract.scopeRule.value} entries with persisted dependency, ` +
        `state, configuration and performance facts for v${releaseVersion}.`,
    );
  }
}

const contract = new DomainAuditContract();
new GenerateStageThreeDomainAuditCommand({
  contract,
  builder: new ConservativeDomainInventoryBuilder(contract),
  validator: new DomainAuditValidator(contract),
  migrator: new DomainAuditSchemaMigrator(contract),
  repository: new DomainAuditRepository(AUDIT_PATH),
  writer: new DomainAuditArtifactWriter(AUDIT_PATH),
  graphBuilder: new InducedDomainGraphBuilder(),
  topologyAnalyzer: new DomainDependencyTopologyAnalyzer(),
  persistence: new DomainDependencyAuditPersistence(),
  semanticPersistence: new DomainSemanticAuditPersistence(),
}).run();
