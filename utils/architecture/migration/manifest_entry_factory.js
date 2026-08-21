class ManifestEntryFactory {
  constructor({ manifestPolicy, currentAreaResolver }) {
    this.manifestPolicy = manifestPolicy;
    this.currentAreaResolver = currentAreaResolver;
  }

  create(sourceFile, legacyLoadOrder) {
    return {
      currentPath: sourceFile.currentPath,
      currentArea: this.currentAreaResolver.resolve(sourceFile.currentPath),
      observed: {
        legacyLoadOrder,
        ...this.#clone(this.manifestPolicy.initialObserved),
      },
      architecture: this.#clone(
        this.manifestPolicy.initialArchitecture,
      ),
      analysis: this.#clone(this.manifestPolicy.initialAnalysis),
    };
  }

  reconcile(existingEntry, sourceFile, legacyLoadOrder) {
    if (!existingEntry) return this.create(sourceFile, legacyLoadOrder);
    return {
      currentPath: sourceFile.currentPath,
      currentArea: this.currentAreaResolver.resolve(sourceFile.currentPath),
      observed: {
        ...(existingEntry.observed || {}),
        legacyLoadOrder,
      },
      architecture: this.#clone(existingEntry.architecture),
      analysis: this.#clone(existingEntry.analysis),
    };
  }

  #clone(value) {
    return value === undefined
      ? undefined
      : JSON.parse(JSON.stringify(value));
  }
}

module.exports = { ManifestEntryFactory };
