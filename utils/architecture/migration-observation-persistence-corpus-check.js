const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const architecture = require("../../architecture/module_architecture.json");
const {
  SourceFileScanner,
} = require("./migration/source_file_scanner");
const {
  LegacyScriptOrderReader,
} = require("./migration/legacy_script_order_reader");
const {
  MigrationObservationReconciler,
} = require("./migration/migration_observation_reconciler");
const {
  LegacySymbolProviderScannerFactory,
} = require("./observation/providers/legacy_symbol_provider_scanner");
const {
  LegacyExternalConsumerScannerFactory,
} = require("./observation/consumers/legacy_external_consumer_scanner");
const {
  LegacyDependencyGraphAnalyzerFactory,
} = require(
  "./observation/resolution/legacy_dependency_graph_analyzer"
);
const {
  ManifestDependencyProjector,
} = require("./observation/persistence/manifest_dependency_projector");
const {
  ObservationManifestProjector,
} = require("./observation/persistence/observation_manifest_projector");
const {
  MigrationObservationSnapshotBuilder,
} = require(
  "./observation/persistence/migration_observation_snapshot_builder"
);

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const SOURCE_ROOT = path.join(PROJECT_ROOT, "src");
const MANIFEST_PATH = path.join(
  PROJECT_ROOT,
  "architecture",
  "migration",
  "module_migration_manifest.json",
);

class MigrationObservationPersistenceCorpusCheck {
  constructor({
    sourceFileScanner,
    legacyScriptOrderReader,
    snapshotBuilder,
    reconciler,
    manifestPath,
  }) {
    this.sourceFileScanner = sourceFileScanner;
    this.legacyScriptOrderReader = legacyScriptOrderReader;
    this.snapshotBuilder = snapshotBuilder;
    this.reconciler = reconciler;
    this.manifestPath = manifestPath;
  }

  run() {
    const manifestText = fs.readFileSync(this.manifestPath, "utf8");
    const manifest = JSON.parse(manifestText);
    const request = {
      sourceFiles: this.sourceFileScanner.scan(),
      legacyScripts: this.legacyScriptOrderReader.read(),
    };
    const first = this.snapshotBuilder.build(request);
    const second = this.snapshotBuilder.build(request);
    assert.deepEqual(second, first, "Observation snapshot must be deterministic");

    const reconciled = this.reconciler.reconcile({
      existingManifest: manifest,
      observationPatches: first,
    });
    const expectedText = `${JSON.stringify(reconciled, null, 2)}\n`;
    assert.equal(
      manifestText,
      expectedText,
      "Migration observations are stale; run architecture:observe",
    );
    assert.equal(
      fs.readFileSync(this.manifestPath, "utf8"),
      manifestText,
      "Persistence corpus check must remain read-only",
    );

    const stats = this.#summarize(manifest);
    assert.equal(stats.modules, request.sourceFiles.length);
    assert.equal(
      stats.confirmed + stats.unresolved + stats.ambiguous,
      stats.consumers,
      "Every persisted consumer requires exactly one resolution result",
    );
    assert.equal(stats.pendingGroups, 0, "Persisted observations cannot be pending");
    console.log(
      "Migration observation persistence corpus passed: " +
        `${stats.modules} modules, ${stats.providers} providers, ` +
        `${stats.consumers} consumers, ${stats.confirmed} confirmed, ` +
        `${stats.unresolved} unresolved, ${stats.ambiguous} ambiguous, ` +
        `${stats.edges} inter-file edges; byte-stable and current.`,
    );
  }

  #summarize(manifest) {
    const stats = {
      modules: manifest.modules.length,
      providers: 0,
      consumers: 0,
      confirmed: 0,
      unresolved: 0,
      ambiguous: 0,
      edges: 0,
      pendingGroups: 0,
    };
    for (const entry of manifest.modules) {
      const dependencies = entry.analysis.dependencies;
      stats.providers += entry.observed.providers.items.length;
      stats.consumers += entry.observed.consumers.items.length;
      stats.confirmed += dependencies.confirmed.length;
      stats.unresolved += dependencies.unresolved.length;
      stats.ambiguous += dependencies.ambiguous.length;
      stats.edges += dependencies.items.length;
      for (const status of [
        entry.observed.providers.status,
        entry.observed.consumers.status,
        entry.observed.environment.status,
        dependencies.status,
      ]) {
        if (status === "pending") stats.pendingGroups += 1;
      }
    }
    return stats;
  }
}

const contract = architecture.migrationManifest.observationContract;
new MigrationObservationPersistenceCorpusCheck({
  sourceFileScanner: new SourceFileScanner({
    projectRoot: PROJECT_ROOT,
    sourceRoot: SOURCE_ROOT,
  }),
  legacyScriptOrderReader: new LegacyScriptOrderReader(
    path.join(PROJECT_ROOT, "index.html"),
  ),
  snapshotBuilder: new MigrationObservationSnapshotBuilder({
    sourceReader: (absolutePath) => fs.readFileSync(absolutePath, "utf8"),
    providerScanner: new LegacySymbolProviderScannerFactory().create(contract),
    consumerScanner: new LegacyExternalConsumerScannerFactory().create(contract),
    dependencyAnalyzer: new LegacyDependencyGraphAnalyzerFactory().create(
      contract.resolutionModel,
    ),
    projector: new ObservationManifestProjector(
      new ManifestDependencyProjector(),
    ),
  }),
  reconciler: new MigrationObservationReconciler(
    architecture.migrationManifest.schemaVersion,
  ),
  manifestPath: MANIFEST_PATH,
}).run();
