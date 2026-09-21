const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const architecture = require("../../architecture/module_architecture.json");
const { historicalManifestBytes, readPendingTargetTransition } = require("./domain_batches/stage_three_pending_target_manifest");
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
const {
  StageTwoRuntimeScriptAliasResolver,
} = require("./migration/stage_two_runtime_script_alias_resolver");

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
    // Scan every live source. Pending persistence is permitted only for exact,
    // approved prebuild targets; existing observations must still reconcile exactly.
    const pendingTransition = readPendingTargetTransition(PROJECT_ROOT);
    historicalManifestBytes(Buffer.from(manifestText), PROJECT_ROOT);
    const pendingPaths = new Set(manifest.modules.filter((entry) => entry.observed.providers.status === "pending")
      .map((entry) => entry.currentPath));
    const allowedPaths = new Set((pendingTransition?.records || []).map((entry) => entry.currentPath));
    const { Batch008CutoverHistory } = require("./domain_batches/stage_three_batch_008_cutover_history");
    const history = new Batch008CutoverHistory(PROJECT_ROOT);
    if (history.active()) {
      for (const item of history.json("architecture/migration/stage_3_batch_008_source_build_validation.json").sources) {
        allowedPaths.add(item.currentPath);
      }
    }
    const { OUTPUT: observationEvidence } = require("./domain_batches/stage_three_batch_008_observation_transition");
    if (fs.existsSync(path.join(PROJECT_ROOT, observationEvidence))) {
      // The exact transition was validated above. After persistence no pending
      // substitution is permitted: compare every live fact in every source.
      allowedPaths.clear();
    }
    const batch009 = new (require("./domain_batches/stage_three_batch_009_cutover_history").Batch009CutoverHistory)(PROJECT_ROOT);
    if (batch009.active()) {
      const cutover = batch009.artifact();
      batch009.before("architecture/migration/module_migration_manifest.json", Buffer.from(manifestText));
      for (const file of cutover.manifestTransition.pendingPaths) allowedPaths.add(file);
    }
    assert.deepEqual([...pendingPaths].sort(), [...allowedPaths].sort(), "Unexpected pending observation scope");
    const pendingByPath = new Map(manifest.modules.filter((entry) => pendingPaths.has(entry.currentPath))
      .map((entry) => [entry.currentPath, entry]));
    reconciled.modules = reconciled.modules.map((entry) => pendingPaths.has(entry.currentPath)
      ? structuredClone(pendingByPath.get(entry.currentPath)) : entry);
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
    assert.equal(stats.pendingGroups, pendingPaths.size * 4,
      "Only exact approved prebuild target observation groups may remain pending");
    console.log(
      `Migration observation persistence corpus passed (${pendingPaths.size} exact pending modules; full live scan): ` +
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
const scriptAliases = new StageTwoRuntimeScriptAliasResolver().loadProject(
  PROJECT_ROOT,
);
new MigrationObservationPersistenceCorpusCheck({
  sourceFileScanner: new SourceFileScanner({
    projectRoot: PROJECT_ROOT,
    sourceRoot: SOURCE_ROOT,
  }),
  legacyScriptOrderReader: new LegacyScriptOrderReader(
    path.join(PROJECT_ROOT, "index.html"),
    { scriptAliases },
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
