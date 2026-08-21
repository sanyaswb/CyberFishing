class ClassificationEvidenceBuilder {
  constructor({ manifest, graph, reverseConsumerIndex }) {
    this.manifest = manifest;
    this.graph = graph;
    this.reverseConsumerIndex = reverseConsumerIndex;
  }

  build() {
    const modules = this.#readModules();
    const graphNodes = this.graph.nodes();
    const modulePaths = modules.map((entry) => entry.currentPath);
    if (JSON.stringify(graphNodes) !== JSON.stringify(modulePaths)) {
      throw new Error(
        "Classification evidence requires manifest and graph node equality",
      );
    }
    const outgoingBySource = new Map(
      modulePaths.map((currentPath) => [currentPath, []]),
    );
    for (const edge of this.graph.edges()) {
      const outgoing = outgoingBySource.get(edge.source);
      if (!outgoing) {
        throw new Error(
          `Classification evidence contains unknown graph source: ${edge.source}`,
        );
      }
      outgoing.push(this.#clone(edge));
    }
    return modules.map((entry) => this.#buildEntry(
      entry,
      outgoingBySource.get(entry.currentPath),
      this.reverseConsumerIndex.consumersOf(entry.currentPath),
    ));
  }

  #buildEntry(entry, outgoing, incoming) {
    const providers = this.#requireGroup(entry.observed?.providers, {
      path: entry.currentPath,
      name: "providers",
      collections: ["items", "issues"],
    });
    const consumers = this.#requireGroup(entry.observed?.consumers, {
      path: entry.currentPath,
      name: "consumers",
      collections: ["items", "issues"],
    });
    const environment = this.#requireGroup(entry.observed?.environment, {
      path: entry.currentPath,
      name: "environment",
      collections: [
        "builtins",
        "browserApis",
        "dynamicConstructs",
        "issues",
      ],
    });
    const dependencies = this.#requireGroup(entry.analysis?.dependencies, {
      path: entry.currentPath,
      name: "dependencies",
      collections: [
        "confirmed",
        "items",
        "unresolved",
        "ambiguous",
        "issues",
      ],
    });
    const architecture = entry.architecture;
    const blockers = entry.analysis?.blockers;
    if (!architecture || typeof architecture !== "object") {
      throw new Error(
        `${entry.currentPath}: classification evidence requires architecture`,
      );
    }
    if (!blockers || typeof blockers !== "object") {
      throw new Error(
        `${entry.currentPath}: classification evidence requires blockers`,
      );
    }

    return {
      currentPath: entry.currentPath,
      decision: {
        migrationStatus: architecture.migrationStatus,
        targetBoundary: architecture.targetBoundary,
        targetPath: architecture.targetPath,
        roles: this.#clone(architecture.roles),
        migrationWave: architecture.migrationWave,
        blockers: this.#clone(blockers),
      },
      observations: {
        legacyLoadOrder: entry.observed.legacyLoadOrder,
        providers: this.#clone(providers),
        consumers: this.#clone(consumers),
        environment: this.#clone(environment),
      },
      dependencies: {
        status: dependencies.status,
        confirmed: this.#clone(dependencies.confirmed),
        outgoing: this.#clone(outgoing),
        incoming: this.#clone(incoming),
        unresolved: this.#clone(dependencies.unresolved),
        ambiguous: this.#clone(dependencies.ambiguous),
        issues: this.#clone(dependencies.issues),
      },
      metrics: {
        providerCount: providers.items.length,
        consumerCount: consumers.items.length,
        confirmedCount: dependencies.confirmed.length,
        outgoingEdgeCount: outgoing.length,
        incomingEdgeCount: incoming.length,
        unresolvedCount: dependencies.unresolved.length,
        ambiguousCount: dependencies.ambiguous.length,
        builtinCount: environment.builtins.length,
        browserApiCount: environment.browserApis.length,
        dynamicConstructCount: environment.dynamicConstructs.length,
        observationIssueCount:
          providers.issues.length +
          consumers.issues.length +
          environment.issues.length,
        dependencyIssueCount: dependencies.issues.length,
      },
    };
  }

  #readModules() {
    if (!Array.isArray(this.manifest?.modules)) {
      throw new Error("Classification evidence requires manifest modules");
    }
    return this.manifest.modules;
  }

  #requireGroup(value, { path, name, collections }) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`${path}: classification evidence requires ${name}`);
    }
    for (const collection of collections) {
      if (!Array.isArray(value[collection])) {
        throw new Error(
          `${path}: classification evidence requires ${name}.${collection}`,
        );
      }
    }
    return value;
  }

  #clone(value) {
    return JSON.parse(JSON.stringify(value));
  }
}

module.exports = { ClassificationEvidenceBuilder };
