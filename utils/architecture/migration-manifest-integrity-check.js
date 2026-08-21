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
  MigrationManifestRepository,
} = require("./migration/migration_manifest_repository");
const {
  createMigrationManifestValidator,
} = require("./migration/migration_manifest_validator");
const {
  SourceFileScanner,
} = require("./migration/source_file_scanner");

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

class MigrationManifestIntegrityCheck {
  constructor({
    policy,
    sourceFileScanner,
    legacyScriptOrderReader,
    repository,
    validator,
    canonicalPath,
    currentAreaResolver,
  }) {
    this.policy = policy;
    this.sourceFileScanner = sourceFileScanner;
    this.legacyScriptOrderReader = legacyScriptOrderReader;
    this.repository = repository;
    this.validator = validator;
    this.canonicalPath = canonicalPath;
    this.currentAreaResolver = currentAreaResolver;
  }

  run() {
    const manifest = this.repository.read();
    if (!manifest) {
      throw new Error("Migration manifest is missing");
    }
    const sourceFiles = this.sourceFileScanner.scan();
    const legacyScripts = this.legacyScriptOrderReader.read();
    this.validator.validate({
      manifest,
      policy: this.policy,
      sourceFiles,
      legacyScripts,
      canonicalPath: this.canonicalPath,
      currentAreaResolver: this.currentAreaResolver,
    });
    console.log(
      `Migration manifest integrity passed: ${manifest.modules.length}/${sourceFiles.length} ` +
        "actual src/**/*.js files tracked.",
    );
  }
}

const policy = ArchitecturePolicy.load(POLICY_PATH);
const currentAreaResolver = new CurrentAreaResolver({
  rootValue: policy.migrationManifest.currentArea.rootValue,
});
new MigrationManifestIntegrityCheck({
  policy,
  sourceFileScanner: new SourceFileScanner({
    projectRoot: PROJECT_ROOT,
    sourceRoot: SOURCE_ROOT,
  }),
  legacyScriptOrderReader: new LegacyScriptOrderReader(INDEX_PATH),
  repository: new MigrationManifestRepository(MANIFEST_PATH),
  validator: createMigrationManifestValidator(),
  canonicalPath: new CanonicalModulePath(),
  currentAreaResolver,
}).run();
