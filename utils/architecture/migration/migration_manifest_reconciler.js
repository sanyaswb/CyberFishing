class MigrationManifestReconciler {
  constructor({ schemaVersion, entryFactory }) {
    this.schemaVersion = schemaVersion;
    this.entryFactory = entryFactory;
  }

  reconcile({ existingManifest, sourceFiles, legacyScripts }) {
    this.#assertSupportedSchema(existingManifest);
    const existingEntries = existingManifest?.modules || [];
    const existingByPath = this.#indexExistingEntries(existingEntries);
    const loadOrderByPath = this.#indexLegacyOrder(legacyScripts);
    const sourcePaths = new Set(sourceFiles.map((file) => file.currentPath));

    const modules = sourceFiles.map((sourceFile) =>
      this.entryFactory.reconcile(
        existingByPath.get(sourceFile.currentPath),
        sourceFile,
        loadOrderByPath.get(sourceFile.currentPath) ?? null,
      ),
    );

    for (const entry of existingEntries) {
      if (!sourcePaths.has(entry.currentPath)) modules.push(entry);
    }

    modules.sort((left, right) =>
      this.#comparePaths(left.currentPath, right.currentPath),
    );
    return {
      schemaVersion: this.schemaVersion,
      modules,
    };
  }

  #assertSupportedSchema(existingManifest) {
    if (
      existingManifest &&
      existingManifest.schemaVersion !== this.schemaVersion
    ) {
      throw new Error(
        `Cannot reconcile migration manifest schema ${existingManifest.schemaVersion}; ` +
          `supported schema is ${this.schemaVersion}.`,
      );
    }
  }

  #indexExistingEntries(entries) {
    const entriesByPath = new Map();
    for (const entry of entries) {
      if (entriesByPath.has(entry.currentPath)) {
        throw new Error(
          `Cannot reconcile duplicate manifest entry: ${entry.currentPath}`,
        );
      }
      entriesByPath.set(entry.currentPath, entry);
    }
    return entriesByPath;
  }

  #indexLegacyOrder(scripts) {
    const loadOrderByPath = new Map();
    for (const script of scripts) {
      if (script.type !== "classic") continue;
      if (loadOrderByPath.has(script.currentPath)) {
        throw new Error(
          `Cannot reconcile duplicate legacy script: ${script.currentPath}`,
        );
      }
      loadOrderByPath.set(script.currentPath, script.legacyLoadOrder);
    }
    return loadOrderByPath;
  }

  #comparePaths(left, right) {
    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
  }
}

module.exports = { MigrationManifestReconciler };
