const path = require("node:path");
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
  ManifestEntryFactory,
} = require("./migration/manifest_entry_factory");
const {
  MigrationManifestReconciler,
} = require("./migration/migration_manifest_reconciler");
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
  SourceFileScanner,
} = require("./migration/source_file_scanner");
const {
  StageTwoRuntimeScriptAliasResolver,
} = require("./migration/stage_two_runtime_script_alias_resolver");

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

class ReconcileMigrationManifestCommand {
  constructor({
    policy,
    sourceFileScanner,
    legacyScriptOrderReader,
    repository,
    schemaMigrator,
    reconciler,
    validator,
    canonicalPath,
    currentAreaResolver,
  }) {
    this.policy = policy;
    this.sourceFileScanner = sourceFileScanner;
    this.legacyScriptOrderReader = legacyScriptOrderReader;
    this.repository = repository;
    this.schemaMigrator = schemaMigrator;
    this.reconciler = reconciler;
    this.validator = validator;
    this.canonicalPath = canonicalPath;
    this.currentAreaResolver = currentAreaResolver;
  }

  run() {
    const sourceFiles = this.sourceFileScanner.scan();
    const legacyScripts = this.legacyScriptOrderReader.read();
    const existingManifest = this.schemaMigrator.migrate(
      this.repository.read(),
    );
    const manifest = this.reconciler.reconcile({
      existingManifest,
      sourceFiles,
      legacyScripts,
    });
    this.validator.validate({
      manifest,
      policy: this.policy,
      sourceFiles,
      legacyScripts,
      canonicalPath: this.canonicalPath,
      currentAreaResolver: this.currentAreaResolver,
    });
    this.repository.write(manifest);
    console.log(
      `Migration manifest reconciled: ${manifest.modules.length} entries for ` +
        `${sourceFiles.length} current src/**/*.js files.`,
    );
  }
}

const policy = ArchitecturePolicy.load(POLICY_PATH);
const scriptAliases = new StageTwoRuntimeScriptAliasResolver().loadProject(
  PROJECT_ROOT,
);
const currentAreaResolver = new CurrentAreaResolver({
  rootValue: policy.migrationManifest.currentArea.rootValue,
});
const entryFactory = new ManifestEntryFactory({
  manifestPolicy: policy.migrationManifest,
  currentAreaResolver,
});
new ReconcileMigrationManifestCommand({
  policy,
  sourceFileScanner: new SourceFileScanner({
    projectRoot: PROJECT_ROOT,
    sourceRoot: SOURCE_ROOT,
  }),
  legacyScriptOrderReader: new LegacyScriptOrderReader(INDEX_PATH, {
    scriptAliases,
  }),
  repository: new MigrationManifestRepository(MANIFEST_PATH),
  schemaMigrator: createMigrationManifestSchemaMigrator(
    policy.migrationManifest,
  ),
  reconciler: new MigrationManifestReconciler({
    schemaVersion: policy.migrationManifest.schemaVersion,
    entryFactory,
  }),
  validator: createMigrationManifestValidator(),
  canonicalPath: new CanonicalModulePath(),
  currentAreaResolver,
}).run();
