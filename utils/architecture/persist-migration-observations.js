const path = require("node:path");
const fs = require("node:fs");
const { ArchitecturePolicy } = require("./core/architecture_policy");
const {
  CanonicalModulePath,
} = require("./migration/canonical_module_path");
const {
  CurrentAreaResolver,
} = require("./migration/current_area_resolver");
const {
  LegacyScriptOrderReader,
} = require("./migration/legacy_script_order_reader");
const {
  MigrationManifestRepository,
} = require("./migration/migration_manifest_repository");
const {
  createMigrationManifestSchemaMigrator,
} = require("./migration/migration_manifest_schema_migrator");
const {
  createMigrationManifestValidator,
} = require("./migration/migration_manifest_validator");
const {
  MigrationObservationReconciler,
} = require("./migration/migration_observation_reconciler");
const {
  PersistMigrationObservationsCommand,
} = require("./migration/persist_migration_observations_command");
const {
  SourceFileScanner,
} = require("./migration/source_file_scanner");
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
const INDEX_PATH = path.join(PROJECT_ROOT, "index.html");
const POLICY_PATH = path.join(
  PROJECT_ROOT,
  "architecture",
  "module_architecture.json",
);
const MANIFEST_PATH = path.join(
  PROJECT_ROOT,
  "architecture",
  "migration",
  "module_migration_manifest.json",
);

const policy = ArchitecturePolicy.load(POLICY_PATH);
const observationContract = policy.observationContract;
const currentAreaResolver = new CurrentAreaResolver({
  rootValue: policy.migrationManifest.currentArea.rootValue,
});
const summary = new PersistMigrationObservationsCommand({
  policy,
  sourceFileScanner: new SourceFileScanner({
    projectRoot: PROJECT_ROOT,
    sourceRoot: SOURCE_ROOT,
  }),
  legacyScriptOrderReader: new LegacyScriptOrderReader(INDEX_PATH),
  snapshotBuilder: new MigrationObservationSnapshotBuilder({
    sourceReader: (absolutePath) => fs.readFileSync(absolutePath, "utf8"),
    providerScanner: new LegacySymbolProviderScannerFactory().create(
      observationContract,
    ),
    consumerScanner: new LegacyExternalConsumerScannerFactory().create(
      observationContract,
    ),
    dependencyAnalyzer: new LegacyDependencyGraphAnalyzerFactory().create(
      observationContract.resolutionModel,
    ),
    projector: new ObservationManifestProjector(
      new ManifestDependencyProjector(),
    ),
  }),
  repository: new MigrationManifestRepository(MANIFEST_PATH),
  schemaMigrator: createMigrationManifestSchemaMigrator(
    policy.migrationManifest,
  ),
  reconciler: new MigrationObservationReconciler(
    policy.migrationManifest.schemaVersion,
  ),
  validator: createMigrationManifestValidator(),
  canonicalPath: new CanonicalModulePath(),
  currentAreaResolver,
}).run();

console.log(
  "Migration observations persisted: " +
    `${summary.modules} modules, ${summary.providers} providers, ` +
    `${summary.consumers} consumers, ${summary.confirmed} confirmed, ` +
    `${summary.unresolved} unresolved, ${summary.ambiguous} ambiguous, ` +
    `${summary.edges} inter-file edges.`,
);
