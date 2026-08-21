class MigrationObservationSnapshotBuilder {
  constructor({
    sourceReader,
    providerScanner,
    consumerScanner,
    dependencyAnalyzer,
    projector,
  }) {
    this.sourceReader = sourceReader;
    this.providerScanner = providerScanner;
    this.consumerScanner = consumerScanner;
    this.dependencyAnalyzer = dependencyAnalyzer;
    this.projector = projector;
  }

  build({ sourceFiles, legacyScripts }) {
    const observations = this.#scan(sourceFiles);
    const resolutionResult = this.dependencyAnalyzer.analyze({
      providerObservations: observations.providers,
      consumerObservations: observations.consumers,
      legacyScripts,
    });
    return this.projector.project({
      providerObservations: observations.providers,
      consumerObservations: observations.consumers,
      resolutionResult,
    });
  }

  #scan(sourceFiles) {
    const providers = [];
    const consumers = [];
    for (const sourceFile of sourceFiles) {
      const request = {
        currentPath: sourceFile.currentPath,
        source: this.sourceReader(sourceFile.absolutePath),
      };
      providers.push(this.providerScanner.scan(request));
      consumers.push(this.consumerScanner.scan(request));
    }
    return { providers, consumers };
  }
}

module.exports = { MigrationObservationSnapshotBuilder };
