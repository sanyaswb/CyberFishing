class PersistMigrationObservationsCommand {
  constructor({
    policy,
    sourceFileScanner,
    legacyScriptOrderReader,
    snapshotBuilder,
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
    this.snapshotBuilder = snapshotBuilder;
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
    const observationPatches = this.snapshotBuilder.build({
      sourceFiles,
      legacyScripts,
    });
    const existingManifest = this.schemaMigrator.migrate(
      this.repository.read(),
    );
    const manifest = this.reconciler.reconcile({
      existingManifest,
      observationPatches,
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
    return this.#summarize(manifest);
  }

  #summarize(manifest) {
    const summary = {
      modules: manifest.modules.length,
      providers: 0,
      consumers: 0,
      confirmed: 0,
      unresolved: 0,
      ambiguous: 0,
      edges: 0,
    };
    for (const entry of manifest.modules) {
      summary.providers += entry.observed.providers.items.length;
      summary.consumers += entry.observed.consumers.items.length;
      summary.confirmed += entry.analysis.dependencies.confirmed.length;
      summary.unresolved += entry.analysis.dependencies.unresolved.length;
      summary.ambiguous += entry.analysis.dependencies.ambiguous.length;
      summary.edges += entry.analysis.dependencies.items.length;
    }
    return summary;
  }
}

module.exports = { PersistMigrationObservationsCommand };
