class MigrationObservationReconciler {
  constructor(schemaVersion) {
    this.schemaVersion = schemaVersion;
  }

  reconcile({ existingManifest, observationPatches }) {
    this.#assertManifest(existingManifest);
    const patches = this.#indexPatches(observationPatches);
    this.#assertSameScope(existingManifest.modules, patches);
    const modules = existingManifest.modules
      .map((entry) => this.#reconcileEntry(entry, patches.get(entry.currentPath)))
      .sort((left, right) =>
        this.#compareText(left.currentPath, right.currentPath),
      );
    return {
      ...this.#clone(existingManifest),
      schemaVersion: this.schemaVersion,
      modules,
    };
  }

  #reconcileEntry(entry, patch) {
    return {
      currentPath: entry.currentPath,
      currentArea: entry.currentArea,
      observed: {
        legacyLoadOrder: entry.observed.legacyLoadOrder,
        providers: this.#clone(patch.observed.providers),
        consumers: this.#clone(patch.observed.consumers),
        environment: this.#clone(patch.observed.environment),
      },
      architecture: this.#clone(entry.architecture),
      analysis: {
        dependencies: this.#clone(patch.dependencies),
        blockers: this.#clone(entry.analysis.blockers),
      },
    };
  }

  #assertManifest(manifest) {
    if (!manifest || manifest.schemaVersion !== this.schemaVersion) {
      throw new Error(
        `Observation persistence requires manifest schema v${this.schemaVersion}`,
      );
    }
    if (!Array.isArray(manifest.modules)) {
      throw new Error("Observation persistence requires manifest modules");
    }
  }

  #indexPatches(patches) {
    const indexed = new Map();
    for (const patch of patches) {
      if (indexed.has(patch.currentPath)) {
        throw new Error(`Duplicate observation patch: ${patch.currentPath}`);
      }
      indexed.set(patch.currentPath, patch);
    }
    return indexed;
  }

  #assertSameScope(entries, patches) {
    const entryPaths = entries.map((entry) => entry.currentPath).sort();
    const patchPaths = [...patches.keys()].sort();
    if (
      entryPaths.length !== patchPaths.length ||
      entryPaths.some((currentPath, index) =>
        currentPath !== patchPaths[index]
      )
    ) {
      throw new Error(
        "Manifest/source scope mismatch; run architecture:manifest before observation persistence",
      );
    }
  }

  #clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  #compareText(left, right) {
    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
  }
}

module.exports = { MigrationObservationReconciler };
