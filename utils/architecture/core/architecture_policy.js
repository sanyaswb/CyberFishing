const fs = require("node:fs");

class ArchitecturePolicy {
  #definition;
  #boundariesById;

  constructor(definition) {
    this.#definition = definition;
    this.#boundariesById = new Map(
      (definition.targetBoundaries || []).map((boundary) => [
        boundary.id,
        boundary,
      ]),
    );
  }

  static load(filePath) {
    return new ArchitecturePolicy(
      JSON.parse(fs.readFileSync(filePath, "utf8")),
    );
  }

  get definition() {
    return this.#definition;
  }

  get boundaries() {
    return this.#definition.targetBoundaries || [];
  }

  get moduleRoles() {
    return this.#definition.moduleRoles || [];
  }

  get qualifiedDependencies() {
    return this.#definition.qualifiedDependencies || [];
  }

  get statuses() {
    return this.#definition.migration?.statuses || [];
  }

  get waves() {
    return this.#definition.migration?.waves || [];
  }

  get migrationManifest() {
    return this.#definition.migrationManifest || {};
  }

  get observationContract() {
    return this.migrationManifest.observationContract || {};
  }

  get classificationContract() {
    return this.migrationManifest.classificationContract || {};
  }

  get architectureGuards() {
    return this.#definition.architectureGuards || {};
  }

  get exceptions() {
    return this.#definition.exceptions || {};
  }

  getBoundary(boundaryId) {
    return this.#boundariesById.get(boundaryId) || null;
  }

  resolveBoundary(currentPath) {
    const normalizedPath = currentPath.replaceAll("\\", "/");
    let bestMatch = null;
    for (const boundary of this.boundaries) {
      for (const prefix of boundary.pathPrefixes || []) {
        if (!normalizedPath.startsWith(prefix)) continue;
        if (!bestMatch || prefix.length > bestMatch.prefix.length) {
          bestMatch = { boundary, prefix };
        }
      }
    }
    return bestMatch?.boundary || null;
  }
}

module.exports = { ArchitecturePolicy };
